/**
 * VoyageVibes Flight Booking Application - Structure & Development Guide
 * 
 * Overview:
 * This is a professional flight booking UI built with React, TypeScript, and Vite.
 * It follows clean code architecture principles with clear separation of concerns.
 */

import React from 'react';

export const PROJECT_STRUCTURE = `
Voyagevibes-FLIGHT-BOOKING/
├── src/
│   ├── components/
│   │   ├── common/               # Reusable UI components
│   │   │   ├── Loading.tsx       # Loading spinner component
│   │   │   ├── Loading.css
│   │   │   ├── CommonComponents.tsx  # Button, Modal, Card, Badge, etc.
│   │   │   ├── CommonComponents.css
│   │   │   └── index.ts
│   │   │
│   │   ├── flight/               # Flight-related components
│   │   │   ├── FlightCard.tsx    # Individual flight display
│   │   │   ├── FlightCard.css
│   │   │   ├── FlightSearch.tsx  # Search form component
│   │   │   ├── FlightSearch.css
│   │   │   ├── FlightFilters.tsx # Filter & sort component
│   │   │   ├── FlightFilters.css
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── Header.tsx        # Navigation header
│   │   │   ├── Header.css
│   │   │   ├── Footer.tsx        # Footer component
│   │   │   ├── Footer.css
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts             # Main components export
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useFlightSearch.ts   # Flight search logic
│   │   ├── useAuth.ts           # Authentication logic
│   │   ├── useBooking.ts        # Booking management logic
│   │   ├── useUtility.ts        # useDebounce, usePagination
│   │   └── index.ts
│   │
│   ├── services/                 # API service layer (mocked)
│   │   ├── flightService.ts     # Flight API calls
│   │   ├── authService.ts       # Auth API calls
│   │   ├── bookingService.ts    # Booking API calls
│   │   ├── paymentService.ts    # Payment API calls
│   │   ├── userService.ts       # User profile API calls
│   │   └── index.ts
│   │
│   ├── types/                    # TypeScript interfaces
│   │   └── index.ts             # All type definitions
│   │
│   ├── constants/                # Application constants & mock data
│   │   ├── airports.ts          # Mock airport data
│   │   ├── airlines.ts          # Mock airline data
│   │   ├── flights.ts           # Mock flight data
│   │   ├── users.ts             # Mock user data
│   │   └── index.ts
│   │
│   ├── pages/                    # Page components (routes)
│   │   ├── Home.tsx             # Landing page
│   │   ├── Home.css
│   │   ├── SearchResults.tsx    # Flight search results
│   │   ├── SearchResults.css
│   │   └── index.ts
│   │
│   ├── utils/                    # Utility functions (if needed)
│   │   └── (utility functions here)
│   │
│   ├── App.tsx                   # Main app component with routing
│   ├── App.css                   # Global styles
│   ├── index.css                 # Base styles
│   ├── main.tsx                  # React entry point
│   └── vite-env.d.ts             # Vite environment types
│
├── public/
│   └── (static assets)
│
├── index.html                     # HTML entry point
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite configuration
└── README.md                       # Project documentation
`;

export const ARCHITECTURE_PRINCIPLES = `
CLEAN CODE ARCHITECTURE PRINCIPLES FOLLOWED:

1. SEPARATION OF CONCERNS
   - Components: Presentational & Container logic separated
   - Services: API/business logic abstracted
   - Hooks: Reusable state management logic
   - Types: Strong TypeScript typing throughout

2. SINGLE RESPONSIBILITY
   - Each component has one primary purpose
   - Services handle one domain (flight, auth, booking, payment)
   - Hooks manage specific state concerns

3. DEPENDENCY INJECTION
   - Services passed to hooks and components
   - Components receive props for configuration
   - Loose coupling between modules

4. DRY (Don't Repeat Yourself)
   - Reusable components (Button, Card, Modal, etc.)
   - Common styling through CSS variables
   - Utility hooks for common patterns

5. TESTABILITY
   - Pure components with props
   - Isolated services with clear interfaces
   - Custom hooks with clear inputs/outputs

6. SCALABILITY
   - Easy to add new services
   - Simple to create new pages
   - Modular component structure
   - Mock data easily replaceable with real APIs
`;

export const MOCK_DATA_STRUCTURE = `
MOCK DATA ORGANIZATION:

The application uses mock data to simulate API responses:

1. AIRPORTS (constants/airports.ts)
   - 15+ popular Indian and international airports
   - Airport codes, names, cities, timezones

2. AIRLINES (constants/airlines.ts)
   - 10 popular airlines with logos
   - Airline codes and names

3. FLIGHTS (constants/flights.ts)
   - Dynamically generated flight data
   - Multiple flights per route
   - Three time slots (morning, afternoon, evening)
   - Realistic pricing and availability

4. USERS (constants/users.ts)
   - Sample user profiles
   - User preferences
   - Authentication data

All mock data can be easily replaced with real API calls
by updating the service layer files.
`;

export const API_INTEGRATION = `
API INTEGRATION GUIDE:

Current Implementation: MOCKED APIs

To integrate real APIs:

1. Update Services (src/services/):
   - Replace mock async functions with real HTTP calls
   - Use fetch or axios
   - Maintain the same service interfaces

2. No Changes Needed For:
   - Components (they use services)
   - Hooks (they use services)
   - Types (already match expected data)
   - App structure (routing stays the same)

EXAMPLE SERVICE MODIFICATION:
// Before (mocked)
async searchFlights(criteria) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, data: MOCK_FLIGHTS, ... });
    }, 800);
  });
}

// After (real API)
async searchFlights(criteria) {
  const response = await fetch('/api/v1/flights/search', {
    method: 'POST',
    body: JSON.stringify(criteria)
  });
  return response.json();
}
`;

