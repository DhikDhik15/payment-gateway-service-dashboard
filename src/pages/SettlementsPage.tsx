import { Info, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';

export function SettlementsPage() {
  return <div className="space-y-6"><PageHeader title="Settlements" description="Merchant-scoped settlement data is not exposed by the current API." /><Card className="border-info/30 bg-info/5"><CardHeader><div className="flex items-center gap-2 text-info"><Info className="h-5 w-5" aria-hidden="true" /><CardTitle>Not available in the merchant dashboard</CardTitle></div></CardHeader><CardContent className="space-y-4"><p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">The backend intentionally does not expose settlement batches to merchant users because the current settlement model is provider-level and has no merchant ownership field. No settlement values are fabricated here.</p><p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Use Reconciliation to review merchant-scoped mismatches. Settlement imports and provider-level operations remain administrator-only.</p><Button variant="outline" asChild><Link to="/dashboard/reconciliation">Open reconciliation <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></CardContent></Card></div>;
}
