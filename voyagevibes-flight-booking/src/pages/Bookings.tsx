import React, { useEffect } from 'react';
import type { Booking } from '../types';
import { Header, Footer, Button, Card, Loading, EmptyState, ErrorMessage } from '../components';
import './Bookings.css';

interface BookingsPageProps {
  userName?: string;
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;
  onNavigate: (path: string) => void;
  onLoad: () => Promise<void>;
  onCancel: (bookingId: string) => Promise<void>;
  onLogout: () => void;
}

const isCurrentBooking = (booking: Booking): boolean =>
  booking.status !== 'cancelled' && booking.status !== 'completed';

export const BookingsPage: React.FC<BookingsPageProps> = ({
  userName,
  bookings,
  isLoading,
  error,
  onNavigate,
  onLoad,
  onCancel,
  onLogout,
}) => {
  useEffect(() => {
    onLoad();
  }, [onLoad]);

  const currentBookings = bookings.filter((booking) => isCurrentBooking(booking));
  const previousBookings = bookings.filter((booking) => !isCurrentBooking(booking));

  const renderBookingItem = (booking: Booking) => {
    const segment = booking.flights[0]?.flight.segments[0];

    return (
      <Card key={booking.id} className="booking-item">
        <div className="booking-item-top">
          <div>
            <h3>{booking.bookingReference}</h3>
            <p>ID: {booking.id}</p>
          </div>
          <span className={`booking-status ${booking.status}`}>
            {booking.status.toUpperCase()}
          </span>
        </div>

        {segment && (
          <div className="booking-route">
            <strong>
              {segment.departureAirport.code} -&gt; {segment.arrivalAirport.code}
            </strong>
            <p>
              {new Date(segment.departureTime).toLocaleString('en-IN')} -{' '}
              {new Date(segment.arrivalTime).toLocaleString('en-IN')}
            </p>
          </div>
        )}

        <div className="booking-item-bottom">
          <p>
            Travelers: {booking.passengers.length} | Amount: INR{' '}
            {Math.round(booking.pricing.totalPrice).toLocaleString('en-IN')}
          </p>
          {booking.status !== 'cancelled' && (
            <Button variant="danger" onClick={() => onCancel(booking.id)}>
              Cancel Booking
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="bookings-page">
      <Header
        user={
          userName
            ? {
                id: 'inline-user',
                firstName: userName,
                lastName: '',
                email: `${userName.toLowerCase()}@voyagevibes.com`,
                createdAt: new Date(),
              }
            : undefined
        }
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <main className="bookings-main">
        <div className="bookings-head">
          <h1>My Bookings</h1>
          <Button variant="outline" onClick={() => onNavigate('/')}>
            New Booking
          </Button>
        </div>

        {error && <ErrorMessage message={error} />}

        {isLoading && <Loading message="Loading your bookings..." />}

        {!isLoading && bookings.length === 0 && (
          <EmptyState
            icon="Flights"
            title="No bookings yet"
            description="Start a flight search and create your first itinerary."
            action={{
              label: 'Search Flights',
              onClick: () => onNavigate('/'),
            }}
          />
        )}

        {!isLoading && bookings.length > 0 && (
          <>
            <section className="bookings-section">
              <h2>Current and Upcoming</h2>
              {currentBookings.length === 0 ? (
                <Card className="bookings-empty-card">
                  <p>No active bookings right now.</p>
                </Card>
              ) : (
                <div className="bookings-list">{currentBookings.map(renderBookingItem)}</div>
              )}
            </section>

            <section className="bookings-section">
              <h2>Previous</h2>
              {previousBookings.length === 0 ? (
                <Card className="bookings-empty-card">
                  <p>No previous bookings yet.</p>
                </Card>
              ) : (
                <div className="bookings-list">{previousBookings.map(renderBookingItem)}</div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BookingsPage;
