import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, error, type = 'text', ...props }, ref) => {
    const errorId = useId();
    const invalid = hasError || !!error;
    const inputElement = (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid}
        aria-describedby={error ? errorId : props['aria-describedby']}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-background px-3 py-2',
          'text-sm text-foreground placeholder:text-muted-foreground',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          invalid && 'border-danger focus-visible:ring-danger',
          className,
        )}
        {...props}
      />
    );

    if (error) {
      return <div className="space-y-1">{inputElement}<p id={errorId} role="alert" className="text-xs font-medium text-danger">{error}</p></div>;
    }
    return inputElement;
  },
);

Input.displayName = 'Input';
