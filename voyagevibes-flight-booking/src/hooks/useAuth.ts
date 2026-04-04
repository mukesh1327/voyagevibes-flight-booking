/**
 * useAuth Hook
 * Manages authentication state
 */

import { useState, useCallback, useEffect } from 'react';
import type { User } from '../types';
import { authService, userService } from '../services';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  startGoogleLogin: () => Promise<boolean>;
  completeGoogleLogin: (code: string, state: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  setUser: (user: User | null) => void;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (err) {
          localStorage.removeItem('user');
        }
      }
    };

    checkAuth();
  }, []);

  const startGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.startGoogleOAuth();
      if (!response.success || !response.data?.authorizationUrl || !response.data?.state) {
        setError(response.error?.message || 'Unable to start Google login');
        return false;
      }

      sessionStorage.setItem('googleOAuthState', response.data.state);
      if (response.data.codeVerifier) {
        sessionStorage.setItem('googleOAuthCodeVerifier', response.data.codeVerifier);
      } else {
        sessionStorage.removeItem('googleOAuthCodeVerifier');
      }
      window.location.assign(response.data.authorizationUrl);
      return true;
    } catch (err) {
      setError('An error occurred while starting Google login');
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeGoogleLogin = useCallback(async (code: string, state: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const expectedState = sessionStorage.getItem('googleOAuthState');
      const codeVerifier = sessionStorage.getItem('googleOAuthCodeVerifier') || undefined;

      if (!expectedState || expectedState !== state) {
        setError('Invalid or expired state');
        return false;
      }

      const response = await authService.handleGoogleCallback({ code, state, codeVerifier });
      if (!response.success || !response.data) {
        setError(response.error?.message || 'Google login failed');
        return false;
      }

      sessionStorage.removeItem('googleOAuthState');
      sessionStorage.removeItem('googleOAuthCodeVerifier');
      const me = await userService.getMe();
      const userData: User = me.success && me.data
        ? me.data
        : {
            id: response.data.user.userId,
            email: response.data.user.email,
            firstName: response.data.user.email.split('@')[0] || 'VoyageVibes',
            lastName: 'User',
            createdAt: new Date(),
          };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    } catch (err) {
      setError('An error occurred while completing Google login');
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('actorType');
      localStorage.removeItem('userId');
      return true;
    } catch (err) {
      setError('An error occurred during logout');
      console.error(err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    startGoogleLogin,
    completeGoogleLogin,
    logout,
    setUser,
  };
};
