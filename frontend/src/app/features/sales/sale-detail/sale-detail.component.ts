import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { Sale } from '../../../core/models/models';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatCardModule,
    MatTableModule, MatProgressBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Sale {{ sale()?.sale_number }}</h1>
          @if (sale()) {
            <p style="color:#888;margin:0">{{ sale()!.created_at | date:'full' }}</p>
          }
        </div>
        <div style="display:flex;gap:8px">
          @if (sale()) {
            <button mat-stroked-button (click)="printReceipt()" matTooltip="Print Receipt">
              <mat-icon>print</mat-icon> Receipt
            </button>
          }
          <button mat-stroked-button routerLink="/sales">
            <mat-icon>arrow_back</mat-icon> Back
          </button>
        </div>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:16px" /> }

      @if (sale()) {
        <!-- Sale Summary Cards -->
        <div class="summary-grid">
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Type</div>
              <div><span [class]="'badge ' + typeBadge(sale()!.sale_type)">{{ sale()!.sale_type }}</span></div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Status</div>
              <div><span [class]="'badge ' + statusBadge(sale()!.status)">{{ sale()!.status }}</span></div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Customer</div>
              <div class="stat-value">{{ sale()!.customer_name || 'Walk-in' }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Cashier</div>
              <div class="stat-value">{{ sale()!.cashier_name }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Subtotal</div>
              <div class="stat-value">{{ sale()!.subtotal | currency }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Discount</div>
              <div class="stat-value">{{ sale()!.discount_amount | currency }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Total</div>
              <div class="stat-value fw-700" style="color:#0f172a">{{ sale()!.total_amount | currency }}</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-label">Paid</div>
              <div class="stat-value text-success">{{ sale()!.paid_amount | currency }}</div>
            </mat-card-content>
          </mat-card>
          @if (sale()!.remaining_amount > 0) {
            <mat-card>
              <mat-card-content>
                <div class="stat-label">Remaining</div>
                <div class="stat-value text-danger fw-700">{{ sale()!.remaining_amount | currency }}</div>
              </mat-card-content>
            </mat-card>
          }
        </div>

        <!-- Receipt Info -->
        @if (sale()!.receipt) {
          <div class="receipt-banner">
            <mat-icon style="color:#10b981">receipt_long</mat-icon>
            <span>Receipt <strong>{{ sale()!.receipt!.receipt_number }}</strong> generated on {{ sale()!.receipt!.generated_at | date:'medium' }}</span>
          </div>
        }

        <!-- Sale Items Table (sale_items) -->
        <mat-card style="margin-top:20px">
          <mat-card-header>
            <mat-card-title>
              <mat-icon style="color:#6366f1;vertical-align:middle;margin-right:6px">shopping_cart</mat-icon>
              Sale Items ({{ sale()!.items.length }})
            </mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:8px">
            <div class="data-table-container" style="border:none;box-shadow:none">
              <table mat-table [dataSource]="sale()!.items" style="width:100%">
                <ng-container matColumnDef="product">
                  <th mat-header-cell *matHeaderCellDef>Product</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="fw-600" style="color:#0f172a">{{ item.product_name }}</div>
                    <div style="font-size:12px;color:#94a3b8">{{ item.variant_display }}</div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="quantity">
                  <th mat-header-cell *matHeaderCellDef>Qty</th>
                  <td mat-cell *matCellDef="let item" class="fw-600">{{ item.quantity }}</td>
                </ng-container>
                <ng-container matColumnDef="unit_price">
                  <th mat-header-cell *matHeaderCellDef>Unit Price</th>
                  <td mat-cell *matCellDef="let item">{{ item.unit_price | currency }}</td>
                </ng-container>
                <ng-container matColumnDef="discount">
                  <th mat-header-cell *matHeaderCellDef>Discount</th>
                  <td mat-cell *matCellDef="let item">
                    @if (item.discount_percent > 0) {
                      <span class="badge badge-warning">{{ item.discount_percent }}%</span>
                      <span style="font-size:12px;color:#94a3b8;margin-left:4px">(-{{ item.discount_amount | currency }})</span>
                    } @else {
                      <span class="text-muted">&mdash;</span>
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="total_price">
                  <th mat-header-cell *matHeaderCellDef>Total</th>
                  <td mat-cell *matCellDef="let item" class="fw-600" style="color:#0f172a">{{ item.total_price | currency }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="itemCols"></tr>
                <tr mat-row *matRowDef="let row; columns: itemCols;"></tr>
              </table>
            </div>
          </mat-card-content>
        </mat-card>

        @if (sale()!.notes) {
          <mat-card style="margin-top:16px">
            <mat-card-content>
              <div style="font-size:13px;color:#64748b"><strong>Notes:</strong> {{ sale()!.notes }}</div>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat-label { font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stat-value { font-size: 16px; font-weight: 600; color: #0f172a; }
    .fw-700 { font-weight: 700; }
    .receipt-banner {
      display: flex; align-items: center; gap: 10px; padding: 12px 16px;
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
      font-size: 13px; color: #166534;
    }
  `]
})
export class SaleDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  sale = signal<Sale | null>(null);
  loading = false;
  itemCols = ['product', 'quantity', 'unit_price', 'discount', 'total_price'];

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.loading = true;
    this.api.getSale(id).subscribe({
      next: (s) => { this.sale.set(s); this.loading = false; },
      error: () => this.loading = false,
    });
  }

  printReceipt() {
    const id = this.sale()?.id;
    if (!id) return;
    this.api.getReceiptPdf(id).subscribe(blob => window.open(URL.createObjectURL(blob), '_blank'));
  }

  typeBadge(t: string) { return { cash: 'badge-success', credit: 'badge-warning', installment: 'badge-accent' }[t] || 'badge-default'; }
  statusBadge(s: string) { return { completed: 'badge-success', pending: 'badge-warning', cancelled: 'badge-danger', refunded: 'badge-default' }[s] || 'badge-default'; }
}
