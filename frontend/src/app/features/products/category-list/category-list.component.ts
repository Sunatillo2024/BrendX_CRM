import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { Category } from '../../../core/models/models';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatTableModule, MatSnackBarModule,
    MatProgressBarModule, MatCheckboxModule, MatPaginatorModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Categories</h1>
          <p style="color:var(--text-muted);margin:0">Manage product categories</p>
        </div>
        <button mat-raised-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> New Category
        </button>
      </div>

      <!-- Stat cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:24px">
        <mat-card style="border:1px solid var(--border);box-shadow:var(--shadow)">
          <mat-card-content style="padding:16px">
            <div style="color:var(--text-muted);font-size:13px">Total</div>
            <div style="font-size:28px;font-weight:700;color:var(--text)">{{ allCategories().length }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card style="border:1px solid var(--border);box-shadow:var(--shadow)">
          <mat-card-content style="padding:16px">
            <div style="color:var(--text-muted);font-size:13px">Active</div>
            <div style="font-size:28px;font-weight:700;color:#22c55e">{{ activeCount() }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card style="border:1px solid var(--border);box-shadow:var(--shadow)">
          <mat-card-content style="padding:16px">
            <div style="color:var(--text-muted);font-size:13px">Root</div>
            <div style="font-size:28px;font-weight:700;color:#6366f1">{{ rootCount() }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card style="border:1px solid var(--border);box-shadow:var(--shadow)">
          <mat-card-content style="padding:16px">
            <div style="color:var(--text-muted);font-size:13px">Subcategories</div>
            <div style="font-size:28px;font-weight:700;color:#f59e0b">{{ subCount() }}</div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" style="margin-bottom:16px;border-radius:4px" /> }

      <!-- Inline form -->
      @if (showForm()) {
        <mat-card style="margin-bottom:20px;border:1px solid var(--border);box-shadow:var(--shadow)">
          <mat-card-header style="padding-top:16px">
            <mat-card-title>{{ editing() ? 'Edit Category' : 'New Category' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px">
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
              <mat-form-field appearance="outline" style="min-width:200px">
                <mat-label>Name *</mat-label>
                <input matInput [(ngModel)]="form.name" required>
              </mat-form-field>
              <mat-form-field appearance="outline" style="flex:2;min-width:200px">
                <mat-label>Description</mat-label>
                <input matInput [(ngModel)]="form.description">
              </mat-form-field>
              <mat-form-field appearance="outline" style="min-width:180px">
                <mat-label>Parent Category</mat-label>
                <mat-select [(ngModel)]="form.parent">
                  <mat-option [value]="null">— None (Root) —</mat-option>
                  @for (cat of allCategories(); track cat.id) {
                    @if (!editing() || cat.id !== editing()!.id) {
                      <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                    }
                  }
                </mat-select>
              </mat-form-field>
              <div style="display:flex;flex-direction:column;gap:8px;padding-top:4px">
                <mat-checkbox [(ngModel)]="form.is_active">Active</mat-checkbox>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <span style="font-size:12px;color:var(--text-muted)">Image (optional)</span>
                  @if (imagePreview()) {
                    <img [src]="imagePreview()!" alt="preview"
                         style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
                  }
                  <input type="file" accept="image/*" (change)="onImageChange($event)"
                         style="font-size:12px;max-width:220px">
                </div>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions align="end" style="padding:0 16px 12px">
            <button mat-button (click)="cancelForm()">Cancel</button>
            <button mat-raised-button color="primary" [disabled]="!form.name || saving()" (click)="save()">
              <mat-icon>{{ saving() ? 'hourglass_empty' : 'save' }}</mat-icon>
              {{ saving() ? 'Saving...' : 'Save' }}
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Filter bar -->
      <div class="filter-bar" style="margin-bottom:16px">
        <mat-form-field appearance="outline" style="min-width:260px">
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="searchQuery" (input)="applySearch()" placeholder="Name or description">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:140px">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (selectionChange)="applySearch()">
            <mat-option value="">All</mat-option>
            <mat-option value="true">Active</mat-option>
            <mat-option value="false">Inactive</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="min-width:160px">
          <mat-label>Parent</mat-label>
          <mat-select [(ngModel)]="parentFilter" (selectionChange)="applySearch()">
            <mat-option value="">All</mat-option>
            <mat-option value="root">Root only</mat-option>
            @for (cat of allCategories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Table -->
      <div class="data-table-container">
        <table mat-table [dataSource]="categories()">

          <ng-container matColumnDef="image">
            <th mat-header-cell *matHeaderCellDef style="width:60px"></th>
            <td mat-cell *matCellDef="let c" style="width:60px;padding:8px">
              @if (c.image) {
                <img [src]="c.image" alt="{{ c.name }}"
                     style="width:40px;height:40px;object-fit:cover;border-radius:6px;display:block;border:1px solid var(--border)">
              } @else {
                <div style="width:40px;height:40px;border-radius:6px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center">
                  <mat-icon style="color:#cbd5e1;font-size:20px;width:20px;height:20px">category</mat-icon>
                </div>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let c" style="font-weight:600;color:var(--text)">
              {{ c.name }}
            </td>
          </ng-container>

          <ng-container matColumnDef="parent">
            <th mat-header-cell *matHeaderCellDef>Parent</th>
            <td mat-cell *matCellDef="let c" style="color:var(--text-muted)">
              {{ getParentName(c.parent) || '— Root —' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let c" style="color:var(--text-muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              {{ c.description || '—' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="product_count">
            <th mat-header-cell *matHeaderCellDef>Products</th>
            <td mat-cell *matCellDef="let c">
              <span class="badge badge-primary">{{ c.product_count }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let c">
              <span [class]="'badge ' + (c.is_active ? 'badge-success' : 'badge-default')">
                {{ c.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button (click)="openForm(c)" matTooltip="Edit">
                <mat-icon style="color:#6366f1">edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="delete(c)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>

        @if (!loading() && categories().length === 0) {
          <div style="text-align:center;padding:48px;color:var(--text-muted)">
            <mat-icon style="font-size:40px;width:40px;height:40px;display:block;margin:0 auto 12px;color:#cbd5e1">category</mat-icon>
            No categories found.
          </div>
        }

        <mat-paginator
          [length]="totalCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          (page)="onPageChange($event)">
        </mat-paginator>
      </div>
    </div>
  `,
})
export class CategoryListComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  cols = ['image', 'name', 'parent', 'description', 'product_count', 'status', 'actions'];
  categories = signal<Category[]>([]);
  allCategories = signal<Category[]>([]);
  loading = signal(false);
  saving = signal(false);
  showForm = signal(false);
  editing = signal<Category | null>(null);
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  totalCount = 0;
  pageSize = 10;
  currentPage = 1;
  searchQuery = '';
  statusFilter = '';
  parentFilter: number | 'root' | '' = '';

  form: { name: string; description: string; parent: number | null; is_active: boolean } =
    { name: '', description: '', parent: null, is_active: true };

  // Computed stats from allCategories
  activeCount = computed(() => this.allCategories().filter(c => c.is_active).length);
  rootCount = computed(() => this.allCategories().filter(c => !c.parent).length);
  subCount = computed(() => this.allCategories().filter(c => !!c.parent).length);

  ngOnInit() {
    this.loadAll();
    this.load();
  }

  /** Load flat list of all categories (active + inactive) for parent selectors and stats */
  loadAll() {
    this.api.getCategories({ page_size: 500 }).subscribe({
      next: res => this.allCategories.set(res.results),
      error: () => {},
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.currentPage, page_size: this.pageSize };
    if (this.searchQuery) params.search = this.searchQuery;
    if (this.statusFilter !== '') params.is_active = this.statusFilter;
    if (this.parentFilter === 'root') params.root_only = 'true';
    else if (this.parentFilter !== '') params.parent = this.parentFilter;

    this.api.getCategories(params).subscribe({
      next: res => {
        this.categories.set(res.results);
        this.totalCount = res.count;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applySearch() { this.currentPage = 1; this.load(); }
  onPageChange(e: PageEvent) { this.currentPage = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }

  getParentName(parentId: number | null): string {
    if (!parentId) return '';
    return this.allCategories().find(c => c.id === parentId)?.name ?? '';
  }

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      this.imagePreview.set(null);
    }
  }

  openForm(cat?: Category) {
    this.editing.set(cat ?? null);
    this.form = {
      name: cat?.name ?? '',
      description: cat?.description ?? '',
      parent: cat?.parent ?? null,
      is_active: cat?.is_active ?? true,
    };
    this.selectedFile.set(null);
    this.imagePreview.set(cat?.image ?? null);
    this.showForm.set(true);
  }

  cancelForm() { this.showForm.set(false); this.editing.set(null); this.imagePreview.set(null); }

  save() {
    this.saving.set(true);
    const cat = this.editing();
    const file = this.selectedFile();

    let payload: any;
    if (file) {
      const fd = new FormData();
      fd.append('name', this.form.name);
      fd.append('description', this.form.description ?? '');
      fd.append('is_active', String(this.form.is_active));
      fd.append('parent', this.form.parent !== null ? String(this.form.parent) : '');
      fd.append('image', file);
      payload = fd;
    } else {
      payload = { ...this.form };
    }

    const req = cat
      ? this.api.updateCategory(cat.id, payload)
      : this.api.createCategory(payload);

    req.subscribe({
      next: () => {
        this.snack.open(cat ? 'Category updated' : 'Category created', 'OK', { duration: 3000 });
        this.cancelForm();
        this.loadAll();
        this.load();
        this.saving.set(false);
      },
      error: (err) => {
        const msg = err.error?.name?.[0] || err.error?.detail || 'Error saving category';
        this.snack.open(msg, 'OK', { duration: 4000 });
        this.saving.set(false);
      },
    });
  }

  delete(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    this.api.deleteCategory(cat.id).subscribe({
      next: () => {
        this.snack.open('Category deleted', 'OK', { duration: 3000 });
        this.loadAll();
        this.load();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Cannot delete — category may have products.';
        this.snack.open(msg, 'OK', { duration: 4000 });
      },
    });
  }
}