export const COMPONENT_HIERARCHY = `
COMPONENT HIERARCHY:

App
├── HomePage
│   ├── Header
│   ├── FlightSearch
│   ├── Features Section
│   ├── Popular Routes Section
│   └── Footer
│
└── SearchResultsPage
    ├── Header
    ├── Sticky FlightSearch
    ├── Results Layout
    │   ├── Sidebar
    │   │   └── FlightFilters
    │   └── Main
    │       ├── Results Header
    │       └── FlightCard (repeated)
    ├── Loading / EmptyState / ErrorMessage
    └── Footer
`;

export const STYLING_APPROACH = `
STYLING APPROACH:

1. CSS MODULES & BEM: Each component has its own CSS file
2. CSS VARIABLES: Root variables for colors, shadows, transitions
3. RESPONSIVE DESIGN: Mobile-first approach with media queries
4. COMPONENT-SCOPED: Styles don't leak between components
5. UTILITY CLASSES: Common utilities in App.css

Color Scheme:
- Primary: #0066cc (Sky blue)
- Secondary: #667eea
- Success: #10b981 (Green)
- Warning: #f59e0b (Orange)
- Danger: #ef4444 (Red)
- Text Dark: #1f2937
- Text Light: #6b7280
- Border: #e5e7eb
- Background: #f9fafb
`;

export const GETTING_STARTED = `
GETTING STARTED:

1. INSTALL DEPENDENCIES
   npm install

2. START DEVELOPMENT SERVER
   npm run dev

3. BUILD FOR PRODUCTION
   npm run build

4. PREVIEW PRODUCTION BUILD
   npm run preview

5. TYPE CHECKING
   npm run type-check

6. LINTING
   npm run lint

7. TESTING (when ready)
   npm run test
`;

export const KEY_FEATURES = `
KEY FEATURES IMPLEMENTED:

1. FLIGHT SEARCH
   - From/To airport selection
   - Date picker (departure & return)
   - Passenger count (adults, children, infants)
   - Class of travel selection
   - Trip type (one-way, round-trip)
   - Airport swap functionality

2. SEARCH RESULTS
   - Dynamic flight listing
   - Real-time filtering (price, airline, stops, duration)
   - Multiple sorting options
   - Flight card with all key information
   - Estimated arrival time calculation
   - Pricing information per person
   - Seat availability indicators

3. FILTERS & SORTING
   - Price range slider
   - Airport filters
   - Airline selection
   - Number of stops filter
   - Departure time ranges
   - Multiple sort options (price, duration, time)

4. RESPONSIVE DESIGN
   - Mobile-first approach
   - Tablet-optimized layout
   - Desktop-optimized experience
   - Touch-friendly buttons and inputs
   - Adaptive cards and grids

5. USER EXPERIENCE
   - Loading states with spinners
   - Error messages with recovery options
   - Empty states with helpful suggestions
   - Smooth transitions and animations
   - Sticky search form on results page
   - Quick booking indicators (seats left)

6. CLEAN CODE
   - Full TypeScript coverage
   - Reusable components
   - Custom hooks for state management
   - Service layer abstraction
   - Well-organized folder structure
   - CSS variable theming
`;

export const REFERENCE_DESIGNS = `
DESIGN INSPIRATION FROM:
- https://www.ixigo.com  (Layout, filters, flight card design)
- https://www.goindigo.in (Color scheme, typography)

Key Design Elements:
1. Clean, minimal interface
2. Large hero section on landing
3. Feature cards with icons
4. Popular routes showcase
5.Professional flight cards with timeline
6. Comprehensive filtering sidebar
7. Responsive grid layouts
`;

export const FUTURE_ENHANCEMENTS = `
POTENTIAL ENHANCEMENTS:

1. AUTHENTICATION
   - Implement real login/signup
   - User profile management
   - Saved flights & wishlists

2. BOOKING FLOW
   - Passenger form component
   - Seat selection interface
   - Baggage options
   - Final confirmation page

3. PAYMENT INTEGRATION
   - Multiple payment methods
   - OTP verification
   - Refund tracking

4. NOTIFICATIONS
   - Real-time price alerts
   - Booking confirmations
   - Trip reminders

5. ADVANCED FEATURES
   - Flexible date search
   - Price calendar
   - Nearby airports
   - Multi-city flights
   - Hotel bundling

6. PERFORMANCE OPTIMIZATION
   - Code splitting by route
   - Lazy loading components
   - Image optimization
   - API caching
   - Service workers (PWA)

7. TESTING
   - Unit tests (Jest)
   - Component tests (React Testing Library)
   - E2E tests (Cypress)
   - Visual regression tests
`;

export default {
  PROJECT_STRUCTURE,
  ARCHITECTURE_PRINCIPLES,
  MOCK_DATA_STRUCTURE,
  API_INTEGRATION,
  COMPONENT_HIERARCHY,
  STYLING_APPROACH,
  GETTING_STARTED,
  KEY_FEATURES,
  REFERENCE_DESIGNS,
  FUTURE_ENHANCEMENTS,
};
