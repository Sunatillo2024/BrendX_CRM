// Core TypeScript Models/Interfaces matching Django API responses

export type UserRole = 'admin' | 'manager' | 'guest';
export type SaleType = 'cash' | 'credit' | 'installment';
export type SaleStatus = 'completed' | 'pending' | 'cancelled' | 'refunded';
export type CustomerType = 'regular' | 'credit' | 'installment';
export type InstallmentStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';

// ─── Auth ─────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string;
  avatar: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

// ─── Products ─────────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  description: string;
  parent: number | null;
  image: string | null;
  is_active: boolean;
  children: Category[];
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
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: number | null;
  category_name?: string | null;
  category_detail: Category | null;
  barcode: string;
  image: string | null;
  base_cost_price: number;
  base_selling_price: number;
  is_active: boolean;
  variants: ProductVariant[];
  total_stock: number;
  created_at: string;
  updated_at: string;
}

// ─── Inventory ─────────────────────────────────────────────────────
export interface StockItem {
  id: number;
  item_id: string;
  product_variant: number;
  variant_display: string;
  vendor: number | null;
  vendor_name: string | null;
  quantity_per_package: number;
  total_packages: number;
  quantity_received: number;
  quantity_in_stock: number;
  quantity_sold: number;
  import_date: string;
  expire_date: string | null;
  production_date: string | null;
  cost_price: number;
  total_cost: number;
  profit_margin: number | null;
  notes: string;
  is_active: boolean;
  created_at: string;
}

// ─── Vendors ───────────────────────────────────────────────────────
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

export interface VendorTransaction {
  id: number;
  vendor: number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  date: string;
  reference: string;
  notes: string;
  created_by_name: string;
  created_at: string;
}

// ─── Customers ─────────────────────────────────────────────────────
export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  id_number: string;
  customer_type: CustomerType;
  credit_limit: number;
  outstanding_balance: number;
  available_credit: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface InstallmentPlan {
  id: number;
  sale: number;
  customer: number;
  customer_name: string;
  total_amount: number;
  down_payment: number;
  remaining_amount: number;
  amount_paid: number;
  monthly_installment: number;
  installment_count: number;
  paid_count: number;
  start_date: string;
  end_date: string;
  status: InstallmentStatus;
  guarantor_name: string;
  guarantor_phone: string;
  overdue_installments: number;
  payments: InstallmentPayment[];
  created_at: string;
}

export interface InstallmentPayment {
  id: number;
  plan: number;
  payment_date: string;
  amount: number;
  installment_number: number;
  notes: string;
  received_by_name: string;
  created_at: string;
}

// ─── Sales ─────────────────────────────────────────────────────────
export interface SaleItem {
  id: number;
  product_variant: number;
  product_name: string;
  variant_display: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  total_price: number;
}

export interface Sale {
  id: number;
  sale_number: string;
  customer: number | null;
  customer_name: string | null;
  cashier: number;
  cashier_name: string;
  sale_type: SaleType;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  remaining_amount: number;
  status: SaleStatus;
  notes: string;
  items: SaleItem[];
  receipt: { id: number; receipt_number: string; generated_at: string } | null;
  created_at: string;
}

// ─── POS Cart ──────────────────────────────────────────────────────
export interface CartItem {
  variant: ProductVariant;
  product: Product;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

// ─── Customer Transactions ─────────────────────────────────────────
export interface CustomerTransaction {
  id: number;
  customer: number;
  customer_name: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  date: string;
  notes: string;
  recorded_by_name: string;
  created_at: string;
}

// ─── Stock Adjustments ─────────────────────────────────────────────
export interface StockAdjustment {
  id: number;
  stock_item: number;
  adjustment_type: 'increase' | 'decrease';
  quantity: number;
  reason: 'damage' | 'theft' | 'audit' | 'return' | 'expired' | 'other';
  notes: string;
  adjusted_by: number | null;
  adjusted_by_name: string;
  adjusted_at: string;
}

// ─── API Pagination ────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Dashboard Stats ───────────────────────────────────────────────
export interface DashboardStats {
  today: { count: number; total: number; paid: number };
  this_month: { count: number; total: number; paid: number };
  this_year: { count: number; total: number; paid: number };
  by_type: { cash: any; credit: any; installment: any };
  outstanding_credit: number;
  outstanding_installment: number;
}
