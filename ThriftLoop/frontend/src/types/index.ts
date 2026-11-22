export type Category = 'Hoodies' | 'T-shirts' | 'Jackets' | 'Jeans' | 'Trousers' | 'Shoes' | 'Accessories';
export type Condition = 'New with tags' | 'Like new' | 'Good' | 'Fair';
export type ProductStatus = 'active' | 'reserved' | 'sold';
export type Role = 'viewer' | 'seller' | 'admin';
export type SellerStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';
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
  role: Role;
}

export interface CurrentUser extends UserProfile {
  email: string;
  is_verified: boolean;
  terms_accepted_at: string | null;
  seller_status: SellerStatus;
}

export interface AdminUser extends UserSummary {
  email: string;
  role: Role;
  created_at: string;
  active_listings_count: number;
  seller_status: SellerStatus;
}

export interface SellerApplication {
  id: number;
  status: Exclude<SellerStatus, 'none'>;
  full_name: string;
  phone: string;
  city: string;
  note: string | null;
  admin_note: string | null;
  has_id_document: boolean;
  id_document_type?: IdDocumentType | null;
  id_document_label?: string | null;
  created_at: string;
  reviewed_at: string | null;
  user: UserSummary;
  user_email: string | null;
}

export interface Order {
  id: number;
  product_id: number | null;
  product_title: string;
  product_image: string | null;
  price: number;
  payment_method: 'cash_on_delivery' | 'card';
  /** due = cash still to be paid on delivery; paid; refunded (card orders that were cancelled). */
  payment_status: 'due' | 'paid' | 'refunded';
  city: string | null;
  /** Delivery the buyer pays (free in Prishtina, €2 elsewhere; once per seller). */
  delivery_fee: number;
  /** What the buyer pays: price + delivery. */
  total: number;
  /** ThriftLoop's 10% of the price, taken from the seller's share. */
  commission: number;
  /** ThriftLoop's 5% of the delivery fee. */
  delivery_commission: number;
  /** What the seller keeps. */
  seller_payout: number;
  delivery_name: string;
  phone: string;
  address_text: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  buyer: UserSummary;
  seller: UserSummary;
}

export interface AdminStats {
  users: number;
  sellers: number;
  pending_applications: number;
  active_listings: number;
  open_orders: number;
  /** ThriftLoop's earnings (10% of prices + 5% of delivery) from delivered orders. */
  earned: number;
  /** Earnings from open orders, counted once they're delivered. */
  earned_pending: number;
  sales_volume: number;
  delivered_orders: number;
}

export interface Pricing {
  cities: string[];
  free_delivery_city: string;
  delivery_fee: number;
  commission_rate: number;
  delivery_commission_rate: number;
}

export type PhotoAngle = 'front' | 'back' | 'side';

/** Official photo IDs accepted for seller verification. */
export type IdDocumentType = 'id_card' | 'drivers_license' | 'passport';

export interface ProductImage {
  id: number;
  url: string;
  display_order: number;
  angle?: PhotoAngle | null;
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
  /** Colours seen in the main photo, e.g. ['black']. */
  photo_colors?: string[];
}

export interface ProductList {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export type Group = 'tops' | 'bottoms' | 'shoes' | 'accessories';

export interface AssistantFilters {
  colors: string[];
  groups: Group[];
  categories: Category[];
  sizes: string[];
  conditions: Condition[];
  min_price: number | null;
  max_price: number | null;
  keywords: string[];
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

export interface AssistantReply {
  reply: string;
  summary: string;
  filters: AssistantFilters;
  relaxed: 'price' | 'color' | null;
  engine: 'ai' | 'rules';
  products: Product[];
  suggestions: string[];
}

export interface ProductFilters {
  q?: string;
  group?: Group | null;
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
  /** False when the backend has email verification turned off; then the user is signed in right away. */
  verification_required: boolean;
  access_token: string | null;
  user: CurrentUser | null;
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
