export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  status: number;
  timestamp: string;
}

export interface DeviceInfo {
  userAgent: string;
  ip: string;
  deviceId: string;
  platform: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserSummary {
  userId: string;
  email: string;
  realm: string;
  status: string;
  roles: string[];
}

export interface CorpSessionResponse {
  tokens: TokenPair;
  user: UserSummary;
  isNewUser: boolean;
  profileStatus: string;
  mfaLevel: string;
}

export interface CorpLoginInitRequest {
  email: string;
  deviceInfo: DeviceInfo;
}

export interface CorpLoginInitResponse {
  loginFlowId: string;
  allowedFactors: string[];
  requiresStepUp: boolean;
}

export interface CorpLoginVerifyRequest {
  loginFlowId: string;
  factorType: string;
  assertion: string;
}

export interface CorpLoginVerifyResponse {
  session: CorpSessionResponse | null;
  challengeRequired: boolean;
  challengeType: string;
  challengeMetadata?: Record<string, unknown>;
}

export interface CorpMfaChallengeRequest {
  loginFlowId: string;
  factorType: string;
}

export interface OtpChallengeResponse {
  challengeId: string;
  expiresIn: number;
  resendAfter: number;
}

export interface WebAuthnChallengeResponse {
  challenge: string;
  rpId: string;
  timeout: number;
}

export type CorpMfaChallengeResponse = OtpChallengeResponse | WebAuthnChallengeResponse;

export interface CorpMfaVerifyRequest {
  challengeId: string;
  otpOrAssertion: string;
}

export interface Airport {
  code: string;
  city: string;
  country: string;
  name: string;
  timezone: string;
}

export interface AirlineInfo {
  code: string;
  name: string;
  logo: string;
}

export interface FlightSegment {
  id: string;
  flightId: string;
  airline: AirlineInfo;
  departureAirport: Airport;
  arrivalAirport: Airport;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
}

export interface PricingSummary {
  baseFare: number;
  taxes: number;
  fees: number;
  totalPrice: number;
  currency: string;
  fareBasis: string;
  fareFamily: string;
}

export interface FlightAvailability {
  seats: number;
}

export interface FlightCardModel {
  id: string;
  totalDurationMinutes: number;
  totalStops: number;
  segments: FlightSegment[];
  pricing: PricingSummary;
  availability: FlightAvailability;
}

export interface FlightSearchCriteria {
  fromCode: string;
  toCode: string;
  departureDate: string;
  seatCount: number;
  cabinClass: 'economy' | 'premium-economy' | 'business' | 'first';
}

export interface FlightSearchResponse {
  flights: FlightCardModel[];
  totalResults: number;
}

export interface PricingQuote {
  quoteId: string;
  pricing: PricingSummary;
  validUntil: string;
}

export interface InventoryHold {
  holdId: string;
  flightId: string;
  seatCount: number;
  expiresAt: string;
}

export interface PassengerDraft {
  firstName: string;
  lastName: string;
  email: string;
}

export interface FlightSummary {
  flightId: string;
  routeLabel: string;
  departureTime?: string;
  arrivalTime?: string;
}

export interface BookingRecord {
  bookingId: string;
  userId: string;
  flightId: string;
  seatCount: number;
  status: string;
  paymentStatus: string;
  holdId: string;
  actorType: string;
  updatedAt: string;
  flightSummary?: FlightSummary;
  quotedAmount?: number;
}

export interface PaymentRecord {
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
  actorType?: string;
  userId?: string;
  provider?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  providerPayload?: Record<string, unknown>;
  updatedAt: string;
}

export interface CorpSession {
  tokens: TokenPair;
  user: UserSummary;
  mfaLevel: string;
  profileStatus: string;
}

export type CorpRoleId = 'CORP_ADMIN' | 'OPS_AGENT' | 'SUPPORT_AGENT' | 'FINANCE_AGENT';
export type CorpUserStatus = 'ACTIVE' | 'DISABLED';

export interface CorpUserCreateRequest {
  email: string;
  roleIds: CorpRoleId[];
  department?: string;
  managerId?: string;
}

export interface CorpUserUpdateRequest {
  status?: CorpUserStatus;
  department?: string;
  managerId?: string;
}

export interface CorpRoleAssignmentRequest {
  roleId: CorpRoleId;
}

export interface CorpAdminUserSnapshot {
  trackingKey: string;
  userId?: string;
  email: string;
  status: CorpUserStatus;
  roles: CorpRoleId[];
  department?: string;
  managerId?: string;
  updatedAt: string;
  lastAction: string;
}