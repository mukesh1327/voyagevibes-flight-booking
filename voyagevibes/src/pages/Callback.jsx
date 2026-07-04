import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { getCurrentUser, handleCallback, readOAuthCallbackError, storeTokens } from '../services/auth';

const Callback = ({ setUser }) => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      if (processedRef.current) {
        return;
      }
      processedRef.current = true;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const oauthError = readOAuthCallbackError();

        if (oauthError) {
          throw new Error(oauthError);
        }

        if (!code || !state) {
          throw new Error('Invalid callback parameters');
        }

        const tokens = await handleCallback(code, state);
        storeTokens(tokens);

        const userData = await getCurrentUser(tokens.accessToken);
        setUser(userData);

        navigate(userData.baseRole === 'corporate' ? '/corporate/dashboard' : '/customer/dashboard');
      } catch (err) {
        console.error('Callback error:', err?.message || err);
        setError(err?.message || 'Authentication failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    processCallback();
  }, [navigate, setUser]);

  if (error) {
    return (
      <div className="main-content">
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '3rem' }}>!</div>
          <h3>Authentication Error</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>Return to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '1.5rem', borderRadius: '50%', marginBottom: '2rem' }}>
          <Plane size={48} color="white" className="loader" style={{ animation: 'spin 2s linear infinite', border: 'none', width: 'auto', height: 'auto' }} />
        </div>
        <h2>Authenticating...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Please wait while we log you in securely.</p>
      </div>
    </div>
  );
};

export default Callback;
