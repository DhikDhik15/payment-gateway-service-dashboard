/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button, Input, Label } from '@/components/ui';
import { fieldError } from '@/lib/api';
import {
  parseRupiahInput,
  productFormSchema,
  type ProductFormValues,
} from '@/lib/catalog/validation';
import type { Category, Product } from '@/types';
import { ProductImageUpload } from './ProductImageUpload';

export interface ProductFormSubmit {
  name: string;
  sku?: string;
  description?: string;
  price: number;
  currency: 'IDR';
  category_id?: string;
  image_url?: string;
  active: boolean;
}

export function toSubmit(values: ProductFormValues): ProductFormSubmit {
  const price = parseRupiahInput(values.priceInput);
  if (price === null) throw new Error('Price must be a whole number of rupiah');
  const sku = values.sku.trim();
  const description = values.description.trim();
  const imageUrl = values.image_url.trim();
  return {
    name: values.name.trim(),
    ...(sku ? { sku } : {}),
    ...(description ? { description } : {}),
    price,
    currency: 'IDR',
    ...(values.category_id ? { category_id: values.category_id } : {}),
    // Blank image means "no image": omit the field entirely so the
    // backend keeps nil (create) or leaves the value unchanged (PATCH).
    // Removal of a persisted image goes through the dedicated DELETE
    // endpoint instead — an omitted field never deletes.
    ...(imageUrl ? { image_url: imageUrl } : {}),
    active: values.active,
  };
}

/**
 * Shared create/edit product form. Edit mode hides the active toggle only
 * when the caller renders its own status control; the toggle below covers
 * both modes. Submits integer minor units — never floats.
 */
export function ProductForm({
  product,
  productId,
  categories,
  pending,
  serverError,
  submitLabel,
  onSubmit,
}: {
  product?: Product | null;
  /** Defined when editing an already-saved product (enables image removal). */
  productId?: string;
  categories: Category[];
  pending: boolean;
  serverError: unknown;
  submitLabel: string;
  onSubmit: (values: ProductFormSubmit) => void;
}) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      description: product?.description ?? '',
      priceInput: product ? String(product.price) : '',
      currency: 'IDR',
      category_id: product?.category_id ?? '',
      image_url: product?.image_url ?? '',
      active: product?.active ?? true,
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const [imageBusy, setImageBusy] = useState(false);
  const busy = pending || isSubmitting || imageBusy;
  const active = watch('active');
  const imageUrl = watch('image_url');

  const submit = (values: ProductFormValues) => {
    if (busy) return;
    try {
      onSubmit(toSubmit(values));
    } catch {
      // Validation guarantees a parseable price; unreachable in practice.
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="product-name" required>
          Name
        </Label>
        <Input
          id="product-name"
          autoComplete="off"
          maxLength={200}
          disabled={busy}
          error={errors.name?.message ?? fieldError(serverError, 'name')}
          {...register('name')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="product-sku">SKU</Label>
          <Input
            id="product-sku"
            autoComplete="off"
            maxLength={50}
            disabled={busy}
            error={errors.sku?.message ?? fieldError(serverError, 'sku')}
            {...register('sku')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-category">Category</Label>
          <select
            id="product-category"
            disabled={busy}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            {...register('category_id')}
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="product-description">Description</Label>
        <Input
          id="product-description"
          autoComplete="off"
          maxLength={500}
          disabled={busy}
          error={
            errors.description?.message ?? fieldError(serverError, 'description')
          }
          {...register('description')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="product-price" required>
            Price (Rp, whole rupiah)
          </Label>
          <Input
            id="product-price"
            inputMode="numeric"
            autoComplete="off"
            placeholder="15000"
            disabled={busy}
            error={
              errors.priceInput?.message ?? fieldError(serverError, 'price')
            }
            {...register('priceInput')}
          />
          <p className="text-xs text-muted-foreground">
            Enter whole rupiah without decimals, e.g. 15000 for Rp15.000.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-currency">Currency</Label>
          <Input
            id="product-currency"
            value="IDR"
            disabled
            aria-describedby="product-currency-note"
            {...register('currency')}
          />
          <p id="product-currency-note" className="text-xs text-muted-foreground">
            Indonesian Rupiah only in this release.
          </p>
        </div>
      </div>

      <ProductImageUpload
        value={imageUrl}
        productId={productId}
        persistedRef={product?.image_url ?? ''}
        disabled={busy}
        error={
          errors.image_url?.message ?? fieldError(serverError, 'image_url')
        }
        onChange={(next) =>
          setValue('image_url', next, { shouldDirty: true, shouldValidate: true })
        }
        onBusyChange={setImageBusy}
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          disabled={busy}
          checked={active}
          onChange={(event) => setValue('active', event.target.checked)}
          aria-label="Product is active"
        />
        Active (available for new orders)
      </label>

      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitLabel}
      </Button>
    </form>
  );
}
