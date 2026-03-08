/**
 * Loading Component
 * Displays a loading spinner/skeleton
 */

import React from 'react';
import './Loading.css';

interface LoadingProps {
  message?: string;
  fullPage?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  fullPage = false,
}) => {
  const content = (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="loading-fullpage">
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;
