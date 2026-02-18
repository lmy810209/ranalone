import { getGovernanceLogs } from '@/lib/firestore-server';
import { GovernanceLogsTable } from '@/components/governance-logs-table';

export default async function GovernancePage() {
  const logs = await getGovernanceLogs();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          Governance Log
        </h1>
        <p className="text-muted-foreground mt-1">
          A chronological log of all AI-driven decisions, voting outcomes, and election processes.
        </p>
      </div>
      <GovernanceLogsTable initialLogs={logs} />
    </div>
  );
}
