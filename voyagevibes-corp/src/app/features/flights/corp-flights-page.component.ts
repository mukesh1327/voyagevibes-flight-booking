import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import type { FlightCardModel } from '../../core/models/domain.models';
import { FlightOpsService } from '../../core/services/flight-ops.service';
import { CorpWorkbenchStore } from '../../core/state/corp-workbench.store';

@Component({
  selector: 'app-corp-flights-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="space-y-8">
      <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Flight desk</p>
              <h1 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-3xl font-semibold text-slate-900">Search, quote, and hold inventory</h1>
            </div>
            <button type="button" (click)="searchFlights()" class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {{ loading() ? 'Searching...' : 'Run Search' }}
            </button>
          </div>

          <form class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5" (ngSubmit)="searchFlights()">
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">From</span>
              <input [(ngModel)]="criteria.fromCode" name="fromCode" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">To</span>
              <input [(ngModel)]="criteria.toCode" name="toCode" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Departure date</span>
              <input [(ngModel)]="criteria.departureDate" name="departureDate" type="date" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Seats</span>
              <input [(ngModel)]="criteria.seatCount" name="seatCount" type="number" min="1" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Cabin</span>
              <select [(ngModel)]="criteria.cabinClass" name="cabinClass" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900">
                <option value="economy">Economy</option>
                <option value="premium-economy">Premium Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </label>
          </form>

          <div *ngIf="error()" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ error() }}
          </div>
        </div>

        <aside class="rounded-[2rem] bg-slate-950/90 p-6 text-white shadow-2xl shadow-slate-900/10">
          <p class="text-xs uppercase tracking-[0.25em] text-cyan-300">Current selection</p>
          <ng-container *ngIf="workbench.selectedFlight() as selected; else noSelection">
            <h2 class="mt-3 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold">
              {{ selected.segments[0].departureAirport.code }} -> {{ selected.segments[0].arrivalAirport.code }}
            </h2>
            <p class="mt-2 text-sm text-slate-300">{{ selected.segments[0].airline.name }} | {{ selected.id }}</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Availability</p>
                <p class="mt-2 text-xl font-semibold">{{ selected.availability.seats }} seats</p>
              </div>
              <div class="rounded-2xl bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Base fare</p>
                <p class="mt-2 text-xl font-semibold">INR {{ Math.round(selected.pricing.totalPrice).toLocaleString('en-IN') }}</p>
              </div>
            </div>

            <div *ngIf="workbench.currentQuote() as quote" class="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm">
              Quote {{ quote.quoteId }} | INR {{ Math.round(quote.pricing.totalPrice).toLocaleString('en-IN') }} valid until
              {{ quote.validUntil | date: 'mediumTime' }}
            </div>

            <div *ngIf="workbench.currentHold() as hold" class="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              Hold {{ hold.holdId }} is active for {{ hold.seatCount }} seat(s) until {{ hold.expiresAt | date: 'mediumTime' }}.
            </div>

            <div class="mt-6 flex flex-wrap gap-3">
              <button type="button" (click)="quoteSelected()" class="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                Quote
              </button>
              <button type="button" (click)="holdSelected()" class="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold transition hover:bg-white/8">
                Hold inventory
              </button>
              <a routerLink="/workspace/bookings" class="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold transition hover:bg-white/8">
                Send to booking desk
              </a>
            </div>
          </ng-container>

          <ng-template #noSelection>
            <div class="mt-5 rounded-3xl border border-dashed border-white/15 px-5 py-10 text-center text-sm text-slate-400">
              Search results will appear on the left. Select a flight to quote or hold inventory.
            </div>
          </ng-template>
        </aside>
      </div>

      <div class="grid gap-5">
        <article
          *ngFor="let flight of workbench.flights()"
          class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div class="grid gap-4 md:grid-cols-[1.1fr_1fr_0.9fr] md:items-center">
              <div>
                <p class="text-lg font-semibold text-slate-900">
                  {{ flight.segments[0].departureAirport.code }} -> {{ flight.segments[0].arrivalAirport.code }}
                </p>
                <p class="mt-1 text-sm text-slate-500">{{ flight.segments[0].airline.name }} | {{ flight.id }}</p>
              </div>
              <div class="text-sm text-slate-500">
                <p>{{ flight.segments[0].departureTime | date: 'medium' }}</p>
                <p class="mt-1">{{ flight.segments[0].arrivalTime | date: 'medium' }}</p>
              </div>
              <div class="text-sm text-slate-500">
                <p>{{ flight.totalDurationMinutes }} min</p>
                <p class="mt-1">{{ flight.availability.seats }} seats open</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div class="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Indicative fare</p>
                <p class="mt-1 text-lg font-semibold text-slate-900">INR {{ Math.round(flight.pricing.totalPrice).toLocaleString('en-IN') }}</p>
              </div>
              <button type="button" (click)="selectFlight(flight)" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                Select
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
})
export class CorpFlightsPageComponent {
  protected readonly workbench = inject(CorpWorkbenchStore);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly Math = Math;

  private readonly flightOps = inject(FlightOpsService);
  private readonly router = inject(Router);

  protected criteria = { ...this.workbench.searchCriteria() };

  protected async searchFlights(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    const response = await this.flightOps.search(this.criteria);
    this.loading.set(false);

    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Flight search failed.');
      return;
    }

    this.workbench.setFlights(response.data.flights, { ...this.criteria });
    this.workbench.log(`Search returned ${response.data.totalResults} corp-visible flight option(s).`);
  }

  protected selectFlight(flight: FlightCardModel): void {
    this.workbench.setSelectedFlight(flight);
    this.workbench.log(`Selected flight ${flight.id} for quote and booking operations.`);
  }

  protected async quoteSelected(): Promise<void> {
    const selected = this.workbench.selectedFlight();
    if (!selected) {
      return;
    }

    const response = await this.flightOps.quote(selected.id, this.criteria.seatCount);
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to quote selected flight.');
      return;
    }

    this.workbench.setQuote(response.data);
    this.workbench.log(`Quoted flight ${selected.id} for ${this.criteria.seatCount} seat(s).`);
  }

  protected async holdSelected(): Promise<void> {
    const selected = this.workbench.selectedFlight();
    if (!selected) {
      return;
    }

    const response = await this.flightOps.holdInventory(selected.id, this.criteria.seatCount);
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to hold inventory.');
      return;
    }

    this.workbench.setHold(response.data);
    this.workbench.log(`Held ${response.data.seatCount} seat(s) on flight ${selected.id}.`);
    await this.router.navigateByUrl('/workspace/bookings');
  }
}
