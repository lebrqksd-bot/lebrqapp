import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = CONFIG.API_BASE_URL.replace(/\/$/, '');

// Default timeout for all API requests (15 seconds - reduced for faster failure detection)
const DEFAULT_TIMEOUT = 15000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function http<T>(path: string, init?: RequestInit, timeout: number = DEFAULT_TIMEOUT): Promise<T> {
  const url = `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  // Try to get auth token, fallback to admin_token for admin users
  let token = await AsyncStorage.getItem('auth.token').catch(()=>null);
  if (!token) {
    token = await AsyncStorage.getItem('admin_token').catch(()=>null);
  }
  
  // Determine if the request is safe to auto-retry (GET/HEAD only)
  const method = (init?.method || 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  const maxRetries = canRetry ? 2 : 0; // retry twice for transient errors
  let attempt = 0;

  while (true) {
    // Create abort controller for timeout per attempt
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), timeout);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        // Parse JSON or text body for details
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }

        // Retry on transient server errors
        if (canRetry && [500, 502, 503, 504].includes(res.status) && attempt < maxRetries) {
          attempt += 1;
          const backoff = attempt === 1 ? 300 : 800; // ms
          await sleep(backoff);
          continue;
        }

        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      return res.json() as Promise<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Retry on timeout for safe methods
      if (canRetry && error?.name === 'AbortError' && attempt < maxRetries) {
        attempt += 1;
        const backoff = attempt === 1 ? 300 : 800;
        await sleep(backoff);
        continue;
      }

      // Handle timeout errors
      if (error?.name === 'AbortError' || error?.message === 'timeout') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      
      // Handle network errors (fetch failures, CORS, etc.)
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        if (canRetry && attempt < maxRetries) {
          attempt += 1;
          const backoff = attempt === 1 ? 300 : 800;
          await sleep(backoff);
          continue;
        }
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  }
}

// Programs API
export type Program = {
  id: number;
  title: string;
  description?: string | null;
  schedule?: string | null;
  price?: number | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | string;
  poster_url?: string | null;
  event_id?: number | null;
};

export const ProgramsAPI = {
  list: (params?: { q?: string; status?: string; sort?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.status) sp.set('status', params.status);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    const qs = sp.toString();
    return http<{ items: Program[]; limit: number; offset: number; count: number }>(`/programs${qs ? `?${qs}` : ''}`);
  },
  create: (payload: Partial<Program> & { title: string }) =>
    http<Program>('/programs', { method: 'POST', body: JSON.stringify(payload) }),
  get: (id: number) => http<Program>(`/programs/${id}`),
  update: (id: number, patch: Partial<Program>) =>
    http<Program>(`/programs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  approve: (id: number) => http<{ ok: boolean }>(`/programs/${id}/approve`, { method: 'POST' }),
  reject: (id: number) => http<{ ok: boolean }>(`/programs/${id}/reject`, { method: 'POST' }),
  remove: (id: number) => http<void>(`/programs/${id}`, { method: 'DELETE' }),
};

// Health
export const HealthAPI = {
  ping: () => http<{ status: string }>('/health'),
};

// Catalog Items
export type CatalogItem = {
  id: number;
  base_hours_included?: number;
  rate_per_extra_hour?: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  video_url?: string | null;
  profile_image_url?: string | null;
  profile_info?: string | null;
  performance_team_profile?: any; // JSON object with PerformanceTeamProfile structure
  category?: string | null;
  subcategory?: string | null;
  type?: string | null;
  space_id?: number | null;
  item_status?: string;
  preparation_time_minutes?: number;
};

export const ItemsAPI = {
  list: (params?: { main_category?: string; category?: string; subcategory?: string; item_type?: string; space_id?: number; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.main_category) sp.set('main_category', params.main_category);
    if (params?.category) sp.set('category', params.category);
    if (params?.subcategory) sp.set('subcategory', params.subcategory);
    if (params?.item_type) sp.set('item_type', params.item_type);
    if (params?.space_id != null) sp.set('space_id', String(params.space_id));
    if (params?.q) sp.set('q', params.q);
    const qs = sp.toString();
    return http<{ items: CatalogItem[]; count: number }>(`/items${qs ? `?${qs}` : ''}`);
  },
};

