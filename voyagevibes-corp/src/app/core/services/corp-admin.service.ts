import { Injectable, inject } from '@angular/core';

import type {
  ApiResult,
  CorpRoleAssignmentRequest,
  CorpUserCreateRequest,
  CorpUserUpdateRequest,
} from '../models/domain.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class CorpAdminService {
  private readonly api = inject(ApiClientService);

  createUser(request: CorpUserCreateRequest): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', '/api/v1/corp/users', {
      method: 'POST',
      body: request,
    });
  }

  updateUser(userId: string, request: CorpUserUpdateRequest): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}`, {
      method: 'PATCH',
      body: request,
    });
  }

  enableUser(userId: string): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}/enable`, {
      method: 'POST',
    });
  }

  disableUser(userId: string): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}/disable`, {
      method: 'POST',
    });
  }

  assignRole(userId: string, request: CorpRoleAssignmentRequest): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}/roles`, {
      method: 'POST',
      body: request,
    });
  }

  removeRole(userId: string, roleId: string): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  forceMfaReset(userId: string): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}/force-mfa-reset`, {
      method: 'POST',
    });
  }

  revokeAllSessions(userId: string): Promise<ApiResult<void>> {
    return this.api.request<void>('auth', `/api/v1/corp/users/${userId}/session-revoke`, {
      method: 'POST',
    });
  }
}