import type { ApiResponse } from '../types';
import { apiRequest, gatewayBaseUrl, getAuthContext } from './apiClient';

interface HealthStatus {
  status: string;
  details?: {
    service?: string;
    mode?: string;
  };
}

type ProbeKey = 'gateway' | 'auth' | 'flight' | 'booking' | 'customer' | 'payment' | 'notification';

interface ProbeDefinition {
  body?: Record<string, unknown>;
  key: ProbeKey;
  label: string;
  method: 'GET' | 'POST';
  path: string;
}

export interface GatewayProbeResult {
  key: ProbeKey;
  label: string;
  method: 'GET' | 'POST';
  path: string;
  message: string;
  state: 'healthy' | 'reachable' | 'down';
  statusCode?: number;
}

const probeDefinitions: ProbeDefinition[] = [
  { key: 'gateway', label: 'Gateway health', method: 'GET', path: '/api/v1/health' },
  { key: 'auth', label: 'Auth route', method: 'GET', path: '/api/v1/auth/public/google/start' },
  { key: 'flight', label: 'Flight search', method: 'GET', path: '/api/v1/flights/search?from=BOM&to=DEL' },
  { key: 'booking', label: 'Booking route', method: 'GET', path: '/api/v1/bookings' },
  { key: 'customer', label: 'Customer profile', method: 'GET', path: '/api/v1/users/me' },
  { key: 'payment', label: 'Payment intent', method: 'GET', path: '/api/v1/payments/intent' },
  { key: 'notification', label: 'OTP route', method: 'GET', path: '/api/v1/otp/send' },
];

const buildProbeHeaders = () => {
  const context = getAuthContext();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Actor-Type': context.actorType,
    'X-User-Id': context.userId,
    'X-Realm': context.realm,
  };

  if (context.token) {
    headers.Authorization = `Bearer ${context.token}`;
  }

  return headers;
};

const describeStatus = (status: number, statusText: string) => {
  if (status >= 200 && status < 300) {
    return {
      message: `${status} ${statusText || 'OK'} - responding normally.`,
      state: 'healthy' as const,
    };
  }

  if (status === 401 || status === 403) {
    return {
      message: `${status} ${statusText} - route is live but requires auth.`,
      state: 'reachable' as const,
    };
  }

  if (status === 400 || status === 404 || status === 405 || status === 422) {
    return {
      message: `${status} ${statusText} - route is reachable and validating requests.`,
      state: 'reachable' as const,
    };
  }

  return {
    message: `${status} ${statusText} - gateway reached the route but backend returned an error.`,
    state: 'reachable' as const,
  };
};

class GatewayService {
  async healthCheck(): Promise<ApiResponse<HealthStatus>> {
    return apiRequest<HealthStatus>('gateway', '/api/v1/health');
  }

  async probeCustomerApis(): Promise<GatewayProbeResult[]> {
    const headers = buildProbeHeaders();
    const baseUrl = gatewayBaseUrl.replace(/\/+$/, '');

    const results = await Promise.all(probeDefinitions.map(async (definition) => {
      const url = `${baseUrl}${definition.path}`;

      try {
        const response = await fetch(url, {
          method: definition.method,
          headers,
          body: definition.body ? JSON.stringify(definition.body) : undefined,
        });

        const summary = describeStatus(response.status, response.statusText);
        return {
          key: definition.key,
          label: definition.label,
          method: definition.method,
          path: definition.path,
          message: summary.message,
          state: summary.state,
          statusCode: response.status,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        return {
          key: definition.key,
          label: definition.label,
          method: definition.method,
          path: definition.path,
          message: `${message} - route is not reachable from the browser right now.`,
          state: 'down' as const,
        };
      }
    }));

    return results;
  }
}

export const gatewayService = new GatewayService();
