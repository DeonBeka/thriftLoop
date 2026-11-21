export type Category = 'Hoodies' | 'T-shirts' | 'Jackets' | 'Jeans' | 'Trousers' | 'Shoes' | 'Accessories';
export type Condition = 'New with tags' | 'Like new' | 'Good' | 'Fair';
export type ProductStatus = 'active' | 'sold';
export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'popular';

export interface UserSummary {
  id: number;
  username: string;
  profile_image: string | null;
}

export interface UserProfile extends UserSummary {
  bio: string | null;
  created_at: string;
  active_listings_count: number;
  sold_count: number;
}

export interface CurrentUser extends UserProfile {
  email: string;
  is_verified: boolean;
}

export interface ProductImage {
  id: number;
  url: string;
  display_order: number;
}

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  category: Category;
  size: string;
  condition: Condition;
  status: ProductStatus;
  created_at: string;
  images: ProductImage[];
  seller: UserSummary;
  favorites_count: number;
  is_favorited: boolean;
}

export interface ProductList {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductFilters {
  q?: string;
  category?: Category | null;
  sizes?: string[];
  conditions?: Condition[];
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: SortOption;
  sellerId?: number;
  excludeOwn?: boolean;
  limit?: number;
  offset?: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface Conversation {
  id: number;
  created_at: string;
  buyer_id: number;
  seller_id: number;
  other_user: UserSummary;
  product: { id: number; title: string; price: number; status: ProductStatus; image_url: string | null } | null;
  last_message: Message | null;
  unread_count: number;
}

export interface RegisterResponse {
  message: string;
  email: string;
  expires_in_seconds: number;
  resend_available_in_seconds: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: CurrentUser;
}

/** A photo picked on the device (not uploaded yet). */
export interface LocalImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}
