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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { Vendor } from '../../../core/models/models';

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatPaginatorModule, MatProgressBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Vendors</h1>
        <button mat-raised-button color="primary" routerLink="/vendors/new">
          <mat-icon>add</mat-icon> Add Vendor
        </button>
      </div>

      <div class="filter-bar">
        <mat-form-field appearance="outline" style="min-width:280px">
          <mat-label>Search vendors</mat-label>
          <input matInput [(ngModel)]="search" (input)="load()" placeholder="Name, phone, company">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:4px" /> }

      <div class="data-table-container">
        <table mat-table [dataSource]="vendors()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Vendor</th>
            <td mat-cell *matCellDef="let v">
              <div class="fw-600" style="color:#0f172a">{{ v.name }}</div>
              <div style="font-size:12px;color:#94a3b8">{{ v.company_name }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let v" style="color:#64748b">{{ v.phone }}</td>
          </ng-container>
          <ng-container matColumnDef="balance">
            <th mat-header-cell *matHeaderCellDef>Balance Owed</th>
            <td mat-cell *matCellDef="let v">
              <span [class]="v.balance > 0 ? 'fw-600 text-danger' : 'text-muted'">
                {{ v.balance | currency }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let v">
              <span [class]="'badge ' + (v.is_active ? 'badge-success' : 'badge-default')">
                {{ v.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let v">
              <button mat-icon-button [routerLink]="['/vendors', v.id]" matTooltip="View Details">
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
export class VendorListComponent implements OnInit {
  private api = inject(ApiService);
  vendors = signal<Vendor[]>([]);
  loading = false;
  total = 0;
  page = 1;
  search = '';
  cols = ['name', 'phone', 'balance', 'status', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const params: any = { page: this.page };
    if (this.search) params.search = this.search;
    this.api.getVendors(params).subscribe({
      next: (r) => { this.vendors.set(r.results); this.total = r.count; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.load(); }
}
