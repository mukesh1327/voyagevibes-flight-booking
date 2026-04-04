import { Injectable, inject } from '@angular/core';

import type {
  AirlineInfo,
  Airport,
  ApiResult,
  FlightAvailability,
  FlightCardModel,
  FlightSearchCriteria,
  FlightSearchResponse,
  InventoryHold,
  PricingQuote,
  PricingSummary,
} from '../models/domain.models';
import { ApiClientService } from './api-client.service';

interface BackendFlight {
  flightId: string;
  airline: string;
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string;
  baseFare: number;
  availableSeats: number;
}

interface BackendFlightSearchResponse {
  count: number;
  flights: BackendFlight[];
}

const toFailure = <T>(response: ApiResult<unknown>): ApiResult<T> => ({
  success: false,
  error: response.error,
  status: response.status,
  timestamp: response.timestamp,
});

@Injectable({ providedIn: 'root' })
export class FlightOpsService {
  private readonly api = inject(ApiClientService);

  async search(criteria: FlightSearchCriteria): Promise<ApiResult<FlightSearchResponse>> {
    const response = await this.api.request<BackendFlightSearchResponse>('flight', '/api/v1/flights/search', {
      query: {
        from: criteria.fromCode,
        to: criteria.toCode,
        date: criteria.departureDate,
      },
    });

    if (!response.success || !response.data) {
      return toFailure<FlightSearchResponse>(response);
    }

    return {
      ...response,
      data: {
        totalResults: response.data.count,
        flights: response.data.flights.map((flight) => this.mapFlight(flight)),
      },
    };
  }

  async getFlight(flightId: string): Promise<ApiResult<FlightCardModel>> {
    const response = await this.api.request<BackendFlight>('flight', `/api/v1/flights/${flightId}`);
    if (!response.success || !response.data) {
      return toFailure<FlightCardModel>(response);
    }

    return {
      ...response,
      data: this.mapFlight(response.data),
    };
  }

  async getAvailability(flightId: string): Promise<ApiResult<FlightAvailability>> {
    const response = await this.api.request<{ availableSeats: number }>('flight', `/api/v1/flights/${flightId}/availability`);
    if (!response.success || !response.data) {
      return toFailure<FlightAvailability>(response);
    }

    return {
      ...response,
      data: { seats: response.data.availableSeats },
    };
  }

  async quote(flightId: string, seatCount: number): Promise<ApiResult<PricingQuote>> {
    const response = await this.api.request<{ totalAmount: number; currency: string }>('flight', '/api/v1/pricing/quote', {
      method: 'POST',
      body: {
        flightId,
        seatCount,
      },
    });

    if (!response.success || !response.data) {
      return toFailure<PricingQuote>(response);
    }

    return {
      ...response,
      data: {
        quoteId: `quote-${flightId}-${Date.now()}`,
        pricing: this.mapPricing(response.data.totalAmount, response.data.currency),
        validUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    };
  }

  async holdInventory(flightId: string, seatCount: number): Promise<ApiResult<InventoryHold>> {
    const response = await this.api.request<{ holdId: string }>('flight', '/api/v1/inventory/hold', {
      method: 'POST',
      body: { flightId, seatCount },
    });

    if (!response.success || !response.data) {
      return toFailure<InventoryHold>(response);
    }

    return {
      ...response,
      data: {
        holdId: response.data.holdId,
        flightId,
        seatCount,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };
  }

  releaseHold(holdId: string): Promise<ApiResult<{ released: boolean }>> {
    return this.api.request<{ released: boolean }>('flight', '/api/v1/inventory/release', {
      method: 'POST',
      body: { holdId },
    });
  }

  private mapFlight(flight: BackendFlight): FlightCardModel {
    const departureAirport = this.mapAirport(flight.from);
    const arrivalAirport = this.mapAirport(flight.to);
    const airline = this.mapAirline(flight.airline);
    const durationMinutes = Math.max(
      0,
      Math.round((new Date(flight.arrivalAt).getTime() - new Date(flight.departureAt).getTime()) / 60000),
    );

    return {
      id: flight.flightId,
      totalDurationMinutes: durationMinutes,
      totalStops: 0,
      availability: { seats: flight.availableSeats },
      pricing: this.mapPricing(flight.baseFare, 'INR'),
      segments: [
        {
          id: `${flight.flightId}-SEG-1`,
          flightId: flight.flightId,
          airline,
          departureAirport,
          arrivalAirport,
          departureTime: flight.departureAt,
          arrivalTime: flight.arrivalAt,
          durationMinutes,
        },
      ],
    };
  }

  private mapAirport(code: string): Airport {
    return {
      code,
      city: code,
      country: 'India',
      name: `${code} Airport`,
      timezone: 'IST',
    };
  }

  private mapAirline(name: string): AirlineInfo {
    return {
      code: name.slice(0, 2).toUpperCase(),
      name,
      logo: 'https://images.ixigo.com/image/upload/airlines/air-india.png',
    };
  }

  private mapPricing(amount: number, currency: string): PricingSummary {
    return {
      baseFare: amount,
      taxes: 0,
      fees: 0,
      totalPrice: amount,
      currency,
      fareBasis: 'Y0STANDARD',
      fareFamily: 'economy',
    };
  }
}
