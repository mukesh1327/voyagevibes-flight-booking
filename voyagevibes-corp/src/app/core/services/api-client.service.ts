import { Injectable, inject } from '@angular/core';

import type { ApiResult } from '../models/domain.models';
import { CorpSessionService } from './corp-session.service';

type ServiceKey = 'gateway' | 'auth' | 'flight' | 'booking' | 'payment';
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
}

const gatewayBaseUrl = '/gateway-api';

const baseUrls: Record<ServiceKey, string> = {
  gateway: gatewayBaseUrl,
  auth: gatewayBaseUrl,
  flight: gatewayBaseUrl,
  booking: gatewayBaseUrl,
  payment: gatewayBaseUrl,
};

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly session = inject(CorpSessionService);

  async request<T>(service: ServiceKey, path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const method = options.method || 'GET';
    const query = this.toQueryString(options.query);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${baseUrls[service].replace(/\/+$/, '')}${normalizedPath}${query}`;
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const headers = this.buildHeaders(options.headers);

    return this.requestOnce<T>(url, method, headers, body);
  }

  private async requestOnce<T>(
    url: string,
    method: HttpMethod,
    headers: Record<string, string>,
    body: string | undefined,
  ): Promise<ApiResult<T>> {
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
          status: response.status,
          timestamp: new Date().toISOString(),
        };
      }

      const { payload, isJson } = await this.readPayload(response);
      if (!response.ok) {
        return {
          success: false,
          error: {
            code: this.extractErrorCode(payload, response.status),
            message: this.extractErrorMessage(payload, response.status),
            details: this.extractErrorDetails(payload),
          },
          status: response.status,
          timestamp: new Date().toISOString(),
        };
      }

      if (!isJson || payload === undefined) {
        return {
          success: false,
          error: {
            code: 'UNEXPECTED_RESPONSE',
            message: 'Expected JSON response from backend.',
            details: this.extractErrorDetails(payload),
          },
          status: response.status,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: payload as T,
        status: response.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
        status: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const session = this.session.session();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Actor-Type': 'corp',
      'X-Realm': 'voyagevibes-corp',
      'X-User-Id': session?.user.userId || 'OPS-DEMO-1',
      'X-Correlation-Id': `corp-ui-${Date.now()}`,
      ...customHeaders,
    };

    if (session?.tokens.accessToken) {
      headers['Authorization'] = `Bearer ${session.tokens.accessToken}`;
    }

    return headers;
  }

  private toQueryString(query?: RequestOptions['query']): string {
    if (!query) {
      return '';
    }

    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        params.append(key, `${value}`);
      }
    });

    const encoded = params.toString();
    return encoded ? `?${encoded}` : '';
  }

  private async readPayload(response: Response): Promise<{ payload: unknown; isJson: boolean }> {
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
  }

  private extractErrorCode(payload: unknown, status: number): string {
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (typeof record['code'] === 'string' && record['code']) {
        return record['code'];
      }
      if (typeof record['error'] === 'string' && record['error']) {
        return record['error'];
      }
    }

    return `HTTP_${status}`;
  }

  private extractErrorMessage(payload: unknown, status: number): string {
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (typeof record['message'] === 'string' && record['message']) {
        return record['message'];
      }
      if (typeof record['detail'] === 'string' && record['detail']) {
        return record['detail'];
      }
      if (typeof record['raw'] === 'string' && record['raw']) {
        return record['raw'];
      }
    }

    return `Request failed with HTTP ${status}.`;
  }

  private extractErrorDetails(payload: unknown): Record<string, unknown> | undefined {
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }

    return undefined;
  }

}
