import { Injectable, signal } from '@angular/core';

import type {
  BookingRecord,
  FlightCardModel,
  FlightSearchCriteria,
  InventoryHold,
  PaymentRecord,
  PricingQuote,
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class CorpWorkbenchStore {
  readonly searchCriteria = signal<FlightSearchCriteria>({
    fromCode: 'DEL',
    toCode: 'BLR',
    departureDate: new Date().toISOString().slice(0, 10),
    seatCount: 2,
    cabinClass: 'business',
  });
  readonly flights = signal<FlightCardModel[]>([]);
  readonly selectedFlight = signal<FlightCardModel | null>(null);
  readonly currentQuote = signal<PricingQuote | null>(null);
  readonly currentHold = signal<InventoryHold | null>(null);
  readonly bookingList = signal<BookingRecord[]>([]);
  readonly currentBooking = signal<BookingRecord | null>(null);
  readonly currentPayment = signal<PaymentRecord | null>(null);
  readonly activityFeed = signal<string[]>([
    'Corp console initialized. Start with login, then search and operate on flights.',
  ]);

  setFlights(flights: FlightCardModel[], criteria: FlightSearchCriteria): void {
    this.flights.set(flights);
    this.searchCriteria.set(criteria);
  }

  setSelectedFlight(flight: FlightCardModel | null): void {
    this.selectedFlight.set(flight);
  }

  setQuote(quote: PricingQuote | null): void {
    this.currentQuote.set(quote);
  }

  setHold(hold: InventoryHold | null): void {
    this.currentHold.set(hold);
  }

  setBookings(bookings: BookingRecord[]): void {
    this.bookingList.set(bookings);
  }

  setCurrentBooking(booking: BookingRecord | null): void {
    this.currentBooking.set(booking);
  }

  upsertBooking(booking: BookingRecord): void {
    const next = [...this.bookingList()];
    const index = next.findIndex((item) => item.bookingId === booking.bookingId);
    if (index >= 0) {
      next[index] = booking;
    } else {
      next.unshift(booking);
    }
    this.bookingList.set(next);
    this.currentBooking.set(booking);
  }

  setCurrentPayment(payment: PaymentRecord | null): void {
    this.currentPayment.set(payment);
  }

  log(message: string): void {
    this.activityFeed.set([`${new Date().toLocaleTimeString('en-IN')} | ${message}`, ...this.activityFeed()].slice(0, 8));
  }

  resetOperationalState(): void {
    this.selectedFlight.set(null);
    this.currentQuote.set(null);
    this.currentHold.set(null);
    this.currentBooking.set(null);
    this.currentPayment.set(null);
    this.activityFeed.set(['Workspace reset.']);
  }
}
