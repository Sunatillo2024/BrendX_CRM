import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Sale } from '../../../core/models/models';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatPaginatorModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Sales History</h1>
      </div>

      <div class="filter-bar">
        <mat-form-field appearance="outline" style="min-width:160px">
          <mat-label>Payment Type</mat-label>
          <mat-select [(ngModel)]="typeFilter" (selectionChange)="load()">
            <mat-option value="">All Types</mat-option>
            <mat-option value="cash">Cash</mat-option>
            <mat-option value="credit">Credit</mat-option>
            <mat-option value="installment">Installment</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:160px">
          <mat-label>Date From</mat-label>
          <input matInput type="date" [(ngModel)]="dateFrom" (change)="load()">
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:160px">
          <mat-label>Date To</mat-label>
          <input matInput type="date" [(ngModel)]="dateTo" (change)="load()">
        </mat-form-field>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:4px" /> }

      <div class="data-table-container">
        <table mat-table [dataSource]="sales()">
          <ng-container matColumnDef="sale_number">
            <th mat-header-cell *matHeaderCellDef>Sale #</th>
            <td mat-cell *matCellDef="let s"><code>{{ s.sale_number }}</code></td>
          </ng-container>
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let s" style="color:#64748b">{{ s.created_at | date:'MMM d, y, h:mm a' }}</td>
          </ng-container>
          <ng-container matColumnDef="customer">
            <th mat-header-cell *matHeaderCellDef>Customer</th>
            <td mat-cell *matCellDef="let s">
              <span [style.color]="s.customer_name ? '#0f172a' : '#94a3b8'">
                {{ s.customer_name || 'Walk-in' }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let s">
              <span [class]="'badge ' + typeBadge(s.sale_type)">{{ s.sale_type }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef>Total</th>
            <td mat-cell *matCellDef="let s" class="fw-600">{{ s.total_amount | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="paid">
            <th mat-header-cell *matHeaderCellDef>Paid</th>
            <td mat-cell *matCellDef="let s" class="text-success fw-600">{{ s.paid_amount | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="remaining">
            <th mat-header-cell *matHeaderCellDef>Remaining</th>
            <td mat-cell *matCellDef="let s">
              <span [class]="s.remaining_amount > 0 ? 'fw-600 text-danger' : 'text-muted'">
                {{ s.remaining_amount | currency }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let s">
              <span [class]="'badge ' + statusBadge(s.status)">{{ s.status }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="receipt">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button (click)="printReceipt(s.id)" matTooltip="Print Receipt">
                <mat-icon style="color:#6366f1">print</mat-icon>
              </button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button [routerLink]="['/sales', s.id]" matTooltip="View Details">
                <mat-icon style="color:#64748b">open_in_new</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols;"></tr>
        </table>
        <mat-paginator [length]="total" [pageSize]="20" (page)="onPage($event)"></mat-paginator>
      </div>
    </div>
  `,
})
export class SalesListComponent implements OnInit {
  private api = inject(ApiService);
  sales = signal<Sale[]>([]);
  loading = false;
  total = 0;
  page = 1;
  typeFilter = '';
  dateFrom = '';
  dateTo = '';
  cols = ['sale_number', 'date', 'customer', 'type', 'total', 'paid', 'remaining', 'status', 'receipt', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const p: any = { page: this.page };
    if (this.typeFilter) p.sale_type = this.typeFilter;
    if (this.dateFrom) p.created_after = this.dateFrom;
    if (this.dateTo) p.created_before = this.dateTo;
    this.api.getSales(p).subscribe({
      next: (r) => { this.sales.set(r.results); this.total = r.count; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.load(); }
  printReceipt(saleId: number) { this.api.getReceiptPdf(saleId).subscribe(blob => { window.open(URL.createObjectURL(blob), '_blank'); }); }
  typeBadge(t: string) { return { cash: 'badge-success', credit: 'badge-warning', installment: 'badge-accent' }[t] || 'badge-default'; }
  statusBadge(s: string) { return { completed: 'badge-success', pending: 'badge-warning', cancelled: 'badge-danger' }[s] || 'badge-default'; }
}
