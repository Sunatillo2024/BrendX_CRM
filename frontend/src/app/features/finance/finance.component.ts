import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MoneyPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { FinanceEntry, FinanceEntryType } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';

type PeriodKey = 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ 'finance.title' | t }}</h1>
      </div>
      <div class="toolbar">
        <div class="period-bar">
          @for (p of periods; track p) {
            <button class="period-btn" [class.active]="period === p" (click)="setPeriod(p)">
              {{ ('common.' + p) | t }}
            </button>
          }
          @if (period === 'custom') {
            <input class="input" style="width:150px" type="date" [(ngModel)]="dateFrom"
                   (change)="load()">
            <input class="input" style="width:150px" type="date" [(ngModel)]="dateTo"
                   (change)="load()">
          }
        </div>
        @if (auth.isManager()) {
          <button class="btn primary" (click)="openCreate()">
            <mat-icon>add</mat-icon> {{ 'finance.new' | t }}
          </button>
        }
      </div>
    </div>

    <div class="page-body">
      <div class="grid grid-3">
        <div class="stat">
          <div class="stat-row">
            <div class="stat-icon success"><mat-icon>arrow_downward</mat-icon></div>
          </div>
          <div class="stat-label mt-12">{{ 'finance.totalIncome' | t }}</div>
          <div class="stat-value positive">{{ summary()?.income | money }}</div>
        </div>
        <div class="stat">
          <div class="stat-row">
            <div class="stat-icon danger"><mat-icon>arrow_upward</mat-icon></div>
          </div>
          <div class="stat-label mt-12">{{ 'finance.totalExpense' | t }}</div>
          <div class="stat-value negative">{{ summary()?.expense | money }}</div>
        </div>
        <div class="stat">
          <div class="stat-row">
            <div class="stat-icon"><mat-icon>balance</mat-icon></div>
          </div>
          <div class="stat-label mt-12">{{ 'finance.balance' | t }}</div>
          <div class="stat-value">{{ (summary()?.income ?? 0) - (summary()?.expense ?? 0) | money }}</div>
        </div>
      </div>

      @if (summary()?.financial; as fin) {
        <div class="card mt-16">
          <div class="section-title mb-12"><mat-icon>insights</mat-icon> {{ 'profit.title' | t }}</div>
          <div class="grid grid-4">
            <div class="stat">
              <div class="stat-label">{{ 'dashboard.revenue' | t }}</div>
              <div class="stat-value">{{ fin.net_revenue | money }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">{{ 'profit.grossProfit' | t }}</div>
              <div class="stat-value positive">{{ fin.gross_profit | money }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">{{ 'profit.expenses' | t }}</div>
              <div class="stat-value negative">{{ fin.expenses | money }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">{{ 'profit.netProfit' | t }}</div>
              <div class="stat-value" [class.positive]="fin.net_profit >= 0"
                   [class.negative]="fin.net_profit < 0">{{ fin.net_profit | money }}</div>
            </div>
          </div>
        </div>
      }

      <div class="card pad-0 mt-16">
        @if (entries().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'finance.entryDate' | t }}</th>
                  <th>{{ 'finance.type' | t }}</th>
                  <th>{{ 'common.category' | t }}</th>
                  <th>{{ 'finance.comment' | t }}</th>
                  <th class="num">{{ 'finance.amount' | t }}</th>
                  <th>{{ 'finance.createdBy' | t }}</th>
                  @if (auth.isManager()) { <th class="actions"></th> }
                </tr>
              </thead>
              <tbody>
                @for (entry of entries(); track entry.id) {
                  <tr>
                    <td class="nowrap small">{{ entry.entry_date }}</td>
                    <td>
                      <span class="badge" [class.success]="entry.entry_type === 'income'"
                            [class.danger]="entry.entry_type === 'expense'">
                        <span class="dot"></span>
                        {{ ('finance.' + entry.entry_type) | t }}
                      </span>
                    </td>
                    <td class="strong">{{ entry.category || '—' }}</td>
                    <td class="muted small">{{ entry.comment || '—' }}</td>
                    <td class="num strong"
                        [class.positive]="entry.entry_type === 'income'"
                        [class.negative]="entry.entry_type === 'expense'">
                      {{ entry.amount | money }}
                    </td>
                    <td class="small muted">{{ entry.created_by_name || '—' }}</td>
                    @if (auth.isManager()) {
                      <td class="actions">
                        <button class="icon-btn" (click)="remove(entry)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-state">
            <mat-icon>account_balance_wallet</mat-icon>
            <h4>{{ 'finance.emptyTitle' | t }}</h4>
            <p>{{ 'finance.emptyHint' | t }}</p>
          </div>
        }
      </div>
    </div>

    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="modalOpen.set(false)">
        <div class="modal" style="max-width:480px" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ 'finance.new' | t }}</h3>
            <button class="icon-btn" (click)="modalOpen.set(false)"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label class="field-label">{{ 'finance.type' | t }}</label>
                <select class="select" [(ngModel)]="form.entry_type" name="type">
                  <option value="expense">{{ 'finance.expense' | t }}</option>
                  <option value="income">{{ 'finance.income' | t }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">{{ 'finance.amount' | t }} *</label>
                <input class="input" type="number" min="0" [(ngModel)]="form.amount" name="amount">
              </div>
              <div class="field">
                <label class="field-label">{{ 'common.category' | t }}</label>
                <input class="input" [(ngModel)]="form.category" name="category"
                       [placeholder]="'finance.hint' | t">
              </div>
              <div class="field">
                <label class="field-label">{{ 'finance.entryDate' | t }}</label>
                <input class="input" type="date" [(ngModel)]="form.entry_date" name="date">
              </div>
            </div>
            <div class="field mt-12">
              <label class="field-label">{{ 'finance.comment' | t }}</label>
              <textarea class="textarea" [(ngModel)]="form.comment" name="comment"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="modalOpen.set(false)">{{ 'common.cancel' | t }}</button>
            <button class="btn primary" [disabled]="!form.amount || saving()" (click)="save()">
              {{ saving() ? ('common.loading' | t) : ('common.save' | t) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FinanceComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private i18n = inject(TranslationService);
  auth = inject(AuthService);

  readonly periods: PeriodKey[] = ['today', 'week', 'month', 'custom'];
  period: PeriodKey = 'month';
  dateFrom = new Date().toISOString().slice(0, 10);
  dateTo = new Date().toISOString().slice(0, 10);

  entries = signal<FinanceEntry[]>([]);
  summary = signal<any>(null);
  modalOpen = signal(false);
  saving = signal(false);

  form: { entry_type: FinanceEntryType; amount: number | null; category: string; comment: string; entry_date: string } = {
    entry_type: 'expense',
    amount: null,
    category: '',
    comment: '',
    entry_date: new Date().toISOString().slice(0, 10),
  };

  ngOnInit() {
    this.load();
  }

  setPeriod(period: PeriodKey) {
    this.period = period;
    this.load();
  }

  private params(): Record<string, any> {
    const params: Record<string, any> = { period: this.period, page_size: 50 };
    if (this.period === 'custom') {
      params['date_from'] = this.dateFrom;
      params['date_to'] = this.dateTo;
    }
    return params;
  }

  load() {
    this.api.getFinanceEntries(this.params()).subscribe(r => this.entries.set(r.results));
    this.api.getFinanceSummary(this.params()).subscribe(r => this.summary.set(r));
  }

  openCreate() {
    this.form = {
      entry_type: 'expense', amount: null, category: '', comment: '',
      entry_date: new Date().toISOString().slice(0, 10),
    };
    this.modalOpen.set(true);
  }

  save() {
    if (!this.form.amount) return;
    this.saving.set(true);
    this.api.createFinanceEntry({
      entry_type: this.form.entry_type,
      amount: Number(this.form.amount),
      category: this.form.category,
      comment: this.form.comment,
      entry_date: this.form.entry_date,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t('common.saved'));
        this.modalOpen.set(false);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.i18n.t('common.error'));
      },
    });
  }

  async remove(entry: FinanceEntry) {
    const approved = await this.confirm.confirm({
      title: this.i18n.t('finance.deleteTitle'),
      message: `${entry.category || ''} · ${entry.amount}`,
      confirmLabel: this.i18n.t('common.delete'),
      danger: true,
    });
    if (!approved) return;

    this.api.deleteFinanceEntry(entry.id).subscribe({
      next: () => { this.toast.success(this.i18n.t('common.deleted')); this.load(); },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }
}
