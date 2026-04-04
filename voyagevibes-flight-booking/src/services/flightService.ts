import type {
  Flight,
  FlightSearchRequest,
  FlightSearchResponse,
  Availability,
  ApiResponse,
  PricingQuoteRequest,
  PricingQuoteResponse,
  InventoryHoldRequest,
  InventoryHoldResponse,
  InventoryReleaseRequest,
  InventoryCommitRequest,
  FlightWithPrice,
  AirlineInfo,
  Airport,
  PricingInfo,
} from '../types';
import { apiRequest, toDate } from './apiClient';

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

interface BackendAvailability {
  flightId: string;
  availableSeats: number;
  status: string;
}

interface BackendQuote {
  flightId: string;
  seatCount: number;
  totalAmount: number;
  currency: string;
}

const AIRLINE_LOGOS: Record<string, string> = {
  voyagevibes: 'https://images.ixigo.com/image/upload/airlines/indigo.png',
  cloudair: 'https://images.ixigo.com/image/upload/airlines/air-india.png',
};

const buildRange = (values: number[]) => {
  if (!values.length) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

const toErrorResponse = <T>(response: ApiResponse<unknown>): ApiResponse<T> => ({
  success: false,
  error: response.error || {
    code: 'API_ERROR',
    message: 'Request failed',
  },
  timestamp: response.timestamp,
});

const airportFromCode = (code: string): Airport => {
  return {
    code,
    name: `${code} Airport`,
    city: code,
    country: 'India',
    timezone: 'IST',
  };
};

const airlineFromName = (name: string): AirlineInfo => {
  const code = name.slice(0, 2).toUpperCase();
  return {
    code,
    name,
    logo: AIRLINE_LOGOS[name.toLowerCase()] || 'https://images.ixigo.com/image/upload/airlines/air-india.png',
  };
};

const mapPricing = (baseFare: number, seatCount = 1): PricingInfo => {
  const totalPrice = Math.max(baseFare * seatCount, 0);
  return {
    baseFare: totalPrice,
    taxes: 0,
    fees: 0,
    totalPrice,
    currency: 'INR',
    fareBasis: 'Y0STANDARD',
    fareFamily: 'economy',
  };
};

const mapBackendFlight = (item: BackendFlight): FlightWithPrice => {
  const departureDate = toDate(item.departureAt);
  const arrivalDate = toDate(item.arrivalAt);
  const duration = Math.max(
    0,
    Math.round((arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60))
  );

  const flight: Flight = {
    id: item.flightId,
    segments: [
      {
        id: `${item.flightId}-SEG-1`,
        flightId: item.flightId,
        airline: airlineFromName(item.airline),
        aircraft: {
          type: 'NARROW_BODY',
          manufacturer: 'Airbus',
          model: 'A320',
        },
        departureAirport: airportFromCode(item.from),
        arrivalAirport: airportFromCode(item.to),
        departureTime: departureDate,
        arrivalTime: arrivalDate,
        duration,
        stops: 0,
      },
    ],
    totalDuration: duration,
    totalStops: 0,
    departureDate,
    arrivalDate,
  };

  return {
    flight,
    pricing: mapPricing(item.baseFare),
    availability: {
      seats: item.availableSeats,
    },
  };
};

class FlightService {
  async getAirportOptions(): Promise<ApiResponse<Airport[]>> {
    const response = await apiRequest<BackendFlightSearchResponse>('flight', '/api/v1/flights/search');

    if (!response.success || !response.data) {
      return toErrorResponse<Airport[]>(response);
    }

    const airportMap = new Map<string, Airport>();

    response.data.flights.forEach((flight) => {
      const fromCode = (flight.from || '').trim().toUpperCase();
      const toCode = (flight.to || '').trim().toUpperCase();

      if (fromCode && !airportMap.has(fromCode)) {
        const from = airportFromCode(fromCode);
        airportMap.set(fromCode, from);
      }

      if (toCode && !airportMap.has(toCode)) {
        const to = airportFromCode(toCode);
        airportMap.set(toCode, to);
      }
    });

    const airports = Array.from(airportMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    return {
      success: true,
      data: airports,
      timestamp: response.timestamp,
    };
  }

  async searchFlights(criteria: FlightSearchRequest): Promise<ApiResponse<FlightSearchResponse>> {
    const departureDate =
      typeof criteria.departureDate === 'string'
        ? criteria.departureDate
        : criteria.departureDate.toISOString().slice(0, 10);

    let response = await apiRequest<BackendFlightSearchResponse>('flight', '/api/v1/flights/search', {
      query: {
        from: criteria.fromCode,
        to: criteria.toCode,
        date: departureDate,
      },
    });

    if (response.success && response.data && response.data.count === 0) {
      const broadResponse = await apiRequest<BackendFlightSearchResponse>('flight', '/api/v1/flights/search', {
        query: {
          from: criteria.fromCode,
          to: criteria.toCode,
        },
      });

      if (broadResponse.success && broadResponse.data && broadResponse.data.count > 0) {
        response = broadResponse;
      }
    }

    if (!response.success || !response.data) {
      return toErrorResponse<FlightSearchResponse>(response);
    }

    const flights = response.data.flights.map(mapBackendFlight);
    const priceValues = flights.map((f) => f.pricing.totalPrice);
    const durationValues = flights.map((f) => f.flight.totalDuration);

    return {
      success: true,
      data: {
        flights,
        totalResults: response.data.count,
        filters: {
          priceRange: buildRange(priceValues),
          airlines: Array.from(
            new Map(flights.map((f) => [f.flight.segments[0].airline.code, f.flight.segments[0].airline])).values()
          ),
          stops: [0],
          departureTimeRanges: [
            { label: 'Early Morning', start: 0, end: 6 },
            { label: 'Morning', start: 6, end: 12 },
            { label: 'Afternoon', start: 12, end: 18 },
            { label: 'Evening', start: 18, end: 24 },
          ],
          duration: buildRange(durationValues),
        },
      },
      timestamp: response.timestamp,
    };
  }

  async getFlightDetails(flightId: string): Promise<ApiResponse<Flight>> {
    const response = await apiRequest<BackendFlight>('flight', `/api/v1/flights/${flightId}`);

    if (!response.success || !response.data) {
      return toErrorResponse<Flight>(response);
    }

    return {
      success: true,
      data: mapBackendFlight(response.data).flight,
      timestamp: response.timestamp,
    };
  }

  async getFlightAvailability(flightId: string): Promise<ApiResponse<Availability>> {
    const response = await apiRequest<BackendAvailability>('flight', `/api/v1/flights/${flightId}/availability`);

    if (!response.success || !response.data) {
      return toErrorResponse<Availability>(response);
    }

    return {
      success: true,
      data: {
        seats: response.data.availableSeats,
      },
      timestamp: response.timestamp,
    };
  }

  async getPricingQuote(request: PricingQuoteRequest): Promise<ApiResponse<PricingQuoteResponse>> {
    const response = await apiRequest<BackendQuote>('flight', '/api/v1/pricing/quote', {
      method: 'POST',
      body: {
        flightId: request.flightId,
        seatCount: Math.max(request.passengers.length, 1),
      },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<PricingQuoteResponse>(response);
    }

    return {
      success: true,
      data: {
        quoteId: `quote-${request.flightId}-${Date.now()}`,
        pricing: mapPricing(response.data.totalAmount),
        validUntil: new Date(Date.now() + 10 * 60 * 1000),
      },
      timestamp: response.timestamp,
    };
  }

  async holdInventory(
    requestOrFlightId: InventoryHoldRequest | string,
    seatCount?: number
  ): Promise<ApiResponse<InventoryHoldResponse>> {
    const request: InventoryHoldRequest =
      typeof requestOrFlightId === 'string'
        ? { flightId: requestOrFlightId, seatCount: seatCount ?? 1 }
        : requestOrFlightId;

    const response = await apiRequest<{ holdId: string; status: string }>('flight', '/api/v1/inventory/hold', {
      method: 'POST',
      body: request,
    });

    if (!response.success || !response.data) {
      return toErrorResponse<InventoryHoldResponse>(response);
    }

    return {
      success: true,
      data: {
        holdId: response.data.holdId,
        flightId: request.flightId,
        seatCount: request.seatCount,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      timestamp: response.timestamp,
    };
  }

  async releaseInventory(requestOrHoldId: InventoryReleaseRequest | string): Promise<ApiResponse<boolean>> {
    const holdId = typeof requestOrHoldId === 'string' ? requestOrHoldId : requestOrHoldId.holdId;

    const response = await apiRequest<{ status: string }>('flight', '/api/v1/inventory/release', {
      method: 'POST',
      body: { holdId },
    });

    if (!response.success) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: true,
      timestamp: response.timestamp,
    };
  }

  async commitInventory(requestOrHoldId: InventoryCommitRequest | string): Promise<ApiResponse<boolean>> {
    const holdId = typeof requestOrHoldId === 'string' ? requestOrHoldId : requestOrHoldId.holdId;

    const response = await apiRequest<{ status: string }>('flight', '/api/v1/inventory/commit', {
      method: 'POST',
      body: { holdId },
    });

    if (!response.success) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: true,
      timestamp: response.timestamp,
    };
  }
}

export const flightService = new FlightService();
