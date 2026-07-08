import { useEffect, useState } from 'react';
import { Activity, Building, CreditCard, Plane, RefreshCw, Search, Shield, Users } from 'lucide-react';

import {
  checkServiceHealth,
  lookupPaymentForOps,
  searchBookingsForSupport,
  searchFlightsForOps,
  updateFlightForOps,
} from '../services/corporateApi';

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const hasRole = (roles, allowedRoles) => allowedRoles.some((role) => roles.includes(role));

const formatDateTime = (value) => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const toFlightForm = (flight) => ({
  price: flight?.price || '',
  seatsAvailable: flight?.seatsAvailable || '',
  departureTime: flight?.departureTime?.slice(0, 16) || '',
  arrivalTime: flight?.arrivalTime?.slice(0, 16) || '',
});

const panelStyle = {
  background: 'rgba(15, 23, 42, 0.45)',
  border: '1px solid var(--surface-border)',
  borderRadius: '0.75rem',
  padding: '1.25rem',
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '1rem',
  fontSize: '1.05rem',
};

const fieldGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '1rem',
};

const StatusMessage = ({ tone = 'muted', children }) => {
  if (!children) return null;
  const color = tone === 'error' ? 'var(--error)' : tone === 'success' ? 'var(--accent)' : 'var(--text-secondary)';
  return <div style={{ color, fontSize: '0.875rem', marginTop: '0.75rem' }}>{children}</div>;
};

