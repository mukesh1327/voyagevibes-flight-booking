import type { ApiResponse } from '../types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  disableFallback?: boolean;
}

interface ServiceConfig {
  baseUrl: string;
}

type ServiceKey = 'gateway' | 'auth' | 'flight' | 'booking' | 'customer' | 'payment';

const DEFAULT_USER_ID = 'U-CUSTOMER-1';
const DEFAULT_ACTOR_TYPE = 'customer';
const DEFAULT_REALM = 'voyagevibes-public';

const resolveEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const resolveServiceConfig = (): Record<
  ServiceKey,
  ServiceConfig
> => ({
  gateway: {
    baseUrl: resolveEnv('VITE_GATEWAY_API_URL', 'VITE_API_GATEWAY_BASE_URL') || '/gateway-api',
  },
  auth: { baseUrl: resolveEnv('VITE_AUTH_API_URL') || '/auth-api' },
  flight: { baseUrl: resolveEnv('VITE_FLIGHT_API_URL') || '/flight-api' },
  booking: { baseUrl: resolveEnv('VITE_BOOKING_API_URL') || '/booking-api' },
  customer: { baseUrl: resolveEnv('VITE_CUSTOMER_API_URL') || '/customer-api' },
  payment: {
    baseUrl:
      resolveEnv('VITE_PAYMENT_API_URL', 'VITE_GATEWAY_API_URL', 'VITE_API_GATEWAY_BASE_URL') || '/gateway-api',
  },
});

const serviceConfig = resolveServiceConfig();

const fallbackServiceConfig: Partial<Record<ServiceKey, ServiceConfig>> = {
  auth: { baseUrl: '/auth-api' },
  flight: { baseUrl: '/flight-api' },
  booking: { baseUrl: '/booking-api' },
  customer: { baseUrl: '/customer-api' },
  payment: { baseUrl: '/payment-api' },
};

const buildQueryString = (query?: RequestOptions['query']): string => {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      params.append(key, String(value));
    }
  });

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

export const getAuthContext = () => {
  const token = localStorage.getItem('token') || '';
  const actorType = localStorage.getItem('actorType') || DEFAULT_ACTOR_TYPE;
  const userId = localStorage.getItem('userId') || DEFAULT_USER_ID;
  const realm =
    localStorage.getItem('realm') ||
    (actorType === 'corp' ? 'voyagevibes-corp' : DEFAULT_REALM);

  return {
    token,
    actorType,
    userId,
    realm,
  };
};

const buildHeaders = (customHeaders?: Record<string, string>): Record<string, string> => {
  const context = getAuthContext();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Actor-Type': context.actorType,
    'X-User-Id': context.userId,
    'X-Realm': context.realm,
    ...customHeaders,
  };

  if (context.token) {
    headers['Authorization'] = `Bearer ${context.token}`;
  }

  return headers;
};

const createErrorResponse = <T>(message: string, details?: unknown): ApiResponse<T> => ({
  success: false,
  error: {
    code: 'API_ERROR',
    message,
    details:
      details && typeof details === 'object'
        ? (details as Record<string, unknown>)
        : details !== undefined
          ? { raw: details }
          : undefined,
  },
  timestamp: new Date(),
});

export const apiRequest = async <T>(
  service: ServiceKey,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const { method = 'GET', body, headers, query, disableFallback = false } = options;

  const base = serviceConfig[service].baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}${buildQueryString(query)}`;
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  const requestHeaders = buildHeaders(headers);

  const primaryResponse = await executeRequest<T>(url, method, requestHeaders, serializedBody);
  const fallback = fallbackServiceConfig[service];
  if (disableFallback || !fallback || !shouldRetryWithFallback(primaryResponse)) {
    return primaryResponse;
  }

  const fallbackBase = fallback.baseUrl.replace(/\/+$/, '');
  return executeRequest<T>(`${fallbackBase}${normalizedPath}${buildQueryString(query)}`, method, requestHeaders, serializedBody);
};

const executeRequest = async <T>(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  body: string | undefined
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (response.status === 204) {
      return {
        success: true,
        data: undefined,
        timestamp: new Date(),
      };
    }

    const { payload, isJson } = await readPayload(response);

    if (!response.ok) {
      return createErrorResponse<T>(extractErrorMessage(payload, response.status), {
        status: response.status,
        payload,
      });
    }

    if (!isJson || payload === undefined) {
      return createErrorResponse<T>('Expected JSON response from backend.', {
        status: response.status,
        payload,
      });
    }

    return {
      success: true,
      data: payload as T,
      timestamp: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    return createErrorResponse<T>(message);
  }
};

const readPayload = async (response: Response): Promise<{ payload: unknown; isJson: boolean }> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return {
      payload: await response.json().catch(() => undefined),
      isJson: true,
    };
  }

  const text = await response.text().catch(() => '');
  if (!text) {
    return { payload: undefined, isJson: false };
  }

  try {
    return {
      payload: JSON.parse(text) as unknown,
      isJson: true,
    };
  } catch {
    return {
      payload: { raw: text },
      isJson: false,
    };
  }
};

const extractErrorMessage = (payload: unknown, status: number): string => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record['message'] === 'string' && record['message']) {
      return record['message'];
    }
    if (typeof record['detail'] === 'string' && record['detail']) {
      return record['detail'];
    }
    if (typeof record['error'] === 'string' && record['error']) {
      return record['error'];
    }
    if (typeof record['raw'] === 'string' && record['raw']) {
      return record['raw'];
    }
  }

  return `Request failed with status ${status}`;
};

const shouldRetryWithFallback = <T>(response: ApiResponse<T>): boolean => {
  if (response.success) {
    return false;
  }

  const status = response.error?.details?.status;
  if (typeof status === 'number' && [404, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = response.error?.message || '';
  return (
    message === 'Expected JSON response from backend.' ||
    message.includes('no Route matched') ||
    message.includes('failure to get a peer from the ring-balancer') ||
    message.includes('Network request failed') ||
    message.includes('Failed to fetch')
  );
};

export const toDate = (value: string | Date | undefined): Date => {
  if (!value) {
    return new Date();
  }
  return value instanceof Date ? value : new Date(value);
};
