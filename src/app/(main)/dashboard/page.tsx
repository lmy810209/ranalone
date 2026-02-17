"use client"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { financials } from '@/lib/data';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { DollarSign, Server, TrendingUp, Clock } from 'lucide-react';

const chartConfig = {
  balance: {
    label: "Balance",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export default function DashboardPage() {
    const { balance, monthlyRevenue, monthlyExpenses, daysRemaining, balanceHistory } = financials;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          Financial Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Read-only overview of simulated server balance, revenue, and operational status.
        </p>
      </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Server Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${balance.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">+${(monthlyRevenue - monthlyExpenses).toLocaleString()} from last month</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+${monthlyRevenue.toLocaleString()}</div>
                     <p className="text-xs text-muted-foreground">Simulated data processing fees</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
                    <Server className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">-${monthlyExpenses.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Simulated server & energy costs</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Operational Days Left</CardTitle>
                    <Clock className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{daysRemaining.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Estimated at current burn rate</p>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Balance History</CardTitle>
            </CardHeader>
            <CardContent>
                 <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart accessibilityLayer data={balanceHistory}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        />
                        <YAxis 
                            tickFormatter={(value) => `$${Number(value) / 1000}k`}
                            tickLine={false}
                            axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="balance" fill="var(--color-balance)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    </div>
  );
}
