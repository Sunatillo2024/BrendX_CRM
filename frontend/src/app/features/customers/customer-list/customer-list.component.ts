import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { Customer } from '../../../core/models/models';

@Component({
  selector: 'app-customer-list',
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
        <h1>Customers</h1>
        <button mat-raised-button color="primary" routerLink="/customers/new">
          <mat-icon>person_add</mat-icon> Add Customer
        </button>
      </div>

      <div class="filter-bar">
        <mat-form-field appearance="outline" style="min-width:260px">
          <mat-label>Search customers</mat-label>
          <input matInput [(ngModel)]="search" (input)="load()" placeholder="Name or phone">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:150px">
          <mat-label>Type</mat-label>
          <mat-select [(ngModel)]="typeFilter" (selectionChange)="load()">
            <mat-option value="">All Types</mat-option>
            <mat-option value="regular">Regular</mat-option>
            <mat-option value="credit">Credit</mat-option>
            <mat-option value="installment">Installment</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:4px" /> }

      <div class="data-table-container">
        <table mat-table [dataSource]="customers()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Customer</th>
            <td mat-cell *matCellDef="let c">
              <div class="fw-600" style="color:#0f172a">{{ c.name }}</div>
              <div style="font-size:12px;color:#94a3b8">{{ c.phone }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let c">
              <span [class]="'badge ' + typeBadge(c.customer_type)">{{ c.customer_type }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="balance">
            <th mat-header-cell *matHeaderCellDef>Outstanding</th>
            <td mat-cell *matCellDef="let c">
              <span [class]="c.outstanding_balance > 0 ? 'fw-600 text-danger' : 'text-muted'">
                {{ c.outstanding_balance | currency }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="credit_limit">
            <th mat-header-cell *matHeaderCellDef>Credit Limit</th>
            <td mat-cell *matCellDef="let c">{{ c.credit_limit | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button [routerLink]="['/customers', c.id]" matTooltip="View Details">
                <mat-icon style="color:#6366f1">open_in_new</mat-icon>
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
export class CustomerListComponent implements OnInit {
  private api = inject(ApiService);
  customers = signal<Customer[]>([]);
  loading = false;
  total = 0;
  page = 1;
  search = '';
  typeFilter = '';
  cols = ['name', 'type', 'balance', 'credit_limit', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const p: any = { page: this.page };
    if (this.search) p.search = this.search;
    if (this.typeFilter) p.customer_type = this.typeFilter;
    this.api.getCustomers(p).subscribe({
      next: (r) => { this.customers.set(r.results); this.total = r.count; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.load(); }
  typeBadge(t: string) { return { regular: 'badge-default', credit: 'badge-warning', installment: 'badge-accent' }[t] || 'badge-default'; }
}
