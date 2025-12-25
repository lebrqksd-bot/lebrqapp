/**
 * Rack API Functions
 */
import { CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = CONFIG.API_BASE_URL.replace(/\/$/, '');

// Default timeout for all API requests (15 seconds - reduced for faster failure detection)
const DEFAULT_TIMEOUT = 15000;

async function http<T>(path: string, init?: RequestInit, useAdminToken: boolean = false, timeout: number = DEFAULT_TIMEOUT): Promise<T> {
  const url = `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  
  // For admin endpoints, use admin_token; for public endpoints, use auth.token
  let token: string | null = null;
  if (useAdminToken) {
    token = await AsyncStorage.getItem('admin_token').catch(() => null);
  } else {
    token = await AsyncStorage.getItem('auth.token').catch(() => null);
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
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
    return res.json() as Promise<T>;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle timeout errors
    if (error.name === 'AbortError') {
      const timeoutErr = new Error('Request timeout: Server is taking too long to respond. Please try again.');
      (timeoutErr as any).details = { error: 'Request timeout' };
      (timeoutErr as any).status = 0;
      throw timeoutErr;
    }
    
    // Handle network errors (fetch failures, CORS, etc.)
    if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.name === 'TypeError') {
      const networkErr = new Error('Network error: Unable to connect to server. Please check your internet connection.');
      (networkErr as any).details = { error: 'Network connection failed' };
      (networkErr as any).status = 0;
      throw networkErr;
    }
    throw error;
  }
}

export type RackProduct = {
  id: number;
  rack_id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  images?: string[]; // Multiple images
  videos?: string[]; // Multiple videos
  price: number;
  stock_quantity: number;
  delivery_time?: string | null;
  category?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Rack = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  location?: string | null;
  category_name?: string | null;
  category_image_url?: string | null;
  qr_code_url?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  products: RackProduct[];
};

export const RacksAPI = {
  // Public endpoints
  list: (active_only: boolean = true) => http<Rack[]>(`/racks?active_only=${active_only}`),
  get: (rackId: number) => http<Rack>(`/racks/${rackId}`),
  getByCode: (code: string) => http<Rack>(`/racks/code/${code}`),
  getAllProducts: (active_only: boolean = true, status_filter: string = 'active') => 
    http<RackProduct[]>(`/racks/products/all?active_only=${active_only}&status_filter=${status_filter}`),
  
  // Admin endpoints (use admin_token)
  create: (data: { name: string; code: string; description?: string; location?: string; category_name?: string; category_image_url?: string; active?: boolean }) =>
    http<Rack>('/racks/admin', { method: 'POST', body: JSON.stringify(data) }, true),
  update: (rackId: number, data: Partial<{ name: string; code: string; description?: string; location?: string; category_name?: string; category_image_url?: string; active?: boolean }>) =>
    http<Rack>(`/racks/admin/${rackId}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  delete: (rackId: number) => http<void>(`/racks/admin/${rackId}`, { method: 'DELETE' }, true),
  generateQR: (rackId: number) => http<{ success: boolean; qr_code_url: string; qr_code_base64: string; rack_url: string; existing?: boolean }>(`/racks/admin/${rackId}/generate-qr`, { method: 'POST' }, true),
  
  // Product management (use admin_token)
  addProduct: (rackId: number, data: {
    name: string;
    description?: string;
    image_url?: string;
    images?: string[];
    videos?: string[];
    price: number;
    stock_quantity?: number;
    delivery_time?: string;
    category?: string;
    status?: string;
  }) => http<RackProduct>(`/racks/admin/${rackId}/products`, { method: 'POST', body: JSON.stringify(data) }, true),
  
  updateProduct: (productId: number, data: Partial<{
    name: string;
    description?: string;
    image_url?: string;
    images?: string[];
    videos?: string[];
    price: number;
    stock_quantity?: number;
    delivery_time?: string;
    category?: string;
    status?: string;
  }>) => http<RackProduct>(`/racks/admin/products/${productId}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  
  deleteProduct: (productId: number) => http<void>(`/racks/admin/products/${productId}`, { method: 'DELETE' }, true),
  
  // Get or create default rack (admin only)
  getDefaultRack: () => http<Rack>('/racks/admin/default-rack', {}, true),
};

