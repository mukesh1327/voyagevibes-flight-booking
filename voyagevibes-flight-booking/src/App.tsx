import { useEffect, useMemo, useState } from 'react';
import type { Booking, FlightSearchRequest, FlightWithPrice, PassengerInfo, PaymentMethod, User } from './types';
import { useAuth, useBooking } from './hooks';
import { bookingService, paymentService, userService } from './services';
import {
  HomePage,
  SearchResultsPage,
  AuthPage,
  CheckoutPage,
  BookingConfirmationPage,
  BookingsPage,
  ProfilePage,
} from './pages';
import './App.css';

type AppPage = 'home' | 'search-results' | 'auth' | 'checkout' | 'confirmation' | 'bookings' | 'profile';

interface ConfirmationState {
  booking: Booking;
  paymentId: string;
}

interface RazorpayPaymentSuccess {
  paymentId: string;
  orderId: string;
  signature?: string;
}

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature?: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on?: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;

type WindowWithRazorpay = Window & {
  Razorpay?: RazorpayConstructor;
};

const loadRazorpayCheckout = async (): Promise<boolean> => {
  const w = window as WindowWithRazorpay;
  if (w.Razorpay) {
    return true;
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const launchRazorpayCheckout = async (params: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  bookingId: string;
  name?: string;
  email?: string;
  contact?: string;
}): Promise<RazorpayPaymentSuccess | null> => {
  if (!params.keyId) {
    return null;
  }

  const loaded = await loadRazorpayCheckout();
  const w = window as WindowWithRazorpay;
  const Razorpay = w.Razorpay;
  if (!loaded || !Razorpay) {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: RazorpayPaymentSuccess | null) => {
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
      },
      notes: {
        bookingId: params.bookingId,
      },
      theme: {
        color: '#1d4ed8',
      },
      handler: (response) => {
        settle({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => settle(null),
      },
    });

    if (checkout.on) {
      checkout.on('payment.failed', () => settle(null));
    }

    checkout.open();
  });
};

