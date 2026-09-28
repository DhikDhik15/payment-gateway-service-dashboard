import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { PaymentStatus, RefundStatus, ReconciliationStatus, ReconciliationResultStatus, WebhookStatus, MerchantWebhookDeliveryStatus } from '@/types';

// ─── Variants ────────────────────────────────────────────────────────────────

const variantClasses = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  outline: 'border border-border text-foreground',
} as const;

export type BadgeVariant = keyof typeof variantClasses;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

// ─── Status Badges ────────────────────────────────────────────────────────────
// Centralised mapping — never hardcode status colors in pages.

const paymentStatusVariant: Record<PaymentStatus, BadgeVariant> = {
  CREATED: 'info',
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  EXPIRED: 'default',
  CANCELLED: 'default',
};

const refundStatusVariant: Record<RefundStatus, BadgeVariant> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
};

const reconciliationStatusVariant: Record<ReconciliationStatus | ReconciliationResultStatus, BadgeVariant> = {
  RECONCILED: 'success',
  MATCHED: 'success',
  MISMATCH: 'danger',
  UNMATCHED: 'warning',
};

const webhookStatusVariant: Record<WebhookStatus | MerchantWebhookDeliveryStatus, BadgeVariant> = {
  DELIVERED: 'success',
  PENDING: 'warning',
  RETRYING: 'info',
  FAILED: 'danger',
  PROCESSING: 'info',
  DEAD: 'danger',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={paymentStatusVariant[status]}>{status}</Badge>;
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return <Badge variant={refundStatusVariant[status]}>{status}</Badge>;
}

export function ReconciliationStatusBadge({ status }: { status: ReconciliationStatus | ReconciliationResultStatus }) {
  return <Badge variant={reconciliationStatusVariant[status]}>{status}</Badge>;
}

export function WebhookStatusBadge({ status }: { status: WebhookStatus | MerchantWebhookDeliveryStatus }) {
  return <Badge variant={webhookStatusVariant[status]}>{status}</Badge>;
}
