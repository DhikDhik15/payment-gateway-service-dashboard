import { Outlet } from 'react-router-dom';

/**
 * Wraps unauthenticated pages (e.g., Login).
 * Centered single-column layout.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      {/* Logo / Brand */}
      <div className="mb-8 flex items-center gap-2">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        >
          P
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">PayGate</span>
      </div>

      {/* Page content */}
      <Outlet />

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} PayGate. All rights reserved.
      </footer>
    </div>
  );
}
