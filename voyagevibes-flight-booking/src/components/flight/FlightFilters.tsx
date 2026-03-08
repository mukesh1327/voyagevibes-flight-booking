/**
 * Flight Filters Component
 * Filter and sort flight search results
 */

import React from 'react';
import type { SearchFilters, AppliedFilters } from '../../types';
import './FlightFilters.css';

interface FlightFiltersProps {
  filters: SearchFilters | null;
  appliedFilters: AppliedFilters;
  onApplyFilters: (filters: AppliedFilters) => void;
  onSortChange: (sortBy: 'price' | 'duration' | 'departure' | 'arrival') => void;
}

export const FlightFilters: React.FC<FlightFiltersProps> = ({
  filters,
  appliedFilters,
  onApplyFilters,
  onSortChange,
}) => {
  if (!filters) return null;

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxPrice = Number(e.target.value);
    if (Number.isNaN(maxPrice)) return;
    onApplyFilters({ ...appliedFilters, maxPrice });
  };

  const handleAirlineChange = (airlineCode: string) => {
    const selectedAirlines = appliedFilters.selectedAirlines || [];
    const updated = selectedAirlines.includes(airlineCode)
      ? selectedAirlines.filter((code) => code !== airlineCode)
      : [...selectedAirlines, airlineCode];
    onApplyFilters({ ...appliedFilters, selectedAirlines: updated });
  };

  const handleStopsChange = (value?: number) => {
    onApplyFilters({ ...appliedFilters, maxStops: value });
  };

  return (
    <aside className="flight-filters">
      {/* Sort Options */}
      <div className="filter-section">
        <h3 className="filter-title">Sort By</h3>
        <div className="filter-options">
          <label className="filter-option">
            <input
              type="radio"
              name="sort"
              value="price"
              checked={appliedFilters.sortBy === 'price'}
              onChange={(e) => onSortChange(e.target.value as 'price' | 'duration' | 'departure' | 'arrival')}
            />
            <span>Lowest Price</span>
          </label>
          <label className="filter-option">
            <input
              type="radio"
              name="sort"
              value="duration"
              checked={appliedFilters.sortBy === 'duration'}
              onChange={(e) => onSortChange(e.target.value as 'price' | 'duration' | 'departure' | 'arrival')}
            />
            <span>Shortest Duration</span>
          </label>
          <label className="filter-option">
            <input
              type="radio"
              name="sort"
              value="departure"
              checked={appliedFilters.sortBy === 'departure'}
              onChange={(e) => onSortChange(e.target.value as 'price' | 'duration' | 'departure' | 'arrival')}
            />
            <span>Earliest Departure</span>
          </label>
          <label className="filter-option">
            <input
              type="radio"
              name="sort"
              value="arrival"
              checked={appliedFilters.sortBy === 'arrival'}
              onChange={(e) => onSortChange(e.target.value as 'price' | 'duration' | 'departure' | 'arrival')}
            />
            <span>Earliest Arrival</span>
          </label>
        </div>
      </div>

      {/* Price Filter */}
      <div className="filter-section">
        <h3 className="filter-title">Price Range</h3>
        <div className="price-range">
          <div className="price-info">
            <span className="price-label">₹{filters.priceRange.min}</span>
            <span className="price-label">₹{filters.priceRange.max}</span>
          </div>
          {(() => {
            const currentMaxPrice = appliedFilters.maxPrice ?? filters.priceRange.max;
            return (
              <>
                <input
                  type="range"
                  min={filters.priceRange.min}
                  max={filters.priceRange.max}
                  value={currentMaxPrice}
                  onChange={handlePriceChange}
                  className="price-slider"
                />
                <p className="selected-price">
                  Max: ₹{currentMaxPrice.toLocaleString('en-IN')}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Stops Filter */}
      <div className="filter-section">
        <h3 className="filter-title">Stops</h3>
        <div className="filter-options">
          <label className="filter-option">
            <input
              type="radio"
              name="stops"
              value="0"
              checked={appliedFilters.maxStops === 0}
              onChange={() => handleStopsChange(0)}
            />
            <span>Non-stop</span>
          </label>
          <label className="filter-option">
            <input
              type="radio"
              name="stops"
              value="1"
              checked={appliedFilters.maxStops === 1}
              onChange={() => handleStopsChange(1)}
            />
            <span>Upto 1 stop</span>
          </label>
          <label className="filter-option">
            <input
              type="radio"
              name="stops"
              value="any"
              checked={appliedFilters.maxStops === undefined}
              onChange={() => handleStopsChange(undefined)}
            />
            <span>Any</span>
          </label>
        </div>
      </div>

      {/* Airlines Filter */}
      <div className="filter-section">
        <h3 className="filter-title">Airlines</h3>
        <div className="airline-filters">
          {filters.airlines.map((airline) => (
            <label key={airline.code} className="airline-filter">
              <input
                type="checkbox"
                checked={appliedFilters.selectedAirlines?.includes(airline.code) || false}
                onChange={() => handleAirlineChange(airline.code)}
              />
              <img src={airline.logo} alt={airline.name} className="airline-logo" />
              <span className="airline-name">{airline.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Filters */}
      {Object.keys(appliedFilters).length > 0 && (
        <button
          className="reset-filters-btn"
          onClick={() => onApplyFilters({})}
        >
          Reset All Filters
        </button>
      )}
    </aside>
  );
};

export default FlightFilters;
