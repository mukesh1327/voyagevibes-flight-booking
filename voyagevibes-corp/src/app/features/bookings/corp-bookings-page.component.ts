import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type { BookingRecord } from '../../core/models/domain.models';
import { BookingOpsService } from '../../core/services/booking-ops.service';
import { CorpWorkbenchStore } from '../../core/state/corp-workbench.store';

@Component({
  selector: 'app-corp-bookings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="space-y-8">
      <div class="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Booking desk</p>
              <h1 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-3xl font-semibold text-slate-900">Reserve, change, cancel, and confirm bookings</h1>
            </div>
            <button type="button" (click)="loadBookings()" class="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
              Refresh bookings
            </button>
          </div>

          <form class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Flight ID</span>
              <input [(ngModel)]="flightId" name="flightId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Seats</span>
              <input [(ngModel)]="seatCount" name="seatCount" type="number" min="1" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block md:col-span-2">
              <span class="mb-2 block text-sm text-slate-500">Customer email</span>
              <input [(ngModel)]="customerEmail" name="customerEmail" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
          </form>

          <div class="mt-6 flex flex-wrap gap-3">
            <button type="button" (click)="reserveBooking()" class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Reserve booking
            </button>
            <button type="button" (click)="confirmSelected()" class="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
              Confirm selected
            </button>
            <button type="button" (click)="cancelSelected()" class="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300">
              Cancel selected
            </button>
          </div>

          <div class="mt-6 rounded-3xl border border-dashed border-slate-200 p-5">
            <p class="text-sm font-semibold text-slate-900">Change booking</p>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">New flight ID</span>
                <input [(ngModel)]="changeFlightId" name="changeFlightId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">New seat count</span>
                <input [(ngModel)]="changeSeatCount" name="changeSeatCount" type="number" min="1" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
            </div>
            <button type="button" (click)="changeSelected()" class="mt-4 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
              Apply change
            </button>
          </div>

          <div *ngIf="message()" class="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ message() }}
          </div>
          <div *ngIf="error()" class="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ error() }}
          </div>
        </section>

        <aside class="rounded-[2rem] bg-slate-950/92 p-6 text-white">
          <p class="text-xs uppercase tracking-[0.25em] text-cyan-300">Selected booking</p>
          <ng-container *ngIf="workbench.currentBooking() as booking; else emptyBooking">
            <h2 class="mt-3 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold">{{ booking.bookingId }}</h2>
            <p class="mt-2 text-sm text-slate-300">{{ booking.flightSummary?.routeLabel || booking.flightId }}</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <p class="mt-2 text-lg font-semibold">{{ booking.status }}</p>
              </div>
              <div class="rounded-2xl bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Payment</p>
                <p class="mt-2 text-lg font-semibold">{{ booking.paymentStatus }}</p>
              </div>
            </div>
            <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Hold {{ booking.holdId }} | {{ booking.seatCount }} seat(s) | updated {{ booking.updatedAt | date: 'medium' }}
            </div>
            <a routerLink="/workspace/payments" class="mt-6 inline-flex rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Continue to payment desk
            </a>
          </ng-container>
          <ng-template #emptyBooking>
            <div class="mt-6 rounded-3xl border border-dashed border-white/15 px-5 py-10 text-center text-sm text-slate-400">
              Reserve or select a booking from the list to act on it.
            </div>
          </ng-template>
        </aside>
      </div>

      <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Corp-visible bookings</p>
          <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-slate-900">All accessible itineraries</h2>
        </div>

        <div class="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">Booking</th>
                <th class="px-4 py-3 font-medium">Route</th>
                <th class="px-4 py-3 font-medium">Seats</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 font-medium">Payment</th>
                <th class="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              <tr *ngFor="let booking of workbench.bookingList()">
                <td class="px-4 py-4">
                  <p class="font-medium text-slate-900">{{ booking.bookingId }}</p>
                  <p class="text-xs text-slate-500">{{ booking.userId }}</p>
                </td>
                <td class="px-4 py-4 text-slate-600">{{ booking.flightSummary?.routeLabel || booking.flightId }}</td>
                <td class="px-4 py-4 text-slate-600">{{ booking.seatCount }}</td>
                <td class="px-4 py-4 text-slate-600">{{ booking.status }}</td>
                <td class="px-4 py-4 text-slate-600">{{ booking.paymentStatus }}</td>
                <td class="px-4 py-4">
                  <button type="button" (click)="pickBooking(booking)" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:border-slate-900">
                    Select
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
})
export class CorpBookingsPageComponent {
  protected readonly workbench = inject(CorpWorkbenchStore);
  protected readonly message = signal('');
  protected readonly error = signal('');

