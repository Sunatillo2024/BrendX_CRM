import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LANGUAGES, Lang } from '../../core/i18n/translations';
import { TranslationService } from '../../core/i18n/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeMode, ThemeService } from '../../core/ui/theme.service';

interface NavItem { key: string; icon: string; route: string; roles?: string[]; }
interface NavGroup { key: string; items: NavItem[]; }

const MANAGER = ['owner', 'manager'];

/** First path segment → i18n key for the header title. */
const TITLE_KEYS: Record<string, string> = {
  dashboard: 'menu.dashboard',
  pos: 'menu.pos',
  products: 'menu.products',
  categories: 'menu.categories',
  stock: 'menu.stock',
  receipts: 'menu.receipts',
  sales: 'menu.sales',
  finance: 'menu.finance',
  reports: 'menu.reports',
  employees: 'menu.employees',
  settings: 'menu.settings',
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule, TranslatePipe,
  ],
  template: `
    <div class="app-shell" [class.collapsed]="collapsed()">
      <aside class="sidebar" [class.mobile-open]="mobileOpen()">
        <div class="brand">
          <div class="brand-logo"><mat-icon>checkroom</mat-icon></div>
          @if (!collapsed()) {
            <div class="brand-text">
              <span class="brand-name">{{ 'app.name' | t }}</span>
              <span class="brand-tag">POS</span>
            </div>
          }
        </div>

        <nav class="nav">
          @for (group of visibleGroups(); track group.key) {
            @if (!collapsed()) { <div class="group-label">{{ group.key | t }}</div> }
            @for (item of group.items; track item.route) {
              <a class="nav-item" [routerLink]="item.route" routerLinkActive="active"
                 [matTooltip]="collapsed() ? (item.key | t) : ''" matTooltipPosition="right"
                 (click)="mobileOpen.set(false)">
                <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
                <span class="nav-label">{{ item.key | t }}</span>
              </a>
            }
          }
        </nav>

        <div class="sidebar-footer">
          <button class="collapse-btn" (click)="toggle()"
                  [matTooltip]="collapsed() ? ('menu.expand' | t) : ('menu.collapse' | t)"
                  matTooltipPosition="right">
            <mat-icon>{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
            <span class="nav-label">{{ 'menu.collapse' | t }}</span>
          </button>
        </div>
      </aside>

      @if (mobileOpen()) {
        <div class="overlay" (click)="mobileOpen.set(false)"></div>
      }

      <div class="main">
        <header class="topbar">
          <button class="icon-btn hamburger" (click)="toggle()" aria-label="Menu">
            <mat-icon>menu</mat-icon>
          </button>

          <div class="page-crumb">
            <h2>{{ titleKey() | t }}</h2>
          </div>

          <div class="global-search">
            <mat-icon>search</mat-icon>
            <input [(ngModel)]="globalQuery" (keydown.enter)="runGlobalSearch()"
                   [placeholder]="'common.search' | t"
                   [attr.aria-label]="'common.search' | t">
          </div>

          <div class="topbar-right">
            <button class="icon-btn" (click)="theme.toggle()"
                    [matTooltip]="('menu.theme' | t)">
              <mat-icon>{{ theme.resolved() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>

            <div class="lang-switch">
              @for (l of languages; track l.code) {
                <button [class.active]="i18n.lang() === l.code"
                        (click)="setLang(l.code)">{{ l.code.toUpperCase() }}</button>
              }
            </div>

            <div class="popover-host">
              <button class="profile-btn" (click)="profileOpen.set(!profileOpen())">
                <div class="avatar">{{ initials() }}</div>
                <div class="profile-meta">
                  <span class="profile-name">{{ auth.displayName() }}</span>
                  <span class="profile-role">{{ roleKey() | t }}</span>
                </div>
                <mat-icon class="chev">expand_more</mat-icon>
              </button>

              @if (profileOpen()) {
                <div class="menu profile-menu">
                  <div class="profile-menu-head">
                    <div class="avatar">{{ initials() }}</div>
                    <div>
                      <div class="strong">{{ auth.displayName() }}</div>
                      <div class="small muted">{{ roleKey() | t }}</div>
                    </div>
                  </div>
                  <div class="menu-sep"></div>
                  <a class="menu-item" routerLink="/settings" (click)="profileOpen.set(false)">
                    <mat-icon>settings</mat-icon> {{ 'menu.settings' | t }}
                  </a>
                  <div class="menu-sep"></div>
                  <div class="theme-row">
                    <mat-icon>contrast</mat-icon>
                    <span class="small muted">{{ 'menu.theme' | t }}</span>
                  </div>
                  <div class="theme-opts">
                    @for (m of themeModes; track m) {
                      <button class="period-btn" [class.active]="theme.mode() === m"
                              (click)="theme.set(m)">{{ ('menu.theme.' + m) | t }}</button>
                    }
                  </div>
                  <div class="menu-sep"></div>
                  <button class="menu-item danger" (click)="auth.logout()">
                    <mat-icon>logout</mat-icon> {{ 'menu.logout' | t }}
                  </button>
                </div>
              }
            </div>
          </div>
        </header>

        <main class="page"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: [`
    .app-shell { display: flex; height: 100vh; overflow: hidden; }
    .sidebar {
      width: var(--sb); flex-shrink: 0; background: var(--sidebar);
      display: flex; flex-direction: column; overflow: hidden; z-index: 200;
      transition: width 220ms cubic-bezier(.22,.61,.36,1);
    }
    .app-shell.collapsed { --sb: 68px; }

    .brand {
      display: flex; align-items: center; gap: 11px; padding: 17px 16px;
      min-height: 64px;
    }
    .brand-logo {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(99,102,241,.4);
      mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    }
    .brand-text { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
    .brand-name { color: #fff; font-weight: 700; font-size: 16px; }
    .brand-tag {
      font-size: 10px; font-weight: 700; color: #c7d2fe; padding: 2px 6px;
      border-radius: 5px; background: rgba(99,102,241,.28);
    }

    .nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 10px 10px; }
    .group-label {
      font-size: 10px; font-weight: 700; letter-spacing: .9px; text-transform: uppercase;
      color: rgba(255,255,255,.32); padding: 16px 8px 6px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 11px; padding: 10px 11px; margin-bottom: 2px;
      border-radius: 9px; color: rgba(255,255,255,.64); text-decoration: none;
      font-size: 13.5px; font-weight: 500; white-space: nowrap; position: relative;
      transition: background 160ms, color 160ms;
      &:hover { background: rgba(255,255,255,.07); color: #fff; }
      &.active { background: rgba(99,102,241,.2); color: #dbe0ff; }
      &.active::before {
        content: ''; position: absolute; left: -10px; top: 50%; transform: translateY(-50%);
        width: 3px; height: 20px; border-radius: 0 3px 3px 0; background: #818cf8;
      }
    }
    .nav-icon { font-size: 19px; width: 19px; height: 19px; flex-shrink: 0; }
    .nav-label {
      overflow: hidden; white-space: nowrap;
      transition: opacity 140ms ease;
    }
    .app-shell.collapsed .nav-label { opacity: 0; width: 0; }
    .group-label { transition: opacity 140ms ease; }

    .sidebar-footer { padding: 10px; }
    .collapse-btn {
      display: flex; align-items: center; gap: 11px; width: 100%; padding: 10px 11px;
      border: none; background: rgba(255,255,255,.05); border-radius: 9px;
      color: rgba(255,255,255,.55); cursor: pointer; font-family: inherit;
      font-size: 13px; font-weight: 500; white-space: nowrap;
      &:hover { background: rgba(255,255,255,.1); color: #fff; }
      mat-icon { font-size: 19px; width: 19px; height: 19px; }
    }

    .overlay { display: none; }
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

    .topbar {
      height: 64px; background: var(--surface); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; padding: 0 18px; gap: 14px; flex-shrink: 0;
      z-index: 10;
    }
    .hamburger { display: none; }
    .page-crumb h2 { font-size: 17px; font-weight: 700; }

    .global-search {
      display: flex; align-items: center; gap: 9px; width: 100%; max-width: 360px;
      height: 40px; padding: 0 13px; margin-left: 8px;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 10px; transition: border-color 160ms, box-shadow 160ms;
      &:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-3); }
      input {
        flex: 1; border: none; outline: none; background: none;
        font-family: inherit; font-size: 13.5px; color: var(--text); min-width: 0;
        &::placeholder { color: var(--text-3); }
      }
    }

    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
    .lang-switch {
      display: flex; border: 1px solid var(--border); border-radius: 9px; overflow: hidden;
      button {
        border: none; background: var(--surface); padding: 7px 11px; font-size: 11.5px;
        font-weight: 700; color: var(--text-3); cursor: pointer; font-family: inherit;
        &.active { background: var(--primary-soft); color: var(--primary); }
      }
    }
    .profile-btn {
      display: flex; align-items: center; gap: 10px; padding: 5px 10px 5px 5px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 24px;
      cursor: pointer; font-family: inherit;
      &:hover { background: var(--surface-2); }
    }
    .profile-meta { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.25; }
    .profile-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .profile-role { font-size: 11px; color: var(--text-3); }
    .chev { font-size: 18px; width: 18px; height: 18px; color: var(--text-3); }

    .profile-menu { right: 0; top: calc(100% + 8px); min-width: 240px; }
    .profile-menu-head { display: flex; align-items: center; gap: 11px; padding: 10px; }
    .theme-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px 4px; }
    .theme-row mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-3); }
    .theme-opts { display: flex; gap: 6px; padding: 4px 8px 6px; }
    .theme-opts .period-btn { flex: 1; }

    .page { flex: 1; overflow-y: auto; background: var(--bg); }

    @media (max-width: 980px) { .global-search { display: none; } }
    @media (max-width: 820px) {
      .sidebar {
        position: fixed; inset: 0 auto 0 0; width: 250px !important;
        transform: translateX(-100%);
        transition: transform 220ms cubic-bezier(.22,.61,.36,1);
      }
      .sidebar.mobile-open { transform: translateX(0); }
      .sidebar .nav-label { opacity: 1 !important; width: auto !important; }
      .overlay {
        display: block; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 199;
        animation: fadeIn 160ms ease;
      }
      .hamburger { display: inline-flex; }
      .profile-meta, .chev { display: none; }
      .page-crumb h2 { font-size: 15px; }
    }
  `],
})
export class MainLayoutComponent {
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  theme = inject(ThemeService);
  private router = inject(Router);

  readonly languages = LANGUAGES;
  readonly themeModes: ThemeMode[] = ['light', 'dark', 'system'];

  collapsed = signal(localStorage.getItem('brandx_sidebar') === 'collapsed');
  mobileOpen = signal(false);
  profileOpen = signal(false);
  globalQuery = '';

  private currentUrl = signal(this.router.url);

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl.set(e.urlAfterRedirects || e.url);
        this.profileOpen.set(false);
      });
  }

  readonly initials = computed(() => {
    const name = this.auth.displayName();
    return name ? name.trim().charAt(0).toUpperCase() : '?';
  });

  readonly roleKey = computed(() => `role.${this.auth.role() ?? 'cashier'}`);

  readonly titleKey = computed(() => {
    const segment = this.currentUrl().split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard';
    return TITLE_KEYS[segment] ?? 'app.name';
  });

  private navGroups: NavGroup[] = [
    {
      key: 'group.main',
      items: [
        { key: 'menu.dashboard', icon: 'dashboard', route: '/dashboard' },
        { key: 'menu.pos', icon: 'point_of_sale', route: '/pos' },
      ],
    },
    {
      key: 'group.catalog',
      items: [
        { key: 'menu.products', icon: 'inventory_2', route: '/products' },
        { key: 'menu.categories', icon: 'category', route: '/categories', roles: MANAGER },
      ],
    },
    {
      key: 'group.operations',
      items: [
        { key: 'menu.stock', icon: 'warehouse', route: '/stock', roles: MANAGER },
        { key: 'menu.receipts', icon: 'move_to_inbox', route: '/receipts', roles: MANAGER },
        { key: 'menu.sales', icon: 'receipt_long', route: '/sales' },
        { key: 'menu.finance', icon: 'account_balance_wallet', route: '/finance', roles: MANAGER },
      ],
    },
    {
      key: 'group.analytics',
      items: [
        { key: 'menu.reports', icon: 'bar_chart', route: '/reports', roles: MANAGER },
      ],
    },
    {
      key: 'group.admin',
      items: [
        { key: 'menu.employees', icon: 'badge', route: '/employees', roles: ['owner'] },
        { key: 'menu.settings', icon: 'settings', route: '/settings' },
      ],
    },
  ];

  readonly visibleGroups = computed(() => {
    const role = this.auth.role() ?? '';
    return this.navGroups
      .map(g => ({
        ...g,
        items: g.items.filter(i => !i.roles || i.roles.includes(role)),
      }))
      .filter(g => g.items.length > 0);
  });

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth <= 820) this.collapsed.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.profileOpen.set(false);
  }

  toggle() {
    if (window.innerWidth <= 820) {
      this.mobileOpen.update(v => !v);
    } else {
      this.collapsed.update(v => !v);
      localStorage.setItem('brandx_sidebar', this.collapsed() ? 'collapsed' : 'expanded');
    }
  }

  runGlobalSearch() {
    const q = this.globalQuery.trim();
    this.router.navigate(['/products'], { queryParams: q ? { q } : {} });
    this.globalQuery = '';
  }

  setLang(lang: Lang) {
    this.auth.persistLanguage(lang);
  }
}
