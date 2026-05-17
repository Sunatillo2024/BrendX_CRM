import { Injectable, signal } from '@angular/core';
import { CartItem, Product, ProductVariant } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();

  get subtotal(): number {
    return this._items().reduce((sum, i) => {
      const line = i.unit_price * i.quantity;
      const disc = line * (i.discount_percent / 100);
      return sum + line - disc;
    }, 0);
  }

  get itemCount(): number {
    return this._items().reduce((sum, i) => sum + i.quantity, 0);
  }

  addItem(product: Product, variant: ProductVariant, qty = 1): void {
    const current = this._items();
    const idx = current.findIndex(i => i.variant.id === variant.id);
    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
      this._items.set(updated);
    } else {
      this._items.set([...current, {
        product, variant, quantity: qty,
        unit_price: variant.effective_price,
        discount_percent: 0,
      }]);
    }
  }

  updateQuantity(variantId: number, qty: number): void {
    if (qty <= 0) { this.removeItem(variantId); return; }
    this._items.update(items => items.map(i => i.variant.id === variantId ? { ...i, quantity: qty } : i));
  }

  updateDiscount(variantId: number, discountPct: number): void {
    this._items.update(items => items.map(i =>
      i.variant.id === variantId ? { ...i, discount_percent: discountPct } : i
    ));
  }

  removeItem(variantId: number): void {
    this._items.update(items => items.filter(i => i.variant.id !== variantId));
  }

  clearCart(): void {
    this._items.set([]);
  }
}
