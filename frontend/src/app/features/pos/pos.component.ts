import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { CartItem, Customer, Product, ProductVariant, SaleType } from '../../core/models/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule,
    MatSnackBarModule, MatProgressBarModule, MatButtonToggleModule,
  ],
  template: `
    <div class="pos-wrapper">
      <!-- LEFT: Product Search -->
      <div class="products-panel">
        <div class="pos-search-bar">
          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Scan barcode or search product</mat-label>
            <input matInput [(ngModel)]="searchQuery" (input)="onSearch()" (keydown.enter)="onBarcodeEnter()" autofocus>
            <mat-icon matSuffix>qr_code_scanner</mat-icon>
          </mat-form-field>
        </div>

        @if (searching) { <mat-progress-bar mode="indeterminate" /> }

        <div class="products-grid">
          @for (product of filteredProducts(); track product.id) {
            <div class="product-tile" (click)="selectProduct(product)">
              <div class="product-tile-img">
                @if (product.image) {
                  <img [src]="product.image" [alt]="product.name">
                } @else {
                  <mat-icon>checkroom</mat-icon>
                }
              </div>
              <div class="product-tile-body">
                <div class="product-tile-name">{{ product.name }}</div>
                <div class="product-tile-price">{{ product.base_selling_price | currency }}</div>
                <div [class]="'product-tile-stock ' + (product.total_stock <= 5 ? 'low' : '')">
                  {{ product.total_stock }} in stock
                </div>
              </div>
            </div>
          }
          @empty {
            <div class="empty-state">
              <mat-icon>search_off</mat-icon>
              <p>{{ searchQuery ? 'No products found' : 'Search or scan a product' }}</p>
            </div>
          }
        </div>
      </div>

      <!-- RIGHT: Cart Panel -->
      <div class="cart-panel">
        <div class="cart-top">
          <div class="cart-title">Current Sale</div>
          <mat-button-toggle-group [(ngModel)]="saleType" style="width:100%;border-radius:8px">
            <mat-button-toggle value="cash" style="flex:1">
              <mat-icon>payments</mat-icon> Cash
            </mat-button-toggle>
            <mat-button-toggle value="credit" style="flex:1">
              <mat-icon>credit_card</mat-icon> Credit
            </mat-button-toggle>
            <mat-button-toggle value="installment" style="flex:1">
              <mat-icon>schedule</mat-icon> Installment
            </mat-button-toggle>
          </mat-button-toggle-group>

          @if (saleType !== 'cash') {
            <div style="position:relative">
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Customer *</mat-label>
                <input matInput [(ngModel)]="customerSearch" (input)="searchCustomers()" [placeholder]="selectedCustomer?.name || 'Search customer...'">
                <mat-icon matPrefix>person_search</mat-icon>
              </mat-form-field>
              @if (customerResults().length) {
                <div class="customer-dropdown">
                  @for (c of customerResults(); track c.id) {
                    <div class="customer-option" (click)="selectCustomer(c)">
                      <span class="fw-600">{{ c.name }}</span>
                      <span style="font-size:12px;color:#94a3b8">{{ c.phone }}</span>
                      <span [class]="'badge ' + (c.outstanding_balance > 0 ? 'badge-warning' : 'badge-success')" style="margin-left:auto">
                        {{ c.outstanding_balance | currency }}
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Cart Items -->
        <div class="cart-items">
          @for (item of cartService.items(); track item.variant.id) {
            <div class="cart-item">
              <div class="cart-item-info">
                <div class="fw-600" style="font-size:13px;color:#0f172a">{{ item.product.name }}</div>
                <div style="font-size:11px;color:#94a3b8">{{ item.variant.color_detail?.name }} آ· {{ item.variant.size_detail?.name }}</div>
              </div>
              <div class="qty-ctrl">
                <button class="qty-btn" (click)="updateQty(item.variant.id, item.quantity - 1)">
                  <mat-icon>remove</mat-icon>
                </button>
                <span class="qty-num">{{ item.quantity }}</span>
                <button class="qty-btn" (click)="updateQty(item.variant.id, item.quantity + 1)">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
              <div class="fw-600" style="min-width:72px;text-align:right">{{ (item.unit_price * item.quantity) | currency }}</div>
              <button class="del-btn" (click)="cartService.removeItem(item.variant.id)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          @empty {
            <div class="empty-cart">
              <mat-icon>shopping_cart</mat-icon>
              <div>Cart is empty</div>
            </div>
          }
        </div>

        <!-- Totals & Checkout -->
        <div class="cart-footer">
          <div class="total-line">
            <span style="color:#64748b">Subtotal</span>
            <span>{{ cartService.subtotal | currency }}</span>
          </div>

          <div class="discount-line">
            <span style="color:#64748b;font-size:13px">Discount</span>
            <div class="discount-input-wrap">
              <mat-icon style="color:#94a3b8;font-size:18px">discount</mat-icon>
              <input type="number" [(ngModel)]="discountAmount" min="0" class="discount-input">
            </div>
          </div>

          <div class="grand-line">
            <span>Total</span>
            <span style="color:#6366f1">{{ grandTotal | currency }}</span>
          </div>

          @if (saleType === 'cash') {
            <div style="margin-bottom:8px">
              <label class="field-label">Cash Received</label>
              <div class="mono-input-wrap">
                <mat-icon style="color:#94a3b8;font-size:18px">payments</mat-icon>
                <input type="number" [(ngModel)]="cashReceived" min="0" class="mono-input">
              </div>
            </div>
            @if (cashReceived >= grandTotal && cashReceived > 0) {
              <div class="change-chip">
                <mat-icon style="font-size:16px">check_circle</mat-icon>
                Change: <strong>{{ (cashReceived - grandTotal) | currency }}</strong>
              </div>
            }
          }

          @if (saleType === 'installment') {
            <div class="installment-row">
              <div>
                <label class="field-label">Down Payment</label>
                <div class="mono-input-wrap">
                  <input type="number" [(ngModel)]="downPayment" min="0" class="mono-input">
                </div>
              </div>
              <div>
                <label class="field-label">Installments</label>
                <div class="mono-input-wrap">
                  <input type="number" [(ngModel)]="installmentCount" min="1" max="60" class="mono-input">
                </div>
              </div>
            </div>
            @if (downPayment >= 0 && installmentCount > 0 && grandTotal > downPayment) {
              <div class="installment-chip">
                Monthly: <strong>{{ ((grandTotal - downPayment) / installmentCount) | currency }}</strong>
              </div>
            }
          }

          <button class="checkout-btn" [disabled]="cartService.items().length === 0 || processing" (click)="checkout()">
            <mat-icon>point_of_sale</mat-icon>
            {{ processing ? 'Processing...' : 'Complete ' + (saleType | titlecase) + ' Sale' }}
          </button>

          @if (cartService.items().length > 0) {
            <button class="clear-btn" (click)="cartService.clearCart()">
              <mat-icon>delete_sweep</mat-icon> Clear Cart
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* POS layout */
    :host { display: block; height: calc(100vh - 61px); overflow: hidden; }
    .pos-wrapper { display: grid; grid-template-columns: 1fr 380px; gap: 0; height: 100%; }

    /* Products panel */
    .products-panel {
      background: #f8fafc; border-right: 1px solid #e2e8f0;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .pos-search-bar { padding: 14px 16px; background: white; border-bottom: 1px solid #e2e8f0; }
    .products-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 12px; padding: 16px; overflow-y: auto; flex: 1;
    }
    .product-tile {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      cursor: pointer; overflow: hidden;
      transition: box-shadow 0.18s, transform 0.18s;
      &:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1); transform: translateY(-2px); }
      &:active { transform: scale(0.98); }
    }
    .product-tile-img {
      height: 90px; display: flex; align-items: center; justify-content: center;
      background: #f1f5f9; overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
      mat-icon { font-size: 36px; color: #cbd5e1; }
    }
    .product-tile-body { padding: 8px 10px; }
    .product-tile-name { font-size: 12.5px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-tile-price { font-size: 13px; font-weight: 700; color: #6366f1; margin: 2px 0; }
    .product-tile-stock { font-size: 11px; color: #64748b; &.low { color: #ef4444; font-weight: 600; } }
    .empty-state { grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #94a3b8;
      mat-icon { font-size: 52px; width: 52px; height: 52px; display: block; margin: 0 auto 12px; }
      p { font-size: 14px; }
    }

    /* Cart panel */
    .cart-panel { background: white; display: flex; flex-direction: column; overflow: hidden; }
    .cart-top { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 10px; }
    .cart-title { font-size: 15px; font-weight: 700; color: #0f172a; }

    /* Customer dropdown */
    .customer-dropdown {
      position: absolute; left: 0; right: 0; top: 100%; z-index: 200;
      background: white; border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-height: 200px; overflow-y: auto;
    }
    .customer-option {
      padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #f8fafc;
      &:hover { background: #f8fafc; }
    }

    /* Cart items */
    .cart-items { flex: 1; overflow-y: auto; padding: 8px 12px; }
    .cart-item {
      display: flex; align-items: center; gap: 8px; padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      &:last-child { border-bottom: none; }
    }
    .cart-item-info { flex: 1; min-width: 0; }
    .qty-ctrl { display: flex; align-items: center; gap: 2px; }
    .qty-btn {
      width: 26px; height: 26px; border: 1px solid #e2e8f0; border-radius: 6px;
      background: #f8fafc; cursor: pointer; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #475569; }
      &:hover { background: #e2e8f0; }
    }
    .qty-num { width: 26px; text-align: center; font-weight: 700; font-size: 14px; color: #0f172a; }
    .del-btn {
      width: 26px; height: 26px; border: none; background: transparent; cursor: pointer;
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
      &:hover { background: #fee2e2; mat-icon { color: #ef4444; } }
    }
    .empty-cart {
      text-align: center; padding: 48px 20px; color: #cbd5e1;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 8px; }
      div { font-size: 14px; }
    }

    /* Cart footer */
    .cart-footer {
      padding: 12px 16px 16px; border-top: 1px solid #e2e8f0;
      display: flex; flex-direction: column; gap: 8px;
    }
    .total-line { display: flex; justify-content: space-between; font-size: 14px; }
    .discount-line { display: flex; align-items: center; justify-content: space-between; }
    .discount-input-wrap {
      display: flex; align-items: center; gap: 6px;
      border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; width: 120px;
    }
    .discount-input { border: none; outline: none; font-size: 14px; font-family: inherit; width: 80px; text-align: right; color: #0f172a; }
    .grand-line { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #0f172a; }
    .field-label { font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .mono-input-wrap {
      display: flex; align-items: center; gap: 6px;
      border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 6px 10px;
      &:focus-within { border-color: #6366f1; }
    }
    .mono-input { border: none; outline: none; font-size: 14px; font-family: inherit; flex: 1; color: #0f172a; }
    .installment-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .change-chip { background: #d1fae5; color: #059669; border-radius: 6px; padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .installment-chip { background: #dbeafe; color: #2563eb; border-radius: 6px; padding: 6px 12px; font-size: 13px; }
    .checkout-btn {
      width: 100%; height: 48px; border-radius: 10px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6366f1, #4f46e5); color: white;
      font-size: 15px; font-weight: 600; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: opacity 0.2s, transform 0.15s;
      mat-icon { font-size: 20px; }
      &:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .clear-btn {
      width: 100%; height: 36px; border-radius: 8px; border: 1px solid #fee2e2; cursor: pointer;
      background: white; color: #ef4444; font-size: 13px; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      &:hover { background: #fee2e2; }
      mat-icon { font-size: 18px; }
    }
  `]
})

