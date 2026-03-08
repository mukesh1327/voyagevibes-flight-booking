/**
 * Header Component
 * Navigation header with logo and user menu
 */

import React from 'react';
import type { User } from '../../types';
import { Button } from '../common';
import './Header.css';

interface HeaderProps {
  user?: User | null;
  onLogin?: () => void;
  onCustomerLogin?: () => void;
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogin,
  onCustomerLogin,
  onLogout,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const avatarLabel = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : '';

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <div className="header-logo" onClick={() => onNavigate?.('/')}>
          <span className="logo-icon">✈️</span>
          <span className="logo-text">VoyageVibes</span>
        </div>

        {/* Navigation */}
        <nav className={`header-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate?.('/'); }}>
            Flights
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate?.('/bookings'); }}>
            My Bookings
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate?.('/profile'); }}>
            Profile
          </a>
        </nav>

        {/* User Section */}
        <div className="header-user">
          {user ? (
            <div className="user-profile">
              {user.avatar ? (
                <img src={user.avatar} alt={user.firstName} className="user-avatar" />
              ) : (
                <div className="user-avatar user-avatar-fallback">{avatarLabel}</div>
              )}
              <span className="user-name">{user.firstName}</span>
              {onLogout && (
                <button
                  className="logout-btn"
                  onClick={onLogout}
                  title="Log out"
                  aria-label="Log out"
                >
                  Log out
                </button>
              )}
            </div>
          ) : (
            <div className="login-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={onCustomerLogin || onLogin}
              >
                Customer Login
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>
      </div>
    </header>
  );
};

export default Header;
