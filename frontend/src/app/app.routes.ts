import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard - BrandX',
      },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/pos.component').then(m => m.PosComponent),
        title: 'POS - BrandX',
      },
      {
        path: 'products',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/products/product-list/product-list.component').then(m => m.ProductListComponent),
            title: 'Products - BrandX',
          },
          {
            path: 'new',
            loadComponent: () => import('./features/products/product-form/product-form.component').then(m => m.ProductFormComponent),
            canActivate: [roleGuard],
            data: { roles: ['admin', 'manager'] },
          },
          {
            path: ':id/edit',
            loadComponent: () => import('./features/products/product-form/product-form.component').then(m => m.ProductFormComponent),
            canActivate: [roleGuard],
            data: { roles: ['admin', 'manager'] },
          },
        ]
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/products/category-list/category-list.component').then(m => m.CategoryListComponent),
        title: 'Categories - BrandX',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'colors',
        loadComponent: () => import('./features/products/color-list/color-list.component').then(m => m.ColorListComponent),
        title: 'Colors - BrandX',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'sizes',
        loadComponent: () => import('./features/products/size-list/size-list.component').then(m => m.SizeListComponent),
        title: 'Sizes - BrandX',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory/inventory.component').then(m => m.InventoryComponent),
        title: 'Inventory - BrandX',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'vendors',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/vendors/vendor-list/vendor-list.component').then(m => m.VendorListComponent),
            title: 'Vendors - BrandX',
          },
          {
            path: 'new',
            loadComponent: () => import('./features/vendors/vendor-form/vendor-form.component').then(m => m.VendorFormComponent),
            title: 'New Vendor - BrandX',
          },
          {
            path: ':id/edit',
            loadComponent: () => import('./features/vendors/vendor-form/vendor-form.component').then(m => m.VendorFormComponent),
            title: 'Edit Vendor - BrandX',
          },
          {
            path: ':id',
            loadComponent: () => import('./features/vendors/vendor-detail/vendor-detail.component').then(m => m.VendorDetailComponent),
          },
        ]
      },
      {
        path: 'customers',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/customers/customer-list/customer-list.component').then(m => m.CustomerListComponent),
            title: 'Customers - BrandX',
          },
          {
            path: 'new',
            loadComponent: () => import('./features/customers/customer-form/customer-form.component').then(m => m.CustomerFormComponent),
            title: 'New Customer - BrandX',
          },
          {
            path: ':id/edit',
            loadComponent: () => import('./features/customers/customer-form/customer-form.component').then(m => m.CustomerFormComponent),
            title: 'Edit Customer - BrandX',
          },
          {
            path: ':id',
            loadComponent: () => import('./features/customers/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
          },
        ]
      },
      {
        path: 'sales',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/sales/sales-list/sales-list.component').then(m => m.SalesListComponent),
            title: 'Sales - BrandX',
          },
          {
            path: ':id',
            loadComponent: () => import('./features/sales/sale-detail/sale-detail.component').then(m => m.SaleDetailComponent),
            title: 'Sale Detail - BrandX',
          },
        ]
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
        title: 'Reports - BrandX',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
        title: 'Settings - BrandX',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' },
];
