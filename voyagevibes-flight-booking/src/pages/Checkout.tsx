import React, { useMemo, useState } from 'react';
import type { Booking, FlightSearchRequest, FlightWithPrice, PassengerInfo, PaymentMethod } from '../types';
import { Header, Footer, Button, ErrorMessage, Card } from '../components';
import './Checkout.css';

interface CheckoutPageProps {
  userName?: string;
  criteria: FlightSearchRequest;
  selectedFlight: FlightWithPrice;
  isSubmitting: boolean;
  error: string | null;
  onBackToResults: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onConfirmBooking: (payload: {
    passengers: PassengerInfo[];
    contactEmail: string;
    contactPhone: string;
    paymentMethod: PaymentMethod;
  }) => Promise<{ booking: Booking; paymentId: string } | null>;
  onSuccess: (booking: Booking, paymentId: string) => void;
}

const titles: PassengerInfo['title'][] = ['Mr', 'Ms', 'Mrs', 'Dr'];

const buildPassengerDrafts = (criteria: FlightSearchRequest): PassengerInfo[] => {
  const list: PassengerInfo[] = [];

  Array.from({ length: criteria.passengers.adults }).forEach((_, index) => {
    list.push({
      title: 'Mr',
      firstName: `Adult${index + 1}`,
      lastName: 'Passenger',
      dateOfBirth: new Date('1990-01-01'),
      nationality: 'IN',
      email: 'traveller@voyagevibes.com',
      phone: '+910000000000',
      type: 'adult',
    });
  });

  Array.from({ length: criteria.passengers.children }).forEach((_, index) => {
    list.push({
      title: 'Ms',
      firstName: `Child${index + 1}`,
      lastName: 'Passenger',
      dateOfBirth: new Date('2015-01-01'),
      nationality: 'IN',
      email: 'traveller@voyagevibes.com',
      phone: '+910000000000',
      type: 'child',
    });
  });

  Array.from({ length: criteria.passengers.infants }).forEach((_, index) => {
    list.push({
      title: 'Ms',
      firstName: `Infant${index + 1}`,
      lastName: 'Passenger',
      dateOfBirth: new Date('2025-01-01'),
      nationality: 'IN',
      email: 'traveller@voyagevibes.com',
      phone: '+910000000000',
      type: 'infant',
    });
  });

  return list;
};

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  userName,
  criteria,
  selectedFlight,
  isSubmitting,
  error,
  onBackToResults,
  onNavigate,
  onLogout,
  onConfirmBooking,
  onSuccess,
}) => {
  const [passengers, setPassengers] = useState<PassengerInfo[]>(() => buildPassengerDrafts(criteria));
  const [contactEmail, setContactEmail] = useState(userName ? `${userName.toLowerCase()}@voyagevibes.com` : 'traveller@voyagevibes.com');
  const [contactPhone, setContactPhone] = useState('+910000000000');
  const [paymentType, setPaymentType] = useState<PaymentMethod['type']>('upi');

  const segment = selectedFlight.flight.segments[0];
  const totalPassengers = passengers.length;

  const totalPrice = useMemo(
    () => Math.max(selectedFlight.pricing.totalPrice * Math.max(totalPassengers, 1), selectedFlight.pricing.totalPrice),
    [selectedFlight, totalPassengers]
  );

  const updatePassenger = (index: number, field: keyof PassengerInfo, value: string) => {
    setPassengers((previous) =>
      previous.map((passenger, currentIndex) => {
        if (currentIndex !== index) {
          return passenger;
        }

        if (field === 'dateOfBirth') {
          return { ...passenger, dateOfBirth: new Date(value) };
        }

        return {
          ...passenger,
          [field]: value,
        };
      })
    );
  };

  const handlePayNow = async (event: React.FormEvent) => {
    event.preventDefault();

    const result = await onConfirmBooking({
      passengers,
      contactEmail,
      contactPhone,
      paymentMethod: {
        type: paymentType,
      },
    });

    if (result) {
      onSuccess(result.booking, result.paymentId);
    }
  };

  return (
    <div className="checkout-page">
      <Header
        user={
          userName
            ? {
                id: 'inline-user',
                firstName: userName,
                lastName: '',
                email: contactEmail,
                createdAt: new Date(),
              }
            : undefined
        }
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <main className="checkout-main">
        <div className="checkout-layout">
          <section className="checkout-form-section">
            <div className="checkout-heading">
              <h1>Complete Your Booking</h1>
              <p>Fill traveller details and pay securely to confirm your itinerary.</p>
            </div>

            {error && <ErrorMessage message={error} />}

            <form onSubmit={handlePayNow} className="checkout-form">
              <Card className="checkout-card">
                <h3>Passenger Details</h3>
                <div className="passenger-list">
                  {passengers.map((passenger, index) => (
                    <div className="passenger-item" key={`${passenger.type}-${index}`}>
                      <div className="passenger-item-header">
                        <strong>
                          {passenger.type.toUpperCase()} {index + 1}
                        </strong>
                      </div>

                      <div className="passenger-grid">
                        <div>
                          <label>Title</label>
                          <select
                            value={passenger.title}
                            onChange={(event) =>
                              updatePassenger(index, 'title', event.target.value)
                            }
                          >
                            {titles.map((title) => (
                              <option key={title} value={title}>
                                {title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label>First Name</label>
                          <input
                            value={passenger.firstName}
                            onChange={(event) =>
                              updatePassenger(index, 'firstName', event.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <label>Last Name</label>
                          <input
                            value={passenger.lastName}
                            onChange={(event) =>
                              updatePassenger(index, 'lastName', event.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <label>Date of Birth</label>
                          <input
                            type="date"
                            value={new Date(passenger.dateOfBirth).toISOString().slice(0, 10)}
                            onChange={(event) =>
                              updatePassenger(index, 'dateOfBirth', event.target.value)
                            }
                            required
                          />
                        </div>
                        <div>
                          <label>Email</label>
                          <input
                            type="email"
                            value={passenger.email}
                            onChange={(event) => updatePassenger(index, 'email', event.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label>Phone</label>
                          <input
                            value={passenger.phone}
                            onChange={(event) => updatePassenger(index, 'phone', event.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="checkout-card">
                <h3>Contact & Payment</h3>
                <div className="passenger-grid">
                  <div>
                    <label>Booking Contact Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>Booking Contact Phone</label>
                    <input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>Payment Method</label>
                    <select
                      value={paymentType}
                      onChange={(event) => setPaymentType(event.target.value as PaymentMethod['type'])}
                    >
                      <option value="upi">UPI</option>
                      <option value="credit-card">Credit Card</option>
                      <option value="debit-card">Debit Card</option>
                      <option value="net-banking">Net Banking</option>
                      <option value="wallet">Wallet</option>
                    </select>
                  </div>
                </div>
              </Card>

              <div className="checkout-actions">
                <Button variant="outline" type="button" onClick={onBackToResults}>
                  Back To Results
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Pay ₹{Math.round(totalPrice).toLocaleString('en-IN')} & Confirm
                </Button>
              </div>
            </form>
          </section>

          <aside className="checkout-summary">
            <Card className="checkout-card sticky-summary">
              <h3>Trip Summary</h3>
              <p>
                {segment.departureAirport.code} → {segment.arrivalAirport.code}
              </p>
              <p>
                {new Date(segment.departureTime).toLocaleString('en-IN')} to{' '}
                {new Date(segment.arrivalTime).toLocaleString('en-IN')}
              </p>
              <hr />
              <p>Travelers: {totalPassengers}</p>
              <p>Cabin: {criteria.classOfTravel}</p>
              <p className="summary-total">
                Total: ₹{Math.round(totalPrice).toLocaleString('en-IN')}
              </p>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CheckoutPage;
