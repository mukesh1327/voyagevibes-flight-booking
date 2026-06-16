import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Search } from 'lucide-react';

const CustomerDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [isFirstTime] = useState(() => !localStorage.getItem('has_visited_customer'));

  useEffect(() => {
    if (isFirstTime) {
      localStorage.setItem('has_visited_customer', 'true');
    } else {
      navigate('/booking');
    }
  }, [isFirstTime, navigate]);

  if (!isFirstTime) {
    return null;
  }

  return (
    <div className="main-content">
      <div className="glass-card glass-card-large">
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Welcome to VoyageVibes!</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
          It looks like this is your first time here. Here are the details we received from your account.
        </p>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2.5rem' }}>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                <User size={20} /> Personal Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Full Name</span>
                  <span style={{ fontWeight: '500' }}>{user?.name || 'Customer'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Email</span>
                  <span style={{ fontWeight: '500' }}>{user?.email || 'customer@example.com'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Role</span>
                  <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{user?.baseRole || 'Customer'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Account Status</span>
                  <span style={{ fontWeight: '500', color: 'var(--accent)' }}>Active</span>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(99, 102, 241, 0.1)', padding: '2rem', borderRadius: '1rem', border: '1px dashed var(--primary)' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <Search size={32} />
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>Ready to explore?</h3>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Book flights, manage your itineraries, and explore the world with VoyageVibes.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/booking')}>
              Go to Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
