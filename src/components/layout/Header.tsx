import { Menu, Settings, KeyRound, LogOut, ChevronDown, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Dropdown, Badge } from '@/components/ui';
import type { DropdownItem } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { DashboardRole } from '@/types';

interface HeaderProps {
  pageTitle: string;
  onMenuClick: () => void;
  className?: string;
  merchantName?: string;
  merchantStatus?: string;
  userEmail?: string;
  userRole?: DashboardRole;
}

export function Header({
  pageTitle,
  onMenuClick,
  className,
  merchantName,
  merchantStatus,
  userEmail,
  userRole,
}: HeaderProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const merchantMenuItems: DropdownItem[] = [
    {
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => void navigate('/dashboard/settings'),
    },
    {
      label: 'API Keys',
      icon: <KeyRound className="h-4 w-4" />,
      onClick: () => void navigate('/dashboard/api-keys'),
    },
    { separator: true, label: '', onClick: () => undefined },
    {
      label: 'Sign out',
      icon: <LogOut className="h-4 w-4" />,
      onClick: () => {
        void logout()
          .then(() => { void navigate('/login', { replace: true }); })
          .catch(() => {
            void navigate('/login', {
              replace: true,
              state: { message: 'You were signed out locally, but the server could not confirm session revocation. Please sign in again if needed.' },
            });
          });
      },
      danger: true,
    },
  ];

  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="md:hidden"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </Button>
        <h2 className="truncate text-sm font-semibold text-foreground md:text-base">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-1">
        <div className="hidden items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs md:flex">
          <span className="max-w-[150px] truncate font-medium text-foreground">{merchantName ?? 'Merchant'}</span>
          <Badge variant={merchantStatus === 'ACTIVE' ? 'success' : 'warning'}>
            {merchantStatus ?? 'UNKNOWN'}
          </Badge>
        </div>

        <Dropdown
          trigger={
            <Button
              variant="ghost"
              size="md"
              aria-label="Account menu"
              className="gap-1.5 px-2 text-sm text-foreground"
            >
              <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="hidden max-w-[150px] truncate md:inline">{userEmail ?? 'Account'}</span>
              <span className="hidden text-xs text-muted-foreground lg:inline">{userRole ?? ''}</span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          }
          items={merchantMenuItems}
          align="right"
        />
      </div>
    </header>
  );
}
