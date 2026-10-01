import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.role() === 'platform_admin') return router.createUrlTree(['/platform']);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/auth']);
};
