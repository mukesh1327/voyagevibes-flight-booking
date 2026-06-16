import { Plane, Calendar, MapPin, Search } from 'lucide-react';

const Booking = ({ user }) => {
  return (
    <div className="main-content">
      <div className="glass-card glass-card-large" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Flight Search & Booking</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {user?.name || 'Traveler'}! Find your next adventure below.</p>
        </div>

        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="input-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                From
              </label>
              <input type="text" className="input-field" placeholder="Departure City or Airport" />
            </div>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="input-label">
                <MapPin size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                To
              </label>
              <input type="text" className="input-field" placeholder="Arrival City or Airport" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="input-label">
                <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Departure Date
              </label>
              <input type="date" className="input-field" />
            </div>
            <div className="input-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="input-label">
                <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Return Date (Optional)
              </label>
              <input type="date" className="input-field" />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            <Search size={18} /> Search Flights
          </button>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Popular Destinations</h3>
          <div className="dashboard-grid" style={{ marginTop: '0.5rem' }}>
            <div className="stat-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
              <div style={{ background: 'var(--primary)', padding: '0.75rem', borderRadius: '0.75rem', color: 'white' }}>
                <Plane size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Paris, France</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Direct flights available</div>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
              <div style={{ background: 'var(--secondary)', padding: '0.75rem', borderRadius: '0.75rem', color: 'white' }}>
                <Plane size={24} />
              </div>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Tokyo, Japan</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Trending destination</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;
