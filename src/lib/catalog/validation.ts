import { z } from 'zod';

/**
 * Parse a user-typed Rupiah amount into integer minor units.
 * Strips thousand separators and any non-digit characters; returns null
 * when no digits remain. Never uses floating point.
 */
export function parseRupiahInput(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const amount = Number.parseInt(digits, 10);
  return Number.isSafeInteger(amount) ? amount : null;
}

/**
 * Validate an optional product image URL.
 * Accepts only absolute HTTPS URLs without embedded credentials.
 * This is syntactic validation only — it never fetches the URL and says
 * nothing about destination trustworthiness.
 */
export function isValidImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname) return false;
  if (parsed.username || parsed.password) return false;
  return true;
}

const imageUrlSchema = z
  .string()
  .trim()
  .max(2048, 'Image URL is too long')
  .refine((value) => value === '' || isValidProductImageReference(value), {
    message: 'Image must be an uploaded image or an absolute HTTPS address (https://…)',
  });

/**
 * Validate a stored product image reference held by the product form.
 * The form no longer accepts manual input: values are either empty (no
 * image), an absolute HTTPS URL (legacy/external images), or a
 * backend-local reference such as `/api/v1/product-images/...` returned by
 * the upload endpoint. Local blob previews must never be submitted.
 */
export function isValidProductImageReference(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > 2048) return false;
  if (trimmed.startsWith('/')) {
    return !/\s/.test(trimmed);
  }
  return isValidImageUrl(trimmed);
}

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200, 'Maximum 200 characters'),
  sku: z.string().trim().max(50, 'Maximum 50 characters'),
  description: z.string().trim().max(500, 'Maximum 500 characters'),
  priceInput: z
    .string()
    .trim()
    .min(1, 'Price is required')
    .refine(
      // Digits with optional dot/space thousand separators ("12.500").
      // Commas are rejected: in Indonesian notation they denote decimals,
      // which minor-unit amounts cannot represent.
      (value) => /^\d[\d.\s]*$/.test(value) && parseRupiahInput(value) !== null,
      { message: 'Price must be a whole number of rupiah (no decimals)' },
    ),
  currency: z.literal('IDR'),
  category_id: z.string().trim().max(100, 'Invalid category'),
  image_url: imageUrlSchema,
  active: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Maximum 100 characters'),
  description: z.string().trim().max(500, 'Maximum 500 characters'),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
