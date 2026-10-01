import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MoneyPipe, TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { Category, Product } from '../../../core/models/models';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ 'products.title' | t }}</h1>
        <div class="page-sub">{{ count() }} {{ 'products.title' | t }}</div>
      </div>
      <div class="toolbar">
        <div class="search-box" style="width:250px">
          <mat-icon>search</mat-icon>
          <input [(ngModel)]="search" (input)="onSearch()"
                 [placeholder]="'common.search' | t">
        </div>
        <select class="select" style="width:190px" [(ngModel)]="categoryFilter" (change)="load()">
          <option value="">{{ 'common.all' | t }}</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        @if (auth.isManager()) {
          <a class="btn primary" routerLink="/products/new">
            <mat-icon>add</mat-icon> {{ 'products.new' | t }}
          </a>
        }
      </div>
    </div>

    <div class="page-body">
      <div class="card pad-0">
        @if (loading()) {
          <div style="padding:16px">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="skeleton skeleton-line" style="height:34px;margin-bottom:8px"></div>
            }
          </div>
        } @else if (products().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'products.name' | t }}</th>
                  <th>{{ 'common.category' | t }}</th>
                  <th>{{ 'products.barcode' | t }}</th>
                  @if (auth.canViewFinancials()) {
                    <th class="num">{{ 'products.costPrice' | t }}</th>
                  }
                  <th class="num">{{ 'products.sellingPrice' | t }}</th>
                  <th class="num">{{ 'products.stock' | t }}</th>
                  <th>{{ 'common.status' | t }}</th>
                  @if (auth.isManager()) { <th class="actions"></th> }
                </tr>
              </thead>
              <tbody>
                @for (p of products(); track p.id) {
                  <tr>
                    <td>
                      <div class="cell-media">
                        <div class="thumb">
                          @if (p.image) { <img [src]="p.image" [alt]="p.name"> }
                          @else { <mat-icon>checkroom</mat-icon> }
                        </div>
                        <span class="strong">{{ p.name }}</span>
                      </div>
                    </td>
                    <td>{{ p.category_name || '—' }}</td>
                    <td class="small muted">{{ p.barcode }}</td>
                    @if (auth.canViewFinancials()) {
                      <td class="num muted">{{ p.base_cost_price | money }}</td>
                    }
                    <td class="num strong">{{ p.base_selling_price | money }}</td>
                    <td class="num">
                      <span class="badge" [class.danger]="p.total_stock <= 0"
                            [class.warn]="p.total_stock > 0 && p.total_stock <= p.low_stock_threshold">
                        {{ p.total_stock }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" [class.success]="p.is_active" [class.danger]="!p.is_active">
                        <span class="dot"></span>
                        {{ (p.is_active ? 'common.active' : 'common.inactive') | t }}
                      </span>
                    </td>
                    @if (auth.isManager()) {
                      <td class="actions">
                        <div class="popover-host">
                          <button class="icon-btn" (click)="toggleMenu(p.id); $event.stopPropagation()">
                            <mat-icon>more_horiz</mat-icon>
                          </button>
                          @if (openMenuId() === p.id) {
                            <div class="menu" style="right:0;top:calc(100% + 4px)"
                                 (click)="$event.stopPropagation()">
                              <a class="menu-item" [routerLink]="['/products', p.id, 'edit']">
                                <mat-icon>edit</mat-icon> {{ 'common.edit' | t }}
                              </a>
                              <a class="menu-item" routerLink="/stock"
                                 [queryParams]="{ q: p.barcode }">
                                <mat-icon>warehouse</mat-icon> {{ 'menu.stock' | t }}
                              </a>
                              <div class="menu-sep"></div>
                              <button class="menu-item danger" (click)="deactivate(p)">
                                <mat-icon>{{ p.is_active ? 'visibility_off' : 'delete' }}</mat-icon>
                                {{ p.is_active ? ('employees.deactivate' | t) : ('common.delete' | t) }}
                              </button>
                            </div>
                          }
                        </div>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (count() > pageSize) {
            <div class="pagination">
              <button class="btn sm" [disabled]="page === 1" (click)="goTo(page - 1)">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="page-info">{{ page }} / {{ totalPages() }}</span>
              <button class="btn sm" [disabled]="page >= totalPages()" (click)="goTo(page + 1)">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
        } @else {
          <div class="empty-state">
            <mat-icon>inventory_2</mat-icon>
            <h4>{{ 'products.emptyTitle' | t }}</h4>
            <p>{{ 'products.emptyHint' | t }}</p>
            @if (auth.isManager()) {
              <a class="btn primary" routerLink="/products/new">
                <mat-icon>add</mat-icon> {{ 'products.new' | t }}
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cell-media { display: flex; align-items: center; gap: 11px; }
    .thumb {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; overflow: hidden;
      background: var(--surface-3); display: flex; align-items: center; justify-content: center;
      img { width: 100%; height: 100%; object-fit: cover; }
      mat-icon { font-size: 19px; width: 19px; height: 19px; color: var(--text-3); }
    }
    .popover-host { display: inline-block; }
    td.actions .menu { min-width: 180px; }
  `],
})
export class ProductListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private i18n = inject(TranslationService);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  count = signal(0);
  loading = signal(true);
  openMenuId = signal<number | null>(null);

  search = '';
  categoryFilter = '';
  page = 1;
  readonly pageSize = 20;

  private timer: any = null;

  ngOnInit() {
    this.search = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.api.getCategories({ page_size: 200 }).subscribe(res => this.categories.set(res.results));
    this.load();
  }

  @HostListener('document:click')
  closeMenu() {
    this.openMenuId.set(null);
  }

  onSearch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.page = 1; this.load(); }, 250);
  }

  load() {
    this.loading.set(true);
    this.api.getProducts({
      page: this.page,
      search: this.search || undefined,
      category: this.categoryFilter || undefined,
    }).subscribe(res => {
      this.products.set(res.results);
      this.count.set(res.count);
      this.loading.set(false);
    });
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.count() / this.pageSize));
  }

  goTo(page: number) {
    this.page = page;
    this.load();
  }

  toggleMenu(id: number) {
    this.openMenuId.update(current => (current === id ? null : id));
  }

  async deactivate(product: Product) {
    this.openMenuId.set(null);
    const approved = await this.confirm.confirm({
      title: this.i18n.t('products.deactivateTitle'),
      message: `${product.name} — ${this.i18n.t('products.deactivateHint')}`,
      confirmLabel: this.i18n.t('common.confirm'),
      danger: true,
    });
    if (!approved) return;

    this.api.deactivateProduct(product.id).subscribe({
      next: () => { this.toast.success(this.i18n.t('common.saved')); this.load(); },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }
}
