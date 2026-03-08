import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import { Header, Footer, Button, Card, ErrorMessage, Loading } from '../components';
import './Profile.css';

interface ProfilePageProps {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  onNavigate: (path: string) => void;
  onLoadProfile: () => Promise<User | null>;
  onSaveProfile: (updates: Partial<User>) => Promise<User | null>;
  onLogout: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  isLoading,
  error,
  onNavigate,
  onLoadProfile,
  onSaveProfile,
  onLogout,
}) => {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onLoadProfile();
  }, []);

  useEffect(() => {
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
  }, [user]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const updated = await onSaveProfile({
      firstName,
      lastName,
      email,
      phone,
    });

    setSaved(!!updated);
  };

  return (
    <div className="profile-page">
      <Header user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="profile-main">
        <Card className="profile-card">
          <h1>Profile</h1>
          <p>Keep your contact details up to date for smooth trip notifications.</p>

          {error && <ErrorMessage message={error} />}
          {saved && <p className="profile-saved">Profile updated successfully.</p>}
          {isLoading && <Loading message="Loading profile..." />}

          <form className="profile-form" onSubmit={handleSave}>
            <div className="profile-grid">
              <div>
                <label>First Name</label>
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
              </div>
              <div>
                <label>Last Name</label>
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div>
                <label>Phone</label>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>

            <div className="profile-actions">
              <Button type="submit" isLoading={isLoading}>
                Save Profile
              </Button>
              <Button variant="outline" type="button" onClick={() => onNavigate('/bookings')}>
                Go To Bookings
              </Button>
            </div>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
