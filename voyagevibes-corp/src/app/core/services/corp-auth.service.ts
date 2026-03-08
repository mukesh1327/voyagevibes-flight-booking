import { Injectable, inject } from '@angular/core';

import type {
  ApiResult,
  CorpLoginInitRequest,
  CorpLoginInitResponse,
  CorpLoginVerifyRequest,
  CorpLoginVerifyResponse,
  CorpMfaChallengeRequest,
  CorpMfaChallengeResponse,
  CorpMfaVerifyRequest,
  CorpSessionResponse,
} from '../models/domain.models';
import { ApiClientService } from './api-client.service';
import { CorpSessionService } from './corp-session.service';

@Injectable({ providedIn: 'root' })
export class CorpAuthService {
  private readonly api = inject(ApiClientService);
  private readonly session = inject(CorpSessionService);

  initLogin(email: string): Promise<ApiResult<CorpLoginInitResponse>> {
    const request: CorpLoginInitRequest = {
      email,
      deviceInfo: this.session.createDeviceInfo(email),
    };

    return this.api.request<CorpLoginInitResponse>('auth', '/api/v1/auth/corp/login/init', {
      method: 'POST',
      body: request,
    });
  }

  verifyPrimaryFactor(request: CorpLoginVerifyRequest): Promise<ApiResult<CorpLoginVerifyResponse>> {
    return this.api.request<CorpLoginVerifyResponse>('auth', '/api/v1/auth/corp/login/verify', {
      method: 'POST',
      body: request,
    }).then((result) => {
      if (result.success && result.data?.session) {
        this.session.setSession({
          tokens: result.data.session.tokens,
          user: result.data.session.user,
          mfaLevel: result.data.session.mfaLevel,
          profileStatus: result.data.session.profileStatus,
        });
      }

      return result;
    });
  }

  challengeMfa(request: CorpMfaChallengeRequest): Promise<ApiResult<CorpMfaChallengeResponse>> {
    return this.api.request<CorpMfaChallengeResponse>('auth', '/api/v1/auth/corp/mfa/challenge', {
      method: 'POST',
      body: request,
    });
  }

  async verifyMfa(request: CorpMfaVerifyRequest): Promise<ApiResult<CorpSessionResponse>> {
    const result = await this.api.request<CorpSessionResponse>('auth', '/api/v1/auth/corp/mfa/verify', {
      method: 'POST',
      body: request,
      headers: {
        'X-Device': this.session.createDeviceInfo(this.session.session()?.user.email || 'staff@airline.com').deviceId,
        'X-Forwarded-For': '127.0.0.1',
      },
    });

    if (result.success && result.data) {
      this.session.setSession({
        tokens: result.data.tokens,
        user: result.data.user,
        mfaLevel: result.data.mfaLevel,
        profileStatus: result.data.profileStatus,
      });
    }

    return result;
  }

  async logout(): Promise<void> {
    await this.api.request('auth', '/api/v1/auth/corp/logout', {
      method: 'POST',
      body: {
        refreshToken: this.session.session()?.tokens.refreshToken || '',
        allSessions: true,
      },
    });
    this.session.clearSession();
  }
}
