import type { ApiResponse } from '../types';
import { apiRequest } from './apiClient';

interface HealthStatus {
  status: string;
  details?: {
    service?: string;
    mode?: string;
  };
}

class GatewayService {
  async healthCheck(): Promise<ApiResponse<HealthStatus>> {
    return apiRequest<HealthStatus>('gateway', '/api/v1/health');
  }
}

export const gatewayService = new GatewayService();
