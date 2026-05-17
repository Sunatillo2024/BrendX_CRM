import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PaginatedResponse, Product, ProductVariant, Category, Color, Size,
  StockItem, StockAdjustment, Vendor, VendorTransaction, Customer,
  CustomerTransaction, InstallmentPlan, Sale, DashboardStats, User
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private url(path: string) { return `${this.base}/${path}`; }

  // ─── Auth ───────────────────────────────────────────────────────
  getUsers(params?: any): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(this.url('auth/users/'), { params });
  }
  getUser(id: number): Observable<User> {
    return this.http.get<User>(this.url(`auth/users/${id}/`));
  }
  createUser(data: any): Observable<User> {
    return this.http.post<User>(this.url('auth/users/'), data);
  }
  updateUser(id: number, data: any): Observable<User> {
    return this.http.patch<User>(this.url(`auth/users/${id}/`), data);
  }
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`auth/users/${id}/`));
  }
  getMe(): Observable<User> {
    return this.http.get<User>(this.url('auth/users/me/'));
  }
  updateMe(data: any): Observable<User> {
    return this.http.patch<User>(this.url('auth/users/me/'), data);
  }
  changePassword(data: { old_password: string; new_password: string; confirm_password: string }): Observable<any> {
    return this.http.post(this.url('auth/users/change_password/'), data);
  }

  // ─── Products ───────────────────────────────────────────────────
  getProducts(params?: any): Observable<PaginatedResponse<Product>> {
    return this.http.get<PaginatedResponse<Product>>(this.url('products/'), { params });
  }
  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(this.url(`products/${id}/`));
  }
  createProduct(data: FormData): Observable<Product> {
    return this.http.post<Product>(this.url('products/'), data);
  }
  updateProduct(id: number, data: FormData): Observable<Product> {
    return this.http.patch<Product>(this.url(`products/${id}/`), data);
  }
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`products/${id}/`));
  }
  getProductByBarcode(barcode: string): Observable<any> {
    return this.http.get(this.url('products/by_barcode/'), { params: { code: barcode } });
  }
  getCategories(params?: any): Observable<PaginatedResponse<Category>> {
    return this.http.get<PaginatedResponse<Category>>(this.url('products/categories/'), { params });
  }
  createCategory(data: any): Observable<Category> {
    return this.http.post<Category>(this.url('products/categories/'), data);
  }
  updateCategory(id: number, data: any): Observable<Category> {
    return this.http.patch<Category>(this.url(`products/categories/${id}/`), data);
  }
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`products/categories/${id}/`));
  }
  getColors(params?: any): Observable<PaginatedResponse<Color>> {
    return this.http.get<PaginatedResponse<Color>>(this.url('products/colors/'), { params });
  }
  createColor(data: any): Observable<Color> {
    return this.http.post<Color>(this.url('products/colors/'), data);
  }
  updateColor(id: number, data: any): Observable<Color> {
    return this.http.patch<Color>(this.url(`products/colors/${id}/`), data);
  }
  deleteColor(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`products/colors/${id}/`));
  }
  getSizes(params?: any): Observable<PaginatedResponse<Size>> {
    return this.http.get<PaginatedResponse<Size>>(this.url('products/sizes/'), { params });
  }
  createSize(data: any): Observable<Size> {
    return this.http.post<Size>(this.url('products/sizes/'), data);
  }
  updateSize(id: number, data: any): Observable<Size> {
    return this.http.patch<Size>(this.url(`products/sizes/${id}/`), data);
  }
  deleteSize(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`products/sizes/${id}/`));
  }
  createVariant(data: any): Observable<ProductVariant> {
    return this.http.post<ProductVariant>(this.url('products/variants/'), data);
  }
  updateVariant(id: number, data: any): Observable<ProductVariant> {
    return this.http.patch<ProductVariant>(this.url(`products/variants/${id}/`), data);
  }
  deleteVariant(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`products/variants/${id}/`));
  }
  getVariant(id: number): Observable<ProductVariant> {
    return this.http.get<ProductVariant>(this.url(`products/variants/${id}/`));
  }
  getVariants(params?: any): Observable<PaginatedResponse<ProductVariant>> {
    return this.http.get<PaginatedResponse<ProductVariant>>(this.url('products/variants/'), { params });
  }
  getProductBarcodeImageUrl(id: number): string {
    return this.url(`products/${id}/barcode_image/`);
  }
  getLowStockProducts(): Observable<any[]> {
    return this.http.get<any[]>(this.url('products/low_stock/'));
  }
  getAllCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.url('products/categories/all/'));
  }

  // ─── Inventory ─────────────────────────────────────────────────
  getStockItems(params?: any): Observable<PaginatedResponse<StockItem>> {
    return this.http.get<PaginatedResponse<StockItem>>(this.url('inventory/stock/'), { params });
  }
  getStockItem(id: number): Observable<StockItem> {
    return this.http.get<StockItem>(this.url(`inventory/stock/${id}/`));
  }
  createStockItem(data: any): Observable<StockItem> {
    return this.http.post<StockItem>(this.url('inventory/stock/'), data);
  }
  updateStockItem(id: number, data: any): Observable<StockItem> {
    return this.http.patch<StockItem>(this.url(`inventory/stock/${id}/`), data);
  }
  deleteStockItem(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`inventory/stock/${id}/`));
  }
  getInventoryValuation(): Observable<any> {
    return this.http.get(this.url('inventory/stock/valuation/'));
  }
  getExpiringSoon(): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(this.url('inventory/stock/expiring_soon/'));
  }
  getStockAdjustments(params?: any): Observable<PaginatedResponse<StockAdjustment>> {
    return this.http.get<PaginatedResponse<StockAdjustment>>(this.url('inventory/adjustments/'), { params });
  }
  createStockAdjustment(data: any): Observable<StockAdjustment> {
    return this.http.post<StockAdjustment>(this.url('inventory/adjustments/'), data);
  }
  updateStockAdjustment(id: number, data: any): Observable<StockAdjustment> {
    return this.http.patch<StockAdjustment>(this.url(`inventory/adjustments/${id}/`), data);
  }
  deleteStockAdjustment(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`inventory/adjustments/${id}/`));
  }

  // ─── Vendors ───────────────────────────────────────────────────
  getVendors(params?: any): Observable<PaginatedResponse<Vendor>> {
    return this.http.get<PaginatedResponse<Vendor>>(this.url('vendors/'), { params });
  }
  getVendor(id: number): Observable<Vendor> {
    return this.http.get<Vendor>(this.url(`vendors/${id}/`));
  }
  createVendor(data: any): Observable<Vendor> {
    return this.http.post<Vendor>(this.url('vendors/'), data);
  }
  updateVendor(id: number, data: any): Observable<Vendor> {
    return this.http.patch<Vendor>(this.url(`vendors/${id}/`), data);
  }
  getVendorStatement(id: number): Observable<any> {
    return this.http.get(this.url(`vendors/${id}/statement/`));
  }
  payVendor(id: number, data: any): Observable<any> {
    return this.http.post(this.url(`vendors/${id}/pay/`), data);
  }
  deleteVendor(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`vendors/${id}/`));
  }
  getVendorTransactions(params?: any): Observable<PaginatedResponse<VendorTransaction>> {
    return this.http.get<PaginatedResponse<VendorTransaction>>(this.url('vendors/transactions/'), { params });
  }
  createVendorTransaction(data: any): Observable<VendorTransaction> {
    return this.http.post<VendorTransaction>(this.url('vendors/transactions/'), data);
  }
  updateVendorTransaction(id: number, data: any): Observable<VendorTransaction> {
    return this.http.patch<VendorTransaction>(this.url(`vendors/transactions/${id}/`), data);
  }
  deleteVendorTransaction(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`vendors/transactions/${id}/`));
  }

  // ─── Customers ─────────────────────────────────────────────────
  getCustomers(params?: any): Observable<PaginatedResponse<Customer>> {
    return this.http.get<PaginatedResponse<Customer>>(this.url('customers/'), { params });
  }
  getCustomer(id: number): Observable<Customer> {
    return this.http.get<Customer>(this.url(`customers/${id}/`));
  }
  createCustomer(data: any): Observable<Customer> {
    return this.http.post<Customer>(this.url('customers/'), data);
  }
  updateCustomer(id: number, data: any): Observable<Customer> {
    return this.http.patch<Customer>(this.url(`customers/${id}/`), data);
  }
  getCustomerStatement(id: number): Observable<any> {
    return this.http.get(this.url(`customers/${id}/statement/`));
  }
  receiveCustomerPayment(id: number, data: any): Observable<any> {
    return this.http.post(this.url(`customers/${id}/receive_payment/`), data);
  }
  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`customers/${id}/`));
  }
  getCustomerTransactions(params?: any): Observable<PaginatedResponse<CustomerTransaction>> {
    return this.http.get<PaginatedResponse<CustomerTransaction>>(this.url('customers/transactions/'), { params });
  }
  getInstallmentPlans(params?: any): Observable<PaginatedResponse<InstallmentPlan>> {
    return this.http.get<PaginatedResponse<InstallmentPlan>>(this.url('customers/installment-plans/'), { params });
  }
  getInstallmentPlan(id: number): Observable<InstallmentPlan> {
    return this.http.get<InstallmentPlan>(this.url(`customers/installment-plans/${id}/`));
  }
  createInstallmentPlan(data: any): Observable<InstallmentPlan> {
    return this.http.post<InstallmentPlan>(this.url('customers/installment-plans/'), data);
  }
  updateInstallmentPlan(id: number, data: any): Observable<InstallmentPlan> {
    return this.http.patch<InstallmentPlan>(this.url(`customers/installment-plans/${id}/`), data);
  }
  deleteInstallmentPlan(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`customers/installment-plans/${id}/`));
  }
  payInstallment(planId: number, data: any): Observable<any> {
    return this.http.post(this.url(`customers/installment-plans/${planId}/pay_installment/`), data);
  }
  getOverduePlans(): Observable<InstallmentPlan[]> {
    return this.http.get<InstallmentPlan[]>(this.url('customers/installment-plans/overdue/'));
  }

  // ─── Sales ─────────────────────────────────────────────────────
  getSales(params?: any): Observable<PaginatedResponse<Sale>> {
    return this.http.get<PaginatedResponse<Sale>>(this.url('sales/'), { params });
  }
  getSale(id: number): Observable<Sale> {
    return this.http.get<Sale>(this.url(`sales/${id}/`));
  }
  createSale(data: any): Observable<Sale> {
    return this.http.post<Sale>(this.url('sales/'), data);
  }
  updateSale(id: number, data: any): Observable<Sale> {
    return this.http.patch<Sale>(this.url(`sales/${id}/`), data);
  }
  deleteSale(id: number): Observable<void> {
    return this.http.delete<void>(this.url(`sales/${id}/`));
  }
  getSaleReceiptUrl(id: number): string {
    return this.url(`sales/${id}/receipt_pdf/`);
  }
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(this.url('sales/dashboard_stats/'));
  }
  getMonthlyReport(year?: number): Observable<any[]> {
    const params: Record<string, string> = year ? { year: year.toString() } : {};
    return this.http.get<any[]>(this.url('sales/monthly_report/'), { params });
  }

  getReceiptPdf(saleId: number): Observable<Blob> {
    return this.http.get(this.url(`sales/${saleId}/receipt_pdf/`), { responseType: 'blob' });
  }
  getMonthlySalesReport(year?: number): Observable<any[]> {
    const params: Record<string, string> = year ? { year: year.toString() } : {};
    return this.http.get<any[]>(this.url('sales/monthly_report/'), { params });
  }

  // ─── AI Analysis ───────────────────────────────────────────────
  analyzeWithAI(data: { query: string }): Observable<any> {
    return this.http.post(this.url('ai/analyze/'), data);
  }
  analyzeFinancials(query: string): Observable<any> {
    return this.http.post(this.url('ai/analyze/'), { query });
  }
  getFinancialDashboard(): Observable<any> {
    return this.http.get(this.url('ai/dashboard/'));
  }
}
