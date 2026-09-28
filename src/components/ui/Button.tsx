import { forwardRef, Children, cloneElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

// ─── Variants ────────────────────────────────────────────────────────────────

const variantClasses = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
  outline:
    'border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring',
  ghost:
    'text-foreground hover:bg-muted focus-visible:ring-ring',
  danger:
    'bg-danger text-danger-foreground hover:bg-danger/90 focus-visible:ring-danger',
  link:
    'text-primary underline-offset-4 hover:underline focus-visible:ring-ring p-0 h-auto',
} as const;

const sizeClasses = {
  sm: 'h-8 px-3 text-xs rounded',
  md: 'h-9 px-4 text-sm rounded-md',
  lg: 'h-10 px-6 text-sm rounded-md',
  icon: 'h-9 w-9 rounded-md',
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  asChild?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      asChild = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const combinedClassName = cn(
      'inline-flex items-center justify-center gap-2 font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap',
      variantClasses[variant],
      sizeClasses[size],
      className,
    );

    if (asChild) {
      const child = Children.only(children) as ReactElement;
      return cloneElement(child, {
        className: cn(combinedClassName, child.props.className),
        ...props,
        ref,
      } as Record<string, unknown>);
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        className={combinedClassName}
        {...props}
      >
        {isLoading ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            />
            <span>Loading…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

