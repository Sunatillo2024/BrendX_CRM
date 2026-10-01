import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

const MANAGER = ['owner', 'manager'];

export const routes: Routes = [
  { path: 'store/:code/login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'platform/login', data: { platform: true }, loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'platform', canActivate: [roleGuard], data: { roles: ['platform_admin'] }, loadComponent: () => import('./features/platform/platform.component').then(m => m.PlatformComponent) },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'BrandX',
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/pos.component').then(m => m.PosComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component')
            .then(m => m.ProductListComponent),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./features/products/product-form/product-form.component')
            .then(m => m.ProductFormComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./features/products/product-form/product-form.component')
            .then(m => m.ProductFormComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/category-list.component').then(m => m.CategoryListComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'stock',
        loadComponent: () =>
          import('./features/stock/stock.component').then(m => m.StockComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'receipts',
        loadComponent: () =>
          import('./features/receipts/receipts.component').then(m => m.ReceiptsComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/sales/sales-list/sales-list.component').then(m => m.SalesListComponent),
      },
      {
        path: 'sales/:id',
        loadComponent: () =>
          import('./features/sales/sale-detail/sale-detail.component').then(m => m.SaleDetailComponent),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance.component').then(m => m.FinanceComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(m => m.ReportsComponent),
        canActivate: [roleGuard],
        data: { roles: MANAGER },
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./features/employees/employee-list.component').then(m => m.EmployeeListComponent),
        canActivate: [roleGuard],
        data: { roles: ['owner'] },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
