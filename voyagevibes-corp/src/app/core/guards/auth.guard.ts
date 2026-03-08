import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CorpSessionService } from '../services/corp-session.service';

export const authGuard: CanActivateFn = () => {
  const session = inject(CorpSessionService);
  const router = inject(Router);

  return session.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
};
