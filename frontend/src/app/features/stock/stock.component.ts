import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MoneyPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { InventoryValuation, StockMovement, VariantSearchResult } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">{{ 'stock.title' | t }}</h1>
      <div class="btn-row">
        <input class="input" style="width:250px" [(ngModel)]="variantQuery"
               (input)="searchVariants()" [placeholder]="'common.search' | t">
        <button class="btn primary" [disabled]="!selected" (click)="openCount()">
          <mat-icon>fact_check</mat-icon> {{ 'stock.inventoryCount' | t }}
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Inventory count panel -->
      @if (counting) {
        <div class="card">
          <h3 class="card-title">{{ 'stock.inventoryCount' | t }}</h3>
          <div class="form-grid">
            <div class="field">
              <label class="field-label">{{ 'stock.variant' | t }}</label>
              <input class="input" [value]="selectedLabel()" disabled>
            </div>
            <div class="field">
              <label class="field-label">{{ 'stock.expected' | t }}</label>
              <input class="input" [value]="expected()" disabled>
            </div>
            <div class="field">
              <label class="field-label">{{ 'stock.countedQuantity' | t }}</label>
              <input class="input" type="number" [(ngModel)]="countedQuantity" name="counted">
            </div>
            <div class="field">
              <label class="field-label">{{ 'stock.difference' | t }}</label>
              <input class="input" [value]="difference()" disabled>
            </div>
            <div class="field">
              <label class="field-label">{{ 'stock.reason' | t }}</label>
              <select class="select" [(ngModel)]="countReason" name="reason">
                <option value="inventory">{{ 'stock.type.inventory' | t }}</option>
                <option value="damage">{{ 'stock.type.adjustment' | t }} — damage</option>
                <option value="loss">{{ 'stock.type.adjustment' | t }} — loss</option>
                <option value="correction">{{ 'stock.type.adjustment' | t }} — correction</option>
              </select>
            </div>
          </div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn primary" (click)="applyCount()">
              <mat-icon>check</mat-icon> {{ 'stock.apply' | t }}
            </button>
            <button class="btn" (click)="counting = false">{{ 'common.cancel' | t }}</button>
          </div>
        </div>
      }

      <!-- Variant picker results -->
      @if (variantQuery && variantResults().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'common.product' | t }}</th>
                  <th>{{ 'common.color' | t }}</th>
                  <th>{{ 'common.size' | t }}</th>
                  <th class="num">{{ 'products.stock' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (v of variantResults(); track v.id) {
                  <tr>
                    <td class="strong">{{ v.product_name }}</td>
                    <td>{{ v.color_name || '—' }}</td>
                    <td>{{ v.size_name || '—' }}</td>
                    <td class="num">{{ v.stock_quantity }}</td>
                    <td class="num">
                      <button class="btn sm" (click)="select(v)">{{ 'common.confirm' | t }}</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Valuation (owner only) -->
      @if (valuation(); as val) {
        <div class="grid grid-3" style="margin-top:16px">
          <div class="stat">
            <div class="stat-label">{{ 'stock.costValue' | t }}</div>
            <div class="stat-value">{{ val.total_cost_value | money }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ 'stock.retailValue' | t }}</div>
            <div class="stat-value">{{ val.total_retail_value | money }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">{{ 'stock.potentialProfit' | t }}</div>
            <div class="stat-value positive">{{ val.potential_profit | money }}</div>
          </div>
        </div>
      }

      <div class="card" style="margin-top:16px">
        <h3 class="card-title">{{ 'stock.movements' | t }}</h3>
        @if (movements().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'common.date' | t }}</th>
                  <th>{{ 'common.product' | t }}</th>
                  <th>{{ 'stock.variant' | t }}</th>
                  <th>{{ 'stock.type.inventory' | t }}</th>
                  <th class="num">{{ 'stock.before' | t }}</th>
                  <th class="num">{{ 'stock.change' | t }}</th>
                  <th class="num">{{ 'stock.after' | t }}</th>
                  <th>{{ 'common.employee' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movements(); track m.id) {
                  <tr>
                    <td class="nowrap small">{{ m.created_at | date: 'dd.MM.yyyy HH:mm' }}</td>
                    <td class="strong">{{ m.product_name }}</td>
                    <td class="small">
                      {{ m.color_name || '—' }} / {{ m.size_name || '—' }}
                    </td>
                    <td>
                      <span class="badge" [class.success]="m.movement_type === 'purchase'"
                            [class.danger]="m.movement_type === 'sale'"
                            [class.warn]="m.movement_type === 'adjustment'">
                        {{ ('stock.type.' + m.movement_type) | t }}
                      </span>
                    </td>
                    <td class="num">{{ m.quantity_before }}</td>
                    <td class="num strong"
                        [class.positive]="m.quantity_change > 0"
                        [class.negative]="m.quantity_change < 0">
                      {{ m.quantity_change > 0 ? '+' : '' }}{{ m.quantity_change }}
                    </td>
                    <td class="num">{{ m.quantity_after }}</td>
                    <td class="small muted">{{ m.created_by_name || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty">{{ 'common.noData' | t }}</div>
        }
      </div>
    </div>
  `,
})
export class StockComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private auth = inject(AuthService);

  movements = signal<StockMovement[]>([]);
  variantResults = signal<VariantSearchResult[]>([]);
  valuation = signal<InventoryValuation | null>(null);

  variantQuery = '';
  counting = false;
  selected: VariantSearchResult | null = null;
  countedQuantity: number | null = null;
  countReason = 'inventory';

  private timer: any = null;

  ngOnInit() {
    this.loadMovements();
    if (this.auth.canViewFinancials()) {
      this.api.getInventoryValuation().subscribe(v => this.valuation.set(v));
    }
  }

  loadMovements() {
    this.api.getMovements({ page_size: 50 }).subscribe(r => this.movements.set(r.results));
  }

  searchVariants() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const q = this.variantQuery.trim();
      if (!q) { this.variantResults.set([]); return; }
      this.api.searchVariants(q, 10).subscribe(r => this.variantResults.set(r));
    }, 220);
  }

  select(variant: VariantSearchResult) {
    this.selected = variant;
    this.countedQuantity = variant.stock_quantity;
    this.variantResults.set([]);
    this.variantQuery = '';
  }

  selectedLabel(): string {
    if (!this.selected) return '';
    return `${this.selected.product_name} — ${this.selected.color_name || '—'} / ${this.selected.size_name || '—'}`;
  }

  expected(): number {
    return this.selected?.stock_quantity ?? 0;
  }

  difference(): number {
    return Number(this.countedQuantity ?? 0) - this.expected();
  }

  openCount() {
    if (!this.selected) return;
    this.countedQuantity = this.selected.stock_quantity;
    this.counting = true;
  }

  applyCount() {
    if (!this.selected || this.countedQuantity === null) return;
    this.api.adjustStock({
      product_variant: this.selected.id,
      mode: 'counted',
      quantity: Number(this.countedQuantity),
      reason: this.countReason,
    }).subscribe({
      next: () => {
        this.counting = false;
        this.toast.success(this.i18n.t('common.saved'));
        this.selected = null;
        this.loadMovements();
      },
      error: err => this.toast.error(err.error?.detail || this.i18n.t('common.error')),
    });
  }
}
