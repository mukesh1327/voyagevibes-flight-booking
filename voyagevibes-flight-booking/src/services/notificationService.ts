import type { ApiResponse } from '../types';
import { apiRequest } from './apiClient';

export interface OtpSendRequest {
  userId: string;
  actorType: string;
  destination: string;
  channel?: 'sms' | 'email';
  code: string;
  ttlSeconds?: number;
}

export interface OtpSendResponse {
  accepted: boolean;
  notificationId?: string;
  deduped?: boolean;
}

class NotificationService {
  async sendOtp(request: OtpSendRequest): Promise<ApiResponse<OtpSendResponse>> {
    return apiRequest<OtpSendResponse>('notification', '/api/v1/otp/send', {
      method: 'POST',
      body: {
        userId: request.userId,
        actorType: request.actorType,
        destination: request.destination,
        channel: request.channel || 'sms',
        code: request.code,
        ttlSeconds: request.ttlSeconds || 300,
      },
    });
  }
}

export const notificationService = new NotificationService();
