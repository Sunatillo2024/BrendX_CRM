import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../../core/services/api.service';
import { Category, Color, Size, Product } from '../../../core/models/models';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatCheckboxModule,
    MatSnackBarModule, MatProgressBarModule, MatDividerModule, MatTableModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>{{ isEdit ? 'Edit' : 'Add' }} Product</h1>
        <button mat-stroked-button routerLink="/products">
          <mat-icon>arrow_back</mat-icon> Back
        </button>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" /> }

      <div class="form-layout">
        <mat-card class="form-card">
          <mat-card-header><mat-card-title>Product Details</mat-card-title></mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()" class="product-form">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Product Name *</mat-label>
                  <input matInput formControlName="name">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Barcode *</mat-label>
                  <input matInput formControlName="barcode">
                  <mat-icon matSuffix>qr_code</mat-icon>
                </mat-form-field>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Category</mat-label>
                  <mat-select formControlName="category">
                    <mat-option [value]="null">No Category</mat-option>
                    @for (cat of categories(); track cat.id) {
                      <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Cost Price</mat-label>
                  <input matInput type="number" formControlName="base_cost_price" min="0">
                  <mat-icon matPrefix>attach_money</mat-icon>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Selling Price *</mat-label>
                  <input matInput type="number" formControlName="base_selling_price" min="0">
                  <mat-icon matPrefix>sell</mat-icon>
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
              </mat-form-field>

              <!-- Product Image Upload -->
              <div class="image-upload">
                <label>Product Image</label>
                <div class="upload-area" (click)="fileInput.click()">
                  @if (imagePreview()) {
                    <img [src]="imagePreview()" alt="Preview">
                  } @else {
                    <mat-icon>add_photo_alternate</mat-icon>
                    <span>Click to upload image</span>
                  }
                </div>
                <input #fileInput type="file" accept="image/*" (change)="onImageChange($event)" hidden>
              </div>

              <mat-checkbox formControlName="is_active">Product is Active</mat-checkbox>

              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
                  @if (saving) { Saving... } @else { Save Product }
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <!-- Variants Card -->
        @if (isEdit && product()) {
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>Product Variants (Size & Color)</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="variant-add">
                <mat-form-field appearance="outline">
                  <mat-label>Color</mat-label>
                  <mat-select [(ngModel)]="newVariantColor">
                    <mat-option [value]="null">No Color</mat-option>
                    @for (c of colors(); track c.id) {
                      <mat-option [value]="c.id">
                        <span class="color-swatch" [style.background]="c.hex_code"></span>{{ c.name }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Size</mat-label>
                  <mat-select [(ngModel)]="newVariantSize">
                    <mat-option [value]="null">No Size</mat-option>
                    @for (s of sizes(); track s.id) {
                      <mat-option [value]="s.id">{{ s.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>SKU</mat-label>
                  <input matInput [(ngModel)]="newVariantSku">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Barcode</mat-label>
                  <input matInput [(ngModel)]="newVariantBarcode">
                </mat-form-field>
                <button mat-raised-button color="accent" (click)="addVariant()">
                  <mat-icon>add</mat-icon> Add Variant
                </button>
              </div>

              @if (product()?.variants?.length) {
                <table mat-table [dataSource]="product()!.variants">
                  <ng-container matColumnDef="color">
                    <th mat-header-cell *matHeaderCellDef>Color</th>
                    <td mat-cell *matCellDef="let v">{{ v.color_detail?.name || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="size">
                    <th mat-header-cell *matHeaderCellDef>Size</th>
                    <td mat-cell *matCellDef="let v">{{ v.size_detail?.name || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="sku">
                    <th mat-header-cell *matHeaderCellDef>SKU</th>
                    <td mat-cell *matCellDef="let v">{{ v.sku }}</td>
                  </ng-container>
                  <ng-container matColumnDef="barcode">
                    <th mat-header-cell *matHeaderCellDef>Barcode</th>
                    <td mat-cell *matCellDef="let v">{{ v.barcode }}</td>
                  </ng-container>
                  <ng-container matColumnDef="stock">
                    <th mat-header-cell *matHeaderCellDef>Stock</th>
                    <td mat-cell *matCellDef="let v">{{ v.stock_quantity }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="variantColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: variantColumns;"></tr>
                </table>
              }
            </mat-card-content>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .form-layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .form-card { }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .product-form { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .image-upload { label { font-size: 14px; color: #666; display: block; margin-bottom: 8px; } }
    .upload-area { border: 2px dashed #ccc; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 120px; justify-content: center; &:hover { border-color: #3f51b5; } img { max-height: 150px; max-width: 200px; object-fit: contain; } mat-icon { font-size: 40px; color: #bbb; } }
    .form-actions { display: flex; justify-content: flex-end; }
    .variant-add { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 16px; }
    .color-swatch { display: inline-block; width: 16px; height: 16px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  `]
})
export class ProductFormComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  isEdit = false;
  loading = false;
  saving = false;
  product = signal<Product | null>(null);
  categories = signal<Category[]>([]);
  colors = signal<Color[]>([]);
  sizes = signal<Size[]>([]);
  imagePreview = signal<string | null>(null);
  selectedFile: File | null = null;

  newVariantColor: number | null = null;
  newVariantSize: number | null = null;
  newVariantSku = '';
  newVariantBarcode = '';
  variantColumns = ['color', 'size', 'sku', 'barcode', 'stock'];

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    barcode: ['', Validators.required],
    category: [null],
    base_cost_price: [0, [Validators.min(0)]],
    base_selling_price: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    is_active: [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    if (id) { this.isEdit = true; this.loadProduct(+id); }
    this.api.getAllCategories().subscribe(cats => this.categories.set(cats));
    this.api.getColors().subscribe(r => this.colors.set(r.results));
    this.api.getSizes().subscribe(r => this.sizes.set(r.results));
  }

  loadProduct(id: number) {
    this.loading = true;
    this.api.getProduct(id).subscribe({
      next: (p) => { this.product.set(p); this.form.patchValue(p); if (p.image) this.imagePreview.set(p.image); this.loading = false; },
      error: () => this.loading = false
    });
  }

  onImageChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const fd = new FormData();
    Object.entries(this.form.value).forEach(([k, v]) => {
      if (v !== null && v !== undefined) fd.append(k, String(v));
    });
    if (this.selectedFile) fd.append('image', this.selectedFile);

    const req = this.isEdit && this.product()
      ? this.api.updateProduct(this.product()!.id, fd)
      : this.api.createProduct(fd);

    req.subscribe({
      next: () => { this.saving = false; this.snackBar.open('Product saved!', '', { duration: 2000 }); this.router.navigate(['/products']); },
      error: (err) => { this.saving = false; this.snackBar.open(err.error?.detail || 'Save failed', 'Close', { duration: 3000 }); }
    });
  }

  addVariant() {
    if (!this.newVariantBarcode) { this.snackBar.open('Barcode is required', 'Close', { duration: 2000 }); return; }
    const data = {
      product: this.product()?.id,
      color: this.newVariantColor,
      size: this.newVariantSize,
      sku: this.newVariantSku,
      barcode: this.newVariantBarcode,
    };
    this.api.createVariant(data).subscribe({
      next: () => { this.snackBar.open('Variant added!', '', { duration: 2000 }); this.loadProduct(this.product()!.id); },
      error: (err) => this.snackBar.open(err.error?.barcode?.[0] || 'Failed', 'Close', { duration: 3000 })
    });
  }
}
