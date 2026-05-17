import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredRoles: string[] = route.data['roles'] ?? [];
  if (!auth.isLoggedIn()) return router.createUrlTree(['/auth']);
  if (requiredRoles.length && !auth.hasRole(requiredRoles)) {
    return router.createUrlTree(['/']);
  }
  return true;
};
