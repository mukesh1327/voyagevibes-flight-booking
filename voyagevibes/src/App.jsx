import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Plane, LogOut } from 'lucide-react';

import Login from './pages/Login';
import Callback from './pages/Callback';
import CustomerDashboard from './pages/CustomerDashboard';
import Booking from './pages/Booking';
import CorporateDashboard from './pages/CorporateDashboard';
import { clearStoredAuth, getCurrentUser, getStoredToken } from './services/auth';
import './App.css';

const ProtectedRoute = ({ children, user, allowedRoles }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.baseRole)) {
    return <Navigate to={user.baseRole === 'corporate' ? '/corporate/dashboard' : '/customer/dashboard'} replace />;
  }
  
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initUser = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          const userData = await getCurrentUser(token);
          setUser(userData);
        } catch (error) {
          console.error('Failed to restore session:', error);
          clearStoredAuth();
        }
      }
      setLoading(false);
    };
    
    initUser();
  }, []);

  const handleLogout = () => {
    // We would ideally call the logout API here.
    clearStoredAuth();
    setUser(null);
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Plane size={48} color="var(--primary)" className="loader" style={{ animation: 'spin 2s linear infinite', border: 'none', width: 'auto', height: 'auto' }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="header">
          <Link to="/" className="header-logo">
            <Plane size={24} color="var(--primary)" />
            VoyageVibes
          </Link>
          <div className="header-nav">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {user.name || user.email}
                </span>
                <button 
                  onClick={handleLogout}
                  className="btn btn-outline" 
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                Login
              </Link>
            )}
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to={user ? (user.baseRole === 'corporate' ? '/corporate/dashboard' : '/customer/dashboard') : '/login'} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/callback" element={<Callback setUser={setUser} />} />
          
          <Route path="/customer/dashboard" element={
            <ProtectedRoute user={user} allowedRoles={['customer']}>
              <CustomerDashboard user={user} />
            </ProtectedRoute>
          } />
          
          <Route path="/booking" element={
            <ProtectedRoute user={user} allowedRoles={['customer']}>
              <Booking user={user} />
            </ProtectedRoute>
          } />
          
          <Route path="/corporate/dashboard" element={
            <ProtectedRoute user={user} allowedRoles={['corporate']}>
              <CorporateDashboard user={user} />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
