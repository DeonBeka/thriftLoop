import type {
  AssistantFilters,
  AssistantReply,
  AdminStats,
  AdminUser,
  Order,
  SellerApplication,
  Conversation,
  CurrentUser,
  IdDocumentType,
  LocalImage,
  Message,
  PhotoAngle,
  Product,
  ProductFilters,
  ProductList,
  ProductStatus,
  RegisterResponse,
  TokenResponse,
  UserProfile,
} from '@/types';

import { API_URL } from './config';
import { getToken } from './storage';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Unauthorized = () => void;
let onUnauthorized: Unauthorized | null = null;
/** AuthProvider registers this so an expired token signs the user out everywhere. */
export function setUnauthorizedHandler(handler: Unauthorized | null) {
  onUnauthorized = handler;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${API_URL}${path}${params ? `?${params}` : ''}`;
}

interface SimpleResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
}

/** Multipart upload via React Native's native networking (supports local file URIs). */
function xhrUpload(method: string, url: string, headers: Record<string, string>, form: FormData, timeoutMs: number): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v)); // no Content-Type: XHR adds the boundary
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      const text = xhr.responseText ?? '';
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, text: async () => text });
    };
    xhr.onerror = () => reject(new Error('Upload failed: the connection dropped'));
    xhr.ontimeout = () => {
      const err = new Error('Upload timed out');
      err.name = 'AbortError';
      reject(err);
    };
    xhr.send(form);
  });
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; form?: FormData; query?: Query; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.body !== undefined && !options.form) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const url = buildUrl(path, options.query);
  const timeoutMs = options.timeoutMs ?? 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: SimpleResponse;
  // Photo uploads go through XMLHttpRequest: Expo's fetch doesn't understand React Native's
  // { uri, name, type } file parts, so multipart uploads with fetch never reach the server.
  const send = (): Promise<SimpleResponse> =>
    options.form
      ? xhrUpload(method, url, headers, options.form, timeoutMs)
      : fetch(url, { method, headers, body, signal: controller.signal });
  try {
    try {
      response = await send();
    } catch (first) {
      // iOS reuses idle keep-alive connections; if the server already closed one, a POST fails with
      // "The network connection was lost" before anything is sent. iOS retries GETs itself but not
      // POST/PUT, so retry once here. (Aborts/timeouts are not retried.)
      if (first instanceof Error && first.name === 'AbortError') throw first;
      await new Promise((r) => setTimeout(r, 350));
      response = await send();
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const reason = err instanceof Error ? err.message : String(err);
    // Shows up in the Expo terminal, so failed uploads are never silent.
    console.warn(`[api] ${method} ${path} failed before reaching the server: ${reason}`);
    throw new ApiError(
      aborted
        ? 'The request took too long. Check your connection and try again.'
        : `Can't reach ThriftLoop right now (${reason}). Check your connection and that the server is running at ${API_URL}.`,
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let data: any = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Something went wrong. Please try again.';
    if (response.status >= 500 || response.status === 413) console.warn(`[api] ${method} ${path} → ${response.status}: ${detail}`);
    if (response.status === 401 && token && options.auth !== false) onUnauthorized?.();
    throw new ApiError(detail, response.status);
  }
  return data as T;
}

function appendImage(form: FormData, field: string, image: LocalImage, index: number) {
  // Always send a sane filename + type: iOS can return HEIC names or no name at all, which some
  // networking stacks reject. The server re-encodes everything to JPEG anyway.
  const type = image.mimeType && image.mimeType.startsWith('image/') ? image.mimeType : 'image/jpeg';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const name = `photo-${index}.${ext}`;
  // React Native's FormData accepts { uri, name, type } file descriptors and streams the file.
  form.append(field, { uri: image.uri, name, type } as unknown as Blob);
}

// ---------- Auth ----------
export const authApi = {
  register: (body: { username: string; email: string; password: string; confirm_password: string; accept_terms: boolean }) =>
    request<RegisterResponse>('POST', '/auth/register', { body, auth: false }),
  acceptTerms: () => request<CurrentUser>('POST', '/auth/accept-terms'),
  verifyEmail: (email: string, code: string) =>
    request<TokenResponse>('POST', '/auth/verify-email', { body: { email, code }, auth: false }),
  resendCode: (email: string) => request<RegisterResponse>('POST', '/auth/resend-code', { body: { email }, auth: false }),
  login: (email: string, password: string) =>
    request<TokenResponse>('POST', '/auth/login', { body: { email, password }, auth: false }),
  me: () => request<CurrentUser>('GET', '/auth/me'),
};

