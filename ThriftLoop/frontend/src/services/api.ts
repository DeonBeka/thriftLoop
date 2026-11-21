import type {
  Conversation,
  CurrentUser,
  LocalImage,
  Message,
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

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; form?: FormData; query?: Query; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // fetch sets the multipart boundary itself
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), { method, headers, body, signal: controller.signal });
  } catch {
    throw new ApiError(
      `Can't reach ThriftLoop right now. Check your connection and that the server is running at ${API_URL}.`,
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
    if (response.status === 401 && token && options.auth !== false) onUnauthorized?.();
    throw new ApiError(detail, response.status);
  }
  return data as T;
}

function appendImage(form: FormData, field: string, image: LocalImage, index: number) {
  const name = image.fileName || `photo-${index}.jpg`;
  const type = image.mimeType || 'image/jpeg';
  // React Native's FormData accepts { uri, name, type } file descriptors and streams the file.
  form.append(field, { uri: image.uri, name, type } as unknown as Blob);
}

// ---------- Auth ----------
export const authApi = {
  register: (body: { username: string; email: string; password: string; confirm_password: string }) =>
    request<RegisterResponse>('POST', '/auth/register', { body, auth: false }),
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
  create: (input: ListingInput, images: LocalImage[]) => {
    const form = new FormData();
    Object.entries(input).forEach(([k, v]) => form.append(k, v));
    images.forEach((img, i) => appendImage(form, 'images', img, i));
    return request<Product>('POST', '/products', { form, timeoutMs: 60000 });
  },
  update: (
    id: number,
    input: Partial<ListingInput> & { status?: ProductStatus },
    keepImageIds?: number[],
    newImages: LocalImage[] = [],
  ) => {
    const form = new FormData();
    Object.entries(input).forEach(([k, v]) => v !== undefined && form.append(k, v));
    if (keepImageIds) form.append('keep_image_ids', keepImageIds.join(','));
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
