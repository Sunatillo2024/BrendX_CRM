import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Lang } from '../i18n/translations';
import { TranslationService } from '../i18n/translation.service';
import { AuthTokens, User } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  private readonly TOKEN_KEY = 'brandx_access';
  private readonly REFRESH_KEY = 'brandx_refresh';
  private readonly USER_KEY = 'brandx_user';

  private _currentUser = signal<User | null>(this.loadStoredUser());
  readonly currentUser = this._currentUser.asReadonly();

  readonly isLoggedIn = computed(() => !!this._currentUser());
  readonly role = computed(() => this._currentUser()?.role ?? null);
  readonly isOwner = computed(() => this._currentUser()?.role === 'owner');
  readonly isManager = computed(() =>
    ['owner', 'manager'].includes(this._currentUser()?.role ?? ''));
  readonly isCashier = computed(() => this._currentUser()?.role === 'cashier');
  /** Cost price / margin / profit are owner-only. */
  readonly canViewFinancials = computed(() => this._currentUser()?.role === 'owner');
  readonly displayName = computed(() =>
    this._currentUser()?.display_name || this._currentUser()?.username || '');

  constructor() {
    // Restore the employee's saved UI language.
    const saved = this._currentUser()?.language;
    if (saved) this.i18n.setLang(saved as Lang, false);
  }

  /** Primary login: PIN only. */
  loginWithPin(pin: string) {
    return this.http.post<AuthTokens>(`${environment.apiUrl}/auth/login/pin/`, { pin }).pipe(
      tap(res => this.storeSession(res)),
      catchError(err => throwError(() => err)),
    );
  }

  /** Technical fallback login (username + password). */
  login(username: string, password: string) {
    return this.http.post<AuthTokens>(`${environment.apiUrl}/auth/login/`,
      { username, password }).pipe(
      tap(res => this.storeSession(res)),
      catchError(err => throwError(() => err)),
    );
  }

  logout() {
    const refresh = this.getRefreshToken();
    if (refresh) {
      this.http.post(`${environment.apiUrl}/auth/logout/`, { refresh }).subscribe({
        error: () => undefined,
      });
    }
    this.clearStorage();
    this.router.navigate(['/auth']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  /** Called by the auth interceptor after a successful token refresh. */
  updateAccessToken(access: string) {
    localStorage.setItem(this.TOKEN_KEY, access);
  }

  hasRole(roles: string[]): boolean {
    return roles.includes(this._currentUser()?.role ?? '');
  }

  /** Save the language on the employee record as well as locally. */
  persistLanguage(lang: Lang) {
    this.i18n.setLang(lang);
    if (!this.isLoggedIn()) return;
    this.http.patch<User>(`${environment.apiUrl}/auth/users/me/`, { language: lang })
      .subscribe({
        next: user => {
          const stored = JSON.stringify(user);
          localStorage.setItem(this.USER_KEY, stored);
          this._currentUser.set(user);
        },
        error: () => undefined,
      });
  }

  refreshCurrentUser() {
    if (!this.isLoggedIn()) return;
    this.http.get<User>(`${environment.apiUrl}/auth/users/me/`).subscribe({
      next: user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this._currentUser.set(user);
      },
      error: () => undefined,
    });
  }

  private storeSession(res: AuthTokens) {
    localStorage.setItem(this.TOKEN_KEY, res.access);
    localStorage.setItem(this.REFRESH_KEY, res.refresh);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this._currentUser.set(res.user);
    if (res.user.language) this.i18n.setLang(res.user.language as Lang, false);
  }

  private loadStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private clearStorage() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._currentUser.set(null);
  }
}