// ---------- Products ----------
export interface ListingInput {
  title: string;
  description: string;
  price: string;
  category: string;
  size: string;
  condition: string;
}

export const productsApi = {
  list: (f: ProductFilters = {}) =>
    request<ProductList>('GET', '/products', {
      query: {
        q: f.q?.trim(),
        group: f.category ? undefined : f.group ?? undefined,
        category: f.category ?? undefined,
        size: f.sizes?.length ? f.sizes.join(',') : undefined,
        condition: f.conditions?.length ? f.conditions.join(',') : undefined,
        min_price: f.minPrice ?? undefined,
        max_price: f.maxPrice ?? undefined,
        sort: f.sort,
        seller_id: f.sellerId,
        exclude_own: f.excludeOwn,
        limit: f.limit,
        offset: f.offset,
      },
    }),
  get: (id: number) => request<Product>('GET', `/products/${id}`),
  create: (input: ListingInput, images: LocalImage[], angles?: (PhotoAngle | null | undefined)[]) => {
    const form = new FormData();
    Object.entries(input).forEach(([k, v]) => form.append(k, v));
    images.forEach((img, i) => appendImage(form, 'images', img, i));
    if (angles?.some(Boolean)) form.append('image_angles', angles.map((a) => a ?? '').join(','));
    return request<Product>('POST', '/products', { form, timeoutMs: 60000 });
  },
  update: (
    id: number,
    input: Partial<ListingInput> & { status?: ProductStatus },
    keepImageIds?: number[],
    newImages: LocalImage[] = [],
    /** One per photo: kept photos first (in keepImageIds order), then new ones. */
    angles?: (PhotoAngle | null | undefined)[],
  ) => {
    const form = new FormData();
    Object.entries(input).forEach(([k, v]) => v !== undefined && form.append(k, v));
    if (keepImageIds) form.append('keep_image_ids', keepImageIds.join(','));
    if (angles) form.append('image_angles', angles.map((a) => a ?? '').join(','));
    newImages.forEach((img, i) => appendImage(form, 'images', img, i));
    return request<Product>('PUT', `/products/${id}`, { form, timeoutMs: 60000 });
  },
  remove: (id: number) => request<void>('DELETE', `/products/${id}`),
};

// ---------- Favorites ----------
export const favoritesApi = {
  list: () => request<Product[]>('GET', '/favorites'),
  add: (productId: number) => request<{ is_favorited: boolean }>('POST', `/favorites/${productId}`),
  remove: (productId: number) => request<{ is_favorited: boolean }>('DELETE', `/favorites/${productId}`),
};

// ---------- Users ----------
export const usersApi = {
  get: (id: number) => request<UserProfile>('GET', `/users/${id}`),
  products: (id: number, status: ProductStatus | 'all' = 'active') =>
    request<Product[]>('GET', `/users/${id}/products`, { query: { status } }),
  updateMe: (input: { username?: string; bio?: string; image?: LocalImage | null; removeImage?: boolean }) => {
    const form = new FormData();
    if (input.username !== undefined) form.append('username', input.username);
    if (input.bio !== undefined) form.append('bio', input.bio);
    if (input.removeImage) form.append('remove_profile_image', 'true');
    if (input.image) appendImage(form, 'profile_image', input.image, 0);
    return request<CurrentUser>('PUT', '/users/me', { form, timeoutMs: 60000 });
  },
};

// ---------- Selling (verification) ----------
export interface SellerApplicationInput {
  full_name: string;
  phone: string;
  city: string;
  note?: string;
  selfie: LocalImage;
  /** Required: a photo of an ID card, driver's licence or passport. */
  idDocument: LocalImage;
  idDocumentType: IdDocumentType;
}

export const sellerApi = {
  mine: () => request<SellerApplication | null>('GET', '/seller-applications/me'),
  apply: (input: SellerApplicationInput) => {
    const form = new FormData();
    form.append('full_name', input.full_name);
    form.append('phone', input.phone);
    form.append('city', input.city);
    form.append('accept_seller_terms', 'true');
    if (input.note) form.append('note', input.note);
    appendImage(form, 'selfie', input.selfie, 0);
    appendImage(form, 'id_document', input.idDocument, 1);
    form.append('id_document_type', input.idDocumentType);
    return request<SellerApplication>('POST', '/seller-applications', { form, timeoutMs: 60000 });
  },
};

