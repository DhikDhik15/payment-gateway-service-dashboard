import { PageHeader } from '@/components/ui';
import { TeamManagementPanel } from '@/components/team/TeamManagementPanel';

export function TeamPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage dashboard access for your merchant team."
      />
      <TeamManagementPanel />
    </div>
  );
}
