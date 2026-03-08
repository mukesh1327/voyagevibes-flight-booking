import type {
  Booking,
  BookingRequest,
  BookingConfirmationRequest,
  BookingChangeRequest,
  ApiResponse,
  FlightWithPrice,
  PassengerInfo,
} from '../types';
import { apiRequest, getAuthContext, toDate } from './apiClient';
import { flightService } from './flightService';

interface BackendBooking {
  bookingId: string;
  userId: string;
  flightId: string;
  seatCount: number;
  status: string;
  paymentStatus?: string;
  updatedAt: string;
}

interface BackendBookingList {
  count: number;
  items: BackendBooking[];
}

const toErrorResponse = <T>(response: ApiResponse<unknown>): ApiResponse<T> => ({
  success: false,
  error: response.error || {
    code: 'API_ERROR',
    message: 'Request failed',
  },
  timestamp: response.timestamp,
});

const statusToBookingStatus = (status: string): Booking['status'] => {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'CHANGED':
      return 'confirmed';
    case 'CANCELLED':
      return 'cancelled';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'pending';
  }
};

const paymentStatusToUiStatus = (
  paymentStatus: string | undefined,
  bookingStatus: string
): Booking['paymentStatus'] => {
  const normalized = (paymentStatus || '').toUpperCase();
  switch (normalized) {
    case 'AUTHORIZED':
      return 'authorized';
    case 'CAPTURED':
      return 'captured';
    case 'FAILED':
      return 'failed';
    case 'REFUNDED':
      return 'refunded';
    case 'INTENT_CREATED':
      return 'pending';
    default:
      return statusToBookingStatus(bookingStatus) === 'confirmed' ? 'captured' : 'pending';
  }
};

const makeFallbackPassenger = (): PassengerInfo => ({
  title: 'Mr',
  firstName: 'Guest',
  lastName: 'User',
  dateOfBirth: new Date('1990-01-01'),
  nationality: 'IN',
  email: 'guest@voyagevibes.dev',
  phone: '+910000000000',
  type: 'adult',
});

class BookingService {
  private async mapBackendBooking(item: BackendBooking): Promise<Booking> {
    let pricedFlight: FlightWithPrice | null = null;
    const details = await flightService.getFlightDetails(item.flightId);
    const availability = await flightService.getFlightAvailability(item.flightId);

    if (details.success && details.data) {
      pricedFlight = {
        flight: details.data,
        pricing: {
          baseFare: 0,
          taxes: 0,
          fees: 0,
          totalPrice: 0,
          currency: 'INR',
          fareBasis: 'Y0STANDARD',
          fareFamily: 'economy',
        },
        availability: {
          seats: availability.data?.seats ?? 0,
        },
      };

      if (details.data.segments[0]) {
        const quote = await apiRequest<{ totalAmount: number; currency: string }>(
          'flight',
          '/api/v1/pricing/quote',
          {
            method: 'POST',
            body: {
              flightId: item.flightId,
              seatCount: Math.max(item.seatCount, 1),
            },
          }
        );

        if (quote.success && quote.data) {
          pricedFlight.pricing.baseFare = quote.data.totalAmount;
          pricedFlight.pricing.totalPrice = quote.data.totalAmount;
          pricedFlight.pricing.currency = quote.data.currency;
        }
      }
    }

    const flights = pricedFlight ? [pricedFlight] : [];

    return {
      id: item.bookingId,
      bookingReference: item.bookingId,
      userId: item.userId,
      flights,
      passengers: Array.from({ length: Math.max(item.seatCount, 1) }, makeFallbackPassenger),
      pricing: {
        baseFare: flights[0]?.pricing.baseFare || 0,
        taxes: flights[0]?.pricing.taxes || 0,
        fees: flights[0]?.pricing.fees || 0,
        totalPrice: flights[0]?.pricing.totalPrice || 0,
        currency: 'INR',
        fareBasis: 'Y0STANDARD',
        fareFamily: 'economy',
      },
      status: statusToBookingStatus(item.status),
      paymentStatus: paymentStatusToUiStatus(item.paymentStatus, item.status),
      bookingDate: toDate(item.updatedAt),
      createdAt: toDate(item.updatedAt),
    };
  }

  async reserve(bookingRequest: BookingRequest): Promise<ApiResponse<Booking>> {
    const flightId = bookingRequest.flightIds[0];

    if (!flightId) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'At least one flightId is required',
        },
        timestamp: new Date(),
      };
    }

    const response = await apiRequest<BackendBooking>('booking', '/api/v1/bookings/reserve', {
      method: 'POST',
      body: {
        flightId,
        seatCount: Math.max(bookingRequest.passengers.length, 1),
      },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<Booking>(response);
    }

    const booking = await this.mapBackendBooking(response.data);
    booking.passengers = bookingRequest.passengers;

    return {
      success: true,
      data: booking,
      timestamp: response.timestamp,
    };
  }

  async confirmBooking(request: BookingConfirmationRequest): Promise<ApiResponse<Booking>> {
    const response = await apiRequest<BackendBooking>('booking', `/api/v1/bookings/${request.bookingId}/confirm`, {
      method: 'POST',
    });

    if (!response.success || !response.data) {
      return toErrorResponse<Booking>(response);
    }

    return {
      success: true,
      data: await this.mapBackendBooking(response.data),
      timestamp: response.timestamp,
    };
  }

  async getBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    const response = await apiRequest<BackendBooking>('booking', `/api/v1/bookings/${bookingId}`);

    if (!response.success || !response.data) {
      return toErrorResponse<Booking>(response);
    }

    return {
      success: true,
      data: await this.mapBackendBooking(response.data),
      timestamp: response.timestamp,
    };
  }

  async getUserBookings(): Promise<ApiResponse<Booking[]>> {
    const context = getAuthContext();
    const response = await apiRequest<BackendBookingList>('booking', '/api/v1/bookings', {
      headers: {
        'X-User-Id': context.userId,
      },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<Booking[]>(response);
    }

    const bookings = await Promise.all(response.data.items.map((item) => this.mapBackendBooking(item)));

    return {
      success: true,
      data: bookings,
      timestamp: response.timestamp,
    };
  }

  async cancelBooking(bookingId: string): Promise<ApiResponse<Booking>> {
    const response = await apiRequest<BackendBooking>('booking', `/api/v1/bookings/${bookingId}/cancel`, {
      method: 'POST',
    });

    if (!response.success || !response.data) {
      return toErrorResponse<Booking>(response);
    }

    return {
      success: true,
      data: await this.mapBackendBooking(response.data),
      timestamp: response.timestamp,
    };
  }

  async changeBooking(request: BookingChangeRequest): Promise<ApiResponse<Booking>> {
    const response = await apiRequest<BackendBooking>('booking', `/api/v1/bookings/${request.bookingId}/change`, {
      method: 'POST',
      body: {
        newFlightId: request.flightIds[0],
      },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<Booking>(response);
    }

    return {
      success: true,
      data: await this.mapBackendBooking(response.data),
      timestamp: response.timestamp,
    };
  }
}

export const bookingService = new BookingService();