export class PosComponent implements OnInit {
  private api = inject(ApiService);
  cartService = inject(CartService);
  private snackBar = inject(MatSnackBar);
  private auth = inject(AuthService);

  searchQuery = '';
  saleType: SaleType = 'cash';
  discountAmount = 0;
  cashReceived = 0;
  downPayment = 0;
  installmentCount = 3;
  customerSearch = '';
  selectedCustomer: Customer | null = null;
  processing = false;
  searching = false;

  private allProducts = signal<Product[]>([]);
  customerResults = signal<Customer[]>([]);
  filteredProducts = computed(() => {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.allProducts().slice(0, 24);
    return this.allProducts().filter(p =>
      p.name.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  });

  get grandTotal(): number {
    return Math.max(0, this.cartService.subtotal - this.discountAmount);
  }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.api.getProducts({ page_size: 100 }).subscribe(res => {
      this.allProducts.set(res.results);
    });
  }

  onSearch() { /* computed handles filtering */ }

  onBarcodeEnter() {
    if (!this.searchQuery) return;
    this.searching = true;
    this.api.getProductByBarcode(this.searchQuery).subscribe({
      next: (res: any) => {
        this.searching = false;
        if (res.matched_variant) {
          this.addVariantToCart(res.product, res.matched_variant);
        } else if (res.id) {
          // Product found but no specific variant - select first variant
          const prod = res as Product;
          if (prod.variants?.length) this.addVariantToCart(prod, prod.variants[0]);
        }
        this.searchQuery = '';
      },
      error: () => { this.searching = false; }
    });
  }

