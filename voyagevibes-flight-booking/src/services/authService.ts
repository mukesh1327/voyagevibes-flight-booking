import type {
  User,
  ApiResponse,
  AuthSessionResponse,
  GoogleOAuthStartResponse,
  GoogleOAuthCallbackRequest,
} from '../types';
import { apiRequest, getAuthContext } from './apiClient';

interface BackendMeResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile?: string;
}

const toErrorResponse = <T>(response: ApiResponse<unknown>): ApiResponse<T> => ({
  success: false,
  error: response.error || {
    code: 'API_ERROR',
    message: 'Request failed',
  },
  timestamp: response.timestamp,
});

const meToUser = (me: BackendMeResponse): User => ({
  id: me.userId,
  email: me.email,
  firstName: me.firstName,
  lastName: me.lastName,
  phone: me.mobile,
  createdAt: new Date(),
});

class AuthService {
  private persistSession(session: AuthSessionResponse): void {
    localStorage.setItem('token', session.tokens.accessToken);
    localStorage.setItem('refreshToken', session.tokens.refreshToken);
    localStorage.setItem('userId', session.user.userId);
    localStorage.setItem('actorType', 'customer');
  }

  async logout(): Promise<ApiResponse<boolean>> {
    const context = getAuthContext();
    const refreshToken = localStorage.getItem('refreshToken') || '';

    const response = await apiRequest<unknown>('auth', '/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'X-User-Id': context.userId,
      },
      body: {
        refreshToken,
        allSessions: true,
      },
    });

    if (!response.success) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: true,
      timestamp: response.timestamp,
    };
  }

  async startGoogleOAuth(): Promise<ApiResponse<GoogleOAuthStartResponse>> {
    return apiRequest<GoogleOAuthStartResponse>('auth', '/api/v1/auth/public/google/start');
  }

  async handleGoogleCallback(request: GoogleOAuthCallbackRequest): Promise<ApiResponse<AuthSessionResponse>> {
    const response = await apiRequest<AuthSessionResponse>('auth', '/api/v1/auth/public/google/callback', {
      query: {
        code: request.code,
        state: request.state,
      },
      disableFallback: true,
      headers: {
        'X-Code-Verifier': request.codeVerifier || '',
        'X-Device': request.device || navigator.userAgent,
        'X-Forwarded-For': request.ip || '127.0.0.1',
      },
    });

    if (response.success && response.data) {
      this.persistSession(response.data);
    }

    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await apiRequest<BackendMeResponse>('customer', '/api/v1/users/me');

    if (!response.success || !response.data) {
      return toErrorResponse<User>(response);
    }

    return {
      success: true,
      data: meToUser(response.data),
      timestamp: response.timestamp,
    };
  }

  async updateProfile(user: Partial<User>): Promise<ApiResponse<User>> {
    const response = await apiRequest<BackendMeResponse>('customer', '/api/v1/users/me', {
      method: 'PATCH',
      body: {
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.phone,
      },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<User>(response);
    }

    return {
      success: true,
      data: meToUser(response.data),
      timestamp: response.timestamp,
    };
  }
}

export const authService = new AuthService();
