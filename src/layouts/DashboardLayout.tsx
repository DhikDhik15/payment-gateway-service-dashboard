import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarContent } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MerchantStatusBanner } from '@/components/layout/MerchantStatusBanner';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/lib/auth';
import { getRouteTitle, useDocumentTitle } from '@/lib/documentTitle';

// ─── DashboardLayout ─────────────────────────────────────────────────────────

export function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { data: merchant } = useSettings();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const pageTitle = getRouteTitle(location.pathname);
  useDocumentTitle(pageTitle);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm">Skip to main content</a>
      {/* ── Desktop Sidebar ── */}
      <aside
        aria-label="Main navigation"
        className="hidden w-sidebar flex-shrink-0 bg-sidebar md:flex md:flex-col"
      >
        <SidebarContent
          merchantName={merchant?.name}
          merchantCode={merchant?.code}
          merchantStatus={merchant?.status}
        />
      </aside>

      {/* ── Mobile Drawer overlay ── */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile Drawer panel ── */}
      {drawerOpen && (
        <aside
          aria-label="Mobile navigation"
          aria-modal="true"
          role="dialog"
          className="fixed inset-y-0 left-0 z-50 w-sidebar bg-sidebar md:hidden"
        >
          <SidebarContent
            onClose={() => setDrawerOpen(false)}
            merchantName={merchant?.name}
            merchantCode={merchant?.code}
            merchantStatus={merchant?.status}
          />
        </aside>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          pageTitle={pageTitle}
          onMenuClick={() => setDrawerOpen(true)}
          merchantName={merchant?.name}
          merchantStatus={merchant?.status}
          userEmail={user?.email}
          userRole={user?.role}
        />

        <MerchantStatusBanner />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin"
          aria-label={pageTitle}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
