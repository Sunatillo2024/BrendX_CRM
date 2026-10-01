import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MoneyPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { ReportSummary } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface ExportKind { key: string; label: string; roles: string[]; }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">{{ 'reports.title' | t }}</h1>
      <div class="period-bar">
        <input class="input" style="width:155px" type="date" [(ngModel)]="dateFrom"
               (change)="load()">
        <input class="input" style="width:155px" type="date" [(ngModel)]="dateTo"
               (change)="load()">
        <button class="period-btn" [class.active]="preset === 'month'" (click)="setMonth()">
          {{ 'common.month' | t }}
        </button>
        <button class="period-btn" [class.active]="preset === 'today'" (click)="setToday()">
          {{ 'common.today' | t }}
        </button>
      </div>
    </div>

    <div class="page-body">
      @if (summary(); as s) {
        <div class="grid grid-4">
          <div class="stat">
            <div class="stat-label">{{ 'dashboard.revenue' | t }}</div>
            <div class="stat-value accent">{{ s.operational.revenue | money }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ 'dashboard.salesCount' | t }}</div>
            <div class="stat-value">{{ s.operational.sales_count }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ 'dashboard.unitsSold' | t }}</div>
            <div class="stat-value">{{ s.operational.units_sold }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ 'dashboard.averageCheck' | t }}</div>
            <div class="stat-value">{{ s.operational.average_check | money }}</div>
          </div>
        </div>

        @if (s.financial; as fin) {
          <div class="card" style="margin-top:16px">
            <h3 class="card-title">{{ 'reports.financial' | t }}</h3>
            <div class="grid grid-3">
              <div class="stat">
                <div class="stat-label">{{ 'profit.cost' | t }}</div>
                <div class="stat-value">{{ fin.cost_of_goods | money }}</div>
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

        @if (s.top_products.length) {
          <div class="card" style="margin-top:16px">
            <h3 class="card-title">{{ 'dashboard.topProducts' | t }}</h3>
            <table class="data">
              <tbody>
                @for (p of s.top_products; track p.product_name) {
                  <tr>
                    <td>{{ p.product_name }}</td>
                    <td class="num strong">{{ p.units }}</td>
                    <td class="num">{{ p.revenue | money }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <div class="card" style="margin-top:16px">
        <h3 class="card-title">{{ 'common.export' | t }}</h3>
        <p class="small muted" style="margin-top:0">{{ 'reports.choosePeriod' | t }}</p>
        <div class="export-grid">
          @for (kind of exports; track kind.key) {
            @if (allowed(kind)) {
              <div class="export-row">
                <span class="strong">{{ kind.label | t }}</span>
                <div class="btn-row">
                  <button class="btn sm" (click)="download(kind.key, 'xlsx')">
                    <mat-icon>grid_on</mat-icon> {{ 'common.excel' | t }}
                  </button>
                  <button class="btn sm" (click)="download(kind.key, 'csv')">
                    <mat-icon>description</mat-icon> {{ 'common.csv' | t }}
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .export-grid { display: grid; gap: 10px; }
    .export-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap;
      &:last-child { border-bottom: none; }
    }
  `],
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  private i18n = inject(TranslationService);
  private auth = inject(AuthService);

  readonly exports: ExportKind[] = [
    { key: 'sales', label: 'reports.sales', roles: ['owner', 'manager'] },
    { key: 'stock', label: 'reports.stock', roles: ['owner', 'manager'] },
    { key: 'receipts', label: 'reports.receipts', roles: ['owner', 'manager'] },
    { key: 'finance', label: 'reports.finance', roles: ['owner', 'manager'] },
    { key: 'financial-summary', label: 'reports.financial', roles: ['owner'] },
  ];

  dateFrom = '';
  dateTo = '';
  preset: 'today' | 'month' | 'custom' = 'month';

  summary = signal<ReportSummary | null>(null);

  ngOnInit() {
    this.setMonth();
  }

  setToday() {
    const today = new Date().toISOString().slice(0, 10);
    this.dateFrom = today;
    this.dateTo = today;
    this.preset = 'today';
    this.load();
  }

  setMonth() {
    const now = new Date();
    this.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().slice(0, 10);
    this.dateTo = now.toISOString().slice(0, 10);
    this.preset = 'month';
    this.load();
  }

  private params(): Record<string, string> {
    return { date_from: this.dateFrom, date_to: this.dateTo, period: 'custom' };
  }

  load() {
    this.api.getReportSummary(this.params()).subscribe(r => this.summary.set(r));
  }

  allowed(kind: ExportKind): boolean {
    return kind.roles.includes(this.auth.role() ?? '');
  }

  download(kind: string, fmt: 'xlsx' | 'csv') {
    this.api.downloadExport(kind, this.params(), fmt, this.i18n.lang())
      .subscribe(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${kind}_${this.dateFrom}_${this.dateTo}.${fmt}`;
        link.click();
        URL.revokeObjectURL(url);
      });
  }
}
