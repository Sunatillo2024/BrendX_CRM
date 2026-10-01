import { Injectable, signal } from '@angular/core';
import { CartItem, VariantSearchResult } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();

  get subtotal(): number {
    return this._items().reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }

  get itemCount(): number {
    return this._items().reduce((sum, i) => sum + i.quantity, 0);
  }

  quantityOf(variantId: number): number {
    return this._items().find(i => i.variantId === variantId)?.quantity ?? 0;
  }

  /** Adds a scanned/searched variant. Returns false when stock is exhausted. */
  add(variant: VariantSearchResult, qty = 1): boolean {
    const current = this._items();
    const existing = current.find(i => i.variantId === variant.id);

    if (existing) {
      if (existing.quantity + qty > existing.stockQuantity) return false;
      this._items.set(current.map(i =>
        i.variantId === variant.id ? { ...i, quantity: i.quantity + qty } : i));
      return true;
    }

    if (variant.stock_quantity < qty) return false;
    this._items.set([...current, {
      variantId: variant.id,
      productName: variant.product_name,
      colorName: variant.color_name,
      sizeName: variant.size_name,
      unitPrice: Number(variant.price),
      quantity: qty,
      stockQuantity: variant.stock_quantity,
    }]);
    return true;
  }

  setQuantity(variantId: number, qty: number): boolean {
    const item = this._items().find(i => i.variantId === variantId);
    if (!item) return false;
    if (qty <= 0) {
      this.remove(variantId);
      return true;
    }
    if (qty > item.stockQuantity) return false;
    this._items.update(items =>
      items.map(i => (i.variantId === variantId ? { ...i, quantity: qty } : i)));
    return true;
  }

  remove(variantId: number): void {
    this._items.update(items => items.filter(i => i.variantId !== variantId));
  }

  clear(): void {
    this._items.set([]);
  }
}
