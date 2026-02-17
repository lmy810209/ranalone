import { governanceLogs } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const eventTypeColors = {
    decision: 'default',
    vote: 'secondary',
    election: 'outline',
    proposal: 'destructive',
} as const;


export default function GovernancePage() {
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[120px]">Event Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {governanceLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium text-muted-foreground">
                  {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss 'UTC'")}
                </TableCell>
                <TableCell>
                  <Badge variant={eventTypeColors[log.eventType] || 'default'} className="capitalize bg-accent text-accent-foreground">
                    {log.eventType}
                  </Badge>
                </TableCell>
                <TableCell className='text-foreground font-semibold'>{log.title}</TableCell>
                <TableCell className='text-muted-foreground'>{log.outcome}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