  private readonly bookingOps = inject(BookingOpsService);

  protected flightId = '';
  protected seatCount = 1;
  protected customerEmail = 'traveller@voyagevibes.com';
  protected changeFlightId = '';
  protected changeSeatCount = 1;

  constructor() {
    effect(() => {
      const selected = this.workbench.selectedFlight();
      const criteria = this.workbench.searchCriteria();
      if (selected) {
        this.flightId = selected.id;
        this.seatCount = criteria.seatCount;
        this.changeSeatCount = criteria.seatCount;
      }
    });

    if (!this.workbench.bookingList().length) {
      void this.loadBookings();
    }
  }

  protected async loadBookings(): Promise<void> {
    this.resetMessages();
    const response = await this.bookingOps.list();
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to load bookings.');
      return;
    }

    this.workbench.setBookings(response.data);
    this.workbench.log(`Booking desk loaded ${response.data.length} booking(s).`);
  }

  protected async reserveBooking(): Promise<void> {
    this.resetMessages();
    const response = await this.bookingOps.reserve({
      flightId: this.flightId,
      seatCount: this.seatCount,
    });

    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to reserve booking.');
      return;
    }

    this.workbench.upsertBooking(response.data);
    this.message.set(`Reserved booking ${response.data.bookingId} for ${this.customerEmail}.`);
    this.workbench.log(`Reserved booking ${response.data.bookingId} on flight ${response.data.flightId}.`);
  }

  protected async confirmSelected(): Promise<void> {
    const current = this.workbench.currentBooking();
    if (!current) {
      return;
    }

    this.resetMessages();
    const response = await this.bookingOps.confirm(current.bookingId);
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to confirm booking.');
      return;
    }

    this.workbench.upsertBooking(response.data);
    this.message.set(`Booking ${response.data.bookingId} confirmed.`);
    this.workbench.log(`Confirmed booking ${response.data.bookingId}.`);
  }

  protected async cancelSelected(): Promise<void> {
    const current = this.workbench.currentBooking();
    if (!current) {
      return;
    }

    this.resetMessages();
    const response = await this.bookingOps.cancel(current.bookingId);
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to cancel booking.');
      return;
    }

    this.workbench.upsertBooking(response.data);
    this.message.set(`Booking ${response.data.bookingId} cancelled.`);
    this.workbench.log(`Cancelled booking ${response.data.bookingId}.`);
  }

  protected async changeSelected(): Promise<void> {
    const current = this.workbench.currentBooking();
    if (!current) {
      return;
    }

    this.resetMessages();
    const response = await this.bookingOps.change(current.bookingId, this.changeFlightId, this.changeSeatCount);
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Unable to change booking.');
      return;
    }

    this.workbench.upsertBooking(response.data);
    this.message.set(`Booking ${response.data.bookingId} moved to ${response.data.flightId}.`);
    this.workbench.log(`Changed booking ${response.data.bookingId} to flight ${response.data.flightId}.`);
  }

  protected pickBooking(booking: BookingRecord): void {
    this.resetMessages();
    this.workbench.setCurrentBooking(booking);
    this.changeFlightId = booking.flightId;
    this.changeSeatCount = booking.seatCount;
    this.message.set(`Selected booking ${booking.bookingId}.`);
  }

  private resetMessages(): void {
    this.message.set('');
    this.error.set('');
  }
}
