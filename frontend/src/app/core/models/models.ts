// TypeScript models mirroring the Django API responses.

export type UserRole = 'owner' | 'manager' | 'cashier';
export type PaymentMethod = 'cash' | 'card' | 'mixed';
export type SaleStatus = 'completed' | 'partially_refunded' | 'refunded' | 'cancelled';
export type MovementType = 'purchase' | 'sale' | 'return' | 'adjustment' | 'inventory';
export type FinanceEntryType = 'income' | 'expense';
export type LangCode = 'uz' | 'ru';

// ─── Auth ─────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  phone: string;
  language: LangCode;
  is_active: boolean;
  pin_set: boolean;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

// ─── Catalog ──────────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  description: string;
  image: string | null;
  is_active: boolean;
  product_count: number;
  created_at: string;
}

export interface Color {
  id: number;
  name: string;
  hex_code: string;
}

export interface Size {
  id: number;
  name: string;
  size_type: string;
  display_order: number;
}

export interface ProductVariant {
  id: number;
  product: number;
  color: number | null;
  color_detail: Color | null;
  size: number | null;
  size_detail: Size | null;
  sku: string;
  barcode: string;
  selling_price: number | null;
  effective_price: number;
  cost_price?: number | null;      // owner only
  effective_cost?: number;         // owner only
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: number | null;
  category_name: string | null;
  barcode: string;
  image: string | null;
  base_cost_price?: number;        // owner only
  base_selling_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  variants: ProductVariant[];
  total_stock: number;
  created_at: string;
  updated_at: string;
}

/** Flat POS row returned by /products/search/ */
export interface VariantSearchResult {
  id: number;
  product_id: number;
  product_name: string;
  category_name: string | null;
  image: string | null;
  color_name: string | null;
  size_name: string | null;
  barcode: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
}

export interface VariantWrite {
  id?: number;
  color: number | null;
  size: number | null;
  barcode?: string;
  selling_price?: number | null;
  cost_price?: number | null;
  stock_quantity: number;
  low_stock_threshold?: number;
  is_active?: boolean;
}

// ─── Inventory ────────────────────────────────────────────────────
export interface StockReceiptItem {
  id: number;
  product_variant: number;
  variant_display: string;
  product_name: string;
  color_name: string | null;
  size_name: string | null;
  quantity: number;
  cost_price: number;
  total_cost: number;
}

export interface StockReceipt {
  id: number;
  number: number;
  receipt_date: string;
  vendor: number | null;
  vendor_name: string | null;
  notes: string;
  total_quantity: number;
  total_cost: number;
  created_by_name: string | null;
  items: StockReceiptItem[];
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_variant: number;
  variant_display: string;
  product_name: string;
  color_name: string | null;
  size_name: string | null;
  movement_type: MovementType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number | null;
  reason: string;
  reference: string;
  notes: string;
  created_by_name: string | null;
  created_at: string;
}

export interface InventoryValuation {
  total_cost_value: number;
  total_retail_value: number;
  potential_profit: number;
  variants_in_stock: number;
  units_in_stock: number;
}

// ─── Vendors / Customers ──────────────────────────────────────────
export interface Vendor {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  contact_person: string;
  company_name: string;
  balance: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

// ─── Sales ────────────────────────────────────────────────────────
export interface SaleItem {
  id: number;
  product_variant: number;
  product_name: string;
  color_name: string;
  size_name: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number;              // owner only
  total_cost?: number | null;      // owner only
  discount_percent: number;
  discount_amount: number;
  total_price: number;
  returned_quantity: number;
}

export interface SaleReturnItem {
  id: number;
  sale_item: number;
  product_name: string;
  color_name: string;
  size_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface SaleReturn {
  id: number;
  sale: number;
  sale_number: string;
  reason: string;
  notes: string;
  total_amount: number;
  items: SaleReturnItem[];
  created_by_name: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  number: number;
  sale_number: string;
  customer: number | null;
  customer_name: string | null;
  cashier: number;
  cashier_name: string;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  cash_amount: number;
  card_amount: number;
  received_amount: number;
  change_amount: number;
  status: SaleStatus;
  notes: string;
  items: SaleItem[];
  returns: SaleReturn[];
  receipt: { id: number; receipt_number: string; generated_at: string } | null;
  item_count: number;
  total_cost?: number | null;      // owner only
  profit?: number | null;          // owner only
  created_at: string;
  updated_at: string;
}

export interface SaleListItem {
  id: number;
  number: number;
  sale_number: string;
  created_at: string;
  cashier_name: string;
  customer_name: string | null;
  payment_method: PaymentMethod;
  total_amount: number;
  cash_amount: number;
  card_amount: number;
  received_amount: number;
  change_amount: number;
  discount_amount: number;
  status: SaleStatus;
  item_count: number;
  has_returns: boolean;
}

export interface CartItem {
  variantId: number;
  productName: string;
  colorName: string | null;
  sizeName: string | null;
  unitPrice: number;
  quantity: number;
  stockQuantity: number;
}

// ─── Finance ──────────────────────────────────────────────────────
export interface FinanceEntry {
  id: number;
  entry_type: FinanceEntryType;
  amount: number;
  category: string;
  comment: string;
  entry_date: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Dashboard / reports ──────────────────────────────────────────
export interface OperationalStats {
  sales_count: number;
  units_sold: number;
  revenue: number;
  returns_total: number;
  net_revenue: number;
  cash_total: number;
  card_total: number;
  discount_total: number;
  average_check: number;
}

export interface FinancialStats extends OperationalStats {
  cost_of_goods: number;
  gross_profit: number;
  other_income: number;
  expenses: number;
  net_profit: number;
}

export interface TopProduct {
  product_name: string;
  units: number;
  revenue: number;
}

export interface ChartPoint {
  date: string;
  revenue: number;
  count: number;
}

export interface DashboardPayload {
  role: UserRole;
  period: { start: string | null; end: string | null };
  operational?: OperationalStats;
  financial?: FinancialStats | null;
  top_products?: TopProduct[];
  chart?: ChartPoint[];
  low_stock?: VariantSearchResult[];
  my_sales?: { sales_count: number; revenue: number };
}

export interface ReportSummary {
  period: { start: string | null; end: string | null };
  operational: OperationalStats;
  top_products: TopProduct[];
  chart: ChartPoint[];
  financial?: FinancialStats;
}

// ─── API pagination ───────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
