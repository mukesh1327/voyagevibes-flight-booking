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

const gatewayBaseUrl = resolveEnv('VITE_GATEWAY_API_URL', 'VITE_API_GATEWAY_BASE_URL') || '/gateway-api';

const resolveServiceConfig = (): Record<
  ServiceKey,
  ServiceConfig
> => ({
  gateway: {
    baseUrl: gatewayBaseUrl,
  },
  auth: { baseUrl: gatewayBaseUrl },
  flight: { baseUrl: gatewayBaseUrl },
  booking: { baseUrl: gatewayBaseUrl },
  customer: { baseUrl: gatewayBaseUrl },
  payment: { baseUrl: gatewayBaseUrl },
});

const serviceConfig = resolveServiceConfig();

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
  const { method = 'GET', body, headers, query } = options;

  const base = serviceConfig[service].baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}${buildQueryString(query)}`;
  const serializedBody = body === undefined ? undefined : JSON.stringify(body);
  const requestHeaders = buildHeaders(headers);

  return executeRequest<T>(url, method, requestHeaders, serializedBody);
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

export const toDate = (value: string | Date | undefined): Date => {
  if (!value) {
    return new Date();
  }
  return value instanceof Date ? value : new Date(value);
};
