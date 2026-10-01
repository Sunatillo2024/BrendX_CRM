import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { MoneyPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  DashboardPayload, FinanceEntry, OperationalStats, SaleListItem,
} from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ 'dashboard.title' | t }}</h1>
        <div class="page-sub">{{ auth.displayName() }} · {{ ('role.' + auth.role()) | t }}</div>
      </div>
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
    </div>

    <div class="page-body">
      @if (loading() && !data()) {
        <div class="grid grid-4">
          @for (i of [1,2,3,4]; track i) { <div class="skeleton skeleton-card"></div> }
        </div>
      }

      @if (data(); as d) {
        <!-- Cashier: personal shift -->
        @if (d.my_sales) {
          <div class="grid grid-2">
            <div class="stat">
              <div class="stat-row">
                <div class="stat-icon"><mat-icon>point_of_sale</mat-icon></div>
              </div>
              <div class="stat-label mt-12">{{ 'dashboard.mySales' | t }}</div>
              <div class="stat-value">{{ d.my_sales.sales_count }}</div>
            </div>
            <div class="stat">
              <div class="stat-row">
                <div class="stat-icon success"><mat-icon>payments</mat-icon></div>
              </div>
              <div class="stat-label mt-12">{{ 'dashboard.myRevenue' | t }}</div>
              <div class="stat-value positive">{{ d.my_sales.revenue | money }}</div>
            </div>
          </div>
        }

        @if (d.operational; as ops) {
          <div class="grid grid-4">
            <div class="stat">
              <div class="stat-row">
                <div class="stat-icon"><mat-icon>trending_up</mat-icon></div>
                @if (trendRevenue(); as tr) {
                  <span class="trend" [class.up]="tr >= 0" [class.down]="tr < 0">
                    <mat-icon style="font-size:15px">{{ tr >= 0 ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                    {{ tr | number: '1.0-1' }}%
                  </span>
                }
              </div>
              <div class="stat-label mt-12">{{ 'dashboard.revenue' | t }}</div>
              <div class="stat-value accent">{{ ops.revenue | money }}</div>
              @if (ops.returns_total > 0) {
                <div class="stat-sub">{{ 'dashboard.returns' | t }}: -{{ ops.returns_total | money }}</div>
              }
            </div>

            <div class="stat">
              <div class="stat-row">
                <div class="stat-icon info"><mat-icon>receipt_long</mat-icon></div>
                @if (trendSales(); as ts) {
                  <span class="trend" [class.up]="ts >= 0" [class.down]="ts < 0">
                    <mat-icon style="font-size:15px">{{ ts >= 0 ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
                    {{ ts | number: '1.0-1' }}%
                  </span>
                }
              </div>
              <div class="stat-label mt-12">{{ 'dashboard.salesCount' | t }}</div>
              <div class="stat-value">{{ ops.sales_count }}</div>
            </div>

            <div class="stat">
              <div class="stat-row">
                <div class="stat-icon warn"><mat-icon>shopping_bag</mat-icon></div>
              </div>
              <div class="stat-label mt-12">{{ 'dashboard.averageCheck' | t }}</div>
              <div class="stat-value">{{ ops.average_check | money }}</div>
            </div>

            <div class="stat">
              <div class="stat-row">
                <div class="stat-icon success"><mat-icon>inventory_2</mat-icon></div>
              </div>
              <div class="stat-label mt-12">{{ 'dashboard.unitsSold' | t }}</div>
              <div class="stat-value">{{ ops.units_sold }}</div>
            </div>
          </div>

          <!-- Owner-only financial KPIs -->
          @if (d.financial; as fin) {
            <div class="grid grid-3 mt-16">
              <div class="stat">
                <div class="stat-row">
                  <div class="stat-icon success"><mat-icon>savings</mat-icon></div>
                </div>
                <div class="stat-label mt-12">{{ 'profit.grossProfit' | t }}</div>
                <div class="stat-value positive">{{ fin.gross_profit | money }}</div>
                <div class="stat-sub">{{ 'profit.cost' | t }}: {{ fin.cost_of_goods | money }}</div>
              </div>
              <div class="stat">
                <div class="stat-row">
                  <div class="stat-icon danger"><mat-icon>receipt</mat-icon></div>
                </div>
                <div class="stat-label mt-12">{{ 'profit.expenses' | t }}</div>
                <div class="stat-value negative">{{ fin.expenses | money }}</div>
                @if (fin.other_income > 0) {
                  <div class="stat-sub">{{ 'profit.otherIncome' | t }}: +{{ fin.other_income | money }}</div>
                }
              </div>
              <div class="stat">
                <div class="stat-row">
                  <div class="stat-icon" [class.success]="fin.net_profit >= 0"
                       [class.danger]="fin.net_profit < 0">
                    <mat-icon>account_balance</mat-icon>
                  </div>
                </div>
                <div class="stat-label mt-12">{{ 'profit.netProfit' | t }}</div>
                <div class="stat-value" [class.positive]="fin.net_profit >= 0"
                     [class.negative]="fin.net_profit < 0">{{ fin.net_profit | money }}</div>
              </div>
            </div>
          }
        }

        <div class="grid dash-two mt-16">
          <!-- Sales chart -->
          <div class="card">
            <div class="section-head">
              <div class="section-title"><mat-icon>show_chart</mat-icon> {{ 'dashboard.chart' | t }}</div>
            </div>
            @if (d.chart?.length) {
              <div class="bars">
                @for (point of d.chart; track point.date) {
                  <div class="bar-col" [title]="point.date + ': ' + (point.revenue | money)">
                    <div class="bar-track">
                      <div class="bar" [style.height.%]="barHeight(point.revenue)"></div>
                    </div>
                    <span class="bar-label">{{ point.date.slice(5) }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state"><mat-icon>bar_chart</mat-icon>
                <p>{{ 'dashboard.noSales' | t }}</p></div>
            }
          </div>

          <!-- Payment split -->
          <div class="card">
            <div class="section-head">
              <div class="section-title"><mat-icon>donut_small</mat-icon> {{ 'dashboard.payments' | t }}</div>
            </div>
            @if (d.operational; as ops) {
              <div class="split">
                <div class="split-bar">
                  <div class="split-cash" [style.width.%]="cashShare()"></div>
                  <div class="split-card" [style.width.%]="100 - cashShare()"></div>
                </div>
                <div class="split-legend">
                  <div class="legend-item">
                    <span class="dot" style="background:var(--primary)"></span>
                    <div>
                      <div class="small muted">{{ 'dashboard.cash' | t }}</div>
                      <div class="strong">{{ ops.cash_total | money }}</div>
                    </div>
                  </div>
                  <div class="legend-item">
                    <span class="dot" style="background:var(--success)"></span>
                    <div>
                      <div class="small muted">{{ 'dashboard.card' | t }}</div>
                      <div class="strong">{{ ops.card_total | money }}</div>
                    </div>
                  </div>
                </div>
                <div class="divider"></div>
                <div class="between">
                  <span class="muted small">{{ 'dashboard.discountTotal' | t }}</span>
                  <span class="strong small">{{ ops.discount_total | money }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="grid dash-two mt-16">
          <!-- Top products -->
          <div class="card">
            <div class="section-head">
              <div class="section-title"><mat-icon>local_fire_department</mat-icon>
                {{ 'dashboard.topProducts' | t }}</div>
            </div>
            @if (d.top_products?.length) {
              <div class="top-list">
                @for (p of d.top_products; track p.product_name; let i = $index) {
                  <div class="top-row">
                    <span class="rank">{{ i + 1 }}</span>
                    <span class="truncate strong" style="flex:1">{{ p.product_name }}</span>
                    <span class="badge">{{ p.units }} {{ 'pos.pcs' | t }}</span>
                    <span class="strong small" style="min-width:90px;text-align:right">
                      {{ p.revenue | money }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state"><mat-icon>inventory_2</mat-icon>
                <p>{{ 'dashboard.noSales' | t }}</p></div>
            }
          </div>

          <!-- Recent sales -->
          <div class="card">
            <div class="section-head">
              <div class="section-title"><mat-icon>history</mat-icon> {{ 'dashboard.recentSales' | t }}</div>
              <a class="btn sm ghost" routerLink="/sales">{{ 'common.all' | t }}</a>
            </div>
            @if (recentSales().length) {
              <div class="recent-list">
                @for (s of recentSales(); track s.id) {
                  <a class="recent-row" [routerLink]="['/sales', s.id]">
                    <div class="recent-main">
                      <span class="strong">№{{ s.sale_number }}</span>
                      <span class="small muted">{{ s.created_at | date: 'dd.MM HH:mm' }}
                        · {{ s.cashier_name }}</span>
                    </div>
                    <span class="badge info">{{ ('payment.' + s.payment_method) | t }}</span>
                    <span class="strong small">{{ s.total_amount | money }}</span>
                  </a>
                }
              </div>
            } @else {
              <div class="empty-state"><mat-icon>receipt_long</mat-icon>
                <p>{{ 'dashboard.noSales' | t }}</p></div>
            }
          </div>
        </div>

        <div class="grid dash-two mt-16">
          <!-- Low stock -->
          <div class="card">
            <div class="section-head">
              <div class="section-title"><mat-icon>warning_amber</mat-icon> {{ 'dashboard.lowStock' | t }}</div>
              <a class="btn sm ghost" routerLink="/stock">{{ 'common.all' | t }}</a>
            </div>
            @if (d.low_stock?.length) {
              <table class="data">
                <tbody>
                  @for (v of d.low_stock; track v.id) {
                    <tr>
                      <td class="strong">{{ v.product_name }}</td>
                      <td class="muted small">{{ v.color_name || '—' }} / {{ v.size_name || '—' }}</td>
                      <td class="num">
                        <span class="badge" [class.danger]="v.stock_quantity <= 0"
                              [class.warn]="v.stock_quantity > 0">
                          {{ v.stock_quantity }} {{ 'pos.pcs' | t }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="empty-state"><mat-icon>check_circle</mat-icon>
                <p>{{ 'dashboard.noLowStock' | t }}</p></div>
            }
          </div>

          <!-- Recent expenses (owner) -->
          @if (auth.isOwner()) {
            <div class="card">
              <div class="section-head">
                <div class="section-title"><mat-icon>receipt</mat-icon> {{ 'dashboard.recentExpenses' | t }}</div>
                <a class="btn sm ghost" routerLink="/finance">{{ 'common.all' | t }}</a>
              </div>
              @if (recentExpenses().length) {
                <div class="recent-list">
                  @for (e of recentExpenses(); track e.id) {
                    <div class="recent-row">
                      <div class="recent-main">
                        <span class="strong">{{ e.category || ('finance.expense' | t) }}</span>
                        <span class="small muted">{{ e.entry_date }}</span>
                      </div>
                      <span class="strong small negative">-{{ e.amount | money }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-state"><mat-icon>receipt</mat-icon>
                  <p>{{ 'dashboard.noExpenses' | t }}</p></div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .dash-two { grid-template-columns: 1.5fr 1fr; }
    .mt-16 { margin-top: 16px; }
    .split { display: flex; flex-direction: column; gap: 16px; }
    .split-bar {
      display: flex; height: 12px; border-radius: 8px; overflow: hidden;
      background: var(--surface-3);
    }
    .split-cash { background: var(--primary); transition: width 400ms var(--ease); }
    .split-card { background: var(--success); transition: width 400ms var(--ease); }
    .split-legend { display: flex; gap: 24px; }
    .legend-item { display: flex; align-items: flex-start; gap: 9px; }
    .legend-item .dot { margin-top: 5px; }

    .top-list { display: flex; flex-direction: column; }
    .top-row {
      display: flex; align-items: center; gap: 12px; padding: 11px 0;
      border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
    }
    .rank {
      width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0;
      background: var(--surface-3); color: var(--text-2);
      display: flex; align-items: center; justify-content: center;
      font-size: 11.5px; font-weight: 700;
    }

    .recent-list { display: flex; flex-direction: column; }
    .recent-row {
      display: flex; align-items: center; gap: 12px; padding: 11px 2px;
      border-bottom: 1px solid var(--border); text-decoration: none; color: inherit;
      transition: background 140ms; border-radius: 6px;
      &:last-child { border-bottom: none; }
      &:hover { background: var(--surface-2); }
    }
    .recent-main { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 1px; }

    @media (max-width: 1050px) {
      .dash-two { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  readonly periods: PeriodKey[] = ['today', 'yesterday', 'week', 'month', 'custom'];
  period: PeriodKey = 'today';
  dateFrom = '';
  dateTo = '';

  data = signal<DashboardPayload | null>(null);
  loading = signal(true);
  private previous = signal<OperationalStats | null>(null);
  recentSales = signal<SaleListItem[]>([]);
  recentExpenses = signal<FinanceEntry[]>([]);

  readonly trendRevenue = computed(() => this.trend(o => o.revenue));
  readonly trendSales = computed(() => this.trend(o => o.sales_count));

  cashShare = computed(() => {
    const ops = this.data()?.operational;
    if (!ops) return 50;
    const total = Number(ops.cash_total) + Number(ops.card_total);
    return total > 0 ? (Number(ops.cash_total) / total) * 100 : 50;
  });

  ngOnInit() {
    const today = new Date().toISOString().slice(0, 10);
    this.dateFrom = today;
    this.dateTo = today;
    this.load();
  }

  setPeriod(period: PeriodKey) {
    this.period = period;
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: Record<string, string> = { period: this.period };
    if (this.period === 'custom') {
      params['date_from'] = this.dateFrom;
      params['date_to'] = this.dateTo;
    }

    this.api.getDashboard(params).subscribe(res => {
      this.data.set(res);
      this.loading.set(false);
    });

    // Previous-period comparison (only when it can be computed honestly).
    const prev = this.previousParams();
    this.previous.set(null);
    if (prev) {
      this.api.getDashboard(prev).subscribe(res => this.previous.set(res.operational ?? null));
    }

    // Supporting panels.
    if (!this.auth.isCashier()) {
      this.api.getSales({ page_size: 5, ordering: '-created_at' })
        .subscribe(r => this.recentSales.set(r.results));
      if (this.auth.isOwner()) {
        this.api.getFinanceEntries({ page_size: 5, entry_type: 'expense', ordering: '-entry_date' })
          .subscribe(r => this.recentExpenses.set(r.results));
      }
    }
  }

  barHeight(value: number): number {
    const points = this.data()?.chart ?? [];
    const max = Math.max(...points.map(p => Number(p.revenue)), 1);
    return Math.max(4, (Number(value) / max) * 100);
  }

  /** Returns a percentage change vs the previous period, or null when unreliable. */
  private trend(pick: (o: OperationalStats) => number): number | null {
    const prev = this.previous();
    const cur = this.data()?.operational;
    if (!prev || !cur) return null;
    const before = Number(pick(prev));
    const now = Number(pick(cur));
    if (!before) return null;
    return ((now - before) / before) * 100;
  }

  private previousParams(): Record<string, string> | null {
    const shift = (days: number, from: string) => {
      const d = new Date(from + 'T00:00:00');
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    if (this.period === 'today') return { period: 'yesterday' };
    if (this.period === 'yesterday') {
      const day = shift(-1, new Date().toISOString().slice(0, 10));
      return { period: 'custom', date_from: day, date_to: day };
    }
    if (this.period === 'week') {
      const end = shift(-1, this.dateRangeStart());
      const start = shift(-7, end);
      return { period: 'custom', date_from: start, date_to: end };
    }
    if (this.period === 'month') {
      const d = new Date();
      const firstOfPrev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const lastOfPrev = new Date(d.getFullYear(), d.getMonth(), 0);
      return {
        period: 'custom',
        date_from: firstOfPrev.toISOString().slice(0, 10),
        date_to: lastOfPrev.toISOString().slice(0, 10),
      };
    }
    return null;
  }

  private dateRangeStart(): string {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }
}
