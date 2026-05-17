import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTokens, User } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'brandx_access';
  private readonly REFRESH_KEY = 'brandx_refresh';
  private readonly USER_KEY = 'brandx_user';

  // Reactive state using signals
  private _currentUser = signal<User | null>(this.loadStoredUser());
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => !!this._currentUser());
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly isManager = computed(() => ['admin', 'manager'].includes(this._currentUser()?.role ?? ''));

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string) {
    return this.http.post<AuthTokens>(`${environment.apiUrl}/auth/login/`, { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.access);
        localStorage.setItem(this.REFRESH_KEY, res.refresh);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        this._currentUser.set(res.user);
      }),
      catchError(err => {
        const msg = err.error?.detail || 'Invalid credentials';
        return throwError(() => new Error(msg));
      })
    );
  }

  register(data: { username: string; email: string; first_name: string; last_name: string; phone?: string; password: string; password_confirm: string }) {
    return this.http.post(`${environment.apiUrl}/auth/register/`, data);
  }

  logout() {
    const refresh = this.getRefreshToken();
    if (refresh) {
      this.http.post(`${environment.apiUrl}/auth/logout/`, { refresh }).subscribe();
    }
    this.clearStorage();
    this.router.navigate(['/auth']);
  }

  refreshToken() {
    const refresh = this.getRefreshToken();
    if (!refresh) return throwError(() => new Error('No refresh token'));
    return this.http.post<{ access: string }>(`${environment.apiUrl}/auth/token/refresh/`, { refresh }).pipe(
      tap(res => localStorage.setItem(this.TOKEN_KEY, res.access))
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  hasRole(roles: string[]): boolean {
    return roles.includes(this._currentUser()?.role ?? '');
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
