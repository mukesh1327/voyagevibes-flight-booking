import React from 'react';
import { Header, Footer, Button, ErrorMessage } from '../components';
import './Auth.css';

interface AuthPageProps {
  isGoogleLoading?: boolean;
  error: string | null;
  onContinueWithGoogle: () => Promise<void>;
  onBackHome: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  isGoogleLoading = false,
  error,
  onContinueWithGoogle,
  onBackHome,
}) => {

  return (
    <div className="auth-page">
      <Header onNavigate={() => onBackHome()} />

      <main className="auth-main">
        <section className="auth-panel">
          <div className="auth-panel-header">
            <h1>Welcome to VoyageVibes</h1>
            <p>Customer login to continue booking, manage trips, and receive alerts.</p>
          </div>

          {error && <ErrorMessage message={error} />}

          <div className="auth-form">
            <Button
              type="button"
              variant="outline"
              isLoading={isGoogleLoading}
              onClick={onContinueWithGoogle}
              size="lg"
              style={{ width: '100%' }}
            >
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBackHome}
              size="lg"
              style={{ width: '100%' }}
            >
              Continue As Guest
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AuthPage;
