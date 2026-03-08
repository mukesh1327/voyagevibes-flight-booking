/**
 * Flight Card Component
 * Displays a single flight with pricing and details
 */

import React from 'react';
import type { FlightWithPrice } from '../../types';
import { Badge } from '../common';
import './FlightCard.css';

interface FlightCardProps {
  flight: FlightWithPrice;
  onSelect: (flight: FlightWithPrice) => void;
  isSelected?: boolean;
}

const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const FlightCard: React.FC<FlightCardProps> = ({
  flight,
  onSelect,
  isSelected = false,
}) => {
  const segment = flight.flight.segments[0];
  const departureTime = new Date(segment.departureTime);
  const arrivalTime = new Date(segment.arrivalTime);

  return (
    <div
      className={`flight-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(flight)}
    >
      <div className="flight-card-header">
        <div className="airline-section">
          <img
            src={segment.airline.logo}
            alt={segment.airline.name}
            className="airline-logo"
          />
          <div className="airline-info">
            <p className="airline-name">{segment.airline.name}</p>
            <p className="flight-number">
              {segment.airline.code} {segment.flightId.split('-')[0]}
            </p>
          </div>
        </div>
        <div className="price-section">
          <p className="price">₹{Math.round(flight.pricing.totalPrice).toLocaleString('en-IN')}</p>
          <p className="per-person">per person</p>
        </div>
      </div>

      <div className="flight-card-body">
        <div className="flight-timeline">
          <div className="stop">
            <p className="time">{formatTime(departureTime)}</p>
            <p className="airport">{segment.departureAirport.code}</p>
          </div>

          <div className="route-info">
            <div className="duration">{formatDuration(flight.flight.totalDuration)}</div>
            <div className="stops-indicator">
              {flight.flight.totalStops === 0 ? (
                <p className="stops-text">Non-stop</p>
              ) : (
                <p className="stops-text">{flight.flight.totalStops} stop</p>
              )}
            </div>
          </div>

          <div className="stop">
            <p className="time">{formatTime(arrivalTime)}</p>
            <p className="airport">{segment.arrivalAirport.code}</p>
          </div>
        </div>
      </div>

      <div className="flight-card-footer">
        <div className="tags">
          <Badge variant="info">{segment.aircraft.model}</Badge>
          {flight.pricing.discount && flight.pricing.discount > 0 && (
            <Badge variant="success">₹{Math.round(flight.pricing.discount)} OFF</Badge>
          )}
          {flight.availability.seats < 10 && flight.availability.seats > 0 && (
            <Badge variant="warning">{flight.availability.seats} seats left</Badge>
          )}
        </div>
        <button className="select-btn">
          {isSelected ? 'Selected' : 'Select'}
        </button>
      </div>
    </div>
  );
};

export default FlightCard;
