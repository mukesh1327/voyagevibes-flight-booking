import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plane, Users, XCircle } from 'lucide-react';
import { cancelBooking, listBookings } from '../services/bookingApi';

const STATUS_STYLE = {
  CONFIRMED: { color: 'var(--accent)', label: 'Confirmed' },
  PAYMENT_PENDING: { color: '#f59e0b', label: 'Payment pending' },
  FAILED: { color: 'var(--error)', label: 'Failed' },
  CANCELLED: { color: 'var(--text-secondary)', label: 'Cancelled' },
};

const CANCELLABLE_STATUSES = new Set(['PAYMENT_PENDING', 'CONFIRMED']);

const formatDate = (value) => new Date(value).toLocaleString([], {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const MyTrips = ({ user }) => {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    listBookings({ user })
      .then((data) => {
        if (!cancelled) {
          setBookings(data.items || []);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleCancel = async (booking) => {
    const isPaid = booking.status === 'CONFIRMED';
    const confirmed = window.confirm(
      isPaid
        ? 'Cancel this booking? A refund will be requested for your payment.'
        : 'Cancel this booking?',
    );
    if (!confirmed) {
      return;
    }

    setError('');
    setCancellingId(booking.id);
    try {
      const updated = await cancelBooking({ bookingId: booking.id, user });
      setBookings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="main-content">
      <div className="glass-card glass-card-large" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <Link
            to="/booking"
            className="btn btn-outline"
            style={{ position: 'absolute', left: 0, top: 0, padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <ArrowLeft size={16} /> Book a flight
          </Link>
          <h2>My Trips</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Every booking you've made, most recent first.</p>
        </div>

        {error && <div style={{ color: 'var(--error)', textAlign: 'center' }}>{error}</div>}

        {bookings === null && !error && (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading your trips...</div>
        )}

        {bookings?.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
            No bookings yet.{' '}
            <Link to="/booking" style={{ color: 'var(--primary)' }}>Search a flight</Link> to make your first one.
          </div>
        )}

        {bookings && bookings.length > 0 && (
          <div className="dashboard-grid" style={{ marginTop: 0 }}>
            {bookings.map((booking) => {
              const status = STATUS_STYLE[booking.status] || { color: 'var(--text-secondary)', label: booking.status };
              return (
                <div key={booking.id} className="stat-card" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{booking.flightNo || booking.flightId}</div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
                        {formatDate(booking.createdAt)}
                      </div>
                    </div>
                    <Plane size={22} color="var(--primary)" />
                  </div>

                  <div
                    style={{
                      marginTop: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: status.color,
                      border: `1px solid ${status.color}`,
                      borderRadius: '999px',
                      padding: '0.25rem 0.7rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {status.label}
                  </div>

                  <div style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <Users size={14} /> {booking.passengers?.length || booking.seatsHeld} passenger{(booking.passengers?.length || booking.seatsHeld) === 1 ? '' : 's'}
                  </div>

                  <div className="stat-value" style={{ marginTop: '0.5rem', fontSize: '1.4rem' }}>₹{booking.amount}</div>

                  {CANCELLABLE_STATUSES.has(booking.status) && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
                      onClick={() => handleCancel(booking)}
                      disabled={cancellingId === booking.id}
                    >
                      <XCircle size={16} /> {cancellingId === booking.id ? 'Cancelling...' : 'Cancel booking'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTrips;
