import type { PaymentStatus, RefundStatus } from './common';

export interface DashboardPeriod {
  from: string;
  to: string;
}

export interface DashboardPaymentStats {
  total: number;
  created: number;
  pending: number;
  paid: number;
  failed: number;
  expired: number;
  cancelled: number;
  /**
   * Server-computed count of terminal unsuccessful payments
   * (FAILED + EXPIRED + CANCELLED). Optional until the backend
   * dashboard overview endpoint exposes it; clients fall back to
   * summing the per-status aggregates above.
   */
  unsuccessful_transactions?: number;
}

export interface DashboardRevenueStats {
  amount: number;
  currency: string;
}

export interface DashboardRefundStats {
  count: number;
  amount: number;
  currency: string;
}

export interface PaymentResponse {
  transaction_id: string;
  merchant_order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  provider?: string | null;
  provider_transaction_id?: string | null;
  payment_url?: string | null;
  status: PaymentStatus;
  expired_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type MockPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

/** Public DTO returned by the development mock payment provider. */
export interface MockPaymentResponse {
  /** Merchant order/reference supplied when the canonical payment was created. */
  reference: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: MockPaymentStatus;
  expired_at: string;
  provider_transaction_id: string;
  /** Present for QRIS payments; this is the exact value encoded in the QR. */
  qris_payload?: string | null;
}

export interface CreatePaymentRequest {
  merchant_order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
}

export interface CreatePaymentResponse {
  transaction_id: string;
  merchant_order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  provider: string;
  provider_transaction_id: string;
  status: PaymentStatus;
  payment_url?: string | null;
  expired_at?: string | null;
  created_at: string;
}


export interface DashboardOverviewResponse {
  period: DashboardPeriod;
  payments: DashboardPaymentStats;
  revenue: DashboardRevenueStats;
  refunds: DashboardRefundStats;
  recent_payments: PaymentResponse[];
}

export interface DashboardAnalyticsSummary {
  total_revenue: number;
  successful_payments: number;
  units_sold: number;
  /** Null when no order was paid in the selected period. */
  average_order_value: number | null;
}

export interface DashboardRevenueBucket {
  /** Bucket start as UTC calendar day (YYYY-MM-DD). */
  date: string;
  revenue: number;
}

export interface DashboardProductSales {
  /** Null for items whose catalog product was deleted. */
  product_id: string | null;
  /** Latest snapshot name; historical quantities/prices preserved. */
  product_name: string;
  units_sold: number;
  revenue: number;
}

export interface DashboardAnalyticsResponse {
  period: DashboardPeriod;
  /** "day" for windows up to 62 days, otherwise Monday-start "week". */
  interval: string;
  /** ISO currency of revenue figures (latest paid row, IDR when empty). */
  currency: string;
  summary: DashboardAnalyticsSummary;
  revenue_trend: DashboardRevenueBucket[];
  /** At most 5 rows, ranked by units sold. */
  top_products: DashboardProductSales[];
  /** Bounded rows, ranked by revenue descending. */
  revenue_by_product: DashboardProductSales[];
}

export interface DashboardTimelineEvent {
  type: string;
  at: string;
}

export interface DashboardPaymentDetailResponse extends PaymentResponse {
  timeline: DashboardTimelineEvent[];
  /**
   * Immutable order-item snapshots for order-backed payments, in canonical
   * item order. Omitted for payments without a linked order or resolvable
   * items. Snapshot values — never live catalog prices. Integer minor units.
   */
  order_items?: DashboardPaymentOrderItem[];
}

/** One purchased line as recorded at order creation time. */
export interface DashboardPaymentOrderItem {
  product_name: string;
  /** Unit price at purchase time, integer minor units. */
  unit_price: number;
  quantity: number;
  /** Stored unit_price × quantity, integer minor units. */
  subtotal: number;
}

export interface CreateRefundRequest {
  amount: number;
  currency: string;
  reason?: string;
}

export interface RefundResponse {
  refund_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  provider: string;
  provider_refund_id?: string | null;
  reason?: string | null;
  refunded_amount: number;
  reserved_refund_amount: number;
  refundable_amount: number;
  transaction_amount: number;
  requested_at: string;
  succeeded_at?: string | null;
  failed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type MerchantWebhookConfigStatus = 'ACTIVE' | 'DISABLED';

export interface MerchantWebhookConfigResponse {
  id: string;
  merchant_id: string;
  url: string;
  status: MerchantWebhookConfigStatus;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantWebhookConfigWithSecretResponse extends MerchantWebhookConfigResponse {
  /** One-time response only; never cache or persist this value. */
  secret: string;
}

export type MerchantWebhookDeliveryStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'FAILED'
  | 'DEAD';

export interface MerchantWebhookDeliveryResponse {
  id: string;
  merchant_id: string;
  event_id: string;
  event_type: string;
  transaction_id: string;
  endpoint_url: string;
  attempt_count: number;
  status: MerchantWebhookDeliveryStatus;
  next_attempt_at: string;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  last_http_status?: number | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export type MerchantAPIKeyStatus = 'ACTIVE' | 'REVOKED';

export interface MerchantAPIKeyResponse {
  id: string;
  merchant_id: string;
  name: string;
  key_id: string;
  status: MerchantAPIKeyStatus;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMerchantAPIKeyResponse {
  id: string;
  merchant_id: string;
  name: string;
  key_id: string;
  /** Returned only by create; do not persist or log. */
  secret: string;
  status: MerchantAPIKeyStatus;
  expires_at?: string | null;
  created_at: string;
}

export type ReconciliationResultStatus = 'MATCHED' | 'MISMATCH' | 'UNMATCHED';
export type ReconciliationResultType =
  | 'PAYMENT_MATCH'
  | 'REFUND_MATCH'
  | 'PAYMENT_NOT_FOUND'
  | 'REFUND_NOT_FOUND'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'REFUND_AMOUNT_MISMATCH'
  | 'PAYMENT_CURRENCY_MISMATCH'
  | 'REFUND_CURRENCY_MISMATCH'
  | 'UNEXPECTED_SETTLEMENT_ITEM'
  | 'UNSUPPORTED_ADJUSTMENT'
  | 'DUPLICATE_SETTLEMENT_ITEM';

export interface ReconciliationResult {
  id: string;
  settlement_id: string;
  settlement_item_id: string;
  reconciliation_run_id: string;
  transaction_id?: string | null;
  refund_id?: string | null;
  merchant_id?: string | null;
  result_type: ReconciliationResultType;
  expected_amount?: number;
  actual_amount?: number;
  expected_currency?: string | null;
  actual_currency?: string | null;
  difference_amount?: number;
  status: ReconciliationResultStatus;
  reason_code?: string | null;
  created_at: string;
  updated_at: string;
}

export type MerchantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type LegacyCredentialState = 'LEGACY' | 'MIGRATED' | 'LEGACY_DISABLED';

export interface DashboardMerchantSettingsResponse {
  id: string;
  name: string;
  code: string;
  status: MerchantStatus;
  created_at: string;
  updated_at: string;
  legacy_credential_state: LegacyCredentialState;
  legacy_credential_disabled_at?: string | null;
}

export type DashboardUserRole = 'OWNER' | 'ADMIN' | 'VIEWER';
export type DashboardUserStatus = 'ACTIVE' | 'DISABLED';

export interface DashboardUserResponse {
  id: string;
  merchant_id: string;
  email: string;
  role: DashboardUserRole;
  status: DashboardUserStatus;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: DashboardUserRole;
}

export interface CreateInvitationResponse {
  id: string;
  merchant_id: string;
  email: string;
  role: DashboardUserRole;
  status: 'PENDING';
  expires_at: string;
  created_at: string;
  /** One-time invitation token; never persist or log it. */
  token: string;
}

export interface InvitationMetadataResponse {
  email: string;
  role: DashboardUserRole;
  merchant_name: string;
  status: 'PENDING';
  expires_at: string;
}

export interface Category {
  id: string;
  merchant_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
}

export interface Product {
  id: string;
  merchant_id: string;
  category_id?: string | null;
  name: string;
  sku?: string | null;
  description?: string | null;
  /** Integer minor units (IDR: rupiah). Never floating point. */
  price: number;
  currency: string;
  /** Optional HTTPS reference for storefront display. Absent until backend migration 000023. */
  image_url?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  currency: string;
  sku?: string;
  description?: string;
  category_id?: string;
  image_url?: string;
  active?: boolean;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number;
  currency?: string;
  sku?: string;
  description?: string;
  category_id?: string;
  image_url?: string;
  active?: boolean;
}
