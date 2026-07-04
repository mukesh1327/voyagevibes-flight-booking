import { useEffect, useState } from 'react';
import { Building, LogIn, Plane, User } from 'lucide-react';
import { getFrontendConfig, readPendingLoginType, startLoginFlow } from '../services/auth';

const Login = () => {
  const [activeTab, setActiveTab] = useState('customer');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      let data;

      try {
        data = await getFrontendConfig();
        setConfig(data);
      } catch (err) {
        console.error('Error loading config:', err);
        setError('Unable to reach the authentication service. Please try again later.');
        setLoading(false);
        return;
      }

      try {
        const pendingType = readPendingLoginType();
        if (!pendingType) {
          setLoading(false);
          return;
        }

        setActiveTab(pendingType);
        await startLoginFlow(pendingType, data, { skipSsoClear: true });
      } catch (err) {
        console.error('Error continuing login flow:', err);
        setError(err.message || 'Unable to continue the login flow. Please try again.');
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleLogin = async (type) => {
    if (!config) {
      setError('Authentication service unavailable');
      return;
    }

    try {
      setLoading(true);
      await startLoginFlow(type, config);
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div className="glass-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '1rem', borderRadius: '50%' }}>
              <Plane size={32} color="white" />
            </div>
          </div>
          <h2>Welcome to VoyageVibes</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Log in to access your flight bookings and services.</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div className="tabs">
          <div
            className={`tab ${activeTab === 'customer' ? 'active' : ''}`}
            onClick={() => setActiveTab('customer')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <User size={18} />
            Customer
          </div>
          <div
            className={`tab ${activeTab === 'corporate' ? 'active' : ''}`}
            onClick={() => setActiveTab('corporate')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Building size={18} />
            Corporate
          </div>
        </div>

        {activeTab === 'customer' ? (
          <div>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>
              Sign in securely with your Google account to manage your personal flight bookings.
            </p>
            <button
              className="btn btn-google"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => handleLogin('customer')}
              disabled={loading}
            >
              {loading ? <div className="loader"></div> : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>
              Sign in with your corporate credentials to access workforce features and operational dashboards.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => handleLogin('corporate')}
              disabled={loading}
            >
              {loading ? <div className="loader"></div> : (
                <>
                  <LogIn size={20} />
                  Corporate Login (SSO)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
