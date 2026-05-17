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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Category, Product } from '../../../core/models/models';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatPaginatorModule, MatSelectModule,
    MatProgressBarModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Products</h1>
        @if (auth.isManager()) {
          <button mat-raised-button color="primary" routerLink="/products/new">
            <mat-icon>add</mat-icon> Add Product
          </button>
        }
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <mat-form-field appearance="outline" style="min-width:260px">
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="searchQuery" (input)="applyFilters()" placeholder="Name or barcode">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:180px">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="categoryFilter" (selectionChange)="applyFilters()">
            <mat-option value="">All Categories</mat-option>
            @for (cat of categories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:140px">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (selectionChange)="applyFilters()">
            <mat-option value="">All</mat-option>
            <mat-option value="true">Active</mat-option>
            <mat-option value="false">Inactive</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:4px" /> }

      <div class="data-table-container">
        <table mat-table [dataSource]="products()">
          <ng-container matColumnDef="image">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p" style="width:64px">
              @if (p.image) {
                <img [src]="p.image" class="product-thumb" [alt]="p.name">
              } @else {
                <div class="no-image"><mat-icon>checkroom</mat-icon></div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Product</th>
            <td mat-cell *matCellDef="let p">
              <div class="fw-600" style="color:#0f172a">{{ p.name }}</div>
              <code style="font-size:11px">{{ p.barcode }}</code>
            </td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Category</th>
            <td mat-cell *matCellDef="let p" style="color:#64748b">{{ p.category_name || 'â€”' }}</td>
          </ng-container>
          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef>Price</th>
            <td mat-cell *matCellDef="let p" class="fw-600">{{ p.base_selling_price | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="stock">
            <th mat-header-cell *matHeaderCellDef>Stock</th>
            <td mat-cell *matCellDef="let p">
              <span [class]="'badge ' + stockBadge(p.total_stock)">
                {{ p.total_stock }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let p">
              <span [class]="'badge ' + (p.is_active ? 'badge-success' : 'badge-default')">
                {{ p.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p">
              @if (auth.isManager()) {
                <button mat-icon-button [routerLink]="['/products', p.id, 'edit']" matTooltip="Edit product">
                  <mat-icon style="color:#6366f1">edit</mat-icon>
                </button>
                <button mat-icon-button (click)="toggleActive(p)"
                  [matTooltip]="p.is_active ? 'Deactivate' : 'Activate'">
                  <mat-icon [style.color]="p.is_active ? '#ef4444' : '#10b981'">
                    {{ p.is_active ? 'visibility_off' : 'visibility' }}
                  </mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>

        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)">
        </mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .product-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; }
    .no-image {
      width: 44px; height: 44px; display: flex; align-items: center;
      justify-content: center; background: #f1f5f9; border-radius: 8px;
      mat-icon { color: #cbd5e1; font-size: 20px; }
    }
  `]
})
export class ProductListComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = false;
  totalCount = 0;
  pageSize = 20;
  currentPage = 1;
  searchQuery = '';
  statusFilter = '';
  categoryFilter: number | '' = '';
  displayedColumns = ['image', 'name', 'category', 'price', 'stock', 'status', 'actions'];

  ngOnInit() {
    this.loadProducts();
    this.api.getAllCategories().subscribe(cats => this.categories.set(cats));
  }

  loadProducts() {
    this.loading = true;
    const params: any = { page: this.currentPage, page_size: this.pageSize };
    if (this.searchQuery) params.search = this.searchQuery;
    if (this.statusFilter !== '') params.is_active = this.statusFilter;
    if (this.categoryFilter !== '') params.category = this.categoryFilter;
    this.api.getProducts(params).subscribe({
      next: (res) => { this.products.set(res.results); this.totalCount = res.count; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  applyFilters() { this.currentPage = 1; this.loadProducts(); }
  onPageChange(event: PageEvent) { this.currentPage = event.pageIndex + 1; this.pageSize = event.pageSize; this.loadProducts(); }

  stockBadge(qty: number) {
    if (qty <= 0) return 'badge-danger';
    if (qty <= 5) return 'badge-warning';
    return 'badge-success';
  }

  toggleActive(product: Product) {
    const data = new FormData();
    data.append('is_active', String(!product.is_active));
    this.api.updateProduct(product.id, data).subscribe({
      next: () => this.loadProducts(),
      error: () => this.snackBar.open('Update failed', 'Close', { duration: 3000 })
    });
  }
}
