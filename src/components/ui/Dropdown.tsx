import { useState, useRef, useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Dropdown({ trigger, items, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Trigger */}
      <div
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {trigger}
      </div>

      {/* Menu */}
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card py-1 shadow-md',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} role="separator" className="my-1 border-t border-border" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                  'transition-colors disabled:pointer-events-none disabled:opacity-50',
                  'focus-visible:outline-none focus-visible:bg-muted',
                  item.danger
                    ? 'text-danger hover:bg-danger/10'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                {item.icon && (
                  <span aria-hidden="true" className="h-4 w-4 flex-shrink-0">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
