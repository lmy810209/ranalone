import { getFinancials } from '@/lib/firestore-server';
import { FinancialsDashboard } from '@/components/financials-dashboard';

export default async function DashboardPage() {
  const initial = await getFinancials();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          Financial Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time overview of server balance, revenue, and operational status.
        </p>
      </div>
      <FinancialsDashboard initial={initial} />
    </div>
  );
}
