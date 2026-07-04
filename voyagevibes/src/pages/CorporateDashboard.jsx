import { Activity, Building, CreditCard, Plane, Shield, Users } from 'lucide-react';

const renderRoleContent = (roles) => {
  if (roles.includes('support-desk')) {
    return (
      <div>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="var(--primary)" /> Support Desk Overview
        </h3>
        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-title">Active Support Tickets</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>42</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>+5 from yesterday</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Pending Refunds</div>
            <div className="stat-value" style={{ color: 'var(--secondary)' }}>12</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Action required</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Customer Satisfaction</div>
            <div className="stat-value">4.8/5</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Based on recent feedback</div>
          </div>
        </div>
      </div>
    );
  }

  if (roles.includes('flight-admin')) {
    return (
      <div>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plane size={20} color="var(--primary)" /> Flight Operations
        </h3>
        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-title">Active Flights Today</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>1,204</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>98% on time</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Schedule Changes</div>
            <div className="stat-value" style={{ color: 'var(--secondary)' }}>15</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Pending review</div>
          </div>
        </div>
      </div>
    );
  }

  if (roles.includes('finance-ops')) {
    return (
      <div>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} color="var(--primary)" /> Financial Overview
        </h3>
        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-title">Daily Revenue</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>$245,000</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>+12% vs last week</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Active Chargebacks</div>
            <div className="stat-value" style={{ color: 'var(--error)' }}>8</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Requires immediate attention</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
      <Shield size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>Welcome to the Corporate Portal</h3>
      <p style={{ color: 'var(--text-secondary)' }}>You do not have any specific operational roles assigned yet.</p>
    </div>
  );
};

const CorporateDashboard = ({ user }) => {
  const roles = user?.corporateRoles || [];

  return (
    <div className="main-content">
      <div className="glass-card glass-card-large" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Building size={28} color="var(--primary)" />
              Corporate Dashboard
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Welcome, {user?.name || 'Corporate User'}. Here is your operational overview.
            </p>
          </div>
          <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Your Roles</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {roles.length > 0 ? (
                roles.map((role) => (
                  <span key={role} style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: '500' }}>
                    {role}
                  </span>
                ))
              ) : (
                <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>corporate (base)</span>
              )}
            </div>
          </div>
        </div>

        <div>{renderRoleContent(roles)}</div>

        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>System Status</h3>
          <div style={{ display: 'flex', gap: '1rem', background: 'var(--surface)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--surface-border)' }}>
            <Activity size={24} color="var(--accent)" />
            <div>
              <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>All Systems Operational</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Gateway, Auth, and Core Services are running smoothly.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorporateDashboard;