// Item Media API (for both admin and vendor)
// Upload API for images and videos
export const UploadAPI = {
  uploadImage: async (file: File | { uri: string; name?: string; type?: string }, onProgress?: (progress: number) => void): Promise<{ url: string; path: string }> => {
    const url = `${BASE}/uploads/image`;
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;

    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      // React Native file object
      formData.append('file', file as any);
    }

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Upload failed: ${errorText}`);
      }

      return await res.json();
    } catch (error: any) {
      throw new Error(`Image upload failed: ${error.message || 'Unknown error'}`);
    }
  },
  uploadVideo: async (file: File | { uri: string; name?: string; type?: string }, onProgress?: (progress: number) => void): Promise<{ url: string; path: string }> => {
    const url = `${BASE}/uploads/video`;
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;

    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      // React Native file object
      formData.append('file', file as any);
    }

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Upload failed: ${errorText}`);
      }

      return await res.json();
    } catch (error: any) {
      throw new Error(`Video upload failed: ${error.message || 'Unknown error'}`);
    }
  },
};

export const ItemMediaAPI = {
  getItemMedia: async (itemId: number) => {
    const url = `${BASE}/items/${itemId}/media`;
    // Try admin_token first (for admin), then auth.token (for vendor)
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      
      return res.json() as Promise<{ media: Array<{ id: number; media_type: 'image' | 'video'; file_url: string; file_path: string; is_primary: boolean; display_order: number; title?: string | null; description?: string | null }> }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
  uploadItemMedia: async (itemId: number, files: File[] | FormData | any[], mediaType: 'image' | 'video') => {
    const url = `${BASE}/items/${itemId}/media/upload`;
    // Try admin_token first (for admin), then auth.token (for vendor)
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;
    
    let formData: FormData;
    if (files instanceof FormData) {
      formData = files;
      if (!formData.has('media_type')) {
        formData.append('media_type', mediaType);
      }
    } else {
      formData = new FormData();
      files.forEach((file: File | any) => {
        formData.append('files', file);
      });
      formData.append('media_type', mediaType);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads
    
    try {
      // Use fetch directly for FormData - DO NOT set Content-Type header
      // The browser will set it automatically with the boundary parameter
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers, // IMPORTANT: Do NOT set Content-Type for FormData
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      
      return res.json() as Promise<{ message: string; media: Array<{ id: number; media_type: string; file_url: string; file_path: string; is_primary: boolean; display_order: number }> }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Upload timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
  deleteItemMedia: async (itemId: number, mediaId: number) => {
    const url = `${BASE}/items/${itemId}/media/${mediaId}`;
    // Try admin_token first (for admin), then auth.token (for vendor)
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      
      return res.json() as Promise<{ message: string; id: number }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
  setPrimaryMedia: async (itemId: number, mediaId: number) => {
    const url = `${BASE}/items/${itemId}/media/${mediaId}/primary`;
    // Try admin_token first (for admin), then auth.token (for vendor)
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      
      return res.json() as Promise<{ message: string; media: { id: number; is_primary: boolean } }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
  reorderItemMedia: async (itemId: number, mediaIds: number[]) => {
    const url = `${BASE}/items/${itemId}/media/reorder`;
    // Try admin_token first (for admin), then auth.token (for vendor)
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;
    const formData = new FormData();
    mediaIds.forEach(id => formData.append('media_ids', String(id)));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers, // Do NOT set Content-Type for FormData
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      
      return res.json() as Promise<{ message: string }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
  updateItemMedia: async (itemId: number, mediaId: number, data: { title?: string; description?: string }) => {
    const url = `${BASE}/items/${itemId}/media/${mediaId}`;
    // Try admin_token first (for admin), then auth.token (for vendor)
    const adminToken = await AsyncStorage.getItem('admin_token').catch(() => null);
    const vendorToken = await AsyncStorage.getItem('auth.token').catch(() => null);
    const token = adminToken || vendorToken;
    const formData = new FormData();
    if (data.title !== undefined) formData.append('title', data.title);
    if (data.description !== undefined) formData.append('description', data.description);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers, // Do NOT set Content-Type for FormData
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      
      return res.json() as Promise<{ message: string; media: { id: number; title?: string | null; description?: string | null } }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
};

// Auth
export const AuthAPI = {
  login: async (username: string, password: string) => {
    const r = await http<{ access_token: string }>(`/auth/login`, { method: 'POST', body: JSON.stringify({ username, password }) });
    await AsyncStorage.setItem('auth.token', r.access_token);
    return r;
  },
  sendOTP: async (mobile: string) => {
    // Add timeout to prevent hanging on OTP send
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout for OTP
    
    try {
      const url = `${BASE}/users/otp/send`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      return res.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: OTP service is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      // Handle network errors
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
  verifyOTP: async (mobile: string, otp: string) => {
    return http<{ success: boolean; message: string; mobile?: string }>(`/users/otp/verify`, { method: 'POST', body: JSON.stringify({ mobile, otp }) });
  },
  me: () =>
    http<{
      id: number;
      username: string;
      role: string;
      first_name?: string | null;
      last_name?: string | null;
      mobile?: string | null;
      last_login_time?: string | null;
      last_logout_time?: string | null;
    }>(`/auth/me`),
  logout: async () => {
    try {
      await http(`/auth/logout`, { method: 'POST' });
    } catch {
      // ignore network/API errors during logout
    }
    await AsyncStorage.removeItem('auth.token');
  },
  register: async (username: string, password: string, first_name?: string | null, last_name?: string | null, mobile?: string | null, role?: 'customer' | 'vendor' | 'broker', mobile_verified?: boolean) => {
    const r = await http<{ id: number; username: string; access_token?: string; requires_approval?: boolean; message?: string }>(`/users/register`, { method: 'POST', body: JSON.stringify({ username, password, first_name, last_name, mobile, role, mobile_verified }) });
    if (r?.access_token) {
      await AsyncStorage.setItem('auth.token', r.access_token);
    }
    return r;
  },
  resetPassword: async (mobile: string, otp: string, newPassword: string) => {
    return http<{ success: boolean; message: string }>(`/users/reset-password`, { method: 'POST', body: JSON.stringify({ mobile, otp, new_password: newPassword }) });
  },
};

// Bookings
export type Booking = {
  id: number;
  booking_reference: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  total_amount: number;
  space_id?: number;
  venue_id?: number;
};

export type BookingDetail = Booking & {
  venue_name?: string;
  space_name?: string;
  attendees?: number;
  booking_type?: string;
  event_type?: string;
  customer_note?: string;
  admin_note?: string;
  items?: Array<{
    id: number;
    item_id: number;
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
};

export const BookingsAPI = {
  listMine: async (status?: string, fromDate?: string, toDate?: string) => {
    // Build query parameters
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    const queryString = params.toString();
    // Backend returns { items, pagination }. Map to items for existing UI.
    const res = await http<{ items: Booking[]; pagination: { total: number; page: number; page_size: number; total_pages: number } }>(`/bookings${queryString ? `?${queryString}` : ''}`);
    return Array.isArray((res as any)?.items) ? res.items : ([] as Booking[]);
  },
  getDetail: (id: number) => http<BookingDetail>(`/bookings/${id}`),
  getPaymentHistory: (id: number) => http<{
    payments: Array<{
      id: number;
      amount: number;
      currency: string;
      provider: string | null;
      provider_payment_id: string | null;
      order_id: string | null;
      status: string;
      paid_at: string | null;
      created_at: string;
      details: any;
    }>;
    refunds: Array<{
      id: number;
      amount: number;
      reason: string | null;
      status: string;
      refund_type: string | null;
      refund_method: string | null;
      refund_reference: string | null;
      processed_at: string | null;
      created_at: string;
      notes: string | null;
    }>;
    total_paid: number;
    total_refunded: number;
    pending_refunds: number;
  }>(`/bookings/${id}/payment-history`),
  cancel: (id: number) => http<{ ok: boolean; status: string }>(`/bookings/${id}/cancel`, { method: 'POST' }),
  update: (id: number, patch: Partial<Pick<Booking, 'start_datetime' | 'end_datetime'> & { attendees: number }>) =>
    http<{ ok: boolean }>(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  createSeries: (payload: {
    space_id: number;
    start_datetime: string;
    end_datetime: string;
    num_days?: number;
    excluded_weekdays?: number[];
    attendees?: number;
    booking_type?: string;
    event_type?: string;
    items?: { item_id: number; quantity?: number }[];
    customer_note?: string;
  }) => http<{ ok: boolean; series_reference: string; created_count: number; skipped_count: number; created: any[]; skipped: any[]; message?: string }>(`/bookings/series`, { method: 'POST', body: JSON.stringify(payload) }),
  downloadInvoice: async (bookingId: number) => {
    if (typeof window === 'undefined') {
      throw new Error('PDF download is only available on web platform');
    }
    
    const url = `${BASE}/bookings/${bookingId}/invoice`;
    const token = await AsyncStorage.getItem('auth.token').catch(() => null) || await AsyncStorage.getItem('admin_token').catch(() => null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
      }
      
      // Check if response is PDF
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        // Clone the response before reading to avoid "body already read" error
        const clonedRes = res.clone();
        const text = await clonedRes.text().catch(() => '');
        throw new Error(`Expected PDF but got ${contentType}${text ? `: ${text.substring(0, 100)}` : ''}`);
      }
      
      // Download PDF
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const contentDisposition = res.headers.get('content-disposition');
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || `invoice_${bookingId}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      return { success: true };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Server is taking too long to respond');
      }
      throw error;
    }
  },
};

// Vendor
export const VendorAPI = {
  profile: () => http(`/vendor/profile`),
  items: () => http<{ items: CatalogItem[]; count: number }>(`/vendor/items`),
  createItem: (form: {
    name: string;
    price: number;
    category?: string | null;
    subcategory?: string | null;
    item_type?: string | null;
    description?: string | null;
    image_url?: string | null;
    space_id?: number | null;
    available?: boolean;
    item_status?: string;
    preparation_time_minutes?: number;
    performance_team_profile?: string;
  }) => {
    const body = new URLSearchParams();
    body.set('name', form.name);
    body.set('price', String(form.price));
    if (form.category != null) body.set('category', form.category);
    if (form.subcategory != null) body.set('subcategory', form.subcategory);
    if (form.item_type != null) body.set('item_type', form.item_type);
    if (form.description != null) body.set('description', form.description);
    if (form.image_url != null) body.set('image_url', form.image_url);
    if (form.space_id != null) body.set('space_id', String(form.space_id));
    if (form.available != null) body.set('available', String(form.available));
    if (form.item_status != null) body.set('item_status', form.item_status);
    if (form.preparation_time_minutes != null) body.set('preparation_time_minutes', String(form.preparation_time_minutes));
    if (form.performance_team_profile != null) body.set('performance_team_profile', form.performance_team_profile);
    return http<{ ok: boolean; id: number }>(`/vendor/items`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  },
  updateItem: (id: number, form: Partial<{
    name: string;
    price: number;
    category: string | null;
    subcategory: string | null;
    item_type: string | null;
    description: string | null;
    image_url: string | null;
    space_id: number | null;
    available: boolean;
    item_status?: string;
    preparation_time_minutes?: number;
    performance_team_profile?: string;
  }>) => {
    const body = new URLSearchParams();
    if (form.name != null) body.set('name', form.name);
    if (form.price != null) body.set('price', String(form.price));
    if (form.category !== undefined) body.set('category', String(form.category ?? ''));
    if (form.subcategory !== undefined) body.set('subcategory', String(form.subcategory ?? ''));
    if (form.item_type !== undefined) body.set('item_type', String(form.item_type ?? ''));
    if (form.description !== undefined) body.set('description', String(form.description ?? ''));
    if (form.image_url !== undefined) body.set('image_url', String(form.image_url ?? ''));
    if (form.space_id !== undefined) body.set('space_id', String(form.space_id ?? ''));
    if (form.available !== undefined) body.set('available', String(form.available));
    if (form.item_status !== undefined) body.set('item_status', String(form.item_status ?? ''));
    if (form.preparation_time_minutes !== undefined) body.set('preparation_time_minutes', String(form.preparation_time_minutes ?? '0'));
    if (form.performance_team_profile !== undefined) body.set('performance_team_profile', form.performance_team_profile);
    return http<{ ok: boolean }>(`/vendor/items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  },
  deleteItem: (id: number) => http<{ ok: boolean }>(`/vendor/items/${id}`, { method: 'DELETE' }),
  orders: () => http<any[]>(`/vendor/orders`),
  markSupplied: (bookingItemId: number) => http<{ ok: boolean; is_supplied: boolean }>(`/vendor/orders/${bookingItemId}/supplied`, { method: 'POST' }),
  acceptOrder: (bookingItemId: number) => http<{ ok: boolean; status: string }>(`/vendor/orders/${bookingItemId}/accept`, { method: 'POST' }),
  // Payment & Settlement APIs
  getPaymentSummary: (params?: { period?: string; include_unverified?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.period) sp.set('period', params.period);
    if (params?.include_unverified !== undefined) sp.set('include_unverified', String(params.include_unverified));
    const qs = sp.toString();
    return http<any>(`/vendor/payments/summary${qs ? `?${qs}` : ''}`);
  },
  downloadInvoice: async (params?: { period?: string; include_unverified?: boolean; settled_only?: boolean; booking_id?: number }) => {
    if (typeof window === 'undefined') {
      throw new Error('PDF download is only available on web platform');
    }
    
    const sp = new URLSearchParams();
    if (params?.period) sp.set('period', params.period);
    if (params?.include_unverified !== undefined) sp.set('include_unverified', String(params.include_unverified));
    if (params?.settled_only !== undefined) sp.set('settled_only', String(params.settled_only));
    if (params?.booking_id !== undefined) sp.set('booking_id', String(params.booking_id));
    sp.set('format', 'pdf');
    const qs = sp.toString();
    const url = `${BASE}/vendor/payments/invoice${qs ? `?${qs}` : ''}`;
    const token = await AsyncStorage.getItem('auth.token').catch(() => null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error('Invoice download error:', errorText);
        throw new Error(`HTTP ${res.status}: ${errorText || 'Failed to download invoice'}`);
      }
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `invoice_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      return { ok: true };
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  },
  rejectOrder: async (bookingItemId: number, reason: string) => {
    const formData = new FormData();
    formData.append('reason', reason);
    const url = `${BASE}/vendor/orders/${bookingItemId}/reject`;
    const token = await AsyncStorage.getItem('auth.token').catch(() => null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const headers: HeadersInit = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers, // Do NOT set Content-Type for FormData
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        let details: any = null;
        try {
          details = await res.json();
        } catch (e) {
          details = await res.text().catch(() => '');
        }
        const err = new Error(`HTTP ${res.status}: ${JSON.stringify(details)}`);
        (err as any).details = details;
        (err as any).status = res.status;
        throw err;
      }
      return res.json() as Promise<{ ok: boolean; status: string; reason?: string }>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
        (timeoutErr as any).details = { error: 'Request timeout' };
        (timeoutErr as any).status = 0;
        throw timeoutErr;
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
        (networkErr as any).details = { error: 'Network connection failed' };
        (networkErr as any).status = 0;
        throw networkErr;
      }
      throw error;
    }
  },
};

// Notifications
export const NotificationsAPI = {
  unreadCount: () => http<{ unread_count: number }>(`/notifications/count`),
};

// Advance Payment Settings
export type AdvancePaymentSettings = {
  enabled: boolean;
  percentage?: number | null;
  fixed_amount?: number | null;
  type: 'percentage' | 'fixed';
};

export const PaymentSettingsAPI = {
  getAdvancePaymentSettings: async (): Promise<AdvancePaymentSettings> => {
    const token = await AsyncStorage.getItem('admin_token').catch(() => null);
    if (!token) {
      // Return defaults if not authenticated
      return { enabled: true, percentage: 50.0, fixed_amount: null, type: 'percentage' };
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${BASE}/payments/admin/settings/advance-payment`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Return defaults on error
        return { enabled: true, percentage: 50.0, fixed_amount: null, type: 'percentage' };
      }
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      // Return defaults on error (timeout or network error)
      return { enabled: true, percentage: 50.0, fixed_amount: null, type: 'percentage' };
    }
  },
  updateAdvancePaymentSettings: async (settings: AdvancePaymentSettings): Promise<{ success: boolean; message: string; settings: AdvancePaymentSettings }> => {
    const token = await AsyncStorage.getItem('admin_token').catch(() => null);
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${BASE}/payments/admin/settings/advance-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update settings' }));
        throw new Error(error.detail || 'Failed to update settings');
      }
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Server is taking too long to respond. Please try again.');
      }
      if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  },
};
