/**
 * Flight Search Component
 * Search form for flight booking
 */

import React, { useEffect, useState } from 'react';
import type { Airport, FlightSearchRequest } from '../../types';
import { TRIP_TYPES, CABIN_CLASSES } from '../../constants';
import { Button } from '../common';
import { flightService } from '../../services';
import './FlightSearch.css';

interface FlightSearchProps {
  onSearch: (criteria: FlightSearchRequest) => void;
  isLoading?: boolean;
}

const today = new Date().toISOString().split('T')[0];

export const FlightSearch: React.FC<FlightSearchProps> = ({
  onSearch,
  isLoading = false,
}) => {
  type ClassOfTravel = FlightSearchRequest['classOfTravel'];
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('one-way');
  const [fromCode, setFromCode] = useState('DEL');
  const [toCode, setToCode] = useState('BOM');
  const [departureDate, setDepartureDate] = useState(today);
  const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [classOfTravel, setClassOfTravel] = useState<ClassOfTravel>('economy');
  const [airportOptions, setAirportOptions] = useState<Airport[]>([]);

  useEffect(() => {
    const loadAirportOptions = async () => {
      const response = await flightService.getAirportOptions();
      if (!response.success || !response.data || !response.data.length) {
        return;
      }

      setAirportOptions(response.data);
      if (!response.data.find((airport) => airport.code === fromCode)) {
        setFromCode(response.data[0].code);
      }
      if (!response.data.find((airport) => airport.code === toCode)) {
        const fallbackTo = response.data[1]?.code || response.data[0].code;
        setToCode(fallbackTo);
      }
    };

    void loadAirportOptions();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const criteria: FlightSearchRequest = {
      fromCode,
      toCode,
      departureDate,
      returnDate: tripType === 'round-trip' ? returnDate : undefined,
      passengers: { adults, children, infants },
      tripType,
      classOfTravel,
    };

    onSearch(criteria);
  };

  const swapAirports = () => {
    const temp = fromCode;
    setFromCode(toCode);
    setToCode(temp);
  };

  const options = airportOptions.length
    ? airportOptions
    : [
        { code: 'DEL', city: 'DEL', name: 'DEL Airport', country: 'India', timezone: 'IST' },
        { code: 'BOM', city: 'BOM', name: 'BOM Airport', country: 'India', timezone: 'IST' },
      ];

  return (
    <form className="flight-search-form" onSubmit={handleSearch}>
      {/* Trip Type Selection */}
      <div className="trip-type-selector">
        {TRIP_TYPES.map((type) => (
          <label key={type.value} className="trip-option">
            <input
              type="radio"
              name="tripType"
              value={type.value}
              checked={tripType === type.value}
              onChange={(e) => setTripType(e.target.value as typeof tripType)}
            />
            <span>{type.label}</span>
          </label>
        ))}
      </div>

      {/* Main Search Row */}
      <div className="search-row">
        {/* From */}
        <div className="search-field">
          <label>From</label>
          <select value={fromCode} onChange={(e) => setFromCode(e.target.value)}>
            {options.map((airport) => (
              <option key={`from-${airport.code}`} value={airport.code}>
                {airport.city} ({airport.code})
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <button
          type="button"
          className="swap-btn"
          onClick={swapAirports}
          title="Swap airports"
        >
          ⇆
        </button>

        {/* To */}
        <div className="search-field">
          <label>To</label>
          <select value={toCode} onChange={(e) => setToCode(e.target.value)}>
            {options.map((airport) => (
              <option key={`to-${airport.code}`} value={airport.code}>
                {airport.city} ({airport.code})
              </option>
            ))}
          </select>
        </div>

        {/* Departure Date */}
        <div className="search-field">
          <label>Departure</label>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            min={today}
            required
          />
        </div>

        {/* Return Date */}
        {tripType === 'round-trip' && (
          <div className="search-field">
            <label>Return</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={departureDate}
              required
            />
          </div>
        )}

        {/* Cabin Class */}
        <div className="search-field">
          <label>Class</label>
          <select
            value={classOfTravel}
            onChange={(e) => setClassOfTravel(e.target.value as ClassOfTravel)}
          >
            {CABIN_CLASSES.map((cls) => (
              <option key={cls.value} value={cls.value}>
                {cls.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Passengers Row */}
      <div className="passengers-row">
        <div className="passenger-selector">
          <label>Passengers</label>
          <div className="passenger-info">
            <span>{adults + children + infants} Traveller{adults + children + infants !== 1 ? 's' : ''}</span>
            <span className="class-label">{classOfTravel}</span>
          </div>
        </div>

        <div className="passenger-counts">
          <div className="count-group">
            <label>Adults</label>
            <div className="counter">
              <button
                type="button"
                onClick={() => setAdults(Math.max(1, adults - 1))}
              >
                −
              </button>
              <span>{adults}</span>
              <button type="button" onClick={() => setAdults(adults + 1)}>
                +
              </button>
            </div>
          </div>

          <div className="count-group">
            <label>Children</label>
            <div className="counter">
              <button
                type="button"
                onClick={() => setChildren(Math.max(0, children - 1))}
              >
                −
              </button>
              <span>{children}</span>
              <button type="button" onClick={() => setChildren(children + 1)}>
                +
              </button>
            </div>
          </div>

          <div className="count-group">
            <label>Infants</label>
            <div className="counter">
              <button
                type="button"
                onClick={() => setInfants(Math.max(0, infants - 1))}
              >
                −
              </button>
              <span>{infants}</span>
              <button type="button" onClick={() => setInfants(infants + 1)}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <div className="search-actions">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          style={{ width: '100%' }}
        >
          🔍 Search Flights
        </Button>
      </div>
    </form>
  );
};

export default FlightSearch;