  selectProduct(product: Product) {
    if (product.variants?.length === 1) {
      this.addVariantToCart(product, product.variants[0]);
    } else if (product.variants?.length > 1) {
      // Auto-select first variant if multiple (could show dialog)
      this.addVariantToCart(product, product.variants[0]);
    }
  }

  addVariantToCart(product: Product, variant: ProductVariant) {
    if (variant.stock_quantity <= 0) {
      this.snackBar.open('Product is out of stock', 'Close', { duration: 3000, panelClass: 'error-snack' });
      return;
    }
    this.cartService.addItem(product, variant);
    this.snackBar.open(`${product.name} added to cart`, '', { duration: 1500 });
  }

  updateQty(variantId: number, qty: number) {
    this.cartService.updateQuantity(variantId, qty);
  }

  searchCustomers() {
    if (this.customerSearch.length < 2) { this.customerResults.set([]); return; }
    this.api.getCustomers({ search: this.customerSearch, customer_type: this.saleType }).subscribe(res => {
      this.customerResults.set(res.results.slice(0, 5));
    });
  }

  selectCustomer(customer: Customer) {
    this.selectedCustomer = customer;
    this.customerSearch = customer.name;
    this.customerResults.set([]);
  }

  checkout() {
    if (!this.cartService.items().length) return;
    if (this.saleType !== 'cash' && !this.selectedCustomer) {
      this.snackBar.open('Please select a customer for credit/installment sales', 'Close', { duration: 3000 });
      return;
    }

    this.processing = true;
    const payload: any = {
      sale_type: this.saleType,
      customer_id: this.selectedCustomer?.id ?? null,
      discount_amount: this.discountAmount,
      paid_amount: this.saleType === 'cash' ? this.grandTotal : (this.saleType === 'installment' ? this.downPayment : 0),
      items: this.cartService.items().map(item => ({
        product_variant_id: item.variant.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
      })),
    };

    if (this.saleType === 'installment') {
      payload.down_payment = this.downPayment;
      payload.installment_count = this.installmentCount;
    }

    this.api.createSale(payload).subscribe({
      next: (sale) => {
        this.processing = false;
        this.cartService.clearCart();
        this.selectedCustomer = null;
        this.customerSearch = '';
        this.discountAmount = 0;
        this.snackBar.open(`Sale ${sale.sale_number} completed!`, 'Print', { duration: 5000 })
          .onAction().subscribe(() => {
            window.open(`${environment.apiUrl}/sales/${sale.id}/receipt_pdf/`, '_blank');
          });
      },
      error: (err) => {
        this.processing = false;
        this.snackBar.open(err.error?.detail || 'Sale failed', 'Close', { duration: 4000 });
      }
    });
  }
}
