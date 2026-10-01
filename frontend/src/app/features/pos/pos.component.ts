import { CommonModule } from '@angular/common';
import {
  Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MoneyPipe, TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { PaymentMethod, Sale, VariantSearchResult } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="pos">
      <!-- ── product picker ── -->
      <section class="picker">
        <div class="pos-search">
          <mat-icon class="scan-icon">qr_code_scanner</mat-icon>
          <input #searchInput [(ngModel)]="query" name="query" autocomplete="off"
                 (input)="onQueryChange()" (keydown.enter)="onEnter()"
                 [placeholder]="'pos.searchPlaceholder' | t"
                 [attr.aria-label]="'pos.searchPlaceholder' | t">
          @if (query) {
            <button class="icon-btn" (click)="resetSearch()" aria-label="Clear">
              <mat-icon>close</mat-icon>
            </button>
          }
          <span class="kbd-hint"><kbd>F2</kbd></span>
        </div>

        <div class="results">
          @if (loading()) {
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="skeleton pcard-skeleton"></div>
            }
          } @else {
            @for (item of results(); track item.id) {
              <button class="pcard" [class.out]="item.stock_quantity <= 0"
                      [class.added]="highlightId() === item.id"
                      (click)="addToCart(item)">
                <div class="pcard-img">
                  @if (item.image) { <img [src]="item.image" [alt]="item.product_name"> }
                  @else { <mat-icon>checkroom</mat-icon> }
                  @if (item.stock_quantity <= 0) {
                    <span class="badge danger out-badge">{{ 'pos.outOfStock' | t }}</span>
                  } @else if (item.stock_quantity <= 5) {
                    <span class="badge warn out-badge">{{ item.stock_quantity }}</span>
                  }
                </div>
                <div class="pcard-body">
                  <div class="pcard-name truncate" [title]="item.product_name">{{ item.product_name }}</div>
                  <div class="pcard-meta">
                    {{ item.category_name || '—' }}
                    @if (item.color_name || item.size_name) {
                      · {{ item.color_name || '—' }} / {{ item.size_name || '—' }}
                    }
                  </div>
                  <div class="pcard-foot">
                    <span class="pcard-price">{{ item.price | money }}</span>
                    <span class="pcard-stock">{{ item.stock_quantity }} {{ 'pos.pcs' | t }}</span>
                  </div>
                </div>
              </button>
            } @empty {
              <div class="empty-state" style="grid-column:1/-1">
                <mat-icon>{{ query ? 'search_off' : 'qr_code_scanner' }}</mat-icon>
                <h4>{{ query ? ('pos.noResults' | t) : ('pos.getStarted' | t) }}</h4>
                <p>{{ query ? ('pos.noResultsHint' | t) : ('pos.scan' | t) }}</p>
              </div>
            }
          }
        </div>

        <div class="pos-shortcuts">
          <span><kbd>F2</kbd> {{ 'pos.focusSearch' | t }}</span>
          <span><kbd>Enter</kbd> {{ 'pos.scanAdd' | t }}</span>
          <span><kbd>F4</kbd> {{ 'pos.paymentShortcut' | t }}</span>
        </div>
      </section>

      <!-- ── cart ── -->
      <aside class="cart">
        <header class="cart-head">
          <div class="section-title">
            <mat-icon>shopping_cart</mat-icon> {{ 'pos.cart' | t }}
          </div>
          <div class="flex gap-8" style="align-items:center">
            <span class="badge info">{{ cart.itemCount }}</span>
            @if (cart.items().length) {
              <button class="icon-btn" (click)="clearCart()" [attr.aria-label]="'pos.clear' | t">
                <mat-icon>delete_sweep</mat-icon>
              </button>
            }
          </div>
        </header>

        <div class="cart-items">
          @for (line of cart.items(); track line.variantId) {
            <div class="cart-line" [class.flash]="highlightId() === line.variantId">
              <div class="line-info">
                <div class="line-name truncate" [title]="line.productName">{{ line.productName }}</div>
                <div class="line-variant">
                  {{ line.colorName || '—' }} / {{ line.sizeName || '—' }}
                  · {{ line.unitPrice | money }}
                </div>
              </div>
              <div class="qty">
                <button (click)="changeQty(line.variantId, -1)" aria-label="minus">
                  <mat-icon>remove</mat-icon>
                </button>
                <span>{{ line.quantity }}</span>
                <button [disabled]="line.quantity >= line.stockQuantity"
                        (click)="changeQty(line.variantId, 1)" aria-label="plus">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
              <div class="line-total">{{ line.unitPrice * line.quantity | money }}</div>
              <button class="line-del" (click)="cart.remove(line.variantId)" aria-label="remove">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          } @empty {
            <div class="empty-state">
              <mat-icon>shopping_cart</mat-icon>
              <h4>{{ 'pos.emptyCart' | t }}</h4>
              <p>{{ 'pos.emptyCartHint' | t }}</p>
            </div>
          }
        </div>

        <footer class="cart-foot">
          <div class="sum-row">
            <span class="muted small">{{ 'pos.subtotal' | t }}</span>
            <span class="small strong">{{ total() | money }}</span>
          </div>
          <div class="sum-row total-row">
            <span>{{ 'common.total' | t }}</span>
            <span class="grand">{{ total() | money }}</span>
          </div>
          <button class="btn primary lg block checkout" [disabled]="!cart.items().length"
                  (click)="openPayment()">
            <mat-icon>point_of_sale</mat-icon> {{ 'pos.pay' | t }}
          </button>
        </footer>
      </aside>
    </div>

    <!-- ── payment modal ── -->
    @if (paymentOpen()) {
      <div class="modal-backdrop" (click)="closePayment()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <h3>{{ 'pos.paymentMethod' | t }}</h3>
              <div class="muted small">
                {{ cart.itemCount }} {{ 'pos.items' | t }}
              </div>
            </div>
            <button class="icon-btn" (click)="closePayment()" aria-label="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="modal-body">
            <div class="pay-total">
              <span class="muted small">{{ 'common.total' | t }}</span>
              <strong>{{ total() | money }}</strong>
            </div>

            <div class="pay-methods">
              @for (m of paymentMethods; track m) {
                <button class="pay-method" [class.active]="paymentMethod === m"
                        (click)="setPayment(m)">
                  <mat-icon>{{ methodIcon(m) }}</mat-icon>
                  {{ ('payment.' + m) | t }}
                </button>
              }
            </div>

            @if (paymentMethod !== 'card') {
              <div class="field mt-12">
                <label class="field-label">{{ 'pos.received' | t }}</label>
                <input class="input num-input" #cashInput type="number" min="0" step="any"
                       [(ngModel)]="received" (keydown.enter)="pay()"
                       placeholder="0">
                <div class="quick-cash">
                  @for (q of quickCash(); track q) {
                    <button class="period-btn" (click)="received = q">{{ q | money: false }}</button>
                  }
                  <button class="period-btn" (click)="received = total()">
                    {{ 'pos.exact' | t }}
                  </button>
                </div>
              </div>
            }

            @if (paymentMethod === 'mixed') {
              <div class="field mt-12">
                <label class="field-label">{{ 'pos.cardAmount' | t }}</label>
                <input class="input num-input" type="number" min="0" step="any"
                       [(ngModel)]="cardAmount" (keydown.enter)="pay()" placeholder="0">
              </div>
            }

            @if (paymentMethod !== 'card') {
              <div class="change-box" [class.bad]="change() !== null && change()! < 0"
                   [class.ok]="change() !== null && change()! >= 0">
                <span class="muted small">{{ 'pos.change' | t }}</span>
                @if (change() === null) {
                  <strong class="muted">—</strong>
                } @else if (change()! < 0) {
                  <strong>{{ 'pos.notEnoughCash' | t }}</strong>
                } @else {
                  <strong>{{ change() | money }}</strong>
                }
              </div>
            }
          </div>

          <div class="modal-foot">
            <button class="btn" (click)="closePayment()">{{ 'common.cancel' | t }}</button>
            <button class="btn primary lg" [disabled]="!canPay()" (click)="pay()">
              <mat-icon>{{ processing() ? 'hourglass_top' : 'check_circle' }}</mat-icon>
              {{ processing() ? ('pos.processing' | t) : ('pos.confirmPayment' | t) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── success state ── -->
    @if (completedSale(); as sale) {
      <div class="modal-backdrop">
        <div class="modal success-modal">
          <div class="success-body">
            <div class="success-icon"><mat-icon>check</mat-icon></div>
            <h3>{{ 'pos.saleDone' | t }}</h3>
            <p class="muted">
              {{ 'sales.number' | t }} <strong>{{ sale.sale_number }}</strong>
              · {{ sale.total_amount | money }}
            </p>
            @if (sale.change_amount > 0) {
              <div class="change-pill">
                {{ 'pos.change' | t }}: <strong>{{ sale.change_amount | money }}</strong>
              </div>
            }
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="newOrder()">
              <mat-icon>add</mat-icon> {{ 'pos.newOrder' | t }}
            </button>
            <button class="btn primary" (click)="printReceipt(sale.id)">
              <mat-icon>print</mat-icon> {{ 'pos.printReceipt' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .pos {
      display: grid; grid-template-columns: 1fr 384px;
      height: calc(100vh - 64px);
    }

    /* ── picker ── */
    .picker { display: flex; flex-direction: column; overflow: hidden; }
    .pos-search {
      display: flex; align-items: center; gap: 12px; margin: 16px 18px 4px;
      padding: 0 16px; height: 56px; background: var(--surface);
      border: 1.5px solid var(--border); border-radius: 14px;
      box-shadow: var(--shadow-xs);
      transition: border-color 160ms, box-shadow 160ms;
      &:focus-within { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-ring); }
      .scan-icon { color: var(--primary); font-size: 24px; width: 24px; height: 24px; }
      input {
        flex: 1; border: none; outline: none; background: none;
        font-size: 17px; font-family: inherit; color: var(--text); min-width: 0;
        font-weight: 500;
        &::placeholder { color: var(--text-3); }
      }
    }
    .kbd-hint { flex-shrink: 0; }

    .results {
      flex: 1; overflow-y: auto; padding: 16px 18px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
      gap: 14px; align-content: start;
    }

    .pcard {
      display: flex; flex-direction: column; text-align: left; padding: 0; overflow: hidden;
      background: var(--surface); border: 1px solid var(--border); border-radius: 13px;
      cursor: pointer; font-family: inherit;
      transition: box-shadow 160ms var(--ease), transform 160ms var(--ease),
                  border-color 160ms;
      &:hover:not(.out) {
        box-shadow: var(--shadow-md); transform: translateY(-3px); border-color: var(--border-2);
      }
      &.out { opacity: .55; cursor: not-allowed; }
      &.added { animation: pop 200ms var(--ease); border-color: var(--primary); }
    }
    .pcard-skeleton { height: 168px; border-radius: 13px; }
    .pcard-img {
      height: 96px; display: flex; align-items: center; justify-content: center;
      background: var(--surface-3); position: relative;
      img { width: 100%; height: 100%; object-fit: cover; }
      mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--text-3); opacity: .6; }
    }
    .out-badge { position: absolute; top: 8px; right: 8px; }
    .pcard-body { padding: 10px 12px 12px; }
    .pcard-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
    .pcard-meta { font-size: 11.5px; color: var(--text-3); margin: 3px 0 8px; }
    .pcard-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .pcard-price { font-size: 14px; font-weight: 700; color: var(--primary); }
    .pcard-stock { font-size: 11px; color: var(--text-3); }
    .pos-shortcuts {
      display: flex; gap: 18px; padding: 9px 20px; border-top: 1px solid var(--border);
      background: var(--surface); font-size: 11.5px; color: var(--text-3);
      span { display: inline-flex; align-items: center; gap: 6px; }
    }

    /* ── cart ── */
    .cart {
      background: var(--surface); display: flex; flex-direction: column;
      border-left: 1px solid var(--border);
    }
    .cart-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px; border-bottom: 1px solid var(--border);
    }
    .cart-head .section-title { margin: 0; font-size: 15px; }
    .cart-items { flex: 1; overflow-y: auto; padding: 8px 14px; }
    .cart-line {
      display: flex; align-items: center; gap: 8px; padding: 11px 4px;
      border-bottom: 1px solid var(--border);
      &:last-child { border-bottom: none; }
      &.flash { animation: rowFlash 900ms var(--ease); border-radius: 8px; }
    }
    .line-info { flex: 1; min-width: 0; }
    .line-name { font-size: 13px; font-weight: 600; }
    .line-variant { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .qty {
      display: flex; align-items: center; gap: 4px;
      button {
        width: 27px; height: 27px; border-radius: 8px; border: 1px solid var(--border);
        background: var(--surface-2); cursor: pointer; display: flex; align-items: center;
        justify-content: center; padding: 0; color: var(--text-2);
        transition: background 140ms;
        &:hover:not(:disabled) { background: var(--primary-soft); color: var(--primary); }
        &:disabled { opacity: .4; cursor: not-allowed; }
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      span { width: 26px; text-align: center; font-weight: 700; font-size: 13.5px; }
    }
    .line-total { min-width: 88px; text-align: right; font-weight: 600; font-size: 13px;
      font-variant-numeric: tabular-nums; }
    .line-del {
      border: none; background: none; cursor: pointer; color: var(--text-3);
      display: flex; padding: 4px; border-radius: 7px;
      transition: color 140ms, background 140ms;
      &:hover { color: var(--danger); background: var(--danger-soft); }
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }

    .cart-foot {
      border-top: 1px solid var(--border); padding: 14px 18px 18px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .sum-row { display: flex; align-items: center; justify-content: space-between; }
    .total-row {
      padding-top: 6px; margin-top: 2px; border-top: 1px dashed var(--border);
      font-size: 14px; font-weight: 700;
    }
    .grand { font-size: 22px; font-weight: 800; color: var(--primary); letter-spacing: -.5px; }
    .checkout { margin-top: 6px; }

    /* ── payment modal ── */
    .pay-total {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; background: var(--surface-2); border-radius: var(--radius);
      margin-bottom: 16px;
      strong { font-size: 22px; font-weight: 800; color: var(--primary); }
    }
    .pay-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .pay-method {
      height: 58px; border-radius: 11px; border: 1.5px solid var(--border);
      background: var(--surface); font-size: 12.5px; font-weight: 600; color: var(--text-2);
      cursor: pointer; font-family: inherit; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 3px;
      transition: all 150ms var(--ease);
      mat-icon { font-size: 19px; width: 19px; height: 19px; }
      &:hover { border-color: var(--border-2); }
      &.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
    }
    .num-input { text-align: right; font-weight: 700; font-size: 16px; height: 46px; }
    .quick-cash { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
    .change-box {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 14px; padding: 14px 16px; border-radius: var(--radius);
      background: var(--surface-2); border: 1.5px solid var(--border);
      strong { font-size: 20px; font-weight: 800; }
      &.ok { background: var(--success-soft); border-color: transparent;
             color: var(--success); strong { color: var(--success); } }
      &.bad { background: var(--danger-soft); border-color: transparent;
              color: var(--danger); strong { color: var(--danger); font-size: 14px; } }
    }

    /* ── success ── */
    .success-modal { max-width: 400px; }
    .success-body { padding: 32px 24px 8px; text-align: center; }
    .success-icon {
      width: 68px; height: 68px; border-radius: 50%; margin: 0 auto 16px;
      background: var(--success-soft); color: var(--success);
      display: flex; align-items: center; justify-content: center;
      animation: pop 320ms var(--ease);
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
    }
    .success-body h3 { font-size: 19px; margin-bottom: 6px; }
    .change-pill {
      display: inline-flex; gap: 6px; align-items: center; margin-top: 14px;
      padding: 9px 16px; border-radius: 20px;
      background: var(--primary-soft); color: var(--primary); font-size: 14px;
      strong { font-size: 16px; }
    }

    @media (max-width: 1050px) {
      .pos { grid-template-columns: 1fr 330px; }
    }
    @media (max-width: 880px) {
      .pos { grid-template-columns: 1fr; height: auto; }
      .cart { border-left: none; border-top: 1px solid var(--border); }
      .results { max-height: 46vh; }
    }
  `],
})
export class PosComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  i18n = inject(TranslationService);
  cart = inject(CartService);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cashInput') cashInput?: ElementRef<HTMLInputElement>;

  readonly paymentMethods: PaymentMethod[] = ['cash', 'card', 'mixed'];

  query = '';
  paymentMethod: PaymentMethod = 'cash';
  received: number | null = null;
  cardAmount: number | null = null;

  results = signal<VariantSearchResult[]>([]);
  loading = signal(true);
  processing = signal(false);
  paymentOpen = signal(false);
  completedSale = signal<Sale | null>(null);
  highlightId = signal<number | null>(null);

  private searchTimer: any = null;
  private highlightTimer: any = null;

  readonly total = computed(() => this.cart.subtotal);

  /**
   * Change to give back. A plain method (not a computed) on purpose:
   * `received` / `cardAmount` / `paymentMethod` are two-way bound with ngModel,
   * not signals, so a signal computed would never re-evaluate when the cashier
   * types the amount. As a method it re-runs on every change detection cycle.
   */
  change(): number | null {
    if (this.paymentMethod === 'card') return null;
    const paid = Number(this.received ?? 0) + Number(this.cardAmount ?? 0);
    if (!paid) return null;
    return paid - this.total();
  }

  readonly quickCash = computed(() => {
    const t = this.total();
    const notes = [10000, 20000, 50000, 100000, 200000];
    const suggestions = notes.filter(n => n >= t);
    return (suggestions.length ? suggestions : [Math.ceil(t / 10000) * 10000]).slice(0, 3);
  });

  ngOnInit() {
    this.loadPopular();
  }

  // ── keyboard-first POS ──────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (event.key === 'F2') { event.preventDefault(); this.focusSearch(); }
    else if (event.key === 'F4') { event.preventDefault(); this.openPayment(); }
    else if (event.key === 'Escape') {
      if (this.paymentOpen()) this.closePayment();
      else if (this.completedSale()) this.newOrder();
    }
  }

  focusSearch() {
    const el = this.searchInput?.nativeElement;
    el?.focus();
    el?.select();
  }

  loadPopular() {
    this.loading.set(true);
    this.api.searchVariants('', 60).subscribe({
      next: res => { this.results.set(res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onQueryChange() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.search(), 200);
  }

  search() {
    const q = this.query.trim();
    if (!q) { this.loadPopular(); return; }
    this.api.searchVariants(q, 40).subscribe(res => this.results.set(res));
  }

  /** Enter = barcode scanner input. */
  onEnter() {
    const code = this.query.trim();
    if (!code) return;

    this.api.lookupBarcode(code).subscribe({
      next: (res: any) => {
        if (res.type === 'variant') {
          this.addToCart(res.variant);
          this.resetSearch();
          return;
        }
        if (res.variants?.length === 1) {
          this.addToCart(res.variants[0]);
          this.resetSearch();
          return;
        }
        this.results.set(res.variants ?? []);
        this.toast.info(this.i18n.t('pos.selectVariant'));
      },
      error: () => this.search(),
    });
  }

  resetSearch() {
    this.query = '';
    this.loadPopular();
    this.focusSearch();
  }

  addToCart(item: VariantSearchResult) {
    if (item.stock_quantity <= 0) {
      this.toast.warn(this.i18n.t('pos.outOfStock'));
      return;
    }
    if (!this.cart.add(item)) {
      this.toast.warn(this.i18n.t('pos.onlyStock'));
      return;
    }
    this.flash(item.id);
    this.toast.success(`${item.product_name} · ${this.i18n.t('pos.addedToCart')}`, 1600);
  }

  changeQty(variantId: number, delta: number) {
    const line = this.cart.items().find(i => i.variantId === variantId);
    if (!line) return;
    const next = line.quantity + delta;
    if (next > line.stockQuantity) {
      this.toast.warn(this.i18n.t('pos.onlyStock'));
      return;
    }
    this.cart.setQuantity(variantId, next);
    this.flash(variantId);
  }

  private flash(variantId: number) {
    this.highlightId.set(variantId);
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightId.set(null), 900);
  }

  methodIcon(m: PaymentMethod): string {
    return m === 'cash' ? 'payments' : m === 'card' ? 'credit_card' : 'call_split';
  }

  openPayment() {
    if (!this.cart.items().length) return;
    this.paymentOpen.set(true);
    this.setPayment(this.paymentMethod);
    setTimeout(() => this.cashInput?.nativeElement?.focus(), 60);
  }

  closePayment() {
    this.paymentOpen.set(false);
  }

  setPayment(method: PaymentMethod) {
    this.paymentMethod = method;
    if (method === 'card') { this.received = null; this.cardAmount = null; }
    if (method === 'cash') { this.cardAmount = null; }
    if (method === 'mixed' && this.received === null) this.received = this.total();
    setTimeout(() => this.cashInput?.nativeElement?.select(), 30);
  }

  canPay(): boolean {
    if (this.processing() || !this.cart.items().length) return false;
    if (this.paymentMethod === 'card') return true;
    const c = this.change();
    return c !== null && c >= 0;
  }

  pay() {
    if (!this.canPay()) return;
    this.processing.set(true);

    const payload = {
      payment_method: this.paymentMethod,
      items: this.cart.items().map(line => ({
        product_variant_id: line.variantId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        discount_percent: 0,
      })),
      received_amount: this.paymentMethod === 'card' ? 0 : Number(this.received ?? 0),
      card_amount: this.paymentMethod === 'mixed' ? Number(this.cardAmount ?? 0) : 0,
    };

    this.api.createSale(payload).subscribe({
      next: sale => {
        this.processing.set(false);
        this.cart.clear();
        this.resetPayment();
        this.paymentOpen.set(false);
        this.completedSale.set(sale);
        this.search();
      },
      error: err => {
        this.processing.set(false);
        this.toast.error(err.error?.detail || this.i18n.t('common.error'));
      },
    });
  }

  newOrder() {
    this.completedSale.set(null);
    this.focusSearch();
  }

  printReceipt(saleId: number) {
    window.open(this.api.getReceiptPdfUrl(saleId, this.i18n.lang()), '_blank');
  }

  clearCart() {
    this.cart.clear();
    this.toast.info(this.i18n.t('pos.cleared'));
  }

  private resetPayment() {
    this.received = null;
    this.cardAmount = null;
    this.paymentMethod = 'cash';
  }
}
