export function toDto(booking) {
  const item = typeof booking.toObject === 'function' ? booking.toObject() : booking;
  return {
    id: item._id,
    userId: item.userId,
    flightId: item.flightId,
    flightNo: item.flightNo,
    holdId: item.holdId,
    holdExpiresAt: item.holdExpiresAt,
    seatsHeld: item.seatsHeld,
    seatsRemaining: item.seatsRemaining,
    passengers: item.passengers,
    amount: item.amount,
    status: item.status,
    paymentId: item.paymentId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
