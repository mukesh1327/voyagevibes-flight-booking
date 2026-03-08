import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BookingOpsService } from '../../core/services/booking-ops.service';
import { CorpSessionService } from '../../core/services/corp-session.service';
import { CorpWorkbenchStore } from '../../core/state/corp-workbench.store';

@Component({
  selector: 'app-corp-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="space-y-8">
      <div class="rounded-[2rem] bg-slate-950/55 p-8 text-white shadow-2xl shadow-slate-950/20">
        <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-cyan-300">Ops overview</p>
            <h1 class="mt-3 font-['Space_Grotesk','Segoe_UI',sans-serif] text-4xl font-semibold">
              Corp routing, business workflows, and payment actions in one desk.
            </h1>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              This workspace is aligned with the root README: corp auth with MFA, flight shopping and inventory,
              booking orchestration, and payment lifecycle management.
            </p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-3xl border border-white/10 bg-white/6 p-5">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Session</p>
              <p class="mt-2 text-lg font-semibold">{{ session.session()?.mfaLevel || 'Not established' }}</p>
              <p class="mt-1 text-sm text-slate-300">{{ session.session()?.user?.email }}</p>
            </div>
            <div class="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5">
              <p class="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Realm</p>
              <p class="mt-2 text-lg font-semibold">{{ session.session()?.user?.realm || 'voyagevibes-corp' }}</p>
              <p class="mt-1 text-sm text-cyan-50/80">Edge host: corp-api.voyagevibes.in</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-4">
        <article *ngFor="let card of kpiCards()" class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-xs uppercase tracking-[0.24em] text-slate-400">{{ card.label }}</p>
          <p class="mt-3 text-3xl font-semibold text-slate-900">{{ card.value }}</p>
          <p class="mt-2 text-sm text-slate-500">{{ card.caption }}</p>
        </article>
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section class="rounded-[2rem] border border-slate-200 bg-white p-6">
          <div>
            <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Operational lanes</p>
            <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-slate-900">Next actions</h2>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-3">
            <a routerLink="/workspace/flights" class="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p class="text-sm font-semibold text-slate-900">Search and quote</p>
              <p class="mt-2 text-sm text-slate-500">Search corp fares, inspect availability, and hold inventory.</p>
            </a>
            <a routerLink="/workspace/bookings" class="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p class="text-sm font-semibold text-slate-900">Reserve and confirm</p>
              <p class="mt-2 text-sm text-slate-500">Reserve new itineraries, manage changes, and confirm after payment capture.</p>
            </a>
            <a routerLink="/workspace/payments" class="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p class="text-sm font-semibold text-slate-900">Move payment state</p>
              <p class="mt-2 text-sm text-slate-500">Create intent, authorize, capture, or refund against the active booking.</p>
            </a>
          </div>
        </section>

        <section class="rounded-[2rem] border border-slate-200 bg-white p-6">
          <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Activity feed</p>
          <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-slate-900">Recent workspace events</h2>

          <div class="mt-6 space-y-3">
            <div *ngFor="let item of workbench.activityFeed()" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {{ item }}
            </div>
          </div>
        </section>
      </div>
    </section>
  `,
})
export class CorpDashboardPageComponent {
  protected readonly session = inject(CorpSessionService);
  protected readonly workbench = inject(CorpWorkbenchStore);

  private readonly bookingOps = inject(BookingOpsService);

  protected readonly kpiCards = computed(() => {
    const bookings = this.workbench.bookingList();
    const activeBookings = bookings.filter((item) => item.status !== 'CANCELLED').length;
    const pendingPayments = bookings.filter((item) => item.paymentStatus !== 'CAPTURED').length;
    const currentHold = this.workbench.currentHold();
    const quote = this.workbench.currentQuote();

    return [
      { label: 'Active bookings', value: activeBookings, caption: 'Visible to corp actor across customers.' },
      { label: 'Pending payments', value: pendingPayments, caption: 'Bookings still waiting for payment completion.' },
      { label: 'Current hold', value: currentHold?.holdId || 'None', caption: currentHold ? `Expires ${new Date(currentHold.expiresAt).toLocaleTimeString('en-IN')}` : 'No hold has been created yet.' },
      { label: 'Last quote', value: quote ? `INR ${Math.round(quote.pricing.totalPrice).toLocaleString('en-IN')}` : 'Not quoted', caption: quote ? `Valid until ${new Date(quote.validUntil).toLocaleTimeString('en-IN')}` : 'Request a quote from the flight desk.' },
    ];
  });

  constructor() {
    if (!this.workbench.bookingList().length) {
      void this.loadBookings();
    }
  }

  private async loadBookings(): Promise<void> {
    const response = await this.bookingOps.list();
    if (response.success && response.data) {
      this.workbench.setBookings(response.data);
      this.workbench.log(`Loaded ${response.data.length} booking(s) into the dashboard view.`);
    }
  }
}
