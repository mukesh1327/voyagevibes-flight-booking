/**
 * Common UI Components
 * Button, ErrorMessage, Card, Badge
 */

import React from 'react';
import './CommonComponents.css';

// ============ Button Component ============
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  ...props
}) => (
  <button
    className={`btn btn-${variant} btn-${size}`}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <span className="btn-loader"></span> : children}
  </button>
);

// ============ ErrorMessage Component ============
interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => (
  <div className="error-message">
    <div className="error-content">
      <span className="error-icon">⚠️</span>
      <p className="error-text">{message}</p>
    </div>
    {onDismiss && (
      <button className="error-dismiss" onClick={onDismiss}>
        ✕
      </button>
    )}
  </div>
);

// ============ Card Component ============
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => (
  <div
    className={`card ${className} ${hoverable ? 'hoverable' : ''}`}
    onClick={onClick}
  >
    {children}
  </div>
);

// ============ Badge Component ============
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
}) => <span className={`badge badge-${variant} badge-${size}`}>{children}</span>;

// ============ Tag Component ============
interface TagProps {
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: 'default' | 'primary' | 'success';
}

export const Tag: React.FC<TagProps> = ({ children, onRemove, variant = 'default' }) => (
  <span className={`tag tag-${variant}`}>
    {children}
    {onRemove && (
      <button className="tag-remove" onClick={onRemove}>
        ✕
      </button>
    )}
  </span>
);

// ============ Empty State Component ============
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  action,
}) => (
  <div className="empty-state">
    <div className="empty-icon">{icon}</div>
    <h3 className="empty-title">{title}</h3>
    {description && <p className="empty-description">{description}</p>}
    {action && (
      <Button onClick={action.onClick} variant="primary">
        {action.label}
      </Button>
    )}
  </div>
);

// ============ Modal Component ============
interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }[];
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  actions,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && (
          <div className="modal-footer">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || 'secondary'}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ Alert Component ============
interface AlertProps {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
}

export const Alert: React.FC<AlertProps> = ({ type, title, message }) => (
  <div className={`alert alert-${type}`}>
    <h4>{title}</h4>
    {message && <p>{message}</p>}
  </div>
);
