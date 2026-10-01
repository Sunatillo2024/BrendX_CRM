import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { Category, Color, Product, Size, VariantWrite } from '../../../core/models/models';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, TranslatePipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">
        {{ (isEdit ? 'products.edit' : 'products.new') | t }}
      </h1>
      <a class="btn" routerLink="/products">{{ 'common.back' | t }}</a>
    </div>

    <div class="page-body">
      <div class="card">
        <h3 class="card-title">{{ 'common.product' | t }}</h3>
        <div class="form-grid">
          <div class="field">
            <label class="field-label">{{ 'products.name' | t }} *</label>
            <input class="input" [(ngModel)]="model.name" name="name">
          </div>

          <div class="field">
            <label class="field-label">{{ 'common.category' | t }}</label>
            <select class="select" [(ngModel)]="model.category" name="category">
              <option [ngValue]="null">—</option>
              @for (c of categories(); track c.id) {
                <option [ngValue]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label">{{ 'products.barcode' | t }}</label>
            <input class="input" [(ngModel)]="model.barcode" name="barcode"
                   [placeholder]="'common.optional' | t">
          </div>

          <div class="field">
            <label class="field-label">{{ 'products.sellingPrice' | t }} *</label>
            <input class="input" type="number" [(ngModel)]="model.base_selling_price"
                   name="price">
          </div>

          @if (auth.canViewFinancials()) {
            <div class="field">
              <label class="field-label">{{ 'products.costPrice' | t }}</label>
              <input class="input" type="number" [(ngModel)]="model.base_cost_price"
                     name="cost">
            </div>
          }

          <div class="field">
            <label class="field-label">{{ 'products.lowStock' | t }}</label>
            <input class="input" type="number" [(ngModel)]="model.low_stock_threshold"
                   name="threshold">
          </div>

          <div class="field">
            <label class="field-label">{{ 'common.status' | t }}</label>
            <select class="select" [(ngModel)]="model.is_active" name="active">
              <option [ngValue]="true">{{ 'common.active' | t }}</option>
              <option [ngValue]="false">{{ 'common.inactive' | t }}</option>
            </select>
          </div>
        </div>

        <div class="field" style="margin-top:14px">
          <label class="field-label">{{ 'products.description' | t }}</label>
          <textarea class="textarea" [(ngModel)]="model.description" name="description"></textarea>
        </div>
      </div>

      <!-- Variants -->
      <div class="card" style="margin-top:16px">
        <div class="card-title-row">
          <h3 class="card-title">{{ 'products.variants' | t }}</h3>
          <button class="btn sm" (click)="addVariant()">
            <mat-icon>add</mat-icon> {{ 'products.addVariant' | t }}
          </button>
        </div>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>{{ 'common.color' | t }}</th>
                <th>{{ 'common.size' | t }}</th>
                <th>{{ 'products.barcode' | t }}</th>
                @if (auth.canViewFinancials()) {
                  <th class="num">{{ 'products.costPrice' | t }}</th>
                }
                <th class="num">{{ 'products.sellingPrice' | t }}</th>
                <th class="num">{{ 'products.stock' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (v of variants; track $index) {
                <tr>
                  <td>
                    <select class="select" [(ngModel)]="v.color" [name]="'color' + $index">
                      <option [ngValue]="null">—</option>
                      @for (c of colors(); track c.id) {
                        <option [ngValue]="c.id">{{ c.name }}</option>
                      }
                    </select>
                  </td>
                  <td>
                    <select class="select" [(ngModel)]="v.size" [name]="'size' + $index">
                      <option [ngValue]="null">—</option>
                      @for (s of sizes(); track s.id) {
                        <option [ngValue]="s.id">{{ s.name }}</option>
                      }
                    </select>
                  </td>
                  <td>
                    <input class="input" [(ngModel)]="v.barcode" [name]="'barcode' + $index"
                           [placeholder]="'common.optional' | t">
                  </td>
                  @if (auth.canViewFinancials()) {
                    <td>
                      <input class="input" type="number" [(ngModel)]="v.cost_price"
                             [name]="'vcost' + $index">
                    </td>
                  }
                  <td>
                    <input class="input" type="number" [(ngModel)]="v.selling_price"
                           [name]="'vprice' + $index">
                  </td>
                  <td>
                    <input class="input" type="number" [(ngModel)]="v.stock_quantity"
                           [name]="'vstock' + $index">
                  </td>
                  <td class="num">
                    <button class="btn sm danger" (click)="removeVariant($index)">
                      <mat-icon>close</mat-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Inline colour/size creation -->
        <div class="inline-add">
          <input class="input" style="width:150px" [(ngModel)]="newColor" name="newColor"
                 [placeholder]="'common.color' | t">
          <button class="btn sm" (click)="createColor()">
            <mat-icon>add</mat-icon> {{ 'common.add' | t }}
          </button>

          <input class="input" style="width:130px" [(ngModel)]="newSize" name="newSize"
                 [placeholder]="'common.size' | t">
          <select class="select" style="width:150px" [(ngModel)]="newSizeType" name="sizeType">
            @for (t of sizeTypes; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
          <button class="btn sm" (click)="createSize()">
            <mat-icon>add</mat-icon> {{ 'common.add' | t }}
          </button>
        </div>
      </div>

      <div class="btn-row" style="margin-top:18px">
        <button class="btn primary" [disabled]="saving" (click)="save()">
          <mat-icon>save</mat-icon> {{ 'common.save' | t }}
        </button>
        <a class="btn" routerLink="/products">{{ 'common.cancel' | t }}</a>
      </div>
    </div>
  `,
  styles: [`
    .card-title-row { display: flex; align-items: center; justify-content: space-between; }
    .inline-add {
      display: flex; gap: 9px; align-items: center; flex-wrap: wrap;
      margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);
    }
  `],
})
export class ProductFormComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  auth = inject(AuthService);

  categories = signal<Category[]>([]);
  colors = signal<Color[]>([]);
  sizes = signal<Size[]>([]);

  readonly sizeTypes = ['letter', 'numeric', 'age', 'universal'];

  isEdit = false;
  saving = false;
  productId: number | null = null;

  newColor = '';
  newSize = '';
  newSizeType = 'letter';

  model: any = {
    name: '',
    category: null,
    barcode: '',
    base_selling_price: 0,
    base_cost_price: 0,
    low_stock_threshold: 5,
    is_active: true,
    description: '',
  };

  variants: VariantWrite[] = [];

  ngOnInit() {
    this.api.getCategories({ page_size: 200 }).subscribe(r => this.categories.set(r.results));
    this.loadColors();
    this.loadSizes();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.productId = Number(id);
      this.api.getProduct(this.productId).subscribe(product => this.fill(product));
    } else {
      this.addVariant();
    }
  }

  loadColors() {
    this.api.getColors({ page_size: 200 }).subscribe(r => this.colors.set(r.results));
  }

  loadSizes() {
    this.api.getSizes({ page_size: 200 }).subscribe(r => this.sizes.set(r.results));
  }

  fill(product: Product) {
    this.model = {
      name: product.name,
      category: product.category,
      barcode: product.barcode,
      base_selling_price: Number(product.base_selling_price),
      base_cost_price: Number(product.base_cost_price ?? 0),
      low_stock_threshold: product.low_stock_threshold,
      is_active: product.is_active,
      description: product.description,
    };
    this.variants = (product.variants ?? []).map(v => ({
      id: v.id,
      color: v.color,
      size: v.size,
      barcode: v.barcode,
      selling_price: v.selling_price !== null ? Number(v.selling_price) : null,
      cost_price: v.cost_price != null ? Number(v.cost_price) : null,
      stock_quantity: v.stock_quantity,
      low_stock_threshold: v.low_stock_threshold,
      is_active: v.is_active,
    }));
  }

  addVariant() {
    this.variants = [...this.variants, {
      color: null, size: null, barcode: '',
      selling_price: null, cost_price: null, stock_quantity: 0,
      low_stock_threshold: this.model.low_stock_threshold ?? 5, is_active: true,
    }];
  }

  removeVariant(index: number) {
    this.variants = this.variants.filter((_, i) => i !== index);
  }

  createColor() {
    const name = this.newColor.trim();
    if (!name) return;
    this.api.createColor({ name }).subscribe({
      next: color => {
        this.loadColors();
        this.newColor = '';
      },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }

  createSize() {
    const name = this.newSize.trim();
    if (!name) return;
    this.api.createSize({ name, size_type: this.newSizeType }).subscribe({
      next: () => { this.loadSizes(); this.newSize = ''; },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }

  save() {
    if (!this.model.name || !this.model.base_selling_price) return;
    this.saving = true;

    const payload: any = {
      name: this.model.name,
      category: this.model.category,
      barcode: this.model.barcode || '',
      base_selling_price: Number(this.model.base_selling_price),
      low_stock_threshold: Number(this.model.low_stock_threshold || 5),
      is_active: this.model.is_active,
      description: this.model.description,
      variants: this.variants.map(v => ({
        ...(v.id ? { id: v.id } : {}),
        color: v.color,
        size: v.size,
        barcode: v.barcode || '',
        selling_price: v.selling_price === null || v.selling_price === undefined
          ? null : Number(v.selling_price),
        stock_quantity: Number(v.stock_quantity || 0),
        low_stock_threshold: Number(v.low_stock_threshold || 5),
        is_active: true,
      })),
    };

    if (this.auth.canViewFinancials()) {
      payload.base_cost_price = Number(this.model.base_cost_price || 0);
      payload.variants = payload.variants.map((v: any, i: number) => ({
        ...v,
        cost_price: this.variants[i]?.cost_price ?? null,
      }));
    }

    const request = this.isEdit && this.productId
      ? this.api.updateProduct(this.productId, payload)
      : this.api.createProduct(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(this.i18n.t('common.saved'));
        this.router.navigate(['/products']);
      },
      error: err => {
        this.saving = false;
        const body = err.error ?? {};
        const message = typeof body === 'string' ? body : JSON.stringify(body);
        this.toast.error((message || this.i18n.t('common.error')).slice(0, 200));
      },
    });
  }
}
