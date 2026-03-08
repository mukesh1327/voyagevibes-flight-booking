/**
 * Constants Index
 */

export const PAGE_SIZE = 12;
export const SEARCH_DEBOUNCE_MS = 300;

export const TRIP_TYPES = [
  { value: 'one-way', label: 'One way' },
  { value: 'round-trip', label: 'Round trip' },
];

export const CABIN_CLASSES = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium-economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First class' },
];

export const PASSENGER_TYPES = [
  { value: 'adults', label: 'Adults' },
  { value: 'children', label: 'Children (2-11 years)' },
  { value: 'infants', label: 'Infants (< 2 years)' },
];

export const SEAT_PREFERENCES = [
  { value: 'window', label: 'Window' },
  { value: 'middle', label: 'Middle' },
  { value: 'aisle', label: 'Aisle' },
];

export const MEAL_PREFERENCES = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non-vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten Free' },
  { value: 'kosher', label: 'Kosher' },
];

export const PAYMENT_METHODS = [
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'debit-card', label: 'Debit Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'net-banking', label: 'Net Banking' },
  { value: 'wallet', label: 'Digital Wallet' },
];

export const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'AE', name: 'United Arab Emirates' },
];
