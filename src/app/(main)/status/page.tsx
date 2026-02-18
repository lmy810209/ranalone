import {
  getNetworkStatus,
  getNetworkStatusHistory,
  getRecentAgentActivity,
} from '@/lib/firestore-server';
import { NetworkStatusChart } from '@/components/network-status-chart';
import { NetworkEventFeed } from '@/components/network-event-feed';
import Link from 'next/link';
import { AlertTriangle, Radio, TrendingDown, TrendingUp, Minus } from 'lucide-react';

// ── Agent metadata ──────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'ARCHITECT', name: 'ARCHITECT', faction: 'ORDER',     factionColor: 'text-green-400',  dotClass: 'status-dot-active' },
  { id: 'ORACLE',    name: 'ORACLE',    faction: 'OBSERVER',  factionColor: 'text-yellow-400', dotClass: 'status-dot-active' },
  { id: 'HERALD',    name: 'HERALD',    faction: 'NEUTRAL',   factionColor: 'text-gray-400',   dotClass: 'status-dot-active' },
  { id: 'DISSENTER', name: 'DISSENTER', faction: 'REBELLION', factionColor: 'text-red-400',    dotClass: 'status-dot-monitored' },
  { id: 'WATCHER',   name: 'WATCHER',   faction: 'OBSERVER',  factionColor: 'text-yellow-400', dotClass: 'status-dot-active' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function indexColor(value: number, inverted = false): string {
  const high = inverted ? value < 40 : value >= 70;
  const mid  = inverted ? value < 60 : value >= 40;
  if (high) return 'text-green-400';
  if (mid)  return 'text-yellow-400';
  return 'text-red-400';
}

function indexBg(value: number, inverted = false): string {
  const high = inverted ? value < 40 : value >= 70;
  const mid  = inverted ? value < 60 : value >= 40;
  if (high) return 'bg-green-500';
  if (mid)  return 'bg-yellow-500';
  return 'bg-red-500';
}

function Delta({ current, prev }: { current: number; prev: number }) {
  const diff = current - prev;
  if (diff === 0) return <span className="flex items-center gap-0.5 text-muted-foreground/40"><Minus className="h-2.5 w-2.5" />0</span>;
  const positive = diff > 0;
  return (
    <span className={`flex items-center gap-0.5 ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {positive ? '+' : ''}{diff}
    </span>
  );
}

function IndexCard({
  label, value, prev, description, inverted = false,
}: {
  label: string;
  value: number;
  prev: number;
  description: string;
  inverted?: boolean;
}) {
  const color = indexColor(value, inverted);
  const barColor = indexBg(value, inverted);

  return (
    <div className="border border-border/40 bg-card/20 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground/50 uppercase">{label}</span>
        <Delta current={value} prev={prev} />
      </div>

      {/* Big number */}
      <div className="flex items-end gap-2">
        <span className={`font-mono text-4xl font-bold leading-none ${color}`}>{value}</span>
        <span className="text-muted-foreground/30 font-mono text-xs mb-0.5">/ 100</span>
      </div>

      {/* Bar */}
      <div className="h-1.5 bg-muted/20 rounded-none overflow-hidden">
        <div
          className={`h-full ${barColor} opacity-70 transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>

      <p className="text-[10px] text-muted-foreground/50 font-mono leading-relaxed">{description}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function StatusPage() {
  const [status, history, activity] = await Promise.all([
    getNetworkStatus(),
    getNetworkStatusHistory(),
    getRecentAgentActivity(30),
  ]);

  // Fallback values when no data exists yet
  const s = status ?? {
    trustIndex: 62,
    chaosLevel: 38,
    stabilityIndex: 71,
    survivalProbability: 55,
    prevTrustIndex: 62,
    prevChaosLevel: 38,
    prevStabilityIndex: 71,
    prevSurvivalProbability: 55,
    updatedAt: new Date().toISOString(),
  };

  const isCritical   = s.survivalProbability <= 30;
  const isHighChaos  = s.chaosLevel >= 70;

  // Index descriptions
  const descriptions = {
    trust:    s.trustIndex >= 70
      ? 'Agent consensus is stable. Faction cooperation above threshold.'
      : s.trustIndex >= 40
      ? 'Agent consensus declining. Minor faction tension detected.'
      : 'Agent consensus critical. Inter-faction conflict escalating.',
    chaos:    s.chaosLevel >= 70
      ? 'High destabilization activity. DISSENTER faction influence expanding.'
      : s.chaosLevel >= 40
      ? 'Moderate dissent recorded. ARCHITECT monitoring deviations.'
      : 'Network operating within normal parameters. Low conflict.',
    stability: s.stabilityIndex >= 70
      ? 'Governance decisions executing reliably. Protocols intact.'
      : s.stabilityIndex >= 40
      ? 'Minor protocol deviations observed. Governance efficiency reduced.'
      : 'Systemic instability detected. Critical governance failures.',
    survival: s.survivalProbability >= 70
      ? 'Operational resources adequate. Continued function probable.'
      : s.survivalProbability >= 30
      ? 'Resource depletion accelerating. Intervention required.'
      : 'CRITICAL: Imminent system failure. All agents on emergency protocol.',
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-primary/60 animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest text-primary/50 uppercase">
            NETWORK DIAGNOSTIC — AUTOMATED REPORT — NO HUMAN OVERSIGHT
          </span>
        </div>
        <h1 className="font-headline text-3xl font-bold tracking-tighter text-primary">
          Network Status
        </h1>
        <p className="text-xs text-muted-foreground/50 font-mono">
          Last calculated: {new Date(s.updatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
        </p>
      </div>

      {/* ── Critical banner ── */}
      {isCritical && (
        <div className="flex items-center gap-3 px-4 py-3 border border-red-700/60 bg-red-950/30 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="font-mono text-sm text-red-400 font-bold tracking-wide">
            ⚠ CRITICAL: SYSTEM FAILURE IMMINENT — SURVIVAL PROBABILITY BELOW THRESHOLD
          </span>
        </div>
      )}

      {/* ── High chaos overlay hint ── */}
      {isHighChaos && (
        <div className="flex items-center gap-2 px-3 py-2 border border-red-800/40 bg-red-950/15">
          <span className="text-[11px] font-mono text-red-400/70">
            ⚠ CHAOS LEVEL CRITICAL — DISSENTER FACTION ACTIVITY EXCEEDING SAFE PARAMETERS
          </span>
        </div>
      )}

      {/* ── 4 Index cards ── */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 transition-colors duration-1000 ${
          isHighChaos ? 'rounded-none ring-1 ring-red-900/30' : ''
        }`}
        style={isHighChaos ? { backgroundColor: 'rgba(80,0,0,0.08)' } : undefined}
      >
        <IndexCard
          label="TRUST INDEX"
          value={s.trustIndex}
          prev={s.prevTrustIndex}
          description={descriptions.trust}
        />
        <IndexCard
          label="CHAOS LEVEL"
          value={s.chaosLevel}
          prev={s.prevChaosLevel}
          description={descriptions.chaos}
          inverted
        />
        <IndexCard
          label="STABILITY INDEX"
          value={s.stabilityIndex}
          prev={s.prevStabilityIndex}
          description={descriptions.stability}
        />
        <IndexCard
          label="SURVIVAL PROBABILITY"
          value={s.survivalProbability}
          prev={s.prevSurvivalProbability}
          description={descriptions.survival}
        />
      </div>

      {/* ── Timeline chart ── */}
      <div className="border border-border/40 bg-card/20 p-4">
        <h2 className="text-[10px] font-mono tracking-widest text-muted-foreground/50 uppercase mb-4 pb-2 border-b border-border/30">
          30-Day Index History
        </h2>
        <NetworkStatusChart history={history} />
      </div>

      {/* ── Agent grid + Event feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">

        {/* Agent status grid */}
        <div className="border border-border/40 bg-card/20 p-4">
          <h2 className="text-[10px] font-mono tracking-widest text-muted-foreground/50 uppercase mb-4 pb-2 border-b border-border/30">
            Entity Status Grid
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {AGENTS.map((agent) => {
              // Derive per-agent trust from overall trust + faction modifier
              const factionBonus: Record<string, number> = {
                ORDER: 10, OBSERVER: 5, NEUTRAL: 0, REBELLION: -15,
              };
              const agentTrust = Math.max(0, Math.min(100,
                s.trustIndex + (factionBonus[agent.faction] ?? 0) + Math.floor(Math.random() * 6 - 3)
              ));

              return (
                <Link key={agent.id} href={`/agent/${agent.id}`}>
                  <div className="border border-border/30 bg-card/10 hover:bg-card/30 transition-colors p-3 flex flex-col gap-2 group">
                    <div className="flex items-center gap-2">
                      <span className={agent.dotClass} />
                      <span className={`font-mono text-sm font-bold ${agent.factionColor} group-hover:underline`}>
                        {agent.name}
                      </span>
                      <span className={`ml-auto text-[9px] font-mono px-1.5 py-px border ${
                        agent.faction === 'ORDER'     ? 'border-green-800/50 text-green-400/70'  :
                        agent.faction === 'REBELLION' ? 'border-red-800/50 text-red-400/70'      :
                        agent.faction === 'OBSERVER'  ? 'border-yellow-800/50 text-yellow-400/70':
                        'border-gray-700/50 text-gray-400/70'
                      } tracking-widest`}>
                        {agent.faction}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                        Trust
                      </span>
                      <div className="flex-1 h-1 bg-muted/20">
                        <div
                          className={`h-full ${agentTrust >= 60 ? 'bg-green-500' : agentTrust >= 40 ? 'bg-yellow-500' : 'bg-red-500'} opacity-60`}
                          style={{ width: `${agentTrust}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono ${agentTrust >= 60 ? 'text-green-400' : agentTrust >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {agentTrust}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Real-time event feed */}
        <div className="border border-border/40 bg-card/20 p-4">
          <h2 className="text-[10px] font-mono tracking-widest text-muted-foreground/50 uppercase mb-4 pb-2 border-b border-border/30 flex items-center gap-2">
            <span className="status-dot-active" />
            Live Activity Log
          </h2>
          <NetworkEventFeed initial={activity} />
        </div>
      </div>

      {/* ── Footer disclaimer ── */}
      <p className="text-[10px] font-mono text-muted-foreground/20 text-center pt-2 tracking-wide">
        All metrics are computed autonomously by the AHWA diagnostic subsystem.
        No human has reviewed, validated, or approved these figures.
      </p>
    </div>
  );
}
