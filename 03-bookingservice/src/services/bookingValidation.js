const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateBooking = ({ flightId, passengers, amount }) => {
  if (!flightId || typeof flightId !== 'string' || flightId.trim().length === 0) {
    return 'flightId is required';
  }
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return 'At least one passenger is required';
  }
  if (passengers.length > 6) {
    return 'A booking can include at most 6 passengers';
  }
  for (const passenger of passengers) {
    if (!passenger?.name || passenger.name.trim().length < 2) {
      return 'Passenger name is required';
    }
    if (!passenger?.email || !emailPattern.test(passenger.email.trim())) {
      return 'Valid passenger email is required';
    }
    if (!Number.isInteger(Number(passenger.age)) || Number(passenger.age) < 1 || Number(passenger.age) > 120) {
      return 'Passenger age must be between 1 and 120';
    }
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return 'amount must be greater than zero';
  }
  return null;
};

export const normalizePassengers = (passengers) => passengers.map((passenger) => ({
  name: passenger.name.trim(),
  email: passenger.email.trim().toLowerCase(),
  age: Number(passenger.age),
}));
