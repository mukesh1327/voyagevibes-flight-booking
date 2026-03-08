import type {
  User,
  ApiResponse,
  EmailNotification,
  SMSNotification,
  PushNotification,
} from '../types';
import { apiRequest, getAuthContext } from './apiClient';

interface BackendUser {
  userId: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  mobileVerified?: boolean;
  preferences?: User['preferences'];
}

const toErrorResponse = <T>(response: ApiResponse<unknown>): ApiResponse<T> => ({
  success: false,
  error: response.error || {
    code: 'API_ERROR',
    message: 'Request failed',
  },
  timestamp: response.timestamp,
});

const mapBackendUser = (user: BackendUser): User => {
  const firstName = user.firstName || user.name?.split(' ')[0] || 'VoyageVibes';
  const lastName = user.lastName || user.name?.split(' ').slice(1).join(' ') || 'User';

  return {
    id: user.userId,
    email: user.email,
    firstName,
    lastName,
    phone: user.mobile,
    createdAt: new Date(),
    preferences: user.preferences,
  };
};

class UserService {
  async getMe(): Promise<ApiResponse<User>> {
    const response = await apiRequest<BackendUser>('customer', '/api/v1/users/me');

    if (!response.success || !response.data) {
      return toErrorResponse<User>(response);
    }

    return {
      success: true,
      data: mapBackendUser(response.data),
      timestamp: response.timestamp,
    };
  }

  async patchMe(updates: Partial<User>): Promise<ApiResponse<User>> {
    const response = await apiRequest<BackendUser>('customer', '/api/v1/users/me', {
      method: 'PATCH',
      body: {
        firstName: updates.firstName,
        lastName: updates.lastName,
        email: updates.email,
        mobile: updates.phone,
        preferences: updates.preferences,
      },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<User>(response);
    }

    return {
      success: true,
      data: mapBackendUser(response.data),
      timestamp: response.timestamp,
    };
  }

  async requestMobileVerification(_phone: string): Promise<ApiResponse<string>> {
    const response = await apiRequest<{ challengeId: string }>('customer', '/api/v1/users/me/mobile/verify/request', {
      method: 'POST',
    });

    if (!response.success || !response.data) {
      return toErrorResponse<string>(response);
    }

    return {
      success: true,
      data: response.data.challengeId,
      timestamp: response.timestamp,
    };
  }

  async confirmMobileVerification(requestId: string, otp: string): Promise<ApiResponse<boolean>> {
    const response = await apiRequest<{ verified: boolean }>('customer', '/api/v1/users/me/mobile/verify/confirm', {
      method: 'POST',
      body: { requestId, otp },
    });

    if (!response.success || !response.data) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: !!response.data.verified,
      timestamp: response.timestamp,
    };
  }

  async sendEmailNotification(payload: EmailNotification): Promise<ApiResponse<boolean>> {
    const response = await apiRequest<{ accepted: boolean }>('customer', '/api/v1/notifications/email', {
      method: 'POST',
      body: payload,
    });

    if (!response.success || !response.data) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: response.data.accepted,
      timestamp: response.timestamp,
    };
  }

  async sendSmsNotification(payload: SMSNotification): Promise<ApiResponse<boolean>> {
    const response = await apiRequest<{ accepted: boolean }>('customer', '/api/v1/notifications/sms', {
      method: 'POST',
      body: payload,
    });

    if (!response.success || !response.data) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: response.data.accepted,
      timestamp: response.timestamp,
    };
  }

  async sendPushNotification(payload: PushNotification): Promise<ApiResponse<boolean>> {
    const response = await apiRequest<{ accepted: boolean }>('customer', '/api/v1/notifications/push', {
      method: 'POST',
      body: payload,
    });

    if (!response.success || !response.data) {
      return toErrorResponse<boolean>(response);
    }

    return {
      success: true,
      data: response.data.accepted,
      timestamp: response.timestamp,
    };
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return this.getMe();
  }

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    const context = getAuthContext();
    if (updates.id) {
      localStorage.setItem('userId', updates.id);
    } else {
      localStorage.setItem('userId', context.userId);
    }
    return this.patchMe(updates);
  }
}

export const userService = new UserService();