function App() {
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
    userBookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    getUserBookings,
    cancelBooking,
  } = useBooking();

  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const [lastSearchCriteria, setLastSearchCriteria] = useState<FlightSearchRequest | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<FlightWithPrice | null>(null);
  const [postAuthTarget, setPostAuthTarget] = useState<AppPage>('home');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const effectiveUser = useMemo(() => profileUser || user, [profileUser, user]);

  useEffect(() => {
    if (window.location.pathname !== '/auth/google/callback') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const processedStateKey = state ? `google-auth-state:${state}` : null;

    // Clear callback URL immediately so React dev double-invocation does not
    // attempt a second token exchange with the same one-time state value.
    window.history.replaceState({}, '', '/');

    if (!code || !state) {
      setCurrentPage('auth');
      return;
    }

    if (processedStateKey && sessionStorage.getItem(processedStateKey) === 'done') {
      setCurrentPage('auth');
      return;
    }

    const finishGoogleLogin = async () => {
      if (processedStateKey) {
        sessionStorage.setItem(processedStateKey, 'done');
      }
      const success = await completeGoogleLogin(code, state);
      if (success) {
        const target = (sessionStorage.getItem('postAuthTarget') as AppPage | null) || 'home';
        sessionStorage.removeItem('postAuthTarget');
        setCurrentPage(target);
      } else {
        setCurrentPage('auth');
      }
    };

    void finishGoogleLogin();
  }, [completeGoogleLogin]);

  const ensureAuthenticated = (target: AppPage) => {
    if (isAuthenticated) {
      return true;
    }

    setPostAuthTarget(target);
    setCurrentPage('auth');
    return false;
  };

  const navigate = (path: string) => {
    if (path === '/') {
      setCurrentPage('home');
      return;
    }

    if (path === '/bookings') {
      if (ensureAuthenticated('bookings')) {
        setCurrentPage('bookings');
      }
      return;
    }

    if (path === '/profile') {
      if (ensureAuthenticated('profile')) {
        setCurrentPage('profile');
      }
      return;
    }

    if (path === '/search-results' && lastSearchCriteria) {
      setCurrentPage('search-results');
      return;
    }

    setCurrentPage('home');
  };

  const handleSearch = (criteria: FlightSearchRequest) => {
    setLastSearchCriteria(criteria);
    setSelectedFlight(null);
    setCurrentPage('search-results');
  };

  const handleSelectFlight = (flight: FlightWithPrice) => {
    setSelectedFlight(flight);

    if (!ensureAuthenticated('checkout')) {
      return;
    }

    setCurrentPage('checkout');
  };

  const handleConfirmBooking = async (payload: {
    passengers: PassengerInfo[];
    contactEmail: string;
    contactPhone: string;
    paymentMethod: PaymentMethod;
  }): Promise<{ booking: Booking; paymentId: string } | null> => {
    if (!selectedFlight) {
      setCheckoutError('No flight selected for checkout.');
      return null;
    }

    setCheckoutSubmitting(true);
    setCheckoutError(null);

    try {
      const reserved = await bookingService.reserve({
        flightIds: [selectedFlight.flight.id],
        passengers: payload.passengers,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
      });

      if (!reserved.success || !reserved.data) {
        setCheckoutError(reserved.error?.message || 'Unable to reserve booking.');
        return null;
      }

      const intent = await paymentService.createPaymentIntent({
        bookingId: reserved.data.id,
        amount: reserved.data.pricing.totalPrice,
        currency: reserved.data.pricing.currency,
        paymentMethod: payload.paymentMethod,
      });

      if (!intent.success || !intent.data) {
        setCheckoutError(intent.error?.message || 'Unable to create payment intent.');
        return null;
      }

      const provider = (intent.data.provider || 'mock').toLowerCase();
      let providerPaymentId = intent.data.providerPaymentId;
      let providerOrderId = intent.data.providerOrderId;
      let razorpaySignature: string | undefined;

      if (provider === 'razorpay') {
        if (!providerOrderId) {
          setCheckoutError('Razorpay order id missing from payment intent.');
          return null;
        }

        if (!intent.data.providerPublicKey) {
          setCheckoutError('Razorpay public key is missing from payment intent.');
          return null;
        }

        const razorpayResult = await launchRazorpayCheckout({
          keyId: intent.data.providerPublicKey,
          orderId: providerOrderId,
          amount: reserved.data.pricing.totalPrice,
          currency: reserved.data.pricing.currency,
          bookingId: reserved.data.id,
          name: `${effectiveUser?.firstName || ''} ${effectiveUser?.lastName || ''}`.trim(),
          email: payload.contactEmail,
          contact: payload.contactPhone,
        });

        if (!razorpayResult) {
          setCheckoutError('Razorpay payment was not completed.');
          return null;
        }

        providerPaymentId = razorpayResult.paymentId;
        providerOrderId = razorpayResult.orderId || providerOrderId;
        razorpaySignature = razorpayResult.signature;
      }

      const authorized = await paymentService.authorizePayment({
        paymentId: intent.data.id,
        providerPaymentId,
        providerOrderId,
        amount: reserved.data.pricing.totalPrice,
        metadata:
          provider === 'razorpay'
            ? {
                source: 'checkout-ui',
                razorpaySignature,
              }
            : undefined,
      });

      if (!authorized.success || !authorized.data) {
        setCheckoutError(authorized.error?.message || 'Payment authorization failed.');
        return null;
      }

      const captured = await paymentService.capturePayment({
        paymentId: authorized.data.id,
        providerPaymentId,
        providerOrderId,
        amount: reserved.data.pricing.totalPrice,
        metadata: provider === 'razorpay' ? { source: 'checkout-ui' } : undefined,
      });

      if (!captured.success || !captured.data) {
        setCheckoutError(captured.error?.message || 'Payment capture failed.');
        return null;
      }

      const confirmed = await bookingService.confirmBooking({
        bookingId: reserved.data.id,
        paymentId: captured.data.id,
      });

      if (!confirmed.success || !confirmed.data) {
        setCheckoutError(confirmed.error?.message || 'Booking confirmation failed.');
        return null;
      }

      void getUserBookings();
      return {
        booking: confirmed.data,
        paymentId: captured.data.id,
      };
    } catch (error) {
      setCheckoutError('Something went wrong while processing your booking.');
      console.error(error);
      return null;
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleCheckoutSuccess = (booking: Booking, paymentId: string) => {
    setConfirmation({ booking, paymentId });
    setCurrentPage('confirmation');
  };

  const handleLoadProfile = async (): Promise<User | null> => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const response = await userService.getMe();
      if (!response.success || !response.data) {
        setProfileError(response.error?.message || 'Unable to load profile.');
        return null;
      }

      setProfileUser(response.data);
      return response.data;
    } catch (error) {
      setProfileError('Unable to load profile.');
      console.error(error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (updates: Partial<User>): Promise<User | null> => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const response = await userService.patchMe(updates);
      if (!response.success || !response.data) {
        setProfileError(response.error?.message || 'Unable to save profile.');
        return null;
      }

      setProfileUser(response.data);
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      setProfileError('Unable to save profile.');
      console.error(error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    sessionStorage.setItem('postAuthTarget', postAuthTarget);
    await startGoogleLogin();
  };

  const handleCancelBooking = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await getUserBookings();
  };

  const handleLogout = async () => {
    await logout();
    setCurrentPage('home');
    setSelectedFlight(null);
    setConfirmation(null);
  };

  return (
    <div className="app">
      {currentPage === 'home' && (
        <HomePage
          onSearch={handleSearch}
          onCustomerLogin={() => {
            setPostAuthTarget('home');
            setCurrentPage('auth');
          }}
          onLogout={handleLogout}
          user={effectiveUser}
          onNavigate={navigate}
        />
      )}

      {currentPage === 'search-results' && lastSearchCriteria && (
        <SearchResultsPage
          initialCriteria={lastSearchCriteria}
          onSelectFlight={handleSelectFlight}
          onCustomerLogin={() => {
            setPostAuthTarget('search-results');
            setCurrentPage('auth');
          }}
          onLogout={handleLogout}
          user={effectiveUser}
          onNavigate={navigate}
        />
      )}

      {currentPage === 'auth' && (
        <AuthPage
          isGoogleLoading={authLoading}
          error={authError}
          onContinueWithGoogle={handleContinueWithGoogle}
          onBackHome={() => setCurrentPage('home')}
        />
      )}

      {currentPage === 'checkout' && selectedFlight && lastSearchCriteria && (
        <CheckoutPage
          userName={effectiveUser?.firstName}
          criteria={lastSearchCriteria}
          selectedFlight={selectedFlight}
          isSubmitting={checkoutSubmitting}
          error={checkoutError}
          onBackToResults={() => setCurrentPage('search-results')}
          onNavigate={navigate}
          onLogout={handleLogout}
          onConfirmBooking={handleConfirmBooking}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {currentPage === 'confirmation' && confirmation && (
        <BookingConfirmationPage
          booking={confirmation.booking}
          paymentId={confirmation.paymentId}
          onNavigate={navigate}
        />
      )}

      {currentPage === 'bookings' && (
        <BookingsPage
          userName={effectiveUser?.firstName}
          bookings={userBookings}
          isLoading={bookingsLoading}
          error={bookingsError}
          onNavigate={navigate}
          onLoad={getUserBookings}
          onCancel={handleCancelBooking}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'profile' && (
        <ProfilePage
          user={effectiveUser}
          isLoading={profileLoading}
          error={profileError}
          onNavigate={navigate}
          onLoadProfile={handleLoadProfile}
          onSaveProfile={handleSaveProfile}
          onLogout={handleLogout}
        />
      )}

      {effectiveUser && (
        <button className="floating-logout" onClick={handleLogout}>
          Logout
        </button>
      )}
    </div>
  );
}

export default App;
