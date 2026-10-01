import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MoneyPipe, TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { Sale } from '../../../core/models/models';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">
        {{ 'sales.detail' | t }}
        @if (sale(); as s) { <span class="muted">№{{ s.sale_number }}</span> }
      </h1>
      <div class="btn-row">
        <a class="btn" routerLink="/sales">{{ 'common.back' | t }}</a>
        @if (sale(); as s) {
          <button class="btn primary" (click)="printReceipt(s.id)">
            <mat-icon>print</mat-icon> {{ 'common.print' | t }}
          </button>
          @if (auth.isManager() && s.status !== 'refunded' && s.status !== 'cancelled') {
            <button class="btn" (click)="showReturn = !showReturn">
              <mat-icon>assignment_return</mat-icon> {{ 'sales.return' | t }}
            </button>
          }
          @if (auth.isOwner() && s.status !== 'cancelled') {
            <button class="btn danger" (click)="cancelSale(s.id)">
              <mat-icon>cancel</mat-icon> {{ 'sales.cancel' | t }}
            </button>
          }
        }
      </div>
    </div>

    <div class="page-body">
      @if (sale(); as s) {
        <div class="grid grid-2">
          <div class="card">
            <h3 class="card-title">{{ 'common.total' | t }}</h3>
            <div class="kv"><span class="muted">{{ 'sales.cashier' | t }}</span>
              <b>{{ s.cashier_name }}</b></div>
            <div class="kv"><span class="muted">{{ 'common.date' | t }}</span>
              <b>{{ s.created_at | date: 'dd.MM.yyyy HH:mm' }}</b></div>
            <div class="kv"><span class="muted">{{ 'common.customer' | t }}</span>
              <b>{{ s.customer_name || '—' }}</b></div>
            <div class="kv"><span class="muted">{{ 'sales.paymentMethod' | t }}</span>
              <span class="badge info">{{ ('payment.' + s.payment_method) | t }}</span></div>
            <div class="kv"><span class="muted">{{ 'common.status' | t }}</span>
              <span class="badge"
                    [class.success]="s.status === 'completed'"
                    [class.danger]="s.status === 'refunded' || s.status === 'cancelled'">
                {{ ('sales.status.' + s.status) | t }}
              </span></div>
          </div>

          <div class="card">
            <h3 class="card-title">{{ 'common.total' | t }}</h3>
            <div class="kv"><span class="muted">{{ 'common.total' | t }}</span>
              <b class="big">{{ s.total_amount | money }}</b></div>
            <div class="kv"><span class="muted">{{ 'dashboard.cash' | t }}</span>
              <span>{{ s.cash_amount | money }}</span></div>
            <div class="kv"><span class="muted">{{ 'dashboard.card' | t }}</span>
              <span>{{ s.card_amount | money }}</span></div>
            <div class="kv"><span class="muted">{{ 'sales.received' | t }}</span>
              <span>{{ s.received_amount | money }}</span></div>
            <div class="kv"><span class="muted">{{ 'sales.change' | t }}</span>
              <b>{{ s.change_amount | money }}</b></div>
            @if (s.profit != null) {
              <div class="kv" style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
                <span class="muted">{{ 'profit.grossProfit' | t }}</span>
                <b class="positive">{{ s.profit | money }}</b>
              </div>
            }
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <h3 class="card-title">{{ 'sales.itemsCount' | t }}</h3>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'common.product' | t }}</th>
                  <th>{{ 'common.color' | t }}</th>
                  <th>{{ 'common.size' | t }}</th>
                  <th class="num">{{ 'common.quantity' | t }}</th>
                  <th class="num">{{ 'common.price' | t }}</th>
                  <th class="num">{{ 'common.sum' | t }}</th>
                  <th class="num">{{ 'sales.returnedQty' | t }}</th>
                  @if (showReturn) { <th></th> }
                </tr>
              </thead>
              <tbody>
                @for (item of s.items; track item.id) {
                  <tr>
                    <td class="strong">{{ item.product_name }}</td>
                    <td>{{ item.color_name || '—' }}</td>
                    <td>{{ item.size_name || '—' }}</td>
                    <td class="num">{{ item.quantity }}</td>
                    <td class="num">{{ item.unit_price | money }}</td>
                    <td class="num strong">{{ item.total_price | money }}</td>
                    <td class="num">{{ item.returned_quantity }}</td>
                    @if (showReturn) {
                      <td class="num">
                        <input class="input" style="width:80px;text-align:right" type="number"
                               min="0" [max]="item.quantity - item.returned_quantity"
                               [name]="'r' + item.id" [(ngModel)]="returnQty[item.id]"
                               [disabled]="item.returned_quantity >= item.quantity">
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (showReturn) {
            <div class="return-box">
              <div class="field">
                <label class="field-label">{{ 'sales.returnReason' | t }}</label>
                <select class="select" [(ngModel)]="returnReason" name="reason">
                  <option value="size">{{ 'sales.reason.size' | t }}</option>
                  <option value="defect">{{ 'sales.reason.defect' | t }}</option>
                  <option value="change_mind">{{ 'sales.reason.change_mind' | t }}</option>
                  <option value="other">{{ 'sales.reason.other' | t }}</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">{{ 'finance.comment' | t }}</label>
                <input class="input" [(ngModel)]="returnNotes" name="notes">
              </div>
              <button class="btn primary" (click)="submitReturn(s.id)">
                <mat-icon>assignment_return</mat-icon> {{ 'common.confirm' | t }}
              </button>
            </div>
          }
        </div>

        @if (s.returns.length) {
          <div class="card" style="margin-top:16px">
            <h3 class="card-title">{{ 'sales.returned' | t }}</h3>
            @for (ret of s.returns; track ret.id) {
              <div class="return-row">
                <div>
                  <span class="badge warn">{{ ('sales.reason.' + ret.reason) | t }}</span>
                  <span class="small muted" style="margin-left:8px">
                    {{ ret.created_at | date: 'dd.MM.yyyy HH:mm' }} ·
                    {{ ret.created_by_name || '—' }}
                  </span>
                </div>
                <b>{{ ret.total_amount | money }}</b>
                <div class="small muted">
                  @for (line of ret.items; track line.id) {
                    <span>{{ line.product_name }} ×{{ line.quantity }}</span>
                    @if (!$last) { <span>, </span> }
                  }
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .kv {
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 0; border-bottom: 1px solid var(--border); font-size: 13.5px;
      &:last-child { border-bottom: none; }
    }
    .big { font-size: 19px; color: var(--primary); }
    .return-box {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px; align-items: end; margin-top: 14px; padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .return-row {
      display: grid; gap: 6px; padding: 12px 0; border-bottom: 1px solid var(--border);
      font-size: 13px;
      &:last-child { border-bottom: none; }
    }
  `],
})
export class SaleDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private i18n = inject(TranslationService);
  auth = inject(AuthService);

  sale = signal<Sale | null>(null);
  showReturn = false;
  returnQty: Record<number, number> = {};
  returnReason = 'size';
  returnNotes = '';

  private saleId = 0;

  ngOnInit() {
    this.saleId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load() {
    this.api.getSale(this.saleId).subscribe(sale => {
      this.sale.set(sale);
      this.returnQty = {};
      (sale.items ?? []).forEach(item => (this.returnQty[item.id] = 0));
    });
  }

  printReceipt(id: number) {
    window.open(this.api.getReceiptPdfUrl(id, this.i18n.lang()), '_blank');
  }

  submitReturn(saleId: number) {
    const items = Object.entries(this.returnQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({ sale_item: Number(id), quantity: Number(qty) }));

    if (!items.length) {
      this.toast.warn(this.i18n.t('sales.noReturnItems'));
      return;
    }

    this.api.returnItems(saleId, {
      reason: this.returnReason,
      notes: this.returnNotes,
      items,
    }).subscribe({
      next: () => {
        this.showReturn = false;
        this.returnNotes = '';
        this.toast.success(this.i18n.t('sales.returnDone'));
        this.load();
      },
      error: err => this.toast.error(err.error?.detail || this.i18n.t('common.error')),
    });
  }

  async cancelSale(saleId: number) {
    const approved = await this.confirm.confirm({
      title: this.i18n.t('sales.cancel'),
      message: this.i18n.t('sales.cancelConfirm'),
      confirmLabel: this.i18n.t('sales.cancel'),
      danger: true,
    });
    if (!approved) return;

    this.api.cancelSale(saleId).subscribe({
      next: () => { this.toast.success(this.i18n.t('common.saved')); this.load(); },
      error: err => this.toast.error(err.error?.detail || this.i18n.t('common.error')),
    });
  }
}
