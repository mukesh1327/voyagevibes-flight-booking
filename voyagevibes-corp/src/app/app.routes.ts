import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { CorpAuthPageComponent } from './features/auth/corp-auth-page.component';
import { CorpBookingsPageComponent } from './features/bookings/corp-bookings-page.component';
import { CorpDashboardPageComponent } from './features/dashboard/corp-dashboard-page.component';
import { CorpFlightsPageComponent } from './features/flights/corp-flights-page.component';
import { CorpPaymentsPageComponent } from './features/payments/corp-payments-page.component';
import { CorpShellComponent } from './layout/corp-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'workspace/dashboard' },
  { path: 'auth/login', component: CorpAuthPageComponent },
  {
    path: 'workspace',
    component: CorpShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: CorpDashboardPageComponent },
      { path: 'flights', component: CorpFlightsPageComponent },
      { path: 'bookings', component: CorpBookingsPageComponent },
      { path: 'payments', component: CorpPaymentsPageComponent },
    ],
  },
  { path: '**', redirectTo: 'workspace/dashboard' },
];
