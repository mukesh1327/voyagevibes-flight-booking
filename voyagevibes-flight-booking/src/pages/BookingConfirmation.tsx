import React from 'react';
import type { Booking } from '../types';
import { Header, Footer, Button, Card } from '../components';
import './BookingConfirmation.css';

interface BookingConfirmationPageProps {
  booking: Booking;
  paymentId: string;
  onNavigate: (path: string) => void;
}

export const BookingConfirmationPage: React.FC<BookingConfirmationPageProps> = ({
  booking,
  paymentId,
  onNavigate,
}) => {
  const firstFlight = booking.flights[0];
  const segment = firstFlight?.flight.segments[0];

  return (
    <div className="confirmation-page">
      <Header onNavigate={onNavigate} />

      <main className="confirmation-main">
        <Card className="confirmation-card">
          <div className="confirmation-icon">✅</div>
          <h1>Booking Confirmed</h1>
          <p>Your trip is confirmed and payment has been captured successfully.</p>

          <div className="confirmation-grid">
            <div>
              <label>Booking Reference</label>
              <p>{booking.bookingReference}</p>
            </div>
            <div>
              <label>Booking ID</label>
              <p>{booking.id}</p>
            </div>
            <div>
              <label>Payment ID</label>
              <p>{paymentId}</p>
            </div>
            <div>
              <label>Status</label>
              <p>{booking.status.toUpperCase()}</p>
            </div>
          </div>

          {segment && (
            <div className="confirmation-trip-box">
              <h3>Itinerary</h3>
              <p>
                {segment.departureAirport.code} → {segment.arrivalAirport.code}
              </p>
              <p>
                {new Date(segment.departureTime).toLocaleString('en-IN')} -{' '}
                {new Date(segment.arrivalTime).toLocaleString('en-IN')}
              </p>
            </div>
          )}

          <div className="confirmation-actions">
            <Button onClick={() => onNavigate('/bookings')}>View My Bookings</Button>
            <Button variant="outline" onClick={() => onNavigate('/')}>
              Book Another Flight
            </Button>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default BookingConfirmationPage;
