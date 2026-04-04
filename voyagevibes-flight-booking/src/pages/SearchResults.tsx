/**
 * Search Results Page
 * Display flight search results with filters and sorting
 */

import React, { useEffect } from 'react';
import type { FlightSearchRequest, FlightWithPrice, User } from '../types';
import { FlightCard, FlightSearch, FlightFilters } from '../components/flight';
import { Header, Footer, Loading, EmptyState, Button } from '../components';
import { useFlightSearch } from '../hooks';
import './SearchResults.css';

interface SearchResultsPageProps {
  initialCriteria: FlightSearchRequest;
  onSelectFlight?: (flight: FlightWithPrice) => void;
  onCustomerLogin?: () => void;
  onLogout?: () => void;
  user?: User | null;
  onNavigate?: (path: string) => void;
}

export const SearchResultsPage: React.FC<SearchResultsPageProps> = ({
  initialCriteria,
  onSelectFlight,
  onCustomerLogin,
  onLogout,
  user,
  onNavigate,
}) => {
  const {
    flights,
    filters,
    appliedFilters,
    isLoading,
    error,
    totalResults,
    searchFlights,
    applyFilters,
    
    sortFlights,
  } = useFlightSearch();

  useEffect(() => {
    searchFlights(initialCriteria);
  }, [initialCriteria]);

  const handleNewSearch = (criteria: FlightSearchRequest) => {
    searchFlights(criteria);
  };

  return (
    <div className="search-results-page">
      <Header
        user={user}
        onNavigate={onNavigate}
        onCustomerLogin={onCustomerLogin}
        onLogout={onLogout}
      />

      <div className="search-results-container">
        {/* Sticky Search Form */}
        <div className="sticky-search">
          <div className="search-form-wrapper">
            <FlightSearch onSearch={handleNewSearch} isLoading={isLoading} />
          </div>
        </div>

        <div className="results-layout">
          {/* Filters Sidebar */}
          <aside className="filter-sidebar">
            <FlightFilters
              filters={filters}
              appliedFilters={appliedFilters}
              onApplyFilters={applyFilters}
              onSortChange={(sortBy) => sortFlights(sortBy)}
            />
          </aside>

          {/* Results Main Content */}
          <main className="results-main">
            {/* Results Header */}
            {!isLoading && flights.length > 0 && (
              <div className="results-header">
                <h2>Flight Results ({totalResults})</h2>
                <p className="results-subtitle">
                  Showing flights from{' '}
                  <strong>
                    {initialCriteria.fromCode} to {initialCriteria.toCode}
                  </strong>
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="error-container">
                <div className="error-box">
                  <h3>⚠️ Search Error</h3>
                  <p>{error}</p>
                  <Button onClick={() => handleNewSearch(initialCriteria)}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="loading-container">
                <Loading message="Searching for flights..." />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && flights.length === 0 && !error && (
              <EmptyState
                icon="✈️"
                title="No Flights Found"
                description="Try adjusting your search criteria"
                action={{
                  label: 'Modify Search',
                  onClick: () => {
                    // Scroll to search form
                    document.querySelector('.sticky-search')?.scrollIntoView();
                  },
                }}
              />
            )}

            {/* Flights List */}
            {!isLoading && flights.length > 0 && (
              <div className="flights-grid">
                {flights.map((flight) => (
                  <FlightCard
                    key={flight.flight.id}
                    flight={flight}
                    onSelect={onSelectFlight || (() => {})}
                  />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {!isLoading && flights.length > 0 && flights.length < totalResults && (
              <div className="load-more-container">
                <Button variant="secondary" size="lg">
                  Load More Flights
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SearchResultsPage;
