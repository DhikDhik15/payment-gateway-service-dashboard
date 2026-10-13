import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiBaseUrl } from '@/lib/api/client';
import { resolveProductImageUrl } from '@/lib/catalog/productImages';

/**
 * Product image with a graceful placeholder.
 * Accepts external HTTPS URLs and backend-local references such as
 * `/api/v1/product-images/...` (resolved against the configured API
 * origin). A missing, blank, or unloadable value renders the placeholder
 * instead of a broken image.
 */
export function ProductImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const url = resolveProductImageUrl(src, apiBaseUrl());
  if (!url || failed) {
    return (
      <span
        role="img"
        aria-label={`${alt} (no image)`}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground',
          className,
        )}
      >
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('h-10 w-10 rounded-md border border-border object-cover', className)}
    />
  );
}
