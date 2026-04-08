import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import type {
  Airport,
  Booking,
  Flight,
  FlightSearchRequest,
  FlightWithPrice,
  InventoryHoldResponse,
  PassengerInfo,
  PaymentMethod,
  PricingQuoteResponse,
  User,
} from '../types';
import { useAuth, useFlightSearch } from '../hooks';
import {
  bookingService,
  flightService,
  gatewayService,
  paymentService,
  userService,
} from '../services';
import type { GatewayProbeResult } from '../services/gatewayService';
import { AppHeader } from '../components/layout/AppHeader';
import { SearchForm } from '../components/search/SearchForm';
import { FlightResultCard } from '../components/results/FlightResultCard';
import { SeatSelector } from '../components/seats/SeatSelector';
import { CheckoutPanel } from '../components/checkout/CheckoutPanel';
import { BoardingPassCard } from '../components/ticket/BoardingPassCard';
import {
  Button,
  Card,
  EmptyState,
  SectionEyebrow,
  SkeletonBlock,
  StatusBadge,
  Stepper,
} from '../components/ui';
import {
  CalendarIcon,
  CreditCardIcon,
  MoonIcon,
  PassengerIcon,
  PlaneIcon,
  SparklesIcon,
  SunIcon,
  TicketIcon,
} from '../components/icons';
import {
  buildPassengerShells,
  formatCurrency,
  formatDate,
  formatDuration,
  formatTime,
  getStopLabel,
  getTotalPassengers,
  initials,
} from '../lib/formatters';

type Screen = 'onboarding' | 'home' | 'results' | 'details' | 'seats' | 'checkout' | 'ticket';
type Theme = 'light' | 'dark';

interface ConfirmationState {
  booking: Booking;
  paymentId: string;
}

const normalizeAirportCode = (value: string) => value.split('-')[0].trim().toUpperCase();

const createInitialSearch = (): FlightSearchRequest => {
  const now = new Date();
  const departure = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
  const returnDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);

  return {
    fromCode: 'BOM',
    toCode: 'DEL',
    departureDate: departure.toISOString().slice(0, 10),
    returnDate: returnDate.toISOString().slice(0, 10),
    passengers: {
      adults: 1,
      children: 0,
      infants: 0,
    },
    tripType: 'one-way',
    classOfTravel: 'economy',
  };
};

const loadRazorpayCheckout = async () => {
  type RazorpayConstructor = new (options: Record<string, unknown>) => {
    open: () => void;
    on?: (event: string, handler: () => void) => void;
  };

  const win = window as Window & { Razorpay?: RazorpayConstructor };
  if (win.Razorpay) {
    return win.Razorpay;
  }

  return new Promise<RazorpayConstructor | undefined>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve((window as typeof win).Razorpay);
    script.onerror = () => resolve(undefined);
    document.body.appendChild(script);
  });
};

const launchRazorpayCheckout = async (params: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  bookingId: string;
  paymentMethodType: PaymentMethod['type'];
  name?: string;
  email?: string;
  contact?: string;
}) => {
  const Razorpay = await loadRazorpayCheckout();
  if (!Razorpay) {
    return null;
  }

  const mapMethod = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'net-banking':
        return 'netbanking';
      case 'wallet':
        return 'wallet';
      case 'upi':
        return 'upi';
      default:
        return 'card';
    }
  };

  return new Promise<{ paymentId: string; orderId: string; signature?: string } | null>((resolve) => {
    let settled = false;
    const settle = (value: { paymentId: string; orderId: string; signature?: string } | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const checkout = new Razorpay({
      key: params.keyId,
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      name: 'VoyageVibes',
      description: `Booking ${params.bookingId}`,
      order_id: params.orderId,
      prefill: {
        name: params.name,
        email: params.email,
        contact: params.contact,
        method: mapMethod(params.paymentMethodType),
      },
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature?: string;
      }) => settle({
        paymentId: response.razorpay_payment_id,
        orderId: response.razorpay_order_id,
        signature: response.razorpay_signature,
      }),
      modal: { ondismiss: () => settle(null) },
      theme: { color: '#2563eb' },
    });

    checkout.on?.('payment.failed', () => settle(null));
    checkout.open();
  });
};

