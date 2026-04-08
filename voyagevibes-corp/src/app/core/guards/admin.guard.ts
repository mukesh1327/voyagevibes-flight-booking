import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CorpSessionService } from '../services/corp-session.service';

export const adminGuard: CanActivateFn = () => {
  const session = inject(CorpSessionService);
  const router = inject(Router);

  return session.session()?.user?.roles?.includes('CORP_ADMIN')
    ? true
    : router.createUrlTree(['/workspace/dashboard']);
};