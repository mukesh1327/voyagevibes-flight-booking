import { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, CreditCard, MapPin, Plane, Search } from 'lucide-react';
import {
  createBooking,
  createPaymentOrder,
  getBooking,
  markBookingConfirmed,
  searchFlights,
  sendConfirmation,
  verifyPayment,
} from '../services/bookingApi';

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const isAirportCode = (value) => /^[A-Z]{3}$/.test(value.trim().toUpperCase());
const isPassengerValid = (passenger) => (
  passenger.name.trim().length >= 2 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email.trim()) &&
  Number.isInteger(Number(passenger.age)) &&
  Number(passenger.age) >= 1 &&
  Number(passenger.age) <= 120
);

const Booking = ({ user }) => {
  const [search, setSearch] = useState({ from: 'DEL', to: 'BOM', date: tomorrow() });
  const [passenger, setPassenger] = useState({
    name: user?.name || '',
    email: user?.email || '',
    age: 30,
  });
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const canBook = useMemo(() => Boolean(selectedFlight) && isPassengerValid(passenger), [selectedFlight, passenger]);

  const handleSearch = async () => {
    if (!isAirportCode(search.from) || !isAirportCode(search.to)) {
      setMessage('Enter valid 3-letter airport codes, for example DEL to BOM.');
      return;
    }

    setLoading(true);
    setMessage('');
    setConfirmation(null);
    setCheckout(null);
    setProgress([]);

    try {
      const results = await searchFlights({
        ...search,
        from: search.from.trim().toUpperCase(),
        to: search.to.trim().toUpperCase(),
      });
      setFlights(results);
      setSelectedFlight(results[0] || null);
      if (results.length === 0) {
        setMessage('No flights found for this route and date.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!canBook) {
      setMessage('Select a flight and enter passenger details first.');
      return;
    }

    setLoading(true);
    setMessage('');
    setProgress(['Holding seat inventory']);

    try {
      // Browser calls stay on the gateway path; each backend owns one step of the booking workflow.
      const booking = await createBooking({ flight: selectedFlight, passenger, user });
      setProgress((steps) => [...steps, 'Creating payment order']);
      const order = await createPaymentOrder({ booking });
      setCheckout({ booking, order });
      setMessage('Seat held. Continue to payment.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!checkout) {
      setMessage('Create a booking before payment.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      setProgress((steps) => [...steps, 'Verifying payment']);
      const paymentResult = await collectPaymentResult({ order: checkout.order, booking: checkout.booking, passenger });
      const payment = await verifyPayment({ booking: checkout.booking, order: checkout.order, paymentResult });
      setProgress((steps) => [...steps, 'Confirming booking']);
      const confirmedBooking = await markBookingConfirmed({ booking: checkout.booking, payment, user });
      const latestBooking = await getBooking({ booking: confirmedBooking, user });
      setProgress((steps) => [...steps, 'Sending confirmation']);
      const notification = await sendConfirmation({ booking: confirmedBooking, passenger });

      setConfirmation({ booking: latestBooking, payment, notification });
      setCheckout(null);
      setMessage('Booking confirmed. Confirmation has been sent.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div className="glass-card glass-card-large" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Flight Search & Booking</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {user?.name || 'Traveler'}! Search, book, and confirm in one simple flow.</p>
        </div>

        <section style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 160px', marginBottom: 0 }}>
              <label className="input-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                From
              </label>
              <input value={search.from} onChange={(event) => setSearch({ ...search, from: event.target.value.toUpperCase() })} type="text" className="input-field" />
            </div>
            <div className="input-group" style={{ flex: '1 1 160px', marginBottom: 0 }}>
              <label className="input-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                To
              </label>
              <input value={search.to} onChange={(event) => setSearch({ ...search, to: event.target.value.toUpperCase() })} type="text" className="input-field" />
            </div>
            <div className="input-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
              <label className="input-label">
                <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Departure Date
              </label>
              <input value={search.date} onChange={(event) => setSearch({ ...search, date: event.target.value })} type="date" className="input-field" />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSearch} disabled={loading}>
            <Search size={18} /> {loading ? 'Working...' : 'Search Flights'}
          </button>
        </section>

        {flights.length > 0 && (
          <section>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Available Flights</h3>
            <div className="dashboard-grid" style={{ marginTop: 0 }}>
              {flights.map((flight) => (
                <button
                  key={flight.id}
                  className="stat-card"
                  onClick={() => setSelectedFlight(flight)}
                  style={{
                    textAlign: 'left',
                    borderColor: selectedFlight?.id === flight.id ? 'var(--primary)' : 'var(--surface-border)',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{flight.flightNo}</div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>{flight.origin} to {flight.destination}</div>
                    </div>
                    <Plane size={24} color="var(--primary)" />
                  </div>
                  <div style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                    {new Date(flight.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} departure
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                    {flight.seatsAvailable} seats left
                  </div>
                  <div className="stat-value" style={{ marginTop: '0.5rem', fontSize: '1.5rem' }}>₹{flight.price}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedFlight && (
          <section style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={20} color="var(--primary)" /> Passenger & Payment
            </h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input className="input-field" style={{ flex: '1 1 220px' }} value={passenger.name} onChange={(event) => setPassenger({ ...passenger, name: event.target.value })} placeholder="Passenger name" />
              <input className="input-field" style={{ flex: '1 1 220px' }} value={passenger.email} onChange={(event) => setPassenger({ ...passenger, email: event.target.value })} placeholder="Email" />
              <input className="input-field" style={{ flex: '1 1 100px' }} value={passenger.age} onChange={(event) => setPassenger({ ...passenger, age: Number(event.target.value) })} type="number" min="1" placeholder="Age" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handleCheckout} disabled={loading || Boolean(checkout)}>
              <CheckCircle2 size={18} /> Hold Seat & Checkout
            </button>
            {progress.length > 0 && (
              <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {progress.map((step) => (
                  <span key={step} style={{ border: '1px solid var(--surface-border)', borderRadius: '999px', padding: '0.35rem 0.75rem' }}>{step}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {checkout && !confirmation && (
          <section style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={20} color="var(--primary)" /> Payment
            </h3>
            <div style={{ color: 'var(--text-secondary)' }}>
              Booking {checkout.booking.id} · Order {checkout.order.razorpay_order_id}
            </div>
            <div className="stat-value" style={{ marginTop: '0.5rem', fontSize: '1.5rem' }}>₹{checkout.booking.amount}</div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handlePayment} disabled={loading}>
              <CreditCard size={18} /> {checkout.order.key_id ? 'Pay with Razorpay' : 'Complete Mock Payment'}
            </button>
          </section>
        )}

        {message && (
          <div style={{ color: confirmation ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'center' }}>
            {message}
          </div>
        )}

        {confirmation && (
          <section className="stat-card" style={{ borderColor: 'var(--accent)' }}>
            <div className="stat-title">Confirmed Booking</div>
            <div style={{ fontWeight: 700 }}>{confirmation.booking.id}</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Flight: {confirmation.booking.flightNo} · Hold: {confirmation.booking.holdId}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Payment: {confirmation.payment.status} · Notification: {confirmation.notification.status} via {confirmation.notification.channel}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Booking;

const collectPaymentResult = ({ order, booking, passenger }) => {
  if (!order.key_id) {
    return Promise.resolve({
      razorpay_payment_id: `pay_mock_${booking.id}`,
      razorpay_signature: 'mock_signature',
    });
  }

  return loadRazorpayScript().then(() => new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'VoyageVibes',
      description: `Flight booking ${booking.flightNo || booking.id}`,
      order_id: order.razorpay_order_id,
      prefill: {
        name: passenger.name,
        email: passenger.email,
      },
      handler: resolve,
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled')),
      },
    });
    checkout.open();
  }));
};

const loadRazorpayScript = () => {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout'));
    document.body.appendChild(script);
  });
};
