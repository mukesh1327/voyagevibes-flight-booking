import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { bookingStatuses } from './bookingStatus.js';

const passengerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  age: { type: Number, required: true, min: 1, max: 120 },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  _id: { type: String, default: () => randomUUID() },
  userId: { type: String, required: true, index: true },
  flightId: { type: String, required: true },
  flightNo: { type: String },
  holdId: { type: String, required: true },
  holdExpiresAt: { type: Date, required: true },
  seatsHeld: { type: Number, required: true, min: 1 },
  seatsRemaining: { type: Number },
  passengers: { type: [passengerSchema], required: true },
  amount: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: Object.values(bookingStatuses),
    default: bookingStatuses.paymentPending,
    index: true,
  },
  paymentId: { type: String },
}, {
  timestamps: true,
  versionKey: false,
});

export const Booking = mongoose.model('Booking', bookingSchema);