// ---------- Orders (cash on delivery) ----------
export interface OrderInput {
  product_id: number;
  delivery_name: string;
  phone: string;
  address_text: string;
  latitude?: number | null;
  longitude?: number | null;
  note?: string;
  accept_terms: boolean;
}

/** Same delivery details as a single order, for every item in the basket. */
export type BasketCheckoutInput = Omit<OrderInput, 'product_id'> & { product_ids: number[] };

export const ordersApi = {
  place: (body: OrderInput) => request<Order>('POST', '/orders', { body }),
  /** Orders everything at once; if any item is gone, nothing is ordered. */
  checkout: (body: BasketCheckoutInput) => request<Order[]>('POST', '/orders/checkout', { body }),
  list: (role: 'buyer' | 'seller' | 'all' = 'all') => request<Order[]>('GET', '/orders', { query: { role } }),
  get: (id: number) => request<Order>('GET', `/orders/${id}`),
  setStatus: (id: number, status: 'confirmed' | 'delivered' | 'cancelled') =>
    request<Order>('POST', `/orders/${id}/status`, { body: { status } }),
};

// ---------- Card payments (Stripe test mode) ----------
export interface CardCheckoutState {
  checkout_id: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  message: string | null;
  orders: Order[];
}

export const paymentsApi = {
  info: () => request<{ card_enabled: boolean; test_mode: boolean; test_card: string }>('GET', '/payments/info'),
  /** Starts a Stripe Checkout for the basket; returns the hosted card page to open. */
  startCard: (body: BasketCheckoutInput & { return_url: string }) =>
    request<{ checkout_id: number; url: string }>('POST', '/payments/card-checkout', { body, timeoutMs: 30000 }),
  /** Verifies with Stripe and returns the orders once paid. */
  cardStatus: (id: number) => request<CardCheckoutState>('GET', `/payments/card-checkout/${id}`, { timeoutMs: 30000 }),
};

// ---------- Admin ----------
export const adminApi = {
  stats: () => request<AdminStats>('GET', '/admin/stats'),
  applications: (status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') =>
    request<SellerApplication[]>('GET', '/admin/applications', { query: { status } }),
  application: (id: number) => request<SellerApplication>('GET', `/admin/applications/${id}`),
  approve: (id: number, note?: string) => request<SellerApplication>('POST', `/admin/applications/${id}/approve`, { body: { note } }),
  reject: (id: number, note: string) => request<SellerApplication>('POST', `/admin/applications/${id}/reject`, { body: { note } }),
  users: (q?: string) => request<AdminUser[]>('GET', '/admin/users', { query: { q } }),
  setRole: (id: number, role: 'viewer' | 'seller') => request<AdminUser>('PATCH', `/admin/users/${id}/role`, { body: { role } }),
  removeProduct: (id: number) => request<void>('DELETE', `/products/${id}`),
  /** Private verification photos need the admin's token, so they're loaded with headers. */
  selfieUrl: (id: number) => `${API_URL}/admin/applications/${id}/selfie`,
  idDocumentUrl: (id: number) => `${API_URL}/admin/applications/${id}/id-document`,
};

// ---------- AI shopping assistant ----------
export const assistantApi = {
  info: () => request<{ ai_enabled: boolean; provider: string | null; model: string | null }>('GET', '/assistant/info'),
  chat: (message: string, previous?: AssistantFilters | null) =>
    request<AssistantReply>('POST', '/assistant/chat', { body: { message, previous: previous ?? null }, timeoutMs: 30000 }),
};

// ---------- Messaging ----------
export const messagesApi = {
  conversations: () => request<Conversation[]>('GET', '/conversations'),
  conversation: (id: number) => request<Conversation>('GET', `/conversations/${id}`),
  start: (productId: number, message?: string) =>
    request<Conversation>('POST', '/conversations', { body: { product_id: productId, message } }),
  messages: (conversationId: number, afterId?: number) =>
    request<Message[]>('GET', `/conversations/${conversationId}/messages`, { query: { after_id: afterId } }),
  send: (conversationId: number, content: string) =>
    request<Message>('POST', `/conversations/${conversationId}/messages`, { body: { content } }),
};
