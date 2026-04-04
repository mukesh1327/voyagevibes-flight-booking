import { Injectable, inject } from '@angular/core';

import type { ApiResult, BookingRecord, FlightSummary } from '../models/domain.models';
import { ApiClientService } from './api-client.service';
import { FlightOpsService } from './flight-ops.service';

interface BackendBooking {
  bookingId: string;
  userId: string;
  flightId: string;
  seatCount: number;
  status: string;
  paymentStatus: string;
  holdId: string;
  actorType: string;
  updatedAt: string;
}

interface BackendBookingList {
  count: number;
  items: BackendBooking[];
}

const toFailure = <T>(response: ApiResult<unknown>): ApiResult<T> => ({
  success: false,
  error: response.error,
  status: response.status,
  timestamp: response.timestamp,
});

@Injectable({ providedIn: 'root' })
export class BookingOpsService {
  private readonly api = inject(ApiClientService);
  private readonly flightOps = inject(FlightOpsService);

  async reserve(payload: {
    flightId: string;
    seatCount: number;
  }): Promise<ApiResult<BookingRecord>> {
    const response = await this.api.request<BackendBooking>('booking', '/api/v1/bookings/reserve', {
      method: 'POST',
      body: {
        flightId: payload.flightId,
        seatCount: payload.seatCount,
      },
    });

    if (!response.success || !response.data) {
      return toFailure<BookingRecord>(response);
    }

    return {
      ...response,
      data: await this.hydrate(response.data),
    };
  }

  async list(): Promise<ApiResult<BookingRecord[]>> {
    const response = await this.api.request<BackendBookingList>('booking', '/api/v1/bookings');
    if (!response.success || !response.data) {
      return toFailure<BookingRecord[]>(response);
    }

    return {
      ...response,
      data: await Promise.all(response.data.items.map((item) => this.hydrate(item))),
    };
  }

  async getOne(bookingId: string): Promise<ApiResult<BookingRecord>> {
    const response = await this.api.request<BackendBooking>('booking', `/api/v1/bookings/${bookingId}`);
    if (!response.success || !response.data) {
      return toFailure<BookingRecord>(response);
    }

    return {
      ...response,
      data: await this.hydrate(response.data),
    };
  }

  async confirm(bookingId: string): Promise<ApiResult<BookingRecord>> {
    const response = await this.api.request<BackendBooking>('booking', `/api/v1/bookings/${bookingId}/confirm`, {
      method: 'POST',
    });

    if (!response.success || !response.data) {
      return toFailure<BookingRecord>(response);
    }

    return {
      ...response,
      data: await this.hydrate(response.data),
    };
  }

  async cancel(bookingId: string): Promise<ApiResult<BookingRecord>> {
    const response = await this.api.request<BackendBooking>('booking', `/api/v1/bookings/${bookingId}/cancel`, {
      method: 'POST',
    });

    if (!response.success || !response.data) {
      return toFailure<BookingRecord>(response);
    }

    return {
      ...response,
      data: await this.hydrate(response.data),
    };
  }

  async change(bookingId: string, newFlightId: string, newSeatCount: number): Promise<ApiResult<BookingRecord>> {
    const response = await this.api.request<BackendBooking>('booking', `/api/v1/bookings/${bookingId}/change`, {
      method: 'POST',
      body: {
        newFlightId,
        newSeatCount,
      },
    });

    if (!response.success || !response.data) {
      return toFailure<BookingRecord>(response);
    }

    return {
      ...response,
      data: await this.hydrate(response.data),
    };
  }

  private async hydrate(booking: BackendBooking): Promise<BookingRecord> {
    const mapped: BookingRecord = {
      bookingId: booking.bookingId,
      userId: booking.userId,
      flightId: booking.flightId,
      seatCount: booking.seatCount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      holdId: booking.holdId,
      actorType: booking.actorType,
      updatedAt: booking.updatedAt,
    };

    const detail = await this.flightOps.getFlight(booking.flightId);
    if (!detail.success || !detail.data) {
      return mapped;
    }

    const segment = detail.data.segments[0];
    const quote = await this.flightOps.quote(booking.flightId, Math.max(booking.seatCount, 1));
    const flightSummary: FlightSummary = {
      flightId: booking.flightId,
      routeLabel: `${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`,
      departureTime: segment.departureTime,
      arrivalTime: segment.arrivalTime,
    };

    return {
      ...mapped,
      flightSummary,
      quotedAmount: quote.data?.pricing.totalPrice,
    };
  }
}
