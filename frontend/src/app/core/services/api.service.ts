import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Category, Color, Customer, DashboardPayload, FinanceEntry, InventoryValuation,
  PaginatedResponse, Product, ProductVariant, ReportSummary, Sale, SaleListItem,
  SaleReturn, Size, StockMovement, StockReceipt, User, VariantSearchResult, Vendor,
} from '../models/models';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private url(path: string) {
    return `${this.base}/${path}`;
  }

  private toParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  // ─── Employees ──────────────────────────────────────────────────
  getUsers(params?: QueryParams): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(this.url('auth/users/'),
      { params: this.toParams(params) });
  }
  createUser(data: any): Observable<User> {
    return this.http.post<User>(this.url('auth/users/'), data);
  }
  updateUser(id: number, data: any): Observable<User> {
    return this.http.patch<User>(this.url(`auth/users/${id}/`), data);
  }
  deactivateUser(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`auth/users/${id}/`));
  }
  setUserPin(id: number, pin: string): Observable<any> {
    return this.http.post(this.url(`auth/users/${id}/set_pin/`), {
      pin, pin_confirm: pin,
    });
  }
  getMe(): Observable<User> {
    return this.http.get<User>(this.url('auth/users/me/'));
  }
  updateMe(data: any): Observable<User> {
    return this.http.patch<User>(this.url('auth/users/me/'), data);
  }
  changeMyPin(currentPin: string, pin: string): Observable<any> {
    return this.http.post(this.url('auth/users/change_pin/'), {
      current_pin: currentPin, pin, pin_confirm: pin,
    });
  }

  // ─── Categories ─────────────────────────────────────────────────
  getCategories(params?: QueryParams): Observable<PaginatedResponse<Category>> {
    return this.http.get<PaginatedResponse<Category>>(this.url('products/categories/'),
      { params: this.toParams(params) });
  }
  createCategory(data: any): Observable<Category> {
    return this.http.post<Category>(this.url('products/categories/'), data);
  }
  updateCategory(id: number, data: any): Observable<Category> {
    return this.http.patch<Category>(this.url(`products/categories/${id}/`), data);
  }
  deleteCategory(id: number): Observable<any> {
    return this.http.delete(this.url(`products/categories/${id}/`));
  }

  // ─── Colors / Sizes (managed inline, no standalone screens) ──────
  getColors(params?: QueryParams): Observable<PaginatedResponse<Color>> {
    return this.http.get<PaginatedResponse<Color>>(this.url('products/colors/'),
      { params: this.toParams(params) });
  }
  createColor(data: any): Observable<Color> {
    return this.http.post<Color>(this.url('products/colors/'), data);
  }
  getSizes(params?: QueryParams): Observable<PaginatedResponse<Size>> {
    return this.http.get<PaginatedResponse<Size>>(this.url('products/sizes/'),
      { params: this.toParams(params) });
  }
  createSize(data: any): Observable<Size> {
    return this.http.post<Size>(this.url('products/sizes/'), data);
  }

  // ─── Products ───────────────────────────────────────────────────
  getProducts(params?: QueryParams): Observable<PaginatedResponse<Product>> {
    return this.http.get<PaginatedResponse<Product>>(this.url('products/'),
      { params: this.toParams(params) });
  }
  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(this.url(`products/${id}/`));
  }
  createProduct(data: any): Observable<Product> {
    return this.http.post<Product>(this.url('products/'), data);
  }
  updateProduct(id: number, data: any): Observable<Product> {
    return this.http.patch<Product>(this.url(`products/${id}/`), data);
  }
  deactivateProduct(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`products/${id}/`));
  }
  /** Fast POS lookup by product name or barcode - returns flat variants. */
  searchVariants(query: string, limit = 50): Observable<VariantSearchResult[]> {
    return this.http.get<VariantSearchResult[]>(this.url('products/search/'),
      { params: this.toParams({ q: query, limit }) });
  }
  lookupBarcode(code: string): Observable<any> {
    return this.http.get(this.url('products/by_barcode/'),
      { params: this.toParams({ code }) });
  }
  getLowStock(): Observable<VariantSearchResult[]> {
    return this.http.get<VariantSearchResult[]>(this.url('products/low_stock/'));
  }
  getProductBarcodeImageUrl(id: number): string {
    return this.url(`products/${id}/barcode_image/`);
  }
  getVariants(params?: QueryParams): Observable<PaginatedResponse<ProductVariant>> {
    return this.http.get<PaginatedResponse<ProductVariant>>(this.url('products/variants/'),
      { params: this.toParams(params) });
  }

  // ─── Inventory ──────────────────────────────────────────────────
  getReceipts(params?: QueryParams): Observable<PaginatedResponse<StockReceipt>> {
    return this.http.get<PaginatedResponse<StockReceipt>>(this.url('inventory/receipts/'),
      { params: this.toParams(params) });
  }
  getReceipt(id: number): Observable<StockReceipt> {
    return this.http.get<StockReceipt>(this.url(`inventory/receipts/${id}/`));
  }
  createReceipt(data: any): Observable<StockReceipt> {
    return this.http.post<StockReceipt>(this.url('inventory/receipts/'), data);
  }
  getMovements(params?: QueryParams): Observable<PaginatedResponse<StockMovement>> {
    return this.http.get<PaginatedResponse<StockMovement>>(this.url('inventory/movements/'),
      { params: this.toParams(params) });
  }
  adjustStock(data: {
    product_variant: number; mode: 'delta' | 'counted'; quantity: number;
    reason?: string; notes?: string;
  }): Observable<StockMovement> {
    return this.http.post<StockMovement>(this.url('inventory/movements/adjust/'), data);
  }
  getInventoryValuation(): Observable<InventoryValuation> {
    return this.http.get<InventoryValuation>(this.url('inventory/valuation/'));
  }

  // ─── Vendors ────────────────────────────────────────────────────
  getVendors(params?: QueryParams): Observable<PaginatedResponse<Vendor>> {
    return this.http.get<PaginatedResponse<Vendor>>(this.url('vendors/'),
      { params: this.toParams(params) });
  }
  createVendor(data: any): Observable<Vendor> {
    return this.http.post<Vendor>(this.url('vendors/'), data);
  }

  // ─── Customers ──────────────────────────────────────────────────
  getCustomers(params?: QueryParams): Observable<PaginatedResponse<Customer>> {
    return this.http.get<PaginatedResponse<Customer>>(this.url('customers/'),
      { params: this.toParams(params) });
  }
  createCustomer(data: any): Observable<Customer> {
    return this.http.post<Customer>(this.url('customers/'), data);
  }

  // ─── Sales ──────────────────────────────────────────────────────
  getSales(params?: QueryParams): Observable<PaginatedResponse<SaleListItem>> {
    return this.http.get<PaginatedResponse<SaleListItem>>(this.url('sales/'),
      { params: this.toParams(params) });
  }
  getSale(id: number): Observable<Sale> {
    return this.http.get<Sale>(this.url(`sales/${id}/`));
  }
  createSale(data: any): Observable<Sale> {
    return this.http.post<Sale>(this.url('sales/'), data);
  }
  returnItems(saleId: number, data: any): Observable<SaleReturn> {
    return this.http.post<SaleReturn>(this.url(`sales/${saleId}/return_items/`), data);
  }
  cancelSale(saleId: number): Observable<Sale> {
    return this.http.post<Sale>(this.url(`sales/${saleId}/cancel/`), {});
  }
  getReceiptPdfUrl(saleId: number, lang: string): string {
    return this.url(`sales/${saleId}/receipt_pdf/?lang=${lang}`);
  }
  getSaleReceiptData(saleId: number): Observable<any> {
    return this.http.get(this.url(`sales/${saleId}/receipt_data/`));
  }
  getSalesReturns(params?: QueryParams): Observable<PaginatedResponse<SaleReturn>> {
    return this.http.get<PaginatedResponse<SaleReturn>>(this.url('sales/returns/'),
      { params: this.toParams(params) });
  }
  getDashboard(params?: QueryParams): Observable<DashboardPayload> {
    return this.http.get<DashboardPayload>(this.url('sales/dashboard/'),
      { params: this.toParams(params) });
  }

  // ─── Finance (income / expense) ─────────────────────────────────
  getFinanceEntries(params?: QueryParams): Observable<PaginatedResponse<FinanceEntry>> {
    return this.http.get<PaginatedResponse<FinanceEntry>>(this.url('finance/'),
      { params: this.toParams(params) });
  }
  createFinanceEntry(data: any): Observable<FinanceEntry> {
    return this.http.post<FinanceEntry>(this.url('finance/'), data);
  }
  updateFinanceEntry(id: number, data: any): Observable<FinanceEntry> {
    return this.http.patch<FinanceEntry>(this.url(`finance/${id}/`), data);
  }
  deleteFinanceEntry(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`finance/${id}/`));
  }
  getFinanceSummary(params?: QueryParams): Observable<any> {
    return this.http.get(this.url('finance/summary/'), { params: this.toParams(params) });
  }

  // ─── Reports / exports ──────────────────────────────────────────
  getReportSummary(params?: QueryParams): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(this.url('reports/summary/'),
      { params: this.toParams(params) });
  }
  /** Builds the download URL for an export endpoint. */
  exportUrl(kind: string, params: QueryParams, fmt: 'xlsx' | 'csv', lang: string): string {
    const query = this.toParams({ ...params, fmt, lang }).toString();
    return `${this.url(`reports/${kind}/`)}?${query}`;
  }
  downloadExport(kind: string, params: QueryParams, fmt: 'xlsx' | 'csv', lang: string) {
    return this.http.get(this.exportUrl(kind, params, fmt, lang), { responseType: 'blob' });
  }

  // ─── Audit trail ────────────────────────────────────────────────
  getAuditLogs(params?: QueryParams): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(this.url('audit/'),
      { params: this.toParams(params) });
  }
}
