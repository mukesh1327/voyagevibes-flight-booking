import { Injectable, inject } from '@angular/core';

import type { ApiResult, PaymentRecord } from '../models/domain.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class PaymentOpsService {
  private readonly api = inject(ApiClientService);

  createIntent(payload: {
    bookingId: string;
    amount: number;
    currency: string;
    provider: 'mock' | 'razorpay';
    metadata?: Record<string, unknown>;
  }): Promise<ApiResult<PaymentRecord>> {
    return this.api.request<PaymentRecord>('payment', '/api/v1/payments/intent', {
      method: 'POST',
      body: payload,
    });
  }

  authorize(payload: {
    paymentId: string;
    providerPaymentId?: string;
    providerOrderId?: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResult<PaymentRecord>> {
    return this.api.request<PaymentRecord>('payment', `/api/v1/payments/${payload.paymentId}/authorize`, {
      method: 'POST',
      body: {
        providerPaymentId: payload.providerPaymentId,
        providerOrderId: payload.providerOrderId,
        amount: payload.amount,
        reason: payload.reason,
        metadata: payload.metadata || {},
      },
    });
  }

  capture(payload: {
    paymentId: string;
    providerPaymentId?: string;
    providerOrderId?: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResult<PaymentRecord>> {
    return this.api.request<PaymentRecord>('payment', `/api/v1/payments/${payload.paymentId}/capture`, {
      method: 'POST',
      body: {
        providerPaymentId: payload.providerPaymentId,
        providerOrderId: payload.providerOrderId,
        amount: payload.amount,
        reason: payload.reason,
        metadata: payload.metadata || {},
      },
    });
  }

  refund(payload: {
    paymentId: string;
    providerPaymentId?: string;
    providerOrderId?: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResult<PaymentRecord>> {
    return this.api.request<PaymentRecord>('payment', `/api/v1/payments/${payload.paymentId}/refund`, {
      method: 'POST',
      body: {
        providerPaymentId: payload.providerPaymentId,
        providerOrderId: payload.providerOrderId,
        amount: payload.amount,
        reason: payload.reason,
        metadata: payload.metadata || {},
      },
    });
  }
}
