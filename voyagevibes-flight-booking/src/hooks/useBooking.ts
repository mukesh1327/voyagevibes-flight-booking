/**
 * useBooking Hook
 * Manages booking state and operations
 */

import { useState, useCallback } from 'react';
import type { Booking, BookingRequest } from '../types';
import { bookingService } from '../services';

interface UseBookingReturn {
  booking: Booking | null;
  userBookings: Booking[];
  isLoading: boolean;
  error: string | null;
  createBooking: (request: BookingRequest) => Promise<Booking | null>;
  confirmBooking: (bookingId: string, paymentId: string) => Promise<void>;
  getBooking: (bookingId: string) => Promise<void>;
  getUserBookings: () => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  changeBooking: (bookingId: string, flightIds: string[], reason?: string) => Promise<void>;
}

export const useBooking = (): UseBookingReturn => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(async (request: BookingRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bookingService.reserve(request);

      if (response.success && response.data) {
        setBooking(response.data);
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to create booking');
        return null;
      }
    } catch (err) {
      setError('An error occurred while creating booking');
      console.error(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmBooking = useCallback(
    async (bookingId: string, paymentId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await bookingService.confirmBooking({
          bookingId,
          paymentId,
        });

        if (response.success && response.data) {
          setBooking(response.data);
        } else {
          setError(response.error?.message || 'Failed to confirm booking');
        }
      } catch (err) {
        setError('An error occurred while confirming booking');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getBooking = useCallback(async (bookingId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bookingService.getBooking(bookingId);

      if (response.success && response.data) {
        setBooking(response.data);
      } else {
        setError(response.error?.message || 'Failed to fetch booking');
      }
    } catch (err) {
      setError('An error occurred while fetching booking');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUserBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bookingService.getUserBookings();

      if (response.success && response.data) {
        setUserBookings(response.data);
      } else {
        setError(response.error?.message || 'Failed to fetch bookings');
      }
    } catch (err) {
      setError('An error occurred while fetching bookings');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelBooking = useCallback(async (bookingId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bookingService.cancelBooking(bookingId);

      if (response.success && response.data) {
        setBooking(response.data);
        // Update user bookings if available
        const updated = response.data as Booking;
        setUserBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
      } else {
        setError(response.error?.message || 'Failed to cancel booking');
      }
    } catch (err) {
      setError('An error occurred while cancelling booking');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changeBooking = useCallback(async (bookingId: string, flightIds: string[], reason?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bookingService.changeBooking({
        bookingId,
        flightIds,
        reason,
      });

      if (response.success && response.data) {
        setBooking(response.data);
        const updated = response.data as Booking;
        setUserBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
      } else {
        setError(response.error?.message || 'Failed to change booking');
      }
    } catch (err) {
      setError('An error occurred while changing booking');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    booking,
    userBookings,
    isLoading,
    error,
    createBooking,
    confirmBooking,
    getBooking,
    getUserBookings,
    cancelBooking,
    changeBooking,
  };
};
