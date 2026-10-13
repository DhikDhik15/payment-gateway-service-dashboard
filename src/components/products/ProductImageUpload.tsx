import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { apiBaseUrl } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import {
  PRODUCT_IMAGE_ACCEPT,
  canManageProductImages,
  deleteProductImage,
  resolveProductImageUrl,
  uploadProductImage,
  validateProductImageFile,
} from '@/lib/catalog/productImages';
import { cn } from '@/lib/utils';

/**
 * Product image upload field with immediate local preview.
 *
 * - Selecting a file shows a local preview instantly, then uploads via
 *   POST /api/v1/dashboard/product-images (multipart field `image`).
 * - The parent form receives the returned `data.image_url` through
 *   `onChange`; local blob URLs are never submitted as the product image.
 * - Removing a persisted image (edit mode, value unchanged) calls
 *   DELETE /api/v1/dashboard/products/:product_id/image. Clearing a newly
 *   selected, not-yet-saved image only resets the selection locally.
 * - Only OWNER/ADMIN can upload or remove; VIEWER stays read-only.
 */
export function ProductImageUpload({
  value,
  productId,
  persistedRef = '',
  disabled = false,
  error,
  onChange,
  onBusyChange,
}: {
  /** Current form image reference (`''` when no image). */
  value: string;
  /** Defined when editing an already-saved product. */
  productId?: string;
  /** Image reference the product had when the modal opened. */
  persistedRef?: string;
  disabled?: boolean;
  error?: string;
  onChange: (imageUrl: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const canEdit = canManageProductImages(user?.role);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Last known persisted reference. After a successful DELETE it becomes
  // '' even though the parent `product` prop still holds the old value.
  const [savedRef, setSavedRef] = useState(persistedRef);

  // Revoke temporary browser object URLs when replaced or unmounted.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const previewSrc = objectUrl ?? resolveProductImageUrl(value, apiBaseUrl());
  useEffect(() => {
    setPreviewFailed(false);
  }, [previewSrc]);

  const busy = uploading || removing || disabled;
  const current = value.trim();
  const hasImage = Boolean(current || objectUrl);

  const openPicker = () => {
    if (busy || !canEdit) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so the same file can be selected again for a retry.
    event.target.value = '';
    if (!file || uploading || removing || disabled || !canEdit) return;
    const validationError = validateProductImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    // Show the local preview immediately, before the upload completes.
    const localPreview = URL.createObjectURL(file);
    setObjectUrl(localPreview);
    setPreviewFailed(false);
    setUploadError(null);
    setUploading(true);
    onBusyChange?.(true);
    try {
      const imageUrl = await uploadProductImage(file);
      // Keep the local preview on screen; the form carries the persisted
      // backend reference returned above for product create/update.
      onChange(imageUrl);
    } catch (uploadFailure) {
      URL.revokeObjectURL(localPreview);
      setObjectUrl(null);
      setUploadError(errorMessage(uploadFailure, 'Could not upload the image. Please try again.'));
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  const handleRemove = async () => {
    if (uploading || removing || disabled || !canEdit) return;
    if (!hasImage) return;
    // A newly selected image that has not been saved to a product is only
    // cleared locally — the persisted-image endpoint is not called. When the
    // selection replaced a persisted image, revert to it; otherwise clear.
    // Successfully uploaded files are intentionally never auto-deleted here:
    // a later product-save failure must keep the reference for retry.
    const isPersistedSelection = Boolean(productId && savedRef && current === savedRef);
    if (!isPersistedSelection) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      setUploadError(null);
      onChange(productId && savedRef ? savedRef : '');
      return;
    }
    setRemoving(true);
    onBusyChange?.(true);
    setUploadError(null);
    try {
      await deleteProductImage(productId as string);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      setSavedRef('');
      onChange('');
    } catch (removeFailure) {
      // Retain the existing image and surface the failure.
      setUploadError(errorMessage(removeFailure, 'Could not remove the image. Please try again.'));
    } finally {
      setRemoving(false);
      onBusyChange?.(false);
    }
  };

  const statusError = uploadError ?? error;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium leading-none text-foreground">Product Image</p>
      <div
        className={cn(
          'flex min-h-44 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-dashed border-input bg-muted/30 p-6 text-center',
        )}
      >
        {previewSrc && !previewFailed ? (
          <img
            src={previewSrc}
            alt="Product image preview"
            className="max-h-48 w-auto max-w-full rounded-md border border-border object-contain"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">Choose an image</p>
            <p className="text-xs text-muted-foreground">
              {hasImage ? 'The saved image could not be loaded.' : 'No image selected'}
            </p>
          </>
        )}
        {uploading && (
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Uploading image…
          </p>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={openPicker}>
            {uploading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {uploading ? 'Uploading…' : 'Choose Image'}
          </Button>
          {hasImage && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                void handleRemove();
              }}
              className="text-danger hover:text-danger"
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              {removing ? 'Removing…' : 'Remove Image'}
            </Button>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={PRODUCT_IMAGE_ACCEPT}
        aria-label="Choose product image"
        className="hidden"
        disabled={busy || !canEdit}
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />
      <p className="text-xs text-muted-foreground">
        Supported formats: JPG, PNG. Maximum size: 5 MB.
      </p>
      {statusError && (
        <p role="alert" className="text-xs font-medium text-danger">
          {statusError}
        </p>
      )}
    </div>
  );
}
