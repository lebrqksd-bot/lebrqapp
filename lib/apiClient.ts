/**
 * API Client with Standardized Error Handling
 * 
 * Automatically handles server responses and displays notifications
 * Integrates with the notification system to show server messages
 * 
 * Usage:
 * const result = await apiClient.post('/bookings', data);
 * if (result.success) {
 *   // Success case handled automatically with notification
 *   console.log(result.data);
 * }
 */

import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  code?: string;
  data?: T;
  meta?: Record<string, any>;
  errors?: Array<{ field: string; message: string }>;
}

export interface APIClientOptions {
  showSuccessNotification?: boolean;
  showErrorNotification?: boolean;
  customHeaders?: Record<string, string>;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = CONFIG.API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth.token');
    } catch {
      return null;
    }
  }

  private async buildHeaders(customHeaders?: Record<string, string>): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(
    response: Response,
    options: APIClientOptions = {}
  ): Promise<APIResponse<T>> {
    let data: APIResponse<T>;

    try {
      data = await response.json();
    } catch {
      // If response is not JSON, create error response
      data = {
        success: false,
        message: response.ok
          ? 'Invalid response from server'
          : `Server error: ${response.statusText}`,
        code: 'INVALID_RESPONSE',
      };
    }

    // Log for debugging
    if (!response.ok) {
      console.error('[API Error]', {
        url: response.url,
        status: response.status,
        data,
      });
    }

    return data;
  }

  async get<T = any>(
    endpoint: string,
    options: APIClientOptions = {}
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), 15000); // 15 second timeout - reduced for faster failure detection
    
    try {
      const headers = await this.buildHeaders(options.customHeaders);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response, options);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Request timeout: Server is taking too long to respond. Please try again.',
          code: 'TIMEOUT_ERROR',
        };
      }
      console.error('[API GET Error]', error);
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  async post<T = any>(
    endpoint: string,
    body: any,
    options: APIClientOptions = {}
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), 15000); // 15 second timeout - reduced for faster failure detection
    
    try {
      const headers = await this.buildHeaders(options.customHeaders);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response, options);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Request timeout: Server is taking too long to respond. Please try again.',
          code: 'TIMEOUT_ERROR',
        };
      }
      console.error('[API POST Error]', error);
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  async put<T = any>(
    endpoint: string,
    body: any,
    options: APIClientOptions = {}
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), 15000); // 15 second timeout - reduced for faster failure detection
    
    try {
      const headers = await this.buildHeaders(options.customHeaders);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response, options);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Request timeout: Server is taking too long to respond. Please try again.',
          code: 'TIMEOUT_ERROR',
        };
      }
      console.error('[API PUT Error]', error);
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  async delete<T = any>(
    endpoint: string,
    options: APIClientOptions = {}
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), 15000); // 15 second timeout - reduced for faster failure detection
    
    try {
      const headers = await this.buildHeaders(options.customHeaders);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response, options);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Request timeout: Server is taking too long to respond. Please try again.',
          code: 'TIMEOUT_ERROR',
        };
      }
      console.error('[API DELETE Error]', error);
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Upload file with multipart/form-data
   */
  async upload<T = any>(
    endpoint: string,
    formData: FormData,
    options: APIClientOptions = {}
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), 60000); // 60 second timeout for uploads
    
    try {
      const token = await this.getAuthToken();
      const headers: HeadersInit = {
        ...options.customHeaders,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Don't set Content-Type for FormData - browser will set it automatically with boundary

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response, options);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Upload timeout: Server is taking too long to respond. Please try again.',
          code: 'TIMEOUT_ERROR',
        };
      }
      console.error('[API Upload Error]', error);
      return {
        success: false,
        message: 'Upload failed. Please try again.',
        code: 'UPLOAD_ERROR',
      };
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for custom instances if needed
export default APIClient;

