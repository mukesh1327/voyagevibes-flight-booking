class InMemoryUserRepository {
  constructor() {
    this.storageName = 'in-memory';
    this.users = new Map();
    this.users.set('U-CUSTOMER-1', {
      userId: 'U-CUSTOMER-1',
      actorType: 'customer',
      name: 'VoyageVibes Customer',
      email: 'customer@voyagevibes.dev',
      mobile: '+911234567890',
      mobileVerified: false,
      preferences: { cabin: 'economy', seat: 'aisle' }
    });
    this.users.set('U-CORP-1', {
      userId: 'U-CORP-1',
      actorType: 'corp',
      name: 'VoyageVibes Staff',
      email: 'staff@voyagevibes.dev',
      mobile: '+919876543210',
      mobileVerified: true,
      preferences: { dashboard: 'ops' }
    });
  }

  findById(userId) {
    return this.users.get(userId);
  }

  save(user) {
    this.users.set(user.userId, user);
    return user;
  }
}

module.exports = { InMemoryUserRepository };
