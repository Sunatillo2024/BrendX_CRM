import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

interface NavItem  { label: string; icon: string; route: string; roles?: string[]; }
interface NavGroup { group: string; items: NavItem[]; }

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="sidebarCollapsed()">

      <!-- ── Sidebar ── -->
      <aside class="sidebar" [class.mobile-open]="mobileSidebarOpen()">

        <!-- Brand -->
        <div class="brand">
          <div class="brand-logo">
            <mat-icon>checkroom</mat-icon>
          </div>
          @if (!sidebarCollapsed()) {
            <div class="brand-text">
              <span class="brand-name">BrandX</span>
              <span class="brand-tag">POS</span>
            </div>
          }
        </div>

        <!-- Nav -->
        <nav class="nav" aria-label="Main navigation">
          @for (group of visibleNavGroups(); track group.group) {
            @if (!sidebarCollapsed()) {
              <div class="nav-group-label">{{ group.group }}</div>
            }
            @for (item of group.items; track item.route) {
              <a class="nav-item"
                 [routerLink]="item.route"
                 routerLinkActive="active"
                 [matTooltip]="sidebarCollapsed() ? item.label : ''"
                 matTooltipPosition="right">
                <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
                @if (!sidebarCollapsed()) {
                  <span class="nav-label">{{ item.label }}</span>
                }
              </a>
            }
          }
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer">
          <div class="user-row">
            <div class="user-avatar" aria-hidden="true">
              {{ auth.currentUser()?.username?.[0]?.toUpperCase() }}
            </div>
            @if (!sidebarCollapsed()) {
              <div class="user-meta">
                <div class="user-name">{{ auth.currentUser()?.username }}</div>
                <div class="user-role">{{ auth.currentUser()?.role | titlecase }}</div>
              </div>
              <button class="logout-btn" (click)="auth.logout()" matTooltip="Log out" aria-label="Log out">
                <mat-icon>logout</mat-icon>
              </button>
            } @else {
              <button class="logout-btn" (click)="auth.logout()" matTooltip="Log out" matTooltipPosition="right" aria-label="Log out">
                <mat-icon>logout</mat-icon>
              </button>
            }
          </div>
        </div>
      </aside>

      <!-- Mobile overlay -->
      @if (mobileSidebarOpen()) {
        <div class="mobile-overlay" (click)="mobileSidebarOpen.set(false)" aria-hidden="true"></div>
      }

      <!-- ── Main ── -->
      <div class="main-area">

        <!-- Top bar -->
        <header class="topbar" role="banner">
          <button class="topbar-btn" (click)="toggleSidebar()" aria-label="Toggle navigation">
            <mat-icon>{{ sidebarCollapsed() ? 'menu_open' : 'menu' }}</mat-icon>
          </button>

          <div class="topbar-right">
            <div class="topbar-user">
              <div class="topbar-avatar" aria-hidden="true">
                {{ auth.currentUser()?.username?.[0]?.toUpperCase() }}
              </div>
              <div class="topbar-info">
                <span class="topbar-name">{{ auth.currentUser()?.username }}</span>
                <span class="topbar-role-chip">{{ auth.currentUser()?.role }}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Page content -->
        <main class="page-area" role="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    /* ── Shell ─────────────────────────────────────────────── */
    .app-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
      --sb-width: 256px;
      --sb-collapsed: 64px;
    }
    .app-shell.sidebar-collapsed { --sb-width: var(--sb-collapsed); }

    /* ── Sidebar ────────────────────────────────────────────── */
    .sidebar {
      width: var(--sb-width);
      flex-shrink: 0;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
      overflow: hidden;
      position: relative;
      z-index: 200;
    }

    /* Brand area */
    .brand {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 18px 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
      min-height: 64px;
    }
    .brand-logo {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
      mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    }
    .brand-text { display: flex; align-items: center; gap: 6px; overflow: hidden; }
    .brand-name { font-size: 16px; font-weight: 700; color: white; letter-spacing: -0.3px; white-space: nowrap; }
    .brand-tag {
      font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
      background: rgba(99,102,241,0.25); color: #a5b4fc;
      padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(99,102,241,0.3);
    }

    /* Nav */
    .nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px 8px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .nav-group-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      padding: 14px 8px 4px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      margin-bottom: 2px;
      white-space: nowrap;
      position: relative;
      outline: none;

      &:hover {
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.92);
      }
      &:focus-visible {
        outline: 2px solid #6366f1;
        outline-offset: 2px;
      }
    }
    .nav-item.active {
      background: rgba(99,102,241,0.18);
      color: #c7d2fe;
      &::before {
        content: '';
        position: absolute;
        left: 0; top: 6px; bottom: 6px;
        width: 3px;
        background: #6366f1;
        border-radius: 0 3px 3px 0;
      }
      .nav-icon { color: #818cf8; }
    }
    .nav-icon { font-size: 19px; width: 19px; height: 19px; flex-shrink: 0; }
    .nav-label { flex: 1; }

    /* Sidebar footer */
    .sidebar-footer {
      padding: 12px 10px;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .user-row { display: flex; align-items: center; gap: 9px; }
    .user-avatar {
      width: 32px; height: 32px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white;
    }
    .user-meta { flex: 1; min-width: 0; }
    .user-name { font-size: 12.5px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 11px; color: rgba(255,255,255,0.38); text-transform: capitalize; }
    .logout-btn {
      background: none; border: none; cursor: pointer; padding: 0;
      width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.35);
      transition: background 0.15s, color 0.15s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
      &:hover { background: rgba(239,68,68,0.15); color: #fca5a5; }
    }

    /* Mobile overlay */
    .mobile-overlay {
      display: none;
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 199;
      backdrop-filter: blur(2px);
    }

    /* ── Main area ──────────────────────────────────────────── */
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    /* Top bar */
    .topbar {
      height: 60px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 12px;
      flex-shrink: 0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      z-index: 10;
    }
    .topbar-btn {
      background: none; border: none; cursor: pointer;
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #64748b;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
      mat-icon { font-size: 22px; }
      &:hover { background: #f1f5f9; color: #0f172a; }
    }
    .topbar-right { margin-left: auto; }
    .topbar-user { display: flex; align-items: center; gap: 9px; }
    .topbar-avatar {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white;
    }
    .topbar-info { display: flex; align-items: center; gap: 7px; }
    .topbar-name { font-size: 13.5px; font-weight: 600; color: #0f172a; }
    .topbar-role-chip {
      font-size: 11px; font-weight: 600; text-transform: capitalize;
      background: #eef2ff; color: #4338ca;
      padding: 2px 8px; border-radius: 10px; border: 1px solid #c7d2fe;
    }

    /* Page area */
    .page-area {
      flex: 1;
      overflow-y: auto;
      background: #f1f5f9;
    }

    /* ── Mobile ─────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        left: 0; top: 0; bottom: 0;
        transform: translateX(-100%);
        transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        z-index: 200;
        width: 256px !important;
      }
      .sidebar.mobile-open { transform: translateX(0); }
      .mobile-overlay { display: block; }
      .app-shell { --sb-width: 0px; }
    }
  `]
})
export class MainLayoutComponent {
  auth = inject(AuthService);
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth <= 768) this.sidebarCollapsed.set(false);
  }

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      this.mobileSidebarOpen.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }

  private navGroups: NavGroup[] = [
    {
      group: 'Main',
      items: [
        { label: 'Dashboard',     icon: 'dashboard',      route: '/dashboard' },
        { label: 'New Sale',      icon: 'point_of_sale',  route: '/pos' },
      ]
    },
    {
      group: 'Catalog',
      items: [
        { label: 'Products',      icon: 'inventory_2',    route: '/products' },
        { label: 'Categories',    icon: 'category',       route: '/categories', roles: ['admin', 'manager'] },
        { label: 'Colors',        icon: 'palette',        route: '/colors',     roles: ['admin', 'manager'] },
        { label: 'Sizes',         icon: 'straighten',     route: '/sizes',      roles: ['admin', 'manager'] },
      ]
    },
    {
      group: 'Operations',
      items: [
        { label: 'Inventory',     icon: 'warehouse',      route: '/inventory',  roles: ['admin', 'manager'] },
        { label: 'Vendors',       icon: 'local_shipping', route: '/vendors',    roles: ['admin', 'manager'] },
        { label: 'Customers',     icon: 'people',         route: '/customers' },
        { label: 'Sales History', icon: 'receipt_long',   route: '/sales' },
      ]
    },
    {
      group: 'Analytics',
      items: [
        { label: 'Reports',       icon: 'bar_chart',      route: '/reports',    roles: ['admin', 'manager'] },
        { label: 'Settings',      icon: 'settings',       route: '/settings',   roles: ['admin'] },
      ]
    },
  ];

  visibleNavGroups() {
    const role = this.auth.currentUser()?.role ?? '';
    return this.navGroups
      .map(g => ({ ...g, items: g.items.filter(i => !i.roles || i.roles.includes(role)) }))
      .filter(g => g.items.length > 0);
  }
}