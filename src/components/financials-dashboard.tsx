'use client';

import { useEffect, useState } from 'react';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { DollarSign, Server, TrendingUp, Clock } from 'lucide-react';
import type { Financials } from '@/lib/types';

const chartConfig = {
  balance: {
    label: 'Balance',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

interface Props {
  initial: Financials | null;
}

export function FinancialsDashboard({ initial }: Props) {
  const [data, setData] = useState<Financials | null>(initial);

  useEffect(() => {
    const q = query(collection(db, 'financials'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const doc = snap.docs[0];
      const d = doc.data();
      const ts = d.updatedAt as { toDate?: () => Date } | string | undefined;
      const updatedAt =
        ts && typeof ts === 'object' && ts.toDate
          ? ts.toDate().toISOString()
          : typeof ts === 'string'
          ? ts
          : new Date().toISOString();

      setData({
        id: doc.id,
        balance: d.balance as number,
        revenue: d.revenue as number,
        serverCost: d.serverCost as number,
        daysRemaining: d.daysRemaining as number,
        updatedAt,
        balanceHistory: (d.balanceHistory as Financials['balanceHistory']) ?? [],
      });
    });
    return unsub;
  }, []);

  if (!data) {
    return <p className="text-muted-foreground">Loading financial data...</p>;
  }

  const { balance, revenue, serverCost, daysRemaining, balanceHistory } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Server Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {revenue - serverCost >= 0
                ? `+$${(revenue - serverCost).toFixed(2)} net this month`
                : `-$${(serverCost - revenue).toFixed(2)} net this month`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+${revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Simulated data processing fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Server Cost / mo</CardTitle>
            <Server className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-${serverCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Simulated server &amp; energy costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operational Days Left</CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysRemaining}</div>
            <p className="text-xs text-muted-foreground">Estimated at current burn rate</p>
          </CardContent>
        </Card>
      </div>

      {balanceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Balance History</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={balanceHistory}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="balance" fill="var(--color-balance)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
