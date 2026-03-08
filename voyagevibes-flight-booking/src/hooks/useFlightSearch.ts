/**
 * useFlightSearch Hook
 * Manages flight search state and operations
 */

import { useState, useCallback } from 'react';
import type {
  FlightSearchRequest,
  FlightWithPrice,
  SearchFilters,
  AppliedFilters,
} from '../types';
import { flightService } from '../services';

const sortFlightsByKey = (
  flights: FlightWithPrice[],
  key: 'price' | 'duration' | 'departure' | 'arrival',
  order: 'asc' | 'desc'
): FlightWithPrice[] => {
  const sorted = [...flights];

  sorted.sort((a, b) => {
    let compareA: number;
    let compareB: number;

    switch (key) {
      case 'price':
        compareA = a.pricing.totalPrice;
        compareB = b.pricing.totalPrice;
        break;
      case 'duration':
        compareA = a.flight.totalDuration;
        compareB = b.flight.totalDuration;
        break;
      case 'departure':
        compareA = new Date(a.flight.departureDate || 0).getTime();
        compareB = new Date(b.flight.departureDate || 0).getTime();
        break;
      case 'arrival':
        compareA = new Date(a.flight.arrivalDate || 0).getTime();
        compareB = new Date(b.flight.arrivalDate || 0).getTime();
        break;
      default:
        compareA = 0;
        compareB = 0;
        break;
    }

    return order === 'asc' ? compareA - compareB : compareB - compareA;
  });

  return sorted;
};

const applyFiltersToFlights = (
  flightList: FlightWithPrice[],
  filters: AppliedFilters
): FlightWithPrice[] => {
  let updated = [...flightList];

  if (typeof filters.maxPrice === 'number') {
    updated = updated.filter(
      (flight) => flight.pricing.totalPrice <= filters.maxPrice!
    );
  }

  if (filters.selectedAirlines?.length) {
    updated = updated.filter((flight) =>
      filters.selectedAirlines!.includes(flight.flight.segments[0].airline.code)
    );
  }

  if (typeof filters.maxStops === 'number') {
    updated = updated.filter(
      (flight) => flight.flight.totalStops <= filters.maxStops!
    );
  }

  const sortKey = filters.sortBy || 'price';
  const sortOrder = filters.sortOrder || 'asc';

  return sortFlightsByKey(updated, sortKey, sortOrder);
};

interface UseFlightSearchReturn {
  flights: FlightWithPrice[];
  filters: SearchFilters | null;
  appliedFilters: AppliedFilters;
  isLoading: boolean;
  error: string | null;
  totalResults: number;
  searchFlights: (criteria: FlightSearchRequest) => Promise<void>;
  applyFilters: (filters: AppliedFilters) => void;
  resetFilters: () => void;
  sortFlights: (sortBy: 'price' | 'duration' | 'departure' | 'arrival') => void;
}

export const useFlightSearch = (): UseFlightSearchReturn => {
  const [flights, setFlights] = useState<FlightWithPrice[]>([]);
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [allFlights, setAllFlights] = useState<FlightWithPrice[]>([]);

  const searchFlights = useCallback(
    async (criteria: FlightSearchRequest) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await flightService.searchFlights(criteria);

        if (response.success && response.data) {
          const baseFilters: AppliedFilters = {};
          setAllFlights(response.data.flights);
          setAppliedFilters(baseFilters);
          const preparedFlights = applyFiltersToFlights(response.data.flights, baseFilters);

          setFlights(preparedFlights);
          setFilters(response.data.filters);
          setTotalResults(preparedFlights.length);
        } else {
          setError(response.error?.message || 'Failed to search flights');
        }
      } catch (err) {
        setError('An error occurred while searching flights');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const applyFilters = useCallback((newFilters: AppliedFilters) => {
    setAppliedFilters(newFilters);
    const updated = applyFiltersToFlights(allFlights, newFilters);
    setFlights(updated);
    setTotalResults(updated.length);
  }, [allFlights]);

  const resetFilters = useCallback(() => {
    setAppliedFilters({});
    const resetFlights = applyFiltersToFlights(allFlights, {});
    setFlights(resetFlights);
    setTotalResults(resetFlights.length);
  }, [allFlights]);

  const sortFlights = useCallback(
    (sortBy: 'price' | 'duration' | 'departure' | 'arrival') => {
      const nextOrder =
        appliedFilters.sortBy === sortBy
          ? appliedFilters.sortOrder === 'asc'
            ? 'desc'
            : 'asc'
          : 'asc';

      const newAppliedFilters = {
        ...appliedFilters,
        sortBy,
        sortOrder: nextOrder,
      } as AppliedFilters;

      applyFilters(newAppliedFilters);
    },
    [appliedFilters, applyFilters]
  );

  return {
    flights,
    filters,
    appliedFilters,
    isLoading,
    error,
    totalResults,
    searchFlights,
    applyFilters,
    resetFilters,
    sortFlights,
  };
};
