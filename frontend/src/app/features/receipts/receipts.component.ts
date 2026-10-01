import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MoneyPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { StockReceipt, VariantSearchResult, Vendor } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/ui/toast.service';

interface ReceiptLine {
  variant: VariantSearchResult;
  quantity: number;
  cost_price: number;
}

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">{{ 'receipts.title' | t }}</h1>
      <div class="btn-row">
        <input class="input" style="width:200px" [(ngModel)]="from" type="date"
               (change)="load()">
        <input class="input" style="width:200px" [(ngModel)]="to" type="date" (change)="load()">
        <button class="btn primary" (click)="openForm()">
          <mat-icon>add</mat-icon> {{ 'receipts.new' | t }}
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Create form -->
      @if (showForm) {
        <div class="card">
          <h3 class="card-title">{{ 'receipts.new' | t }}</h3>
          <div class="form-grid">
            <div class="field">
              <label class="field-label">{{ 'receipts.vendor' | t }}</label>
              <select class="select" [(ngModel)]="vendorId" name="vendor">
                <option [ngValue]="null">—</option>
                @for (v of vendors(); track v.id) {
                  <option [ngValue]="v.id">{{ v.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label">{{ 'common.date' | t }}</label>
              <input class="input" type="date" [(ngModel)]="receiptDate" name="date">
            </div>
            <div class="field">
              <label class="field-label">{{ 'common.add' | t }} {{ 'receipts.vendor' | t }}</label>
              <div style="display:flex;gap:8px">
                <input class="input" [(ngModel)]="newVendor" name="newVendor"
                       [placeholder]="'common.optional' | t">
                <button class="btn sm" (click)="createVendor()">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
            </div>
            <div class="field">
              <label class="field-label">{{ 'products.description' | t }}</label>
              <input class="input" [(ngModel)]="notes" name="notes">
            </div>
          </div>

          <!-- Variant picker -->
          <div class="field" style="margin-top:14px">
            <label class="field-label">{{ 'stock.variant' | t }}</label>
            <input class="input" [(ngModel)]="variantQuery" name="vq" (input)="searchVariants()"
                   [placeholder]="'common.search' | t">
          </div>

          @if (variantResults().length) {
            <div class="picker-list">
              @for (v of variantResults(); track v.id) {
                <button class="picker-row" (click)="addLine(v)">
                  <span class="strong">{{ v.product_name }}</span>
                  <span class="muted small">{{ v.color_name || '—' }} / {{ v.size_name || '—' }}</span>
                  <span class="badge info" style="margin-left:auto">
                    {{ 'pos.stockLeft' | t }}: {{ v.stock_quantity }}
                  </span>
                </button>
              }
            </div>
          }

          @if (lines.length) {
            <div class="table-wrap" style="margin-top:14px">
              <table class="data">
                <thead>
                  <tr>
                    <th>{{ 'common.product' | t }}</th>
                    <th class="num">{{ 'common.quantity' | t }}</th>
                    <th class="num">{{ 'products.costPrice' | t }}</th>
                    <th class="num">{{ 'common.sum' | t }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of lines; track line.variant.id) {
                    <tr>
                      <td>
                        <div class="strong">{{ line.variant.product_name }}</div>
                        <div class="small muted">
                          {{ line.variant.color_name || '—' }} / {{ line.variant.size_name || '—' }}
                        </div>
                      </td>
                      <td class="num">
                        <input class="input" style="width:90px;text-align:right" type="number"
                               min="1" [(ngModel)]="line.quantity" [name]="'q' + line.variant.id">
                      </td>
                      <td class="num">
                        <input class="input" style="width:120px;text-align:right" type="number"
                               min="0" [(ngModel)]="line.cost_price"
                               [name]="'c' + line.variant.id">
                      </td>
                      <td class="num strong">{{ line.quantity * line.cost_price | money }}</td>
                      <td class="num">
                        <button class="btn sm danger" (click)="removeLine(line.variant.id)">
                          <mat-icon>close</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <div class="btn-row" style="margin-top:16px">
            <button class="btn primary" [disabled]="!lines.length || saving" (click)="save()">
              <mat-icon>save</mat-icon> {{ 'common.save' | t }}
            </button>
            <button class="btn" (click)="closeForm()">{{ 'common.cancel' | t }}</button>
          </div>
        </div>
      }

      <!-- Receipt list -->
      <div class="card" style="margin-top:16px">
        @if (receipts().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'receipts.number' | t }}</th>
                  <th>{{ 'common.date' | t }}</th>
                  <th>{{ 'receipts.vendor' | t }}</th>
                  <th class="num">{{ 'receipts.totalQuantity' | t }}</th>
                  <th class="num">{{ 'receipts.totalCost' | t }}</th>
                  <th>{{ 'receipts.createdBy' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (r of receipts(); track r.id) {
                  <tr>
                    <td class="strong">№{{ r.number }}</td>
                    <td>{{ r.receipt_date }}</td>
                    <td>{{ r.vendor_name || '—' }}</td>
                    <td class="num">{{ r.total_quantity }}</td>
                    <td class="num">{{ r.total_cost | money }}</td>
                    <td class="small muted">{{ r.created_by_name || '—' }}</td>
                    <td class="num">
                      <button class="btn sm" (click)="toggleDetail(r)">
                        <mat-icon>visibility</mat-icon>
                      </button>
                    </td>
                  </tr>
                  @if (expandedId === r.id) {
                    <tr>
                      <td colspan="7" style="background:var(--surface-2)">
                        <table class="data">
                          <thead>
                            <tr>
                              <th>{{ 'common.product' | t }}</th>
                              <th class="num">{{ 'common.quantity' | t }}</th>
                              <th class="num">{{ 'products.costPrice' | t }}</th>
                              <th class="num">{{ 'common.sum' | t }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (item of r.items; track item.id) {
                              <tr>
                                <td>
                                  {{ item.product_name }}
                                  <span class="muted small">
                                    ({{ item.color_name || '—' }} / {{ item.size_name || '—' }})
                                  </span>
                                </td>
                                <td class="num">+{{ item.quantity }}</td>
                                <td class="num">{{ item.cost_price | money }}</td>
                                <td class="num strong">{{ item.total_cost | money }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  }
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
  styles: [`
    .picker-list {
      border: 1px solid var(--border); border-radius: 10px; margin-top: 6px;
      max-height: 220px; overflow-y: auto;
    }
    .picker-row {
      width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border: none; border-bottom: 1px solid var(--border); background: var(--surface);
      cursor: pointer; font-family: inherit; font-size: 13px; text-align: left;
      color: var(--text);
      &:hover { background: var(--surface-2); }
      &:last-child { border-bottom: none; }
    }
  `],
})
export class ReceiptsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  receipts = signal<StockReceipt[]>([]);
  vendors = signal<Vendor[]>([]);
  variantResults = signal<VariantSearchResult[]>([]);

  from = '';
  to = '';
  showForm = false;
  saving = false;
  expandedId: number | null = null;

  vendorId: number | null = null;
  newVendor = '';
  receiptDate = new Date().toISOString().slice(0, 10);
  notes = '';
  variantQuery = '';
  lines: ReceiptLine[] = [];

  private timer: any = null;

  ngOnInit() {
    this.load();
    this.api.getVendors({ page_size: 200 }).subscribe(r => this.vendors.set(r.results));
  }

  load() {
    this.api.getReceipts({
      page_size: 30,
      date_from: this.from || undefined,
      date_to: this.to || undefined,
    }).subscribe(r => this.receipts.set(r.results));
  }

  openForm() { this.showForm = true; }

  closeForm() {
    this.showForm = false;
    this.lines = [];
    this.variantQuery = '';
    this.variantResults.set([]);
    this.notes = '';
  }

  searchVariants() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const q = this.variantQuery.trim();
      if (!q) { this.variantResults.set([]); return; }
      this.api.searchVariants(q, 10).subscribe(r => this.variantResults.set(r));
    }, 220);
  }

  addLine(variant: VariantSearchResult) {
    if (this.lines.some(l => l.variant.id === variant.id)) {
      this.toast.warn(this.i18n.t('receipts.alreadyAdded'));
      return;
    }
    this.lines = [...this.lines,
      { variant, quantity: 1, cost_price: Number(variant.price) * 0.6 }];
    this.variantResults.set([]);
    this.variantQuery = '';
  }

  removeLine(variantId: number) {
    this.lines = this.lines.filter(l => l.variant.id !== variantId);
  }

  createVendor() {
    const name = this.newVendor.trim();
    if (!name) return;
    this.api.createVendor({ name }).subscribe({
      next: vendor => {
        this.vendors.update(list => [...list, vendor]);
        this.vendorId = vendor.id;
        this.newVendor = '';
      },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }

  save() {
    if (!this.lines.length) return;
    this.saving = true;
    this.api.createReceipt({
      vendor: this.vendorId,
      receipt_date: this.receiptDate,
      notes: this.notes,
      items: this.lines.map(l => ({
        product_variant: l.variant.id,
        quantity: Number(l.quantity),
        cost_price: Number(l.cost_price),
      })),
    }).subscribe({
      next: receipt => {
        this.saving = false;
        this.toast.success(`${this.i18n.t('receipts.number')} №${receipt.number}`);
        this.closeForm();
        this.load();
      },
      error: err => {
        this.saving = false;
        this.toast.error(err.error?.detail || this.i18n.t('common.error'));
      },
    });
  }

  toggleDetail(receipt: StockReceipt) {
    if (this.expandedId === receipt.id) { this.expandedId = null; return; }
    this.expandedId = receipt.id;
    this.api.getReceipt(receipt.id).subscribe(full => {
      this.receipts.update(list =>
        list.map(r => (r.id === full.id ? { ...r, items: full.items } : r)));
    });
  }
}
