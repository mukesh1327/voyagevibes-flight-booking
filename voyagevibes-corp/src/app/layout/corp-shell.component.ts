import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CorpAuthService } from '../core/services/corp-auth.service';
import { CorpSessionService } from '../core/services/corp-session.service';
import { CorpWorkbenchStore } from '../core/state/corp-workbench.store';

@Component({
  selector: 'app-corp-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(39,94,254,0.22),_transparent_38%),linear-gradient(180deg,_#0a1020,_#111a30_52%,_#f5f7fb_52%,_#eef3fb_100%)] text-slate-100">
      <div class="mx-auto flex min-h-screen max-w-[1600px]">
        <aside class="hidden w-80 shrink-0 border-r border-white/10 bg-slate-950/45 px-6 py-8 backdrop-blur xl:block">
          <a routerLink="/workspace/dashboard" class="group block">
            <p class="text-xs uppercase tracking-[0.35em] text-cyan-300/80">VoyageVibes Corp</p>
            <h1 class="mt-3 font-['Space_Grotesk','Segoe_UI',sans-serif] text-3xl font-semibold leading-none text-white">
              Ops cockpit
            </h1>
            <p class="mt-3 text-sm text-slate-300">
              Corp agents manage search, hold, booking, confirmation, and payment transitions from one workspace.
            </p>
          </a>

          <nav class="mt-10 space-y-2">
            <a
              *ngFor="let item of navItems"
              [routerLink]="item.link"
              routerLinkActive="bg-white text-slate-950 shadow-lg shadow-cyan-500/20"
              class="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/5"
            >
              <span>{{ item.label }}</span>
              <span class="text-xs text-slate-400">{{ item.hint }}</span>
            </a>
          </nav>

          <section class="mt-10 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5">
            <p class="text-xs uppercase tracking-[0.25em] text-cyan-200">Workbench</p>
            <div class="mt-4 space-y-3 text-sm text-slate-200">
              <div class="rounded-2xl bg-slate-900/60 p-3">
                <p class="text-xs text-slate-400">Selected flight</p>
                <p class="mt-1 font-medium">
                  {{ workbench.selectedFlight()?.segments?.[0]?.departureAirport?.code || 'None' }}
                  <span class="text-slate-400">-></span>
                  {{ workbench.selectedFlight()?.segments?.[0]?.arrivalAirport?.code || 'None' }}
                </p>
              </div>
              <div class="rounded-2xl bg-slate-900/60 p-3">
                <p class="text-xs text-slate-400">Current booking</p>
                <p class="mt-1 font-medium">{{ workbench.currentBooking()?.bookingId || 'Not reserved yet' }}</p>
              </div>
              <div class="rounded-2xl bg-slate-900/60 p-3">
                <p class="text-xs text-slate-400">Current payment</p>
                <p class="mt-1 font-medium">{{ workbench.currentPayment()?.paymentId || 'No payment intent' }}</p>
              </div>
            </div>
          </section>
        </aside>

        <div class="flex min-h-screen flex-1 flex-col">
          <header class="border-b border-white/10 bg-slate-950/35 px-5 py-5 backdrop-blur md:px-8">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-xs uppercase tracking-[0.28em] text-cyan-300">Corporate route surface</p>
                <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-white">
                  {{ sessionService.session()?.user?.roles?.join(' | ') || 'Corp agent' }}
                </h2>
                <p class="mt-1 text-sm text-slate-300">
                  Routed through <span class="font-medium text-white">corp-api.voyagevibes.in</span> with actor context injected at Kong.
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Signed in as</p>
                  <p class="mt-1 font-medium text-white">{{ sessionService.session()?.user?.email }}</p>
                </div>
                <button
                  type="button"
                  (click)="logout()"
                  class="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main class="flex-1 px-5 py-6 md:px-8 md:py-8">
            <router-outlet />
          </main>
        </div>
      </div>
    </div>
  `,
})
export class CorpShellComponent {
  protected readonly sessionService = inject(CorpSessionService);
  protected readonly workbench = inject(CorpWorkbenchStore);

  private readonly auth = inject(CorpAuthService);
  private readonly router = inject(Router);

  protected readonly navItems = [
    { label: 'Dashboard', link: '/workspace/dashboard', hint: 'Overview' },
    { label: 'Flight Desk', link: '/workspace/flights', hint: 'Search + quote' },
    { label: 'Booking Desk', link: '/workspace/bookings', hint: 'Reserve + confirm' },
    { label: 'Payment Desk', link: '/workspace/payments', hint: 'Intent + capture' },
  ];

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.workbench.resetOperationalState();
    await this.router.navigateByUrl('/auth/login');
  }
}