const getFlowStep = (screen: Screen) => {
  switch (screen) {
    case 'results':
      return 1;
    case 'details':
      return 2;
    case 'seats':
      return 3;
    case 'checkout':
      return 4;
    case 'ticket':
      return 5;
    default:
      return 0;
  }
};

const getTripPrice = (
  selectedFlight: FlightWithPrice | null,
  quote: PricingQuoteResponse | null,
  criteria: FlightSearchRequest
) => {
  if (!selectedFlight) {
    return 0;
  }

  if (quote?.pricing.totalPrice) {
    return quote.pricing.totalPrice;
  }

  return selectedFlight.pricing.totalPrice * getTotalPassengers(criteria.passengers);
};

export function AppShell() {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    startGoogleLogin,
    completeGoogleLogin,
    logout,
    setUser,
  } = useAuth();
  const {
    flights,
    filters,
    appliedFilters,
    isLoading: searchLoading,
    error: searchError,
    totalResults,
    searchFlights,
    applyFilters,
    sortFlights,
  } = useFlightSearch();

  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem('vv-theme');
    return stored === 'dark' ? 'dark' : 'light';
  });
  const [screen, setScreen] = useState<Screen>(() => (
    window.localStorage.getItem('vv-onboarding-complete') === 'true' ? 'home' : 'onboarding'
  ));
  const [searchDraft, setSearchDraft] = useState<FlightSearchRequest>(createInitialSearch);
  const [searchCriteria, setSearchCriteria] = useState<FlightSearchRequest>(createInitialSearch);
  const [selectedFlight, setSelectedFlight] = useState<FlightWithPrice | null>(null);
  const [flightDetails, setFlightDetails] = useState<Flight | null>(null);
  const [pricingQuote, setPricingQuote] = useState<PricingQuoteResponse | null>(null);
  const [inventoryHold, setInventoryHold] = useState<InventoryHoldResponse | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [airportError, setAirportError] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<GatewayProbeResult[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiCheckedAt, setApiCheckedAt] = useState<Date | null>(null);
  const [seatHolding, setSeatHolding] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const deferredFlights = useDeferredValue(flights);
  const effectiveUser = profile ?? user;
  const travellerCount = getTotalPassengers(searchCriteria.passengers);
  const tripPrice = getTripPrice(selectedFlight, pricingQuote, searchCriteria);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('vv-theme', theme);
  }, [theme]);

  useEffect(() => {
    const loadAirports = async () => {
      const response = await flightService.getAirportOptions();
      if (!response.success || !response.data) {
        setAirportError(response.error?.message || 'Airport suggestions are unavailable right now.');
        return;
      }
      setAirports(response.data);
    };

    void loadAirports();
  }, []);

  useEffect(() => {
    const runDiagnostics = async () => {
      setApiLoading(true);
      const results = await gatewayService.probeCustomerApis();
      setApiStatus(results);
      setApiCheckedAt(new Date());
      setApiLoading(false);
    };

    void runDiagnostics();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
      const response = await userService.getMe();
      if (!response.success || !response.data) {
        setProfileError(response.error?.message || 'Profile sync is unavailable right now.');
        return;
      }
      setProfile(response.data);
      setProfileError(null);
    };

    void loadProfile();
  }, [isAuthenticated]);

  useEffect(() => {
    if (window.location.pathname !== '/auth/google/callback') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    window.history.replaceState({}, '', '/');

    if (!code || !state) {
      startTransition(() => setScreen('home'));
      return;
    }

    const finishLogin = async () => {
      const success = await completeGoogleLogin(code, state);
      startTransition(() => {
        setScreen(success ? 'checkout' : 'home');
      });
    };

    void finishLogin();
  }, [completeGoogleLogin]);

  useEffect(() => {
    if (screen !== 'results') {
      return;
    }

    void searchFlights(searchCriteria);
  }, [screen, searchCriteria, searchFlights]);

  const navigate = (nextScreen: Screen) => {
    startTransition(() => setScreen(nextScreen));
  };

  const submitSearch = (criteria: FlightSearchRequest) => {
    const normalized = {
      ...criteria,
      fromCode: normalizeAirportCode(criteria.fromCode),
      toCode: normalizeAirportCode(criteria.toCode),
    };
    setSearchDraft(normalized);
    setSearchCriteria(normalized);
    setSelectedFlight(null);
    setFlightDetails(null);
    setPricingQuote(null);
    setSelectedSeats([]);
    setInventoryHold(null);
    setDetailError(null);
    navigate('results');
  };

  const refreshDiagnostics = async () => {
    setApiLoading(true);
    const results = await gatewayService.probeCustomerApis();
    setApiStatus(results);
    setApiCheckedAt(new Date());
    setApiLoading(false);
  };

  const selectFlight = async (flight: FlightWithPrice) => {
    setSelectedFlight(flight);
    setFlightDetails(flight.flight);
    setPricingQuote(null);
    setSelectedSeats([]);
    setInventoryHold(null);
    setDetailError(null);
    setCheckoutError(null);
    navigate('details');
    setDetailLoading(true);

    const passengers = buildPassengerShells(searchCriteria, effectiveUser);
    const [detailsResponse, availabilityResponse, quoteResponse] = await Promise.all([
      flightService.getFlightDetails(flight.flight.id),
      flightService.getFlightAvailability(flight.flight.id),
      flightService.getPricingQuote({
        flightId: flight.flight.id,
        passengers,
        classOfTravel: searchCriteria.classOfTravel,
      }),
    ]);

    if (!detailsResponse.success || !detailsResponse.data) {
      setDetailError(detailsResponse.error?.message || 'We could not load the full itinerary.');
    } else {
      setFlightDetails(detailsResponse.data);
    }

    if (availabilityResponse.success && availabilityResponse.data) {
      const availability = availabilityResponse.data;
      setSelectedFlight((current) => (
        current
          ? {
              ...current,
              availability,
            }
          : current
      ));
    }

    if (quoteResponse.success && quoteResponse.data) {
      const quote = quoteResponse.data;
      setPricingQuote(quote);
      setSelectedFlight((current) => (
        current
          ? {
              ...current,
              pricing: quote.pricing,
            }
          : current
      ));
    }

    setDetailLoading(false);
  };

  const holdSeatsAndContinue = async () => {
    if (!selectedFlight) {
      return;
    }

    setSeatHolding(true);
    setCheckoutError(null);
    const response = await flightService.holdInventory({
      flightId: selectedFlight.flight.id,
      seatCount: travellerCount,
    });
    setSeatHolding(false);

    if (!response.success || !response.data) {
      setCheckoutError(response.error?.message || 'We could not lock your seats. Please try again.');
      return;
    }

    setInventoryHold(response.data);
    navigate('checkout');
  };

  const handleCheckout = async (payload: {
    passengers: PassengerInfo[];
    contactEmail: string;
    contactPhone: string;
    paymentMethod: PaymentMethod;
    specialRequests?: string;
  }) => {
    if (!selectedFlight) {
      setCheckoutError('Choose a flight before checking out.');
      return;
    }

    setCheckoutSubmitting(true);
    setCheckoutError(null);
    let activeHold = inventoryHold;
    let shouldReleaseHold = false;

    try {
      if (!activeHold) {
        const holdResponse = await flightService.holdInventory({
          flightId: selectedFlight.flight.id,
          seatCount: travellerCount,
        });

        if (!holdResponse.success || !holdResponse.data) {
          setCheckoutError(holdResponse.error?.message || 'Seat hold failed.');
          return;
        }

        activeHold = holdResponse.data;
        setInventoryHold(activeHold);
      }

      shouldReleaseHold = true;

      if (isAuthenticated) {
        const profileResponse = await userService.patchMe({
          firstName: payload.passengers[0]?.firstName || effectiveUser?.firstName,
          lastName: payload.passengers[0]?.lastName || effectiveUser?.lastName,
          email: payload.contactEmail,
          phone: payload.contactPhone,
        });

        if (profileResponse.success && profileResponse.data) {
          setProfile(profileResponse.data);
          setUser(profileResponse.data);
          window.localStorage.setItem('user', JSON.stringify(profileResponse.data));
        }
      }

      const bookingResponse = await bookingService.reserve({
        flightIds: [selectedFlight.flight.id],
        passengers: payload.passengers,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        specialRequests: payload.specialRequests,
      });

      if (!bookingResponse.success || !bookingResponse.data) {
        setCheckoutError(bookingResponse.error?.message || 'Booking reservation failed.');
        return;
      }

      const amount = tripPrice || selectedFlight.pricing.totalPrice;
      const paymentIntentResponse = await paymentService.createPaymentIntent({
        bookingId: bookingResponse.data.id,
        amount,
        currency: selectedFlight.pricing.currency || 'INR',
        paymentMethod: payload.paymentMethod,
      });

      if (!paymentIntentResponse.success || !paymentIntentResponse.data) {
        setCheckoutError(paymentIntentResponse.error?.message || 'Payment initialization failed.');
        return;
      }

      let providerPaymentId = paymentIntentResponse.data.providerPaymentId;
      let providerOrderId = paymentIntentResponse.data.providerOrderId;

      if (
        (paymentIntentResponse.data.provider || '').toLowerCase() === 'razorpay' &&
        paymentIntentResponse.data.providerOrderId &&
        paymentIntentResponse.data.providerPublicKey
      ) {
        const razorpayResult = await launchRazorpayCheckout({
          keyId: paymentIntentResponse.data.providerPublicKey,
          orderId: paymentIntentResponse.data.providerOrderId,
          amount,
          currency: selectedFlight.pricing.currency || 'INR',
          bookingId: bookingResponse.data.id,
          paymentMethodType: payload.paymentMethod.type,
          name: `${payload.passengers[0]?.firstName || ''} ${payload.passengers[0]?.lastName || ''}`.trim(),
          email: payload.contactEmail,
          contact: payload.contactPhone,
        });

        if (!razorpayResult) {
          setCheckoutError('Razorpay checkout was cancelled.');
          return;
        }

        providerPaymentId = razorpayResult.paymentId;
        providerOrderId = razorpayResult.orderId;
      }

      const authorizeResponse = await paymentService.authorizePayment({
        paymentId: paymentIntentResponse.data.id,
        providerPaymentId,
        providerOrderId,
        amount,
      });

      if (!authorizeResponse.success || !authorizeResponse.data) {
        setCheckoutError(authorizeResponse.error?.message || 'Payment authorization failed.');
        return;
      }

      const captureResponse = await paymentService.capturePayment({
        paymentId: authorizeResponse.data.id,
        providerPaymentId,
        providerOrderId,
        amount,
      });

      if (!captureResponse.success || !captureResponse.data) {
        setCheckoutError(captureResponse.error?.message || 'Payment capture failed.');
        return;
      }

      const confirmResponse = await bookingService.confirmBooking({
        bookingId: bookingResponse.data.id,
        paymentId: captureResponse.data.id,
      });

      if (!confirmResponse.success || !confirmResponse.data) {
        setCheckoutError(confirmResponse.error?.message || 'Booking confirmation failed.');
        return;
      }

      if (activeHold) {
        await flightService.commitInventory(activeHold.holdId);
      }

      shouldReleaseHold = false;
      setConfirmation({
        booking: confirmResponse.data,
        paymentId: captureResponse.data.id,
      });
      navigate('ticket');
    } finally {
      if (shouldReleaseHold && activeHold) {
        void flightService.releaseInventory(activeHold.holdId);
      }
      setCheckoutSubmitting(false);
    }
  };

  const renderApiPanel = () => (
    <Card className="glass-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionEyebrow>Gateway Diagnostics</SectionEyebrow>
          <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Customer APIs via Kong</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Gateway, auth, flight, booking, customer, payment, and notification routes are checked from the UI layer.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refreshDiagnostics()} disabled={apiLoading}>
          {apiLoading ? 'Checking...' : 'Refresh'}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {apiLoading && !apiStatus.length && Array.from({ length: 7 }, (_, index) => (
          <SkeletonBlock key={index} className="h-28 rounded-3xl" />
        ))}
        {!apiLoading && apiStatus.map((item) => (
          <div
            key={item.key}
            className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm transition duration-300 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
              <StatusBadge tone={item.state === 'down' ? 'danger' : item.state === 'healthy' ? 'success' : 'warning'}>
                {item.state}
              </StatusBadge>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-400">
              {item.method} {item.path}
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {apiCheckedAt ? `Last checked ${apiCheckedAt.toLocaleString('en-IN')}` : 'Checking diagnostics...'}
      </p>
    </Card>
  );

  const activeFlight = selectedFlight
    ? {
        ...selectedFlight,
        flight: flightDetails || selectedFlight.flight,
      }
    : null;

  return (
    <div className="mesh-background min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 lg:px-8">
        <AppHeader
          currentScreen={screen}
          darkMode={theme === 'dark'}
          userInitials={initials(effectiveUser)}
          userName={effectiveUser ? `${effectiveUser.firstName} ${effectiveUser.lastName}`.trim() : null}
          onHome={() => navigate('home')}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onSignIn={() => void startGoogleLogin()}
          onLogout={() => void logout()}
          themeIcon={theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          isAuthenticated={isAuthenticated}
          isBusy={authLoading}
          onViewTicket={confirmation ? () => navigate('ticket') : undefined}
        />

        <div className="mt-6">
          {screen !== 'onboarding' && (
            <Stepper
              className="mb-6"
              currentStep={getFlowStep(screen)}
              steps={['Search', 'Results', 'Details', 'Seats', 'Checkout', 'Ticket']}
            />
          )}

          {screen === 'onboarding' && (
            <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
              <Card className="glass-panel fade-up overflow-hidden p-8 sm:p-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  <SparklesIcon className="h-4 w-4" />
                  Modern flight booking
                </div>
                <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                  Book faster with a calmer, mobile-first customer journey.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  Redesigned with cleaner search, card-based fares, seat selection, sticky actions, dark mode, and live Kong API diagnostics.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button onClick={() => {
                    window.localStorage.setItem('vv-onboarding-complete', 'true');
                    navigate('home');
                  }}>
                    Start booking
                  </Button>
                  <Button variant="secondary" onClick={() => void startGoogleLogin()} disabled={authLoading}>
                    Continue with Google
                  </Button>
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {[
                    { title: 'Fewer steps', description: 'Search, compare, and book with much lower cognitive load.', icon: PlaneIcon },
                    { title: 'Built for webview', description: 'Touch-friendly controls, sticky CTAs, and compact cards.', icon: PassengerIcon },
                    { title: 'Safer checkout', description: 'Seat hold, payment flow, and ticket generation stay in one path.', icon: CreditCardIcon },
                  ].map((item) => (
                    <div key={item.title} className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                      <item.icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-6">
                <Card className="glass-panel p-6">
                  <SectionEyebrow>Why it feels better</SectionEyebrow>
                  <div className="mt-5 space-y-4">
                    {[
                      'Search inputs are larger and easier to scan on desktop and mobile.',
                      'Results use clear cards with airline, time, duration, fare, and one primary action.',
                      'Seat selection and checkout keep a persistent trip summary so users never lose context.',
                    ].map((item) => (
                      <div key={item} className="flex gap-3 rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-900/70">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                {renderApiPanel()}
              </div>
            </section>
          )}

          {screen === 'home' && (
            <div className="space-y-6">
              <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <Card className="glass-panel hero-gradient fade-up overflow-hidden p-8 sm:p-10">
                  <SectionEyebrow className="text-blue-100">Search smarter</SectionEyebrow>
                  <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Compare the best flights without the usual booking clutter.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-blue-50/90">
                    Inspired by Airbnb, Google Flights, and Skyscanner, but tuned for VoyageVibes customers and mobile web views.
                  </p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'From', value: searchDraft.fromCode, icon: PlaneIcon },
                      { label: 'Date', value: formatDate(searchDraft.departureDate), icon: CalendarIcon },
                      { label: 'Travellers', value: `${travellerCount} passengers`, icon: PassengerIcon },
                    ].map((item) => (
                      <div key={item.label} className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                        <item.icon className="h-5 w-5 text-blue-100" />
                        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-blue-100/80">{item.label}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <SearchForm
                  airports={airports}
                  errorMessage={airportError}
                  isBusy={searchLoading}
                  onChange={setSearchDraft}
                  onSubmit={submitSearch}
                  value={searchDraft}
                />
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: 'Best balance',
                    description: 'Smart cards highlight duration, fare, and seat availability at a glance.',
                  },
                  {
                    title: 'Built for touch',
                    description: 'Larger tap targets, sticky actions, and native date controls work well in mobile browsers.',
                  },
                  {
                    title: 'Operationally aware',
                    description: 'Kong route diagnostics are surfaced right in the UI so support and QA can see API readiness.',
                  },
                ].map((item) => (
                  <Card key={item.title} className="glass-panel p-5">
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                  </Card>
                ))}
              </section>

              {renderApiPanel()}
            </div>
          )}

          {screen === 'results' && (
            <div className="space-y-6">
              <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <Card className="hero-gradient p-8 text-white">
                  <SectionEyebrow className="text-blue-100">Available flights</SectionEyebrow>
                  <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
                    {searchCriteria.fromCode} to {searchCriteria.toCode}
                  </h1>
                  <p className="mt-3 text-sm text-blue-50/90">
                    {formatDate(searchCriteria.departureDate)} / {travellerCount} travellers / {searchCriteria.classOfTravel}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <StatusBadge tone="info">{totalResults} fares found</StatusBadge>
                    {filters?.priceRange.max ? (
                      <StatusBadge tone="neutral">
                        Up to {formatCurrency(filters.priceRange.max, 'INR')}
                      </StatusBadge>
                    ) : null}
                  </div>
                </Card>

                <SearchForm
                  airports={airports}
                  compact
                  errorMessage={airportError}
                  isBusy={searchLoading}
                  onChange={setSearchDraft}
                  onSubmit={submitSearch}
                  value={searchDraft}
                />
              </section>

              <Card className="glass-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionEyebrow>Refine results</SectionEyebrow>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Switch between cheapest, fastest, and best. Filters stay simple to keep decisions easy.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['price', 'Cheapest'],
                      ['duration', 'Fastest'],
                      ['departure', 'Early'],
                    ].map(([key, label]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={appliedFilters.sortBy === key ? 'primary' : 'secondary'}
                        onClick={() => sortFlights(key as 'price' | 'duration' | 'departure' | 'arrival')}
                      >
                        {label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFilters({ ...appliedFilters, maxStops: appliedFilters.maxStops === 0 ? undefined : 0 })}
                    >
                      {appliedFilters.maxStops === 0 ? 'Show all stops' : 'Non-stop only'}
                    </Button>
                  </div>
                </div>
              </Card>

              {searchLoading && (
                <div className="grid gap-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <SkeletonBlock key={index} className="h-44 rounded-[28px]" />
                  ))}
                </div>
              )}

              {!searchLoading && searchError && (
                <EmptyState
                  action={<Button onClick={() => submitSearch(searchDraft)}>Retry search</Button>}
                  description={searchError}
                  title="We could not load the latest fares"
                />
              )}

              {!searchLoading && !searchError && !deferredFlights.length && (
                <EmptyState
                  action={<Button variant="secondary" onClick={() => navigate('home')}>Adjust search</Button>}
                  description="Try different dates, destinations, or cabin class to see more options."
                  title="No flights matched this search"
                />
              )}

              {!searchLoading && !searchError && deferredFlights.length > 0 && (
                <div className="grid gap-4">
                  {deferredFlights.map((flight, index) => (
                    <FlightResultCard
                      key={flight.flight.id}
                      flight={flight}
                      index={index}
                      onPreview={() => void selectFlight(flight)}
                      onSelect={() => void selectFlight(flight)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {screen === 'details' && activeFlight && (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <Card className="glass-panel p-6 sm:p-7">
                  <SectionEyebrow>Flight details</SectionEyebrow>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">
                        {activeFlight.flight.segments[0].departureAirport.code} to {activeFlight.flight.segments[0].arrivalAirport.code}
                      </h1>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {activeFlight.flight.segments[0].airline.name} / {formatDate(activeFlight.flight.segments[0].departureTime)}
                      </p>
                    </div>
                    <StatusBadge tone="info">{activeFlight.availability.seats} seats left</StatusBadge>
                  </div>

                  {detailLoading && (
                    <div className="mt-6 grid gap-4">
                      <SkeletonBlock className="h-24 rounded-3xl" />
                      <SkeletonBlock className="h-24 rounded-3xl" />
                    </div>
                  )}

                  {!detailLoading && (
                    <div className="mt-6 space-y-4">
                      {activeFlight.flight.segments.map((segment) => (
                        <div key={segment.id} className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{segment.airline.name}</p>
                              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                                {segment.departureAirport.code} {formatTime(segment.departureTime)} to {segment.arrivalAirport.code} {formatTime(segment.arrivalTime)}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                              {formatDuration(segment.duration)} / {getStopLabel(segment.stops)}
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-950">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Aircraft</p>
                              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{segment.aircraft.model}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-950">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Departure</p>
                              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{segment.departureAirport.name}</p>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-950">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Arrival</p>
                              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{segment.arrivalAirport.name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailError && (
                    <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                      {detailError}
                    </div>
                  )}
                </Card>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                <Card className="glass-panel p-6">
                  <SectionEyebrow>Fare summary</SectionEyebrow>
                  <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
                    {formatCurrency(tripPrice, activeFlight.pricing.currency)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {travellerCount} travellers / {formatDuration(activeFlight.flight.totalDuration)} / {getStopLabel(activeFlight.flight.totalStops)}
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                      <span>Cabin</span>
                      <span className="font-medium text-slate-900 dark:text-white">{searchCriteria.classOfTravel}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                      <span>Fare family</span>
                      <span className="font-medium text-slate-900 dark:text-white">{activeFlight.pricing.fareFamily}</span>
                    </div>
                  </div>
                  <Button className="mt-6 w-full" onClick={() => navigate('seats')}>
                    Continue to seats
                  </Button>
                  <Button className="mt-3 w-full" variant="secondary" onClick={() => navigate('results')}>
                    Back to results
                  </Button>
                </Card>

                <Card className="glass-panel p-6">
                  <SectionEyebrow>Why customers choose this</SectionEyebrow>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    <p>Shorter glance time with clearer times, duration, and fare hierarchy.</p>
                    <p>Sticky next step keeps progress moving on small screens.</p>
                    <p>Seat hold happens before payment so customers do not lose chosen inventory.</p>
                  </div>
                </Card>
              </aside>

              <div className="fixed inset-x-0 bottom-4 z-20 px-4 lg:hidden">
                <div className="mx-auto max-w-xl rounded-full border border-slate-200/70 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                  <Button className="w-full" onClick={() => navigate('seats')}>
                    Continue for {formatCurrency(tripPrice, activeFlight.pricing.currency)}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {screen === 'seats' && activeFlight && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <Card className="hero-gradient p-8 text-white">
                  <SectionEyebrow className="text-blue-100">Seat selection</SectionEyebrow>
                  <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Choose seats for a smoother boarding experience.</h1>
                  <p className="mt-3 text-sm text-blue-50/90">
                    Select {travellerCount} seat{travellerCount > 1 ? 's' : ''} before moving to checkout.
                  </p>
                </Card>
                <Card className="glass-panel p-6">
                  <SectionEyebrow>Trip summary</SectionEyebrow>
                  <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
                    {activeFlight.flight.segments[0].departureAirport.code} to {activeFlight.flight.segments[0].arrivalAirport.code}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(activeFlight.flight.segments[0].departureTime)} / {formatDuration(activeFlight.flight.totalDuration)}
                  </p>
                </Card>
              </div>

              <SeatSelector
                errorMessage={checkoutError}
                flight={activeFlight}
                isBusy={seatHolding}
                onBack={() => navigate('details')}
                onContinue={() => void holdSeatsAndContinue()}
                onSelectionChange={setSelectedSeats}
                passengerCount={travellerCount}
                selectedSeats={selectedSeats}
              />
            </div>
          )}

          {screen === 'checkout' && activeFlight && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <CheckoutPanel
                  bookingError={checkoutError}
                  contactUser={effectiveUser}
                  fareTotal={tripPrice}
                  isAuthenticated={isAuthenticated}
                  isSubmitting={checkoutSubmitting}
                  onBack={() => navigate('seats')}
                  onSignIn={() => void startGoogleLogin()}
                  onSubmit={(payload) => void handleCheckout(payload)}
                  searchCriteria={searchCriteria}
                  selectedFlight={activeFlight}
                  selectedSeats={selectedSeats}
                />

                <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                  <Card className="glass-panel p-6">
                    <SectionEyebrow>Payment summary</SectionEyebrow>
                    <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
                      {formatCurrency(tripPrice, activeFlight.pricing.currency)}
                    </p>
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                        <span>Seats</span>
                        <span className="font-medium text-slate-900 dark:text-white">{selectedSeats.join(', ') || 'Auto assign'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                        <span>Hold ID</span>
                        <span className="font-medium text-slate-900 dark:text-white">{inventoryHold?.holdId || 'Pending'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                        <span>Travellers</span>
                        <span className="font-medium text-slate-900 dark:text-white">{travellerCount}</span>
                      </div>
                    </div>
                    {profileError && (
                      <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                        {profileError}
                      </div>
                    )}
                    {authError && (
                      <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                        {authError}
                      </div>
                    )}
                  </Card>
                  {renderApiPanel()}
                </div>
              </div>
            </div>
          )}

          {screen === 'ticket' && confirmation && activeFlight && (
            <div className="space-y-6">
              <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <Card className="hero-gradient p-8 text-white">
                  <SectionEyebrow className="text-blue-100">Trip confirmed</SectionEyebrow>
                  <h1 className="mt-4 text-4xl font-semibold">Your boarding pass is ready.</h1>
                  <p className="mt-3 text-sm text-blue-50/90">
                    Booking reference {confirmation.booking.bookingReference} / Payment {confirmation.paymentId}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => navigate('home')}>
                      Book another trip
                    </Button>
                    <Button variant="ghost" onClick={() => navigate('details')}>
                      Review itinerary
                    </Button>
                  </div>
                </Card>
                <Card className="glass-panel p-6">
                  <SectionEyebrow>Customer summary</SectionEyebrow>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <TicketIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Status: <span className="font-medium text-slate-900 dark:text-white">{confirmation.booking.status}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <PassengerIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Seats: <span className="font-medium text-slate-900 dark:text-white">{selectedSeats.join(', ') || 'Assigned at airport'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Departure: <span className="font-medium text-slate-900 dark:text-white">{formatDate(activeFlight.flight.segments[0].departureTime)}</span>
                      </p>
                    </div>
                  </div>
                </Card>
              </section>

              <BoardingPassCard
                booking={confirmation.booking}
                flight={activeFlight}
                paymentId={confirmation.paymentId}
                seats={selectedSeats}
                user={effectiveUser}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
