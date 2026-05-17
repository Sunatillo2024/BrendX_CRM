import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ApiService } from '../../core/services/api.service';
import { StockItem, StockAdjustment, Vendor } from '../../core/models/models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatTableModule,
    MatSnackBarModule, MatPaginatorModule, MatProgressBarModule, MatTabsModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Inventory</h1>
      </div>

      @if (valuation()) {
        <div class="val-grid" style="margin-bottom:24px">
          <div class="val-card">
            <div class="val-icon" style="background:#ede9fe;color:#7c3aed"><mat-icon>inventory_2</mat-icon></div>
            <div class="val-body">
              <div class="val-value">{{ valuation().total_cost_value | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="val-label">Cost Value</div>
            </div>
          </div>
          <div class="val-card">
            <div class="val-icon" style="background:#d1fae5;color:#059669"><mat-icon>sell</mat-icon></div>
            <div class="val-body">
              <div class="val-value">{{ valuation().total_retail_value | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="val-label">Retail Value</div>
            </div>
          </div>
          <div class="val-card">
            <div class="val-icon" style="background:#fef3c7;color:#d97706"><mat-icon>trending_up</mat-icon></div>
            <div class="val-body">
              <div class="val-value">{{ valuation().potential_profit | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="val-label">Potential Profit</div>
            </div>
          </div>
        </div>
      }

      <mat-tab-group>

        <mat-tab label="Stock Items">
          <div style="padding-top:20px">
            <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
              <button mat-raised-button color="primary" (click)="showAddForm = !showAddForm">
                <mat-icon>{{ showAddForm ? 'close' : 'add' }}</mat-icon>
                {{ showAddForm ? 'Cancel' : 'Receive Stock' }}
              </button>
            </div>

            @if (showAddForm) {
              <div class="form-card" style="margin-bottom:24px">
                <div class="form-card-header">
                  <mat-icon style="color:#6366f1">add_circle</mat-icon>
                  Receive New Stock
                </div>
                <div class="form-card-body">
                  <form [formGroup]="stockForm" (ngSubmit)="addStock()">
                    <div class="form-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Product Variant ID *</mat-label>
                        <input matInput formControlName="product_variant" type="number">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Vendor</mat-label>
                        <mat-select formControlName="vendor">
                          <mat-option [value]="null">No Vendor</mat-option>
                          @for (v of vendors(); track v.id) {
                            <mat-option [value]="v.id">{{ v.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>
                    <div class="form-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Qty per Package *</mat-label>
                        <input matInput formControlName="quantity_per_package" type="number" min="1">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Total Packages *</mat-label>
                        <input matInput formControlName="total_packages" type="number" min="1">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Cost Price (per unit) *</mat-label>
                        <input matInput formControlName="cost_price" type="number" min="0">
                        <mat-icon matPrefix>attach_money</mat-icon>
                      </mat-form-field>
                    </div>
                    <div class="form-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Import Date *</mat-label>
                        <input matInput formControlName="import_date" type="date">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Production Date</mat-label>
                        <input matInput formControlName="production_date" type="date">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Expire Date</mat-label>
                        <input matInput formControlName="expire_date" type="date">
                      </mat-form-field>
                    </div>
                    <mat-form-field appearance="outline" style="width:100%">
                      <mat-label>Notes</mat-label>
                      <textarea matInput formControlName="notes" rows="2"></textarea>
                    </mat-form-field>
                    <div class="form-actions">
                      <button mat-raised-button color="primary" type="submit" [disabled]="stockForm.invalid || saving">
                        <mat-icon>save</mat-icon> {{ saving ? 'Saving...' : 'Receive Stock' }}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            }

            @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:4px" /> }

            <div class="data-table-container">
              <table mat-table [dataSource]="stockItems()">
                <ng-container matColumnDef="item_id">
                  <th mat-header-cell *matHeaderCellDef>Item ID</th>
                  <td mat-cell *matCellDef="let s"><code>{{ s.item_id }}</code></td>
                </ng-container>
                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef>Product</th>
                  <td mat-cell *matCellDef="let s" class="fw-600" style="color:#0f172a">{{ s.variant_display }}</td>
                </ng-container>
                <ng-container matColumnDef="vendor">
                  <th mat-header-cell *matHeaderCellDef>Vendor</th>
                  <td mat-cell *matCellDef="let s" style="color:#64748b">{{ s.vendor_name || '&mdash;' }}</td>
                </ng-container>
                <ng-container matColumnDef="qty">
                  <th mat-header-cell *matHeaderCellDef>In Stock</th>
                  <td mat-cell *matCellDef="let s">
                    <span [class]="'badge ' + (s.quantity_in_stock <= 0 ? 'badge-danger' : s.quantity_in_stock <= 10 ? 'badge-warning' : 'badge-success')">
                      {{ s.quantity_in_stock }} / {{ s.quantity_received }}
                    </span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="cost">
                  <th mat-header-cell *matHeaderCellDef>Cost</th>
                  <td mat-cell *matCellDef="let s">{{ s.cost_price | currency }}</td>
                </ng-container>
                <ng-container matColumnDef="margin">
                  <th mat-header-cell *matHeaderCellDef>Margin</th>
                  <td mat-cell *matCellDef="let s">
                    <span [class]="s.profit_margin >= 30 ? 'text-success fw-600' : ''">
                      {{ s.profit_margin ? (s.profit_margin + '%') : '&mdash;' }}
                    </span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="import_date">
                  <th mat-header-cell *matHeaderCellDef>Import Date</th>
                  <td mat-cell *matCellDef="let s" style="color:#64748b">{{ s.import_date | date }}</td>
                </ng-container>
                <ng-container matColumnDef="expire_date">
                  <th mat-header-cell *matHeaderCellDef>Expire Date</th>
                  <td mat-cell *matCellDef="let s">
                    @if (s.expire_date) {
                      <span [class]="isExpiringSoon(s.expire_date) ? 'fw-600 text-danger' : 'text-muted'">
                        {{ s.expire_date | date }}
                      </span>
                    } @else { <span class="text-muted">&mdash;</span> }
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns;"></tr>
              </table>
              <mat-paginator [length]="total" [pageSize]="20" (page)="onPage($event)"></mat-paginator>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Adjustments">
          <div style="padding-top:20px">
            <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
              <button mat-raised-button color="accent" (click)="showAdjForm = !showAdjForm">
                <mat-icon>{{ showAdjForm ? 'close' : 'tune' }}</mat-icon>
                {{ showAdjForm ? 'Cancel' : 'New Adjustment' }}
              </button>
            </div>

            @if (showAdjForm) {
              <div class="form-card" style="margin-bottom:24px">
                <div class="form-card-header">
                  <mat-icon style="color:#f59e0b">tune</mat-icon>
                  Create Stock Adjustment
                </div>
                <div class="form-card-body">
                  <form [formGroup]="adjForm" (ngSubmit)="createAdjustment()">
                    <div class="form-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Stock Item ID *</mat-label>
                        <input matInput formControlName="stock_item" type="number">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Type *</mat-label>
                        <mat-select formControlName="adjustment_type">
                          <mat-option value="increase">Increase</mat-option>
                          <mat-option value="decrease">Decrease</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Quantity *</mat-label>
                        <input matInput formControlName="quantity" type="number" min="1">
                      </mat-form-field>
                    </div>
                    <div class="form-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Reason *</mat-label>
                        <mat-select formControlName="reason">
                          <mat-option value="damage">Damage</mat-option>
                          <mat-option value="theft">Theft / Loss</mat-option>
                          <mat-option value="audit">Audit Correction</mat-option>
                          <mat-option value="return">Customer Return</mat-option>
                          <mat-option value="expired">Expired</mat-option>
                          <mat-option value="other">Other</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field appearance="outline" style="flex:2">
                        <mat-label>Notes</mat-label>
                        <input matInput formControlName="notes">
                      </mat-form-field>
                    </div>
                    <div class="form-actions">
                      <button mat-raised-button color="accent" type="submit" [disabled]="adjForm.invalid || adjSaving">
                        <mat-icon>save</mat-icon> {{ adjSaving ? 'Saving...' : 'Save Adjustment' }}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            }

            @if (adjLoading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:4px" /> }

            <div class="data-table-container">
              <table mat-table [dataSource]="adjustments()">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let a" style="color:#64748b">{{ a.adjusted_at | date:'short' }}</td>
                </ng-container>
                <ng-container matColumnDef="stock_item">
                  <th mat-header-cell *matHeaderCellDef>Stock Item</th>
                  <td mat-cell *matCellDef="let a"><code>{{ a.stock_item }}</code></td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let a">
                    <span [class]="'badge ' + (a.adjustment_type === 'increase' ? 'badge-success' : 'badge-danger')">
                      {{ a.adjustment_type }}
                    </span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="quantity">
                  <th mat-header-cell *matHeaderCellDef>Quantity</th>
                  <td mat-cell *matCellDef="let a" class="fw-600">{{ a.quantity }}</td>
                </ng-container>
                <ng-container matColumnDef="reason">
                  <th mat-header-cell *matHeaderCellDef>Reason</th>
                  <td mat-cell *matCellDef="let a" style="color:#64748b">{{ a.reason }}</td>
                </ng-container>
                <ng-container matColumnDef="notes">
                  <th mat-header-cell *matHeaderCellDef>Notes</th>
                  <td mat-cell *matCellDef="let a" style="color:#94a3b8">{{ a.notes || '&mdash;' }}</td>
                </ng-container>
                <ng-container matColumnDef="adjusted_by">
                  <th mat-header-cell *matHeaderCellDef>By</th>
                  <td mat-cell *matCellDef="let a" style="color:#64748b">{{ a.adjusted_by_name }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="adjColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: adjColumns;"></tr>
              </table>
              <mat-paginator [length]="adjTotal" [pageSize]="20" (page)="onAdjPage($event)"></mat-paginator>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .val-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .val-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 20px; display: flex; gap: 14px; align-items: center; }
    .val-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .val-value { font-size: 20px; font-weight: 700; color: #0f172a; }
    .val-label { font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px; }
    .form-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .form-card-header { padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #0f172a; display: flex; gap: 8px; align-items: center; }
    .form-card-body { padding: 20px; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 4px; }
    .form-actions { display: flex; gap: 12px; margin-top: 8px; }
    code { font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569; }
  `]
})
export class InventoryComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  stockItems = signal<StockItem[]>([]);
  adjustments = signal<StockAdjustment[]>([]);
  vendors = signal<Vendor[]>([]);
  valuation = signal<any>(null);
  loading = false;
  saving = false;
  showAddForm = false;
  adjLoading = false;
  adjSaving = false;
  showAdjForm = false;
  total = 0;
  page = 1;
  adjTotal = 0;
  adjPage = 1;
  columns = ['item_id', 'product', 'vendor', 'qty', 'cost', 'margin', 'import_date', 'expire_date'];
  adjColumns = ['date', 'stock_item', 'type', 'quantity', 'reason', 'notes', 'adjusted_by'];

  stockForm: FormGroup = this.fb.group({
    product_variant: [null, Validators.required],
    vendor: [null],
    quantity_per_package: [1, [Validators.required, Validators.min(1)]],
    total_packages: [1, [Validators.required, Validators.min(1)]],
    cost_price: [0, [Validators.required, Validators.min(0)]],
    import_date: [new Date().toISOString().split('T')[0], Validators.required],
    production_date: [null],
    expire_date: [null],
    notes: [''],
  });

  adjForm: FormGroup = this.fb.group({
    stock_item: [null, Validators.required],
    adjustment_type: ['decrease', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    reason: ['damage', Validators.required],
    notes: [''],
  });

  ngOnInit() {
    this.loadStock();
    this.loadAdjustments();
    this.api.getVendors({ page_size: 100 }).subscribe(r => this.vendors.set(r.results));
    this.api.getInventoryValuation().subscribe(v => this.valuation.set(v));
  }

  loadStock() {
    this.loading = true;
    this.api.getStockItems({ page: this.page }).subscribe({
      next: (res) => { this.stockItems.set(res.results); this.total = res.count; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  loadAdjustments() {
    this.adjLoading = true;
    this.api.getStockAdjustments({ page: this.adjPage }).subscribe({
      next: (res) => { this.adjustments.set(res.results); this.adjTotal = res.count; this.adjLoading = false; },
      error: () => this.adjLoading = false,
    });
  }

  addStock() {
    if (this.stockForm.invalid) return;
    this.saving = true;
    this.api.createStockItem(this.stockForm.value).subscribe({
      next: () => {
        this.saving = false; this.showAddForm = false;
        this.stockForm.reset({ quantity_per_package: 1, total_packages: 1, cost_price: 0 });
        this.loadStock();
        this.api.getInventoryValuation().subscribe(v => this.valuation.set(v));
        this.snackBar.open('Stock received!', '', { duration: 2000 });
      },
      error: (err) => { this.saving = false; this.snackBar.open(err.error?.detail || 'Failed', 'Close', { duration: 3000 }); },
    });
  }

  createAdjustment() {
    if (this.adjForm.invalid) return;
    this.adjSaving = true;
    this.api.createStockAdjustment(this.adjForm.value).subscribe({
      next: () => {
        this.adjSaving = false; this.showAdjForm = false;
        this.adjForm.reset({ adjustment_type: 'decrease', quantity: 1, reason: 'damage' });
        this.loadAdjustments();
        this.loadStock();
        this.api.getInventoryValuation().subscribe(v => this.valuation.set(v));
        this.snackBar.open('Adjustment saved!', '', { duration: 2000 });
      },
      error: (err) => { this.adjSaving = false; this.snackBar.open(err.error?.detail || 'Failed', 'Close', { duration: 3000 }); },
    });
  }

  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.loadStock(); }
  onAdjPage(e: PageEvent) { this.adjPage = e.pageIndex + 1; this.loadAdjustments(); }

  isExpiringSoon(dateStr: string): boolean {
    const d = new Date(dateStr);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 30);
    return d <= threshold;
  }
}