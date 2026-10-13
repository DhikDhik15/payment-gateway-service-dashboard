import { useEffect, useId, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Maximum width class, e.g. 'max-w-md' */
  maxWidth?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'max-w-lg',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Sync open state with <dialog> element
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Close on backdrop click. Only a click whose target is the <dialog>
  // element itself (the backdrop region) dismisses. Clicks bubbling up from
  // dialog content must never close the modal — notably the synthetic
  // (clientX/Y 0,0) click dispatched by `fileInput.click()` in a "Choose
  // Image" button, which falls outside the dialog rect and would otherwise be
  // mistaken for a backdrop dismissal, instantly closing the modal.
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      onClose();
    }
  };

  // Route the native `cancel` (Escape) through React state instead of letting
  // the browser tear down the <dialog> natively. A native teardown fires
  // `close` outside React control — e.g. an Escape pressed to dismiss the OS
  // file picker opened from a "Choose Image" button inside the dialog would
  // otherwise close the whole modal — and it can desync the element
  // (`el.open === false`) from the `open` prop when a guarded close (such as
  // a pending save) intentionally keeps `open === true`. `cancel` events
  // bubbling up from descendants (notably the file picker's own cancel when
  // the user dismisses it without choosing a file) are ignored: only a cancel
  // dispatched at the dialog itself is a dismissal.
  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      className={cn(
        'w-full rounded-lg border border-border bg-card p-0 shadow-lg',
        'backdrop:bg-foreground/20 backdrop:backdrop-blur-sm',
        'open:animate-in open:fade-in-0 open:zoom-in-95',
        maxWidth,
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close dialog"
          className="-mr-1 -mt-1 flex-shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Body */}
      <div className="px-6 py-4">{children}</div>
    </dialog>
  );
}
