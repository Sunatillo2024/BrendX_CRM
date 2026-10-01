import { HttpClient, HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

interface RefreshResponse {
  refresh?: string;
  access: string;
}

/** Attaches the JWT and transparently refreshes it once after a 401. */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth = inject(AuthService);
  const http = inject(HttpClient);

  const token = auth.getAccessToken();
  const authorized = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const isAuthCall =
    req.url.includes('/auth/login') || req.url.includes('/auth/token/refresh');

  return next(authorized).pipe(
    catchError((error: HttpErrorResponse) => {
      const refresh = auth.getRefreshToken();

      if (error.status !== 401 || isAuthCall || !refresh) {
        if (error.status === 401 && !isAuthCall) auth.logout();
        return throwError(() => error);
      }

      return http.post<RefreshResponse>(
        `${environment.apiUrl}/auth/token/refresh/`, { refresh },
      ).pipe(
        switchMap(res => {
          auth.updateAccessToken(res.access);
          if(res.refresh) auth.updateRefreshToken(res.refresh);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.access}` } }));
        }),
        catchError(refreshError => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