const RolePills = ({ roles }) => (
  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
    {roles.length > 0 ? (
      roles.map((role) => (
        <span
          key={role}
          style={{
            background: 'rgba(99, 102, 241, 0.18)',
            color: 'var(--text-primary)',
            padding: '0.3rem 0.55rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {role}
        </span>
      ))
    ) : (
      <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>corporate</span>
    )}
  </div>
);

const FlightOpsPanel = ({ user }) => {
  const [criteria, setCriteria] = useState({ from: 'DEL', to: 'BLR', date: tomorrow() });
  const [flights, setFlights] = useState([]);
  const [selectedFlightId, setSelectedFlightId] = useState('');
  const [form, setForm] = useState({ price: '', seatsAvailable: '', departureTime: '', arrivalTime: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadFlights = async (event) => {
    event?.preventDefault();
    setError('');
    setStatus('Loading route inventory...');
    try {
      const items = await searchFlightsForOps(criteria);
      setFlights(items);
      setSelectedFlightId(items[0]?.id || '');
      setForm(toFlightForm(items[0]));
      setStatus(items.length ? `${items.length} flights found` : 'No flights found');
    } catch (loadError) {
      setError(loadError.message);
      setStatus('');
    }
  };

  const updateFlight = async (event) => {
    event.preventDefault();
    if (!selectedFlightId) return;
    setError('');
    setStatus('Updating flight...');
    try {
      const updated = await updateFlightForOps({
        flightId: selectedFlightId,
        user,
        changes: {
          price: Number(form.price),
          seatsAvailable: Number(form.seatsAvailable),
          departureTime: form.departureTime ? new Date(form.departureTime).toISOString() : undefined,
          arrivalTime: form.arrivalTime ? new Date(form.arrivalTime).toISOString() : undefined,
        },
      });
      setFlights((items) => items.map((flight) => (flight.id === updated.id ? updated : flight)));
      setStatus(`Updated ${updated.flightNo}`);
    } catch (updateError) {
      setError(updateError.message);
      setStatus('');
    }
  };

  return (
    <section style={panelStyle}>
      <h3 style={sectionHeaderStyle}><Plane size={20} color="var(--primary)" /> Flight Operations</h3>
      <form onSubmit={loadFlights} style={fieldGridStyle}>
        <label className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">From</span>
          <input className="input-field" value={criteria.from} maxLength={3} onChange={(event) => setCriteria({ ...criteria, from: event.target.value.toUpperCase() })} />
        </label>
        <label className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">To</span>
          <input className="input-field" value={criteria.to} maxLength={3} onChange={(event) => setCriteria({ ...criteria, to: event.target.value.toUpperCase() })} />
        </label>
        <label className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">Date</span>
          <input className="input-field" type="date" value={criteria.date} onChange={(event) => setCriteria({ ...criteria, date: event.target.value })} />
        </label>
        <button className="btn btn-outline" style={{ alignSelf: 'end' }} type="submit"><Search size={16} /> Search</button>
      </form>

      {flights.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <label className="input-group" style={{ marginBottom: 0 }}>
            <span className="input-label">Selected Flight</span>
            <select
              className="input-field"
              value={selectedFlightId}
              onChange={(event) => {
                const nextFlightId = event.target.value;
                setSelectedFlightId(nextFlightId);
                setForm(toFlightForm(flights.find((flight) => flight.id === nextFlightId)));
              }}
            >
              {flights.map((flight) => (
                <option key={flight.id} value={flight.id}>
                  {flight.flightNo} · {flight.origin}-{flight.destination} · {formatDateTime(flight.departureTime)} · {flight.seatsAvailable} seats
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={updateFlight} style={fieldGridStyle}>
            <label className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Fare</span>
              <input className="input-field" type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            </label>
            <label className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Seats</span>
              <input className="input-field" type="number" min="0" value={form.seatsAvailable} onChange={(event) => setForm({ ...form, seatsAvailable: event.target.value })} />
            </label>
            <label className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Departure</span>
              <input className="input-field" type="datetime-local" value={form.departureTime} onChange={(event) => setForm({ ...form, departureTime: event.target.value })} />
            </label>
            <label className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Arrival</span>
              <input className="input-field" type="datetime-local" value={form.arrivalTime} onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })} />
            </label>
            <button className="btn btn-primary" style={{ alignSelf: 'end' }} type="submit"><RefreshCw size={16} /> Update</button>
          </form>
        </div>
      )}
      <StatusMessage>{status}</StatusMessage>
      <StatusMessage tone="error">{error}</StatusMessage>
    </section>
  );
};

const SupportPanel = ({ user }) => {
  const [query, setQuery] = useState({ bookingId: '', email: '' });
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const search = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('Searching bookings...');
    try {
      const result = await searchBookingsForSupport({ ...query, user });
      setBookings(result.items || []);
      setStatus(result.items?.length ? `${result.items.length} matching bookings` : 'No matching bookings');
    } catch (searchError) {
      setError(searchError.message);
      setStatus('');
    }
  };

  return (
    <section style={panelStyle}>
      <h3 style={sectionHeaderStyle}><Users size={20} color="var(--primary)" /> Support Desk</h3>
      <form onSubmit={search} style={fieldGridStyle}>
        <label className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">Booking ID</span>
          <input className="input-field" value={query.bookingId} onChange={(event) => setQuery({ ...query, bookingId: event.target.value })} />
        </label>
        <label className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">Passenger Email</span>
          <input className="input-field" type="email" value={query.email} onChange={(event) => setQuery({ ...query, email: event.target.value })} />
        </label>
        <button className="btn btn-outline" style={{ alignSelf: 'end' }} type="submit"><Search size={16} /> Lookup</button>
      </form>
      <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
        {bookings.map((booking) => (
          <div key={booking.id} style={{ ...panelStyle, padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <strong>{booking.flightNo || booking.flightId}</strong>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{booking.status}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {booking.id} · ₹{booking.amount} · {booking.passengers?.map((passenger) => passenger.email).join(', ')}
            </div>
          </div>
        ))}
      </div>
      <StatusMessage>{status}</StatusMessage>
      <StatusMessage tone="error">{error}</StatusMessage>
    </section>
  );
};

const PaymentOpsPanel = ({ user }) => {
  const [bookingId, setBookingId] = useState('');
  const [payment, setPayment] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const lookup = async (event) => {
    event.preventDefault();
    if (!bookingId.trim()) return;
    setError('');
    setStatus('Loading payment...');
    try {
      const result = await lookupPaymentForOps({ bookingId: bookingId.trim(), user });
      setPayment(result);
      setStatus(`Payment ${result.status}`);
    } catch (lookupError) {
      setPayment(null);
      setError(lookupError.message);
      setStatus('');
    }
  };

  return (
    <section style={panelStyle}>
      <h3 style={sectionHeaderStyle}><CreditCard size={20} color="var(--primary)" /> Payment Reconciliation</h3>
      <form onSubmit={lookup} style={fieldGridStyle}>
        <label className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label">Booking ID</span>
          <input className="input-field" value={bookingId} onChange={(event) => setBookingId(event.target.value)} />
        </label>
        <button className="btn btn-outline" style={{ alignSelf: 'end' }} type="submit"><Search size={16} /> Lookup</button>
      </form>
      {payment && (
        <div style={{ ...panelStyle, padding: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <strong>{payment.razorpay_order_id}</strong>
            <span style={{ color: payment.status === 'PAID' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 700 }}>{payment.status}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            ₹{payment.amount / 100} · {payment.currency} · {formatDateTime(payment.created_at)}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Events: {payment.events.length || 0}
          </div>
        </div>
      )}
      <StatusMessage>{status}</StatusMessage>
      <StatusMessage tone="error">{error}</StatusMessage>
    </section>
  );
};

const PlatformPanel = () => {
  const [services, setServices] = useState([]);

  const refresh = async () => {
    setServices(await checkServiceHealth());
  };

  useEffect(() => {
    let active = true;
    checkServiceHealth().then((items) => {
      if (active) setServices(items);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ ...sectionHeaderStyle, marginBottom: 0 }}><Activity size={20} color="var(--primary)" /> Platform Status</h3>
        <button className="btn btn-outline" style={{ padding: '0.55rem 0.8rem' }} type="button" onClick={refresh}><RefreshCw size={16} /></button>
      </div>
      <div className="dashboard-grid" style={{ marginTop: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {services.map((service) => (
          <div key={service.name} className="stat-card" style={{ borderRadius: '0.75rem', padding: '1rem' }}>
            <div className="stat-title">{service.name}</div>
            <div className="stat-value" style={{ fontSize: '1.25rem', color: service.status === 'UP' ? 'var(--accent)' : 'var(--error)' }}>{service.status}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const CorporateDashboard = ({ user }) => {
  const roles = user?.corporateRoles || [];
  const canManageFlights = hasRole(roles, ['flight-admin', 'platform-admin', 'super-admin']);
  const canSupport = hasRole(roles, ['support-desk', 'booking-ops', 'platform-admin', 'super-admin']);
  const canViewPayments = hasRole(roles, ['finance-ops', 'support-desk', 'platform-admin', 'super-admin']);
  const canViewPlatform = hasRole(roles, ['platform-admin', 'super-admin']);

  return (
    <div className="main-content" style={{ alignItems: 'flex-start' }}>
      <div className="glass-card glass-card-large" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1100px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Building size={28} color="var(--primary)" />
              Employee Workspace
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              {user?.name || 'Corporate User'} · {user?.email}
            </p>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Roles</div>
            <RolePills roles={roles} />
          </div>
        </div>

        {/* Role workbenches mirror real flight-booking teams without adding new routes for each employee type. */}
        {canManageFlights && <FlightOpsPanel user={user} />}
        {canSupport && <SupportPanel user={user} />}
        {canViewPayments && <PaymentOpsPanel user={user} />}
        {canViewPlatform && <PlatformPanel />}

        {!canManageFlights && !canSupport && !canViewPayments && !canViewPlatform && (
          <section style={{ ...panelStyle, textAlign: 'center', padding: '2rem' }}>
            <Shield size={40} color="var(--text-secondary)" style={{ marginBottom: '0.75rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Corporate access is active</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Ask an admin to assign flight-admin, support-desk, finance-ops, or platform-admin.</p>
          </section>
        )}
      </div>
    </div>
  );
};

export default CorporateDashboard;
