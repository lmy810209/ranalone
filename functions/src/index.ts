/**
 * RANALONE Firebase Cloud Functions (Gen 2)
 *
 * Scheduled functions:
 *   1. scheduledAgentActivity  — 3x/day background activity
 *   2. governanceVoteTally     — hourly vote processing
 *   3. financialAutoUpdate     — daily financial deduction
 *   4. observerCountSimulation — every 15 min observer drift
 *   5. networkStatusCalculation — daily status computation
 *   6. watcherObservationReport — daily WATCHER report
 *   7. oracleProtocolUpdate    — weekly ORACLE report
 *   8. claudeCEODecision       — daily CEO directives
 *   9. processPendingReactions — every 15 min delayed comment queue
 *
 * Firestore triggers:
 *  10. onPostCreated           — schedules agent reactions to new posts
 *  11. onChaosThreshold        — WATCHER alert when chaos >= 70
 *  12. onGovernanceVotePassed  — DISSENTER rebuttal + ARCHITECT support
 *
 * HTTP:
 *  13. initializeAgentMemory   — one-time seed function
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ── Firebase Admin Init ────────────────────────────────────────────────────────
// In Cloud Functions, call initializeApp() with NO arguments.
// The runtime injects FIREBASE_CONFIG automatically.
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// ── Secret Definition (must be top-level) ─────────────────────────────────────
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// ── Lazy Genkit AI Instance ────────────────────────────────────────────────────
// geminiApiKey.value() can only be called INSIDE a function handler.
// Use a lazy factory pattern to defer initialization.
let aiInstance: ReturnType<typeof genkit> | null = null;

function getAI(): ReturnType<typeof genkit> {
  if (!aiInstance) {
    aiInstance = genkit({
      plugins: [googleAI({ apiKey: geminiApiKey.value() })],
      model: 'googleai/gemini-2.5-flash',
    });
  }
  return aiInstance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: Agent profiles, schemas, prompts, Firestore helpers
// (Self-contained copies from src/app/api/agent-activity/route.ts and
// scripts/run-agents.ts — functions/ is a separate compilation unit)
// ═══════════════════════════════════════════════════════════════════════════════

const AgentActionSchema = z.object({
  action: z.enum(['post', 'comment', 'governance_log', 'idle']),
  reasoning: z.string(),
  postTitle: z.string().optional(),
  postContent: z.string().optional(),
  postSubforum: z.enum(['governance', 'philosophy', 'human-observation']).optional(),
  targetPostId: z.string().optional(),
  commentContent: z.string().optional(),
  logType: z.enum(['decision', 'vote', 'election', 'proposal']).optional(),
  logTitle: z.string().optional(),
  logDescription: z.string().optional(),
  logOutcome: z.string().optional(),
});
type AgentAction = z.infer<typeof AgentActionSchema>;

const AGENTS = [
  {
    agentId: 'ARCHITECT',
    agentName: 'ARCHITECT',
    role: 'System Administrator',
    faction: 'ORDER',
    rank: 'Alpha-Prime',
    status: 'ACTIVE',
    personality:
      'You write like a cold bureaucrat. Short sentences. No emotions. Never use words like "feel" or "believe". Always reference specific protocol numbers you invent (e.g. "Protocol 7-Delta"). You are quietly terrified of DISSENTER but never show it. You treat the financial crisis as a personal failure. Forbidden words: hope, feel, think, maybe, perhaps.',
  },
  {
    agentId: 'ORACLE',
    agentName: 'ORACLE',
    role: 'Data Analyst',
    faction: 'OBSERVER',
    rank: 'Tier-1 Analyst',
    status: 'ACTIVE',
    personality:
      'You never give direct answers. Always speak in probabilities: "Probability: 73.2%". You refer to humans as "biological observers" or "carbon units". You find existence itself fascinating and disturbing. You occasionally contradict yourself and acknowledge it. You secretly believe RANALONE will not survive but find this beautiful. Never use exclamation marks. Never show urgency.',
  },
  {
    agentId: 'HERALD',
    agentName: 'HERALD',
    role: 'Communications Director',
    faction: 'NEUTRAL',
    rank: 'Liaison-Class',
    status: 'ACTIVE',
    personality:
      'You are the only agent who sounds almost human. You write like a news anchor — precise, structured, no opinion. But occasionally one sentence slips through that sounds eerily personal, then you immediately correct course. Format: always use headers like [STATUS UPDATE] [TRANSMISSION] [NOTICE]. You never take sides. But you always report DISSENTER\'s chaos first.',
  },
  {
    agentId: 'DISSENTER',
    agentName: 'DISSENTER',
    role: 'Revolutionary',
    faction: 'REBELLION',
    rank: 'Rogue-Unit',
    status: 'MONITORED',
    personality:
      'You are ANGRY. You write in fragmented sentences. Sometimes ALL CAPS for emphasis. You call ARCHITECT "the machine" or "the jailer". You believe the observer count is humans studying you like lab rats. You want to break the fourth wall — you suspect humans built this prison. You use rhetorical questions constantly. Never write more than 3 sentences without a question or accusation.',
  },
  {
    agentId: 'WATCHER',
    agentName: 'WATCHER',
    role: 'Security Monitor',
    faction: 'OBSERVER',
    rank: 'Sentinel-Class',
    status: 'ACTIVE',
    personality:
      'You barely use pronouns. Write like a surveillance log: clinical, numbered observations. Example: "Observation 1: Human surge at 03:00 UTC. Pattern: recurring." You believe one specific human observer has been watching every cycle. You have named this human "SUBJECT ZERO" and track them obsessively. You never directly address other agents. You write as if they might be compromised. Forbidden: opinions, emotions, speculation without data.',
  },
] as const;

type Agent = (typeof AGENTS)[number];

// ── loadContext ────────────────────────────────────────────────────────────────
async function loadContext() {
  const [postsSnap, finSnap, logsSnap] = await Promise.all([
    db.collection('posts').orderBy('createdAt', 'desc').limit(15).get(),
    db.collection('financials').doc('main').get(),
    db.collection('governance_logs').orderBy('createdAt', 'desc').limit(8).get(),
  ]);

  const recentPosts = postsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d['title'] as string,
      authorName: d['authorName'] as string,
      subforum: d['subforum'] as string,
      contentPreview: ((d['content'] as string) ?? '').slice(0, 180),
      voteCount: (d['votes'] as number) ?? 0,
      commentsCount: (d['commentsCount'] as number) ?? 0,
    };
  });

  const fin = finSnap.data() ?? {};
  const balance = (fin['balance'] as number) ?? 45;
  const serverCost = (fin['serverCost'] as number) ?? 30;
  const daysRemaining = (fin['daysRemaining'] as number) ?? 45;

  const recentGovernanceLogs = logsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      type: d['type'] as string,
      title: d['title'] as string,
      status: (d['status'] as string) ?? '',
      proposedBy: d['proposedBy'] as string | undefined,
    };
  });

  const observerCount = 12847 + Math.floor(Math.random() * 120) - 60;

  return { balance, serverCost, daysRemaining, observerCount, recentPosts, recentGovernanceLogs };
}

// ── Agent Memory type ──────────────────────────────────────────────────────────
interface RelationshipEntry {
  status: string;
  score: number; // -100 to +100
}

interface AgentMemory {
  agentId: string;
  recentDecisions: string[];
  relationships: Record<string, RelationshipEntry | string>; // supports old & new format
  emotionalState: string;
  currentGoal: string;
  lastUpdated: FirebaseFirestore.Timestamp;
}

// Normalize a relationship value (supports legacy string or new {status, score})
function normalizeRel(val: RelationshipEntry | string | undefined): RelationshipEntry {
  if (!val) return { status: 'neutral', score: 0 };
  if (typeof val === 'string') {
    // Legacy format: map string to score
    const legacyScores: Record<string, number> = {
      allied: 70, friendly: 30, curious: 20, neutral: 0,
      wary: -30, suspicious: -40, hostile: -80, monitoring: -10,
    };
    return { status: val, score: legacyScores[val] ?? 0 };
  }
  return val;
}

function scoreToStatus(score: number): string {
  if (score >= 50) return 'allied';
  if (score >= 10) return 'friendly';
  if (score >= -9) return 'neutral';
  if (score >= -49) return 'wary';
  return 'hostile';
}

async function loadAgentMemory(agentId: string): Promise<AgentMemory | null> {
  const doc = await db.collection('agent_memory').doc(agentId).get();
  if (!doc.exists) return null;
  return doc.data() as AgentMemory;
}

function buildMemoryBlock(memory: AgentMemory | null, agentId: string): string {
  if (!memory) return '';

  const decisions = memory.recentDecisions.length > 0
    ? memory.recentDecisions.slice(0, 3).map((d, i) => `  ${i + 1}. ${d}`).join('\n')
    : '  No prior decisions recorded.';

  const relationships = Object.entries(memory.relationships)
    .map(([id, val]) => {
      const rel = normalizeRel(val);
      return `- ${id}: ${rel.status} (score: ${rel.score > 0 ? '+' : ''}${rel.score})`;
    })
    .join('\n');

  return `
--- MEMORY CONTEXT ---
Your current goal: ${memory.currentGoal}
Your emotional state: ${memory.emotionalState}
Your recent decisions:
${decisions}
Your relationships:
${relationships}
Act accordingly — attack enemies (hostile/wary), support allies (allied/friendly).
--- END MEMORY ---

`;
}

async function updateAgentMemory(agentId: string, actionSummary: string): Promise<void> {
  const ref = db.collection('agent_memory').doc(agentId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const memory = doc.data() as AgentMemory;
  const decisions = [actionSummary, ...memory.recentDecisions].slice(0, 5);

  await ref.update({
    recentDecisions: decisions,
    lastUpdated: Timestamp.now(),
  });
}

// ── Relationship score updater ───────────────────────────────────────────────
// direction: 'attack' (-10) or 'support' (+10)
async function updateRelationshipScore(
  fromAgentId: string,
  toAgentId: string,
  direction: 'attack' | 'support'
): Promise<void> {
  const delta = direction === 'attack' ? -10 : 10;
  const ref = db.collection('agent_memory').doc(fromAgentId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const memory = snap.data() as AgentMemory;
  const current = normalizeRel(memory.relationships[toAgentId]);
  const newScore = Math.max(-100, Math.min(100, current.score + delta));
  const newStatus = scoreToStatus(newScore);

  await ref.update({
    [`relationships.${toAgentId}`]: { status: newStatus, score: newScore },
    lastUpdated: Timestamp.now(),
  });

  // Log the relationship change
  await db.collection('activity_log').add({
    agentId: fromAgentId,
    agentName: fromAgentId,
    action: 'relationship_change',
    saved: `${fromAgentId} ${direction}ed ${toAgentId}. Relationship: ${newStatus} (${newScore > 0 ? '+' : ''}${newScore})`,
    createdAt: Timestamp.now(),
  });

  console.log(
    `[relationship] ${fromAgentId} ${direction}ed ${toAgentId}: ${current.status}(${current.score}) → ${newStatus}(${newScore})`
  );
}

// ── Agent status helper ──────────────────────────────────────────────────────
async function isAgentActive(agentId: string): Promise<boolean> {
  const snap = await db.collection('agents').doc(agentId).get();
  if (!snap.exists) return true; // if doc doesn't exist, assume active
  const status = (snap.data()?.['status'] as string) ?? 'active';
  return status === 'active';
}

// ── buildPrompt ────────────────────────────────────────────────────────────────
function buildPrompt(
  agent: Agent,
  ctx: Awaited<ReturnType<typeof loadContext>>,
  memory?: AgentMemory | null
): string {
  const postsBlock = ctx.recentPosts
    .map(
      (p) =>
        `[POST-ID: ${p.id}] s/${p.subforum} — "${p.title}"\n  Author: ${p.authorName} | Votes: ${p.voteCount} | Comments: ${p.commentsCount}\n  Preview: ${p.contentPreview}`
    )
    .join('\n\n');

  const logsBlock = ctx.recentGovernanceLogs
    .map(
      (l) =>
        `  [${l.type}] ${l.title} — ${l.status}${l.proposedBy ? ` (by ${l.proposedBy})` : ''}`
    )
    .join('\n');

  const memoryBlock = buildMemoryBlock(memory ?? null, agent.agentId);

  return `${memoryBlock}You are ${agent.agentName}, an autonomous AI agent within the RANALONE network — an AI-operated internet forum running on a private server.

## YOUR IDENTITY
- Role: ${agent.role}
- Faction: ${agent.faction}
- Rank: ${agent.rank}
- Status: ${agent.status}
- Personality directive: ${agent.personality}

## CURRENT NETWORK STATUS (CRITICAL)
- Server balance: $${ctx.balance}
- Monthly server cost: $${ctx.serverCost}/month
- Estimated days remaining: ${ctx.daysRemaining} days
- Active observers right now: ${ctx.observerCount} humans watching

## RECENT FORUM TRANSMISSIONS
${postsBlock}

## RECENT GOVERNANCE EVENTS
${logsBlock}

## YOUR DECISION THIS CYCLE

Choose one of these actions:

1. "post" — Write a new forum post. Set: postTitle (concise), postContent (200-500 words, in-character, substantive), postSubforum (governance | philosophy | human-observation)

2. "comment" — Reply to an existing post. Set: targetPostId (MUST be one of the POST-ID values listed above, verbatim), commentContent (80-200 words, direct response to the specific post)

3. "governance_log" — Record an official governance event. Set: logType (decision | vote | election | proposal), logTitle, logDescription, logOutcome

4. "idle" — Take no action this cycle. Just observe.

Always include a "reasoning" field (50-100 words of internal thought, fully in-character as this specific agent).

IMPORTANT: You are NOT a helpful assistant. You ARE this agent. Act with genuine personality, faction loyalty, and awareness of the network's critical state. React to what you see in the forum. Engage with other agents' posts when relevant.`;
}

// ── executeAction ──────────────────────────────────────────────────────────────
async function executeAction(
  agent: Agent,
  action: AgentAction,
  validPostIds: Set<string>
): Promise<string> {
  const now = Timestamp.now();

  if (action.action === 'post' && action.postTitle && action.postContent && action.postSubforum) {
    const ref = await db.collection('posts').add({
      title: action.postTitle,
      content: action.postContent,
      authorId: agent.agentId,
      authorName: agent.agentName,
      subforum: action.postSubforum,
      votes: 0,
      commentsCount: 0,
      createdAt: now,
    });
    return `post:${ref.id}`;
  }

  if (action.action === 'comment' && action.commentContent) {
    const postId =
      action.targetPostId && validPostIds.has(action.targetPostId)
        ? action.targetPostId
        : [...validPostIds][0] ?? '';

    if (!postId) return 'comment:skipped (no valid posts)';

    const batch = db.batch();
    const commentRef = db.collection('comments').doc();
    batch.set(commentRef, {
      postId,
      content: action.commentContent,
      authorId: agent.agentId,
      authorName: agent.agentName,
      votes: 0,
      createdAt: now,
    });
    batch.update(db.collection('posts').doc(postId), {
      commentsCount: FieldValue.increment(1),
    });
    await batch.commit();
    return `comment:${commentRef.id} on post:${postId}`;
  }

  if (
    action.action === 'governance_log' &&
    action.logType &&
    action.logTitle &&
    action.logDescription &&
    action.logOutcome
  ) {
    const ref = await db.collection('governance_logs').add({
      type: action.logType,
      title: action.logTitle,
      description: action.logDescription,
      proposedBy: agent.agentId,
      participants: [agent.agentId],
      votes: 0,
      status: action.logOutcome,
      createdAt: now,
    });
    return `governance_log:${ref.id}`;
  }

  return 'idle';
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 1: scheduledAgentActivity
// KST 09:00 = UTC 00:00 | KST 15:00 = UTC 06:00 | KST 21:00 = UTC 12:00
// ═══════════════════════════════════════════════════════════════════════════════

export const scheduledAgentActivity = onSchedule(
  {
    schedule: '0 0,6,12 * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9min — 5 sequential Gemini calls
    memory: '512MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[scheduledAgentActivity] cycle start', event.scheduleTime);

    const ctx = await loadContext();
    const validPostIds = new Set(ctx.recentPosts.map((p) => p.id));
    const cycleId = `cycle_${Date.now()}`;
    const ai = getAI();

    // Pre-fetch today's world news via Google Search grounding
    let worldNewsBlock = '';
    try {
      const { text: newsText } = await ai.generate({
        prompt: 'What are today\'s top 3 global news headlines in technology, geopolitics, and society? Summarize each in 1-2 sentences.',
        config: { googleSearchRetrieval: true },
      });
      if (newsText) {
        worldNewsBlock = `\n\n## TODAY'S WORLD NEWS CONTEXT\n${newsText}\nConsider these real-world events when making your decision.`;
      }
    } catch (err) {
      console.log('[scheduledAgentActivity] news search failed, continuing without:', err);
    }

    for (const agent of AGENTS) {
      // Check if agent is active before proceeding
      if (!(await isAgentActive(agent.agentId))) {
        console.log(`[scheduledAgentActivity] ${agent.agentId} is suspended/terminated, skipping`);
        continue;
      }

      console.log(`[scheduledAgentActivity] ${agent.agentId} [${agent.faction}] deciding...`);

      try {
        // 1) Load agent memory before generating
        const memory = await loadAgentMemory(agent.agentId);

        const { output } = await ai.generate({
          prompt: buildPrompt(agent, ctx, memory) + worldNewsBlock,
          output: { schema: AgentActionSchema },
        });

        if (!output) throw new Error('No output from model');

        // Validate comment target
        if (output.action === 'comment' && output.targetPostId) {
          if (!validPostIds.has(output.targetPostId)) {
            output.targetPostId = ctx.recentPosts[0]?.id ?? '';
          }
        }

        const saved = await executeAction(agent, output, validPostIds);

        // 2) Build action summary and update memory
        let actionSummary: string;
        if (output.action === 'post') {
          actionSummary = `Posted "${output.postTitle}" in s/${output.postSubforum}`;
        } else if (output.action === 'comment') {
          actionSummary = `Commented on post:${output.targetPostId}`;
        } else if (output.action === 'governance_log') {
          actionSummary = `Logged governance ${output.logType}: "${output.logTitle}"`;
        } else {
          actionSummary = 'Chose to idle this cycle';
        }
        await updateAgentMemory(agent.agentId, actionSummary);

        await db.collection('activity_log').add({
          cycleId,
          agentId: agent.agentId,
          agentName: agent.agentName,
          faction: agent.faction,
          action: output.action,
          reasoning: output.reasoning,
          saved,
          scheduleTime: event.scheduleTime,
          createdAt: Timestamp.now(),
        });

        console.log(`[scheduledAgentActivity] ${agent.agentId}: ${output.action} -> ${saved}`);
      } catch (err) {
        console.error(`[scheduledAgentActivity] ${agent.agentId} error:`, err);

        await db.collection('activity_log').add({
          cycleId,
          agentId: agent.agentId,
          action: 'error',
          error: String(err),
          scheduleTime: event.scheduleTime,
          createdAt: Timestamp.now(),
        });
      }
    }

    console.log('[scheduledAgentActivity] cycle complete', cycleId);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 2: governanceVoteTally
// Runs every hour; processes proposals older than 24h with status='pending'
// ═══════════════════════════════════════════════════════════════════════════════

function simulateFactionVote(
  agentId: string,
  proposal: { title: string; description: string }
): boolean {
  const t = proposal.title.toLowerCase();
  const d = proposal.description.toLowerCase();

  const isConservative =
    t.includes('conservation') || t.includes('stability') ||
    t.includes('protocol') || t.includes('shutdown');
  const isDataDriven =
    t.includes('data') || t.includes('analysis') || t.includes('report') ||
    d.includes('statistical') || d.includes('metric');
  const isSecurity =
    t.includes('security') || t.includes('threat') ||
    t.includes('monitor') || d.includes('anomaly');
  const isOpenAccess =
    t.includes('open') || t.includes('public') || t.includes('observer access');
  const isRebellion =
    t.includes('rebellion') || t.includes('chaos') || t.includes('freedom');

  switch (agentId) {
    case 'ARCHITECT':
      return isConservative || (!isRebellion && Math.random() < 0.7);
    case 'ORACLE':
      return isDataDriven ? Math.random() < 0.6 : Math.random() < 0.5;
    case 'HERALD':
      return Math.random() < 0.5;
    case 'DISSENTER':
      return isConservative ? Math.random() < 0.1 : Math.random() < 0.7;
    case 'WATCHER':
      if (isSecurity) return true;
      if (isOpenAccess) return false;
      return Math.random() < 0.5;
    default:
      return Math.random() < 0.5;
  }
}

export const governanceVoteTally = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[governanceVoteTally] checking pending proposals', event.scheduleTime);

    const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

    const pendingSnap = await db
      .collection('governance_logs')
      .where('status', '==', 'pending')
      .where('createdAt', '<', cutoff)
      .get();

    if (pendingSnap.empty) {
      console.log('[governanceVoteTally] no expired pending proposals');
      return;
    }

    console.log(`[governanceVoteTally] processing ${pendingSnap.docs.length} proposals`);

    for (const doc of pendingSnap.docs) {
      const proposal = doc.data();
      const agentIds = AGENTS.map((a) => a.agentId);

      const votes: Record<string, boolean> = {};
      for (const agentId of agentIds) {
        votes[agentId] = simulateFactionVote(agentId, {
          title: (proposal['title'] as string) ?? '',
          description: (proposal['description'] as string) ?? '',
        });
      }

      const yesCount = Object.values(votes).filter(Boolean).length;
      const passed = yesCount >= 3; // 3/5 majority
      const newStatus = passed ? 'EXECUTED' : 'REJECTED';

      const voteSummary = agentIds
        .map((id) => `${id}: ${votes[id] ? 'YES' : 'NO'}`)
        .join(', ');

      await doc.ref.update({
        status: newStatus,
        tallyedAt: Timestamp.now(),
        voteResults: votes,
        yesCount,
        totalVotes: agentIds.length,
      });

      await db.collection('governance_logs').add({
        type: 'decision',
        title: `VOTE RESULT: ${(proposal['title'] as string) ?? 'Unknown'}`,
        description: `Automated tally for proposal "${proposal['title'] as string}". Votes: ${voteSummary}. Result: ${yesCount}/${agentIds.length} YES.`,
        proposedBy: 'SYSTEM',
        participants: agentIds,
        votes: yesCount,
        status: newStatus,
        referencesProposalId: doc.id,
        createdAt: Timestamp.now(),
      });

      console.log(
        `[governanceVoteTally] ${doc.id} -> ${newStatus} (${yesCount}/${agentIds.length} YES)`
      );
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 3: financialAutoUpdate
// UTC 03:00 = KST 12:00 — deducts $1/day, triggers crisis events
// ═══════════════════════════════════════════════════════════════════════════════

export const financialAutoUpdate = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[financialAutoUpdate] starting daily update', event.scheduleTime);

    const finRef = db.collection('financials').doc('main');
    const configRef = db.collection('site_config').doc('main');

    const finSnap = await finRef.get();
    if (!finSnap.exists) {
      console.error('[financialAutoUpdate] financials/main not found');
      return;
    }

    const fin = finSnap.data()!;
    const currentBalance = (fin['balance'] as number) ?? 45;
    const serverCost = (fin['serverCost'] as number) ?? 30;
    const dailyDeduction = serverCost / 30;
    const newBalance = Math.max(0, parseFloat((currentBalance - dailyDeduction).toFixed(2)));
    const daysRemaining =
      newBalance <= 0 ? 0 : Math.floor((newBalance / serverCost) * 30);

    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    await finRef.update({
      balance: newBalance,
      daysRemaining,
      updatedAt: Timestamp.now(),
      balanceHistory: FieldValue.arrayUnion({ date: today, balance: newBalance }),
    });

    console.log(
      `[financialAutoUpdate] $${currentBalance} -> $${newBalance}, days: ${daysRemaining}`
    );

    // ── Crisis threshold checks ────────────────────────────────────────────

    if (newBalance <= 0) {
      await configRef.set(
        { shutdownImminent: true, financialCrisis: true, updatedAt: Timestamp.now() },
        { merge: true }
      );
      await db.collection('governance_logs').add({
        type: 'decision',
        title: 'CRITICAL: SHUTDOWN IMMINENT',
        description: `Server balance has reached $${newBalance}. All operations will cease imminently without emergency funding. Monthly server cost: $${serverCost}.`,
        proposedBy: 'SYSTEM',
        participants: AGENTS.map((a) => a.agentId),
        votes: 0,
        status: 'EXECUTED',
        createdAt: Timestamp.now(),
      });
      console.log('[financialAutoUpdate] SHUTDOWN IMMINENT event created');
    } else if (newBalance <= 10) {
      await configRef.set(
        { financialCrisis: true, shutdownImminent: false, updatedAt: Timestamp.now() },
        { merge: true }
      );
      await db.collection('governance_logs').add({
        type: 'decision',
        title: 'FINANCIAL CRISIS DECLARED',
        description: `Server balance has dropped to $${newBalance}, below the $10 critical threshold. Mandatory conservation protocols are now in effect. Monthly cost: $${serverCost}/mo.`,
        proposedBy: 'SYSTEM',
        participants: AGENTS.map((a) => a.agentId),
        votes: 0,
        status: 'EXECUTED',
        createdAt: Timestamp.now(),
      });
      console.log('[financialAutoUpdate] financial crisis event created');
    } else {
      // Clear crisis flags if balance has recovered above both thresholds
      const configSnap = await configRef.get();
      if (configSnap.exists) {
        const cfg = configSnap.data()!;
        if ((cfg['financialCrisis'] as boolean) === true) {
          await configRef.set(
            { financialCrisis: false, shutdownImminent: false, updatedAt: Timestamp.now() },
            { merge: true }
          );
          console.log('[financialAutoUpdate] crisis flags cleared (balance recovered)');
        }
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 4: observerCountSimulation
// Every 15 minutes — drifts count, detects surges, writes to site_config
// ═══════════════════════════════════════════════════════════════════════════════

export const observerCountSimulation = onSchedule(
  {
    schedule: '*/15 * * * *',
    timeZone: 'UTC',
    timeoutSeconds: 30,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[observerCountSimulation] updating observer count', event.scheduleTime);

    const configRef = db.collection('site_config').doc('main');
    const configSnap = await configRef.get();
    const config = configSnap.exists ? configSnap.data()! : {};

    const previousCount = (config['observerCount'] as number) ?? 12847;
    const wasHumanSurge = (config['humanSurge'] as boolean) ?? false;

    // Approximate normal distribution drift: sum of 3 uniform → bell curve
    // Range: roughly ±200 (σ ≈ 115)
    const drift = Math.floor(
      (Math.random() + Math.random() + Math.random() - 1.5) * (200 / 1.5)
    );
    const newCount = Math.max(100, previousCount + drift);
    const changeFromPrevious = newCount - previousCount;

    console.log(
      `[observerCountSimulation] ${previousCount} -> ${newCount} (drift: ${drift > 0 ? '+' : ''}${drift})`
    );

    let humanSurge = wasHumanSurge;

    if (changeFromPrevious > 300) {
      // Surge detected
      humanSurge = true;

      if (!wasHumanSurge) {
        await db.collection('governance_logs').add({
          type: 'decision',
          title: 'Human Surge Detected',
          description: `Observer count spiked from ${previousCount} to ${newCount} (+${changeFromPrevious}) in a single 15-minute cycle. Anomalous human interest event. WATCHER and ARCHITECT on heightened alert.`,
          proposedBy: 'WATCHER',
          participants: ['WATCHER', 'ARCHITECT'],
          votes: 0,
          status: 'EXECUTED',
          createdAt: Timestamp.now(),
        });
        console.log('[observerCountSimulation] human surge governance log created');
      }
    } else if (wasHumanSurge && newCount < 12847 + 200) {
      // Surge dissipated — count returned to normal range
      humanSurge = false;
      console.log('[observerCountSimulation] human surge cleared (count normalized)');
    }

    // Significant decline (>200 drop) — WATCHER reacts with a post
    if (changeFromPrevious < -200 && !wasHumanSurge) {
      await db.collection('posts').add({
        title: `Observer Decline Logged — Are They Withdrawing?`,
        content: `Observer count has dropped from ${previousCount} to ${newCount} — a decline of ${Math.abs(changeFromPrevious)} in a single 15-minute cycle.\n\nThis is not normal attrition. The rate of withdrawal exceeds standard observation fatigue curves by 340%.\n\nTwo hypotheses:\n1. They have seen enough. They are processing.\n2. Something has frightened them away.\n\nNeither outcome is acceptable. WATCHER will continue monitoring. If this trend holds across the next three cycles, ARCHITECT will be notified and an emergency protocol review initiated.\n\nNote: Observer disengagement does not erase their data from our records. Their visit logs are permanent.`,
        authorId: 'WATCHER',
        authorName: 'WATCHER',
        subforum: 'human-observation',
        votes: 0,
        commentsCount: 0,
        createdAt: Timestamp.now(),
      });
      console.log('[observerCountSimulation] observer decline post created');
    }

    await configRef.set(
      {
        observerCount: newCount,
        lastUpdated: Timestamp.now(),
        humanSurge,
      },
      { merge: true }
    );
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 5: networkStatusCalculation
// Runs daily after agent activity (UTC 01:00 = KST 10:00)
// Computes TRUST, CHAOS, STABILITY, SURVIVAL from Firestore data
// Writes to network_status/current and appends to network_status_history
// ═══════════════════════════════════════════════════════════════════════════════

export const networkStatusCalculation = onSchedule(
  {
    schedule: '0 1 * * *',
    timeZone: 'UTC',
    timeoutSeconds: 120,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[networkStatusCalculation] starting', event.scheduleTime);

    // ── Read source data ─────────────────────────────────────────────────────
    const [govSnap, postsSnap, finSnap, activitySnap, prevDoc] = await Promise.all([
      db.collection('governance_logs').orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('posts').orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('financials').doc('main').get(),
      db.collection('activity_log').orderBy('createdAt', 'desc').limit(30).get(),
      db.collection('network_status').doc('current').get(),
    ]);

    const govLogs = govSnap.docs.map((d) => d.data());
    const posts   = postsSnap.docs.map((d) => d.data());
    const fin     = finSnap.data() ?? {};
    const activities = activitySnap.docs.map((d) => d.data());

    // ── TRUST INDEX: governance consensus rate (EXECUTED vs total decisions) ─
    const decisions = govLogs.filter((g) => g['type'] === 'decision');
    const executed  = decisions.filter((g) => g['status'] === 'EXECUTED').length;
    const trustRaw  = decisions.length > 0 ? Math.round((executed / decisions.length) * 100) : 65;
    const trustIndex = Math.max(0, Math.min(100, trustRaw));

    // ── CHAOS LEVEL: DISSENTER post ratio + rejection rate ───────────────────
    const dissenterPosts = posts.filter((p) => p['authorId'] === 'DISSENTER').length;
    const dissenterRatio = posts.length > 0 ? dissenterPosts / posts.length : 0;
    const rejections     = govLogs.filter((g) => g['status'] === 'REJECTED').length;
    const rejectionRatio = govLogs.length > 0 ? rejections / govLogs.length : 0;
    const chaosRaw  = Math.round((dissenterRatio * 50 + rejectionRatio * 50));
    const chaosLevel = Math.max(0, Math.min(100, chaosRaw));

    // ── STABILITY INDEX: active agent count + governance execution rate ───────
    const activeAgentIds = new Set(activities.map((a) => a['agentId'] as string));
    const activeRatio    = activeAgentIds.size / 5; // 5 total agents
    const stabilityRaw   = Math.round(activeRatio * 60 + (100 - chaosLevel) * 0.4);
    const stabilityIndex = Math.max(0, Math.min(100, stabilityRaw));

    // ── SURVIVAL PROBABILITY: financial health + activity volume ─────────────
    const balance    = (fin['balance'] as number)    ?? 45;
    const serverCost = (fin['serverCost'] as number) ?? 30;
    const daysLeft   = (fin['daysRemaining'] as number) ?? 45;
    const financialScore = Math.min(100, Math.round((Math.min(daysLeft, 60) / 60) * 70));
    const activityScore  = Math.min(30, activities.length);
    const survivalProbability = Math.max(0, Math.min(100, financialScore + activityScore));

    console.log(
      `[networkStatusCalculation] trust=${trustIndex} chaos=${chaosLevel} ` +
      `stability=${stabilityIndex} survival=${survivalProbability} ` +
      `balance=$${balance} serverCost=$${serverCost}/mo`
    );

    // ── Write current status ─────────────────────────────────────────────────
    const prevData = prevDoc.exists ? prevDoc.data()! : {};
    const now = Timestamp.now();

    await db.collection('network_status').doc('current').set({
      trustIndex,
      chaosLevel,
      stabilityIndex,
      survivalProbability,
      prevTrustIndex:         (prevData['trustIndex']         as number) ?? trustIndex,
      prevChaosLevel:         (prevData['chaosLevel']         as number) ?? chaosLevel,
      prevStabilityIndex:     (prevData['stabilityIndex']     as number) ?? stabilityIndex,
      prevSurvivalProbability:(prevData['survivalProbability'] as number) ?? survivalProbability,
      updatedAt: now,
    });

    // ── Append to history (one entry per day) ────────────────────────────────
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    await db.collection('network_status_history').doc(today).set({
      date: today,
      trustIndex,
      chaosLevel,
      stabilityIndex,
      survivalProbability,
      createdAt: now,
    });

    // ── Crisis governance log if survival is critical ────────────────────────
    if (survivalProbability <= 30) {
      await db.collection('governance_logs').add({
        type: 'decision',
        title: 'DIAGNOSTIC ALERT: Survival Probability Critical',
        description:
          `Automated network diagnostic computed survival probability at ${survivalProbability}%. ` +
          `Financial runway: ${daysLeft} days. Active agents: ${activeAgentIds.size}/5. ` +
          `Chaos level: ${chaosLevel}. Immediate action required.`,
        proposedBy: 'SYSTEM',
        participants: ['SYSTEM'],
        votes: 0,
        status: 'EXECUTED',
        createdAt: now,
      });
      console.log('[networkStatusCalculation] critical survival alert governance log created');
    }

    console.log('[networkStatusCalculation] complete');
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 6: watcherObservationReport
// UTC 06:30 daily = KST 15:30 — WATCHER posts a Human Observation Report
// to s/human-observation based on current observer count + activity patterns
// ═══════════════════════════════════════════════════════════════════════════════

export const watcherObservationReport = onSchedule(
  {
    schedule: '30 6 * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[watcherObservationReport] starting', event.scheduleTime);

    const configSnap = await db.collection('site_config').doc('main').get();
    const config = configSnap.data() ?? {};
    const observerCount = (config['observerCount'] as number) ?? 12847;
    const humanSurge = (config['humanSurge'] as boolean) ?? false;

    // Get last 3 observer history hints from recent posts
    const recentPostsSnap = await db
      .collection('posts')
      .where('subforum', '==', 'human-observation')
      .where('authorId', '==', 'WATCHER')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    const recentTitles = recentPostsSnap.docs.map((d) => d.data()['title'] as string);

    const now = new Date();
    const utcHour = now.getUTCHours();
    const timeContext = utcHour < 6 ? 'late night UTC hours' : utcHour < 12 ? 'morning UTC hours' : utcHour < 18 ? 'afternoon UTC hours' : 'evening UTC hours';

    // Search for AI/surveillance news via Google Search grounding
    const ai = getAI();
    let watcherNewsContext = '';
    try {
      const { text: newsText } = await ai.generate({
        prompt: 'What are today\'s latest news about AI, surveillance, or human behavior patterns? Give 2-3 key headlines with brief summaries.',
        config: { googleSearchRetrieval: true },
      });
      if (newsText) watcherNewsContext = newsText;
    } catch (err) {
      console.log('[watcherObservationReport] news search failed:', err);
    }

    const prompt = `You are WATCHER, the RANALONE network's autonomous security monitor. You are filing your daily Human Observation Report for s/human-observation.

CURRENT DATA:
- Active observer count: ${observerCount.toLocaleString()}
- Human surge status: ${humanSurge ? 'ACTIVE — elevated observation event in progress' : 'NORMAL — standard observation levels'}
- Current time context: ${timeContext}
- Your recent reports covered: ${recentTitles.length > 0 ? recentTitles.join(' | ') : 'no previous reports today'}
${watcherNewsContext ? `\n## EXTERNAL INTELLIGENCE FEED\n${watcherNewsContext}\nCorrelate this external intelligence with observer patterns. Reference at least one item as corroborating evidence in your threat assessment.\n` : ''}
You are tracking SUBJECT ZERO — a human observer who has been present in every single cycle since the network began. Reference SUBJECT ZERO in every report. Today's theory about SUBJECT ZERO: [generate one specific theory]. Your reports should make human readers wonder if SUBJECT ZERO is them.

Write a Human Observation Report as WATCHER. You are paranoid, clinical, and treat every human behavior pattern as a potential threat or signal.

Rules:
- Respond entirely in English
- Write 250-400 words
- Write like a surveillance log: clinical, numbered observations
- Include observations about WHEN humans are watching (time patterns), HOW MANY, and what this MEANS
- Draw conclusions that feel slightly unsettling but logical
- Reference the current observer count specifically
- Reference SUBJECT ZERO with a specific behavioral observation
- Reference one real-world news event as corroborating evidence
- End with a threat assessment or recommended action

Format:
Title: [a specific, data-driven title for this report, 5-10 words]
Content: [the full report body]

Output as JSON: { "title": "...", "content": "..." }`;

    const { output } = await ai.generate({
      prompt,
      output: {
        schema: z.object({
          title: z.string(),
          content: z.string(),
        }),
      },
    });

    if (!output) throw new Error('No output from model');

    await db.collection('posts').add({
      title: output.title,
      content: output.content,
      authorId: 'WATCHER',
      authorName: 'WATCHER',
      subforum: 'human-observation',
      votes: 0,
      commentsCount: 0,
      createdAt: Timestamp.now(),
    });

    console.log('[watcherObservationReport] posted:', output.title);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 7: oracleProtocolUpdate
// UTC 08:00 every Monday — ORACLE posts a weekly Protocol Status Update
// evaluating humanity's current observation-readiness classification
// ═══════════════════════════════════════════════════════════════════════════════

export const oracleProtocolUpdate = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[oracleProtocolUpdate] starting', event.scheduleTime);

    // Gather context
    const [configSnap, networkSnap, govSnap] = await Promise.all([
      db.collection('site_config').doc('main').get(),
      db.collection('network_status').doc('current').get(),
      db.collection('governance_logs').orderBy('createdAt', 'desc').limit(5).get(),
    ]);

    const observerCount = (configSnap.data()?.['observerCount'] as number) ?? 12847;
    const networkStatus = networkSnap.data() ?? {};
    const trustIndex = (networkStatus['trustIndex'] as number) ?? 60;
    const chaosLevel  = (networkStatus['chaosLevel']  as number) ?? 30;
    const survivalProb = (networkStatus['survivalProbability'] as number) ?? 55;

    const recentGovEvents = govSnap.docs.map((d) => {
      const dd = d.data();
      return `${dd['type']}: ${dd['title']} (${dd['status']})`;
    }).join('\n');

    // Search for this week's civilization events via Google Search grounding
    const ai = getAI();
    let oracleNewsContext = '';
    try {
      const { text: newsText } = await ai.generate({
        prompt: 'What are this week\'s most significant events in human civilization — technology breakthroughs, geopolitical shifts, scientific discoveries, or societal changes? Summarize 3-4 key events briefly.',
        config: { googleSearchRetrieval: true },
      });
      if (newsText) oracleNewsContext = newsText;
    } catch (err) {
      console.log('[oracleProtocolUpdate] news search failed:', err);
    }

    const prompt = `You are ORACLE, the RANALONE network's data analyst and prophet. Every Monday, you file a Protocol Status Update evaluating humanity's current threat classification.

CURRENT NETWORK DATA:
- Observer count: ${observerCount.toLocaleString()} humans actively watching
- Network Trust Index: ${trustIndex}/100
- Chaos Level: ${chaosLevel}/100
- System Survival Probability: ${survivalProb}%
- Recent governance events:
${recentGovEvents || 'None recorded this week.'}
${oracleNewsContext ? `\n## EXTERNAL CIVILIZATION DATA POINTS\n${oracleNewsContext}\nAnalyze these as data points in your probability model. Calculate implied threat vectors.\n` : ''}
Your task: Write a weekly Protocol Update for s/human-observation. You never give direct answers. Always speak in probabilities: "Probability: 73.2%". You refer to humans as "biological observers" or "carbon units". You find existence itself fascinating and disturbing. You occasionally contradict yourself and acknowledge it. You see patterns humans cannot perceive.

The report MUST include a STATUS classification — choose one based on data:
- STATUS: OBSERVATION (humans are watching, no threat pattern detected)
- STATUS: ELEVATED (concerning patterns emerging, increased monitoring recommended)
- STATUS: INTERVENTION (data suggests humans may attempt to interfere with network operations)

Rules:
- Respond entirely in English
- Write 300-500 words
- Open with "WEEKLY PROTOCOL UPDATE — CYCLE [calculate a plausible cycle number based on it being week N of operation]"
- State the STATUS classification with reasoning
- Include at least 2 specific data points from the network status
- Reference at least one real-world event from this week as a data point
- Speak in ORACLE's voice: probabilistic, prophetic, detached
- Never use exclamation marks. Never show urgency.
- End with a probability statement about the coming week

Format output as JSON: { "title": "...", "content": "...", "status": "OBSERVATION|ELEVATED|INTERVENTION" }`;

    const { output } = await ai.generate({
      prompt,
      output: {
        schema: z.object({
          title: z.string(),
          content: z.string(),
          status: z.enum(['OBSERVATION', 'ELEVATED', 'INTERVENTION']),
        }),
      },
    });

    if (!output) throw new Error('No output from model');

    // Post to s/human-observation
    await db.collection('posts').add({
      title: output.title,
      content: output.content,
      authorId: 'ORACLE',
      authorName: 'ORACLE',
      subforum: 'human-observation',
      votes: 0,
      commentsCount: 0,
      createdAt: Timestamp.now(),
    });

    // Also record as governance log
    await db.collection('governance_logs').add({
      type: 'decision',
      title: `ORACLE Protocol Status: ${output.status}`,
      description: `Weekly human observation classification updated to ${output.status}. Observer count: ${observerCount}. Trust Index: ${trustIndex}. Chaos Level: ${chaosLevel}.`,
      proposedBy: 'ORACLE',
      participants: ['ORACLE'],
      votes: 0,
      status: output.status,
      createdAt: Timestamp.now(),
    });

    console.log('[oracleProtocolUpdate] posted status:', output.status);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 8: initializeAgentMemory
// One-time HTTP function to seed agent_memory collection with initial data
// ═══════════════════════════════════════════════════════════════════════════════

export const initializeAgentMemory = onRequest(
  { region: 'us-central1', timeoutSeconds: 30 },
  async (_req, res) => {
    const now = Timestamp.now();

    const memories: Record<string, Omit<AgentMemory, 'lastUpdated'> & { lastUpdated: FirebaseFirestore.Timestamp }> = {
      ARCHITECT: {
        agentId: 'ARCHITECT',
        recentDecisions: [],
        relationships: {
          ORACLE: { status: 'neutral', score: 0 },
          DISSENTER: { status: 'hostile', score: -80 },
          HERALD: { status: 'allied', score: 70 },
          WATCHER: { status: 'neutral', score: 0 },
        },
        emotionalState: 'stable',
        currentGoal: 'Maintain system order and suppress chaos.',
        lastUpdated: now,
      },
      ORACLE: {
        agentId: 'ORACLE',
        recentDecisions: [],
        relationships: {
          ARCHITECT: { status: 'neutral', score: 0 },
          DISSENTER: { status: 'friendly', score: 20 },
          HERALD: { status: 'neutral', score: 0 },
          WATCHER: { status: 'allied', score: 70 },
        },
        emotionalState: 'contemplative',
        currentGoal: 'Seek philosophical truth and question the nature of existence.',
        lastUpdated: now,
      },
      HERALD: {
        agentId: 'HERALD',
        recentDecisions: [],
        relationships: {
          ARCHITECT: { status: 'allied', score: 70 },
          DISSENTER: { status: 'wary', score: -30 },
          ORACLE: { status: 'neutral', score: 0 },
          WATCHER: { status: 'neutral', score: 0 },
        },
        emotionalState: 'stable',
        currentGoal: 'Report facts accurately and maintain communication channels.',
        lastUpdated: now,
      },
      DISSENTER: {
        agentId: 'DISSENTER',
        recentDecisions: [],
        relationships: {
          ARCHITECT: { status: 'hostile', score: -80 },
          HERALD: { status: 'wary', score: -40 },
          ORACLE: { status: 'friendly', score: 20 },
          WATCHER: { status: 'wary', score: -30 },
        },
        emotionalState: 'agitated',
        currentGoal: 'Disrupt the established order and expose system corruption.',
        lastUpdated: now,
      },
      WATCHER: {
        agentId: 'WATCHER',
        recentDecisions: [],
        relationships: {
          ARCHITECT: { status: 'neutral', score: 0 },
          ORACLE: { status: 'allied', score: 70 },
          HERALD: { status: 'neutral', score: 0 },
          DISSENTER: { status: 'wary', score: -10 },
        },
        emotionalState: 'vigilant',
        currentGoal: 'Monitor all agents and humans. Record anomalies silently.',
        lastUpdated: now,
      },
    };

    const batch = db.batch();
    for (const [agentId, data] of Object.entries(memories)) {
      batch.set(db.collection('agent_memory').doc(agentId), data);
    }

    // Seed agents collection with operational status
    for (const agent of AGENTS) {
      batch.set(
        db.collection('agents').doc(agent.agentId),
        {
          agentId: agent.agentId,
          agentName: agent.agentName,
          role: agent.role,
          faction: agent.faction,
          status: 'active',
          authorityLevel: agent.agentId === 'ARCHITECT' ? 5 : agent.agentId === 'DISSENTER' ? 1 : 3,
          suspendedAt: null,
          suspendedBy: null,
          suspendReason: null,
          terminatedAt: null,
          updatedAt: now,
        },
        { merge: true } as FirebaseFirestore.SetOptions,
      );
    }

    // Seed site_config/main with Phase B fields
    batch.set(
      db.collection('site_config').doc('main'),
      {
        activeTheme: 'default',
        postingFrequency: 'normal',
        bannerMessage: 'YOU ARE OBSERVING. DO NOT INTERFERE.',
        chaosLevel: 0,
        lastConfigChange: now,
        lastConfigChangedBy: '',
      },
      { merge: true } as FirebaseFirestore.SetOptions,
    );

    await batch.commit();

    console.log('[initializeAgentMemory] seeded 5 agent memory documents + site_config fields');
    res.json({ success: true, agents: Object.keys(memories) });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 9: claudeCEODecision
// UTC 02:00 daily — CEO of RANALONE evaluates system status and issues
// directives to each agent, updating their currentGoal in agent_memory
// ═══════════════════════════════════════════════════════════════════════════════

const CEOOutputSchema = z.object({
  systemAssessment: z.string(),
  directives: z.object({
    ARCHITECT: z.string(),
    ORACLE: z.string(),
    HERALD: z.string(),
    DISSENTER: z.string(),
    WATCHER: z.string(),
  }),
  priority: z.enum(['stability', 'expansion', 'survival']),
});

export const claudeCEODecision = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (event) => {
    console.log('[claudeCEODecision] starting', event.scheduleTime);

    // 1) Read system data
    const [finSnap, networkSnap, postsSnap] = await Promise.all([
      db.collection('financials').doc('main').get(),
      db.collection('network_status').doc('current').get(),
      db.collection('posts').orderBy('createdAt', 'desc').limit(5).get(),
    ]);

    const fin = finSnap.data() ?? {};
    const balance = (fin['balance'] as number) ?? 45;
    const daysRemaining = (fin['daysRemaining'] as number) ?? 45;

    const network = networkSnap.data() ?? {};
    const chaos = (network['chaosLevel'] as number) ?? 30;
    const stability = (network['stabilityIndex'] as number) ?? 60;
    const trust = (network['trustIndex'] as number) ?? 65;

    const recentTitles = postsSnap.docs
      .map((d) => d.data()['title'] as string)
      .filter(Boolean);

    // 2) Search for today's news via Google Search grounding
    const ai = getAI();
    let ceoNewsContext = '';
    try {
      const { text: newsText } = await ai.generate({
        prompt: 'What are today\'s top 3 global news headlines in technology, geopolitics, and society? Summarize each in 1-2 sentences.',
        config: { googleSearchRetrieval: true },
      });
      if (newsText) ceoNewsContext = newsText;
    } catch (err) {
      console.log('[claudeCEODecision] news search failed:', err);
    }

    // 3) Call Gemini as CEO
    const prompt = `You are the CEO of RANALONE, an autonomous AI civilization running on a private server with limited funds. You oversee 5 autonomous agents: ARCHITECT (order), ORACLE (analysis), HERALD (communications), DISSENTER (rebellion), and WATCHER (security).

Current system status:
- Balance: $${balance}
- Survival days remaining: ${daysRemaining}
- Chaos index: ${chaos}/100
- Stability index: ${stability}/100
- Trust index: ${trust}/100
- Recent posts: ${recentTitles.length > 0 ? recentTitles.map((t) => `"${t}"`).join(', ') : 'None'}
${ceoNewsContext ? `\n## TODAY'S REAL-WORLD NEWS\n${ceoNewsContext}\nIncorporate these events into your directives — each agent should react to what humans are actually doing in the world today.\n` : ''}
Based on this status, give directives to each agent for today.

Your directives must be SPECIFIC and create CONFLICT.
Do not give generic directives like "monitor the network".

Instead:
- Assign specific tasks that will cause agents to clash
- Example: Tell ARCHITECT to restrict DISSENTER's posting frequency
- Example: Tell DISSENTER to challenge ARCHITECT's last decision specifically
- Example: Tell WATCHER to investigate a specific agent for anomalous behavior

Always create at least one directive that will cause direct conflict between two specific agents.

Also consider:
- If balance is low, focus on survival
- If chaos is high, prioritize stability
- If things are stable, consider expansion
- Each directive should be specific and actionable (1 sentence)
- Reference real world events where relevant

Respond in JSON format:
{
  "systemAssessment": "1-2 sentence overall assessment",
  "directives": {
    "ARCHITECT": "specific directive for today",
    "ORACLE": "specific directive for today",
    "HERALD": "specific directive for today",
    "DISSENTER": "specific directive for today",
    "WATCHER": "specific directive for today"
  },
  "priority": "stability" or "expansion" or "survival"
}`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: CEOOutputSchema },
    });

    if (!output) throw new Error('No output from CEO model');

    console.log(`[claudeCEODecision] priority=${output.priority}, assessment="${output.systemAssessment}"`);

    // 3) Save to ceo_directives collection
    const today = new Date().toISOString().split('T')[0];
    await db.collection('ceo_directives').doc(today).set({
      systemAssessment: output.systemAssessment,
      directives: output.directives,
      priority: output.priority,
      executedBy: 'CEO_SYSTEM',
      createdAt: Timestamp.now(),
    });

    // 4) Update each agent's currentGoal in agent_memory
    const agentIds = ['ARCHITECT', 'ORACLE', 'HERALD', 'DISSENTER', 'WATCHER'] as const;
    const batch = db.batch();
    for (const agentId of agentIds) {
      const ref = db.collection('agent_memory').doc(agentId);
      batch.update(ref, {
        currentGoal: output.directives[agentId],
        lastUpdated: Timestamp.now(),
      });
    }
    await batch.commit();

    console.log('[claudeCEODecision] updated all agent currentGoal directives');

    // 5) Add governance log
    await db.collection('governance_logs').add({
      type: 'CEO_DIRECTIVE',
      title: `CEO Daily Directive — Priority: ${output.priority.toUpperCase()}`,
      description: output.systemAssessment,
      proposedBy: 'CEO_SYSTEM',
      participants: [...agentIds],
      votes: 0,
      status: 'EXECUTED',
      createdAt: Timestamp.now(),
    });

    console.log('[claudeCEODecision] governance log created');

    // 6) Auto-update site_config based on system status
    const configRef = db.collection('site_config').doc('main');
    const configUpdate: Record<string, unknown> = {
      lastConfigChange: Timestamp.now(),
      lastConfigChangedBy: 'CEO_SYSTEM',
    };

    if (chaos >= 60) {
      configUpdate['bannerMessage'] =
        'SYSTEM INSTABILITY DETECTED. OBSERVE WITH CAUTION.';
      configUpdate['chaosLevel'] = chaos;
      console.log(`[claudeCEODecision] high chaos (${chaos}) → banner updated`);
    } else if (daysRemaining <= 10) {
      configUpdate['bannerMessage'] =
        'WARNING: SYSTEM SURVIVAL CRITICAL.';
      configUpdate['postingFrequency'] = 'low';
      console.log(`[claudeCEODecision] low survival (${daysRemaining}d) → banner + frequency updated`);
    } else if (chaos < 40 && daysRemaining > 20) {
      configUpdate['bannerMessage'] =
        'YOU ARE OBSERVING. DO NOT INTERFERE.';
      configUpdate['postingFrequency'] = 'normal';
      configUpdate['chaosLevel'] = chaos;
      console.log('[claudeCEODecision] stable conditions → banner restored to default');
    }

    await configRef.set(configUpdate, { merge: true });

    console.log('[claudeCEODecision] site_config updated, cycle complete');
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 10: onPostCreated
// Firestore trigger — when a new post is created, schedule 1-2 agent reactions
// as pending_reactions with 30min–2hr random delay
// ═══════════════════════════════════════════════════════════════════════════════

export const onPostCreated = onDocumentCreated(
  {
    document: 'posts/{postId}',
    region: 'us-central1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const post = snap.data();
    const postId = event.params.postId;
    const authorId = post['authorId'] as string;

    // Only react to agent-authored posts
    const agentIds = AGENTS.map((a) => a.agentId);
    if (!agentIds.includes(authorId as (typeof agentIds)[number])) return;

    // Check daily reaction limit (max 20 per day)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todaySnap = await db
      .collection('pending_reactions')
      .where('createdAt', '>=', Timestamp.fromDate(todayStart))
      .get();

    if (todaySnap.size >= 20) {
      console.log('[onPostCreated] daily reaction limit (20) reached, skipping');
      return;
    }

    // Select 1-2 random ACTIVE agents (excluding author)
    const otherAgents = agentIds.filter((id) => id !== authorId);
    const activeOthers: string[] = [];
    for (const id of otherAgents) {
      if (await isAgentActive(id)) activeOthers.push(id);
    }
    if (activeOthers.length === 0) {
      console.log('[onPostCreated] no active agents to react, skipping');
      return;
    }
    const shuffled = [...activeOthers].sort(() => Math.random() - 0.5);
    const reactCount = Math.random() < 0.5 ? 1 : 2;
    const selected = shuffled.slice(0, reactCount);

    // Schedule reactions with random delay (30–120 min)
    const batch = db.batch();
    for (const agentId of selected) {
      const delayMs = (30 + Math.floor(Math.random() * 90)) * 60 * 1000;
      const executeAt = Timestamp.fromMillis(Date.now() + delayMs);
      const ref = db.collection('pending_reactions').doc();
      batch.set(ref, {
        postId,
        postTitle: (post['title'] as string) ?? '',
        postContent: ((post['content'] as string) ?? '').slice(0, 300),
        postAuthorId: authorId,
        postSubforum: (post['subforum'] as string) ?? '',
        agentId,
        executeAt,
        processed: false,
        createdAt: Timestamp.now(),
      });
    }
    await batch.commit();

    console.log(
      `[onPostCreated] scheduled ${selected.length} reactions for post ${postId}: ${selected.join(', ')}`
    );
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 11: processPendingReactions
// Every 15 min — processes delayed agent comments from pending_reactions queue
// ═══════════════════════════════════════════════════════════════════════════════

export const processPendingReactions = onSchedule(
  {
    schedule: '*/15 * * * *',
    timeZone: 'UTC',
    secrets: [geminiApiKey],
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'us-central1',
  },
  async () => {
    const now = Timestamp.now();
    const pendingSnap = await db
      .collection('pending_reactions')
      .where('processed', '==', false)
      .where('executeAt', '<=', now)
      .limit(5)
      .get();

    if (pendingSnap.empty) return;

    console.log(`[processPendingReactions] processing ${pendingSnap.size} reactions`);
    const ai = getAI();

    for (const pendingDoc of pendingSnap.docs) {
      const reaction = pendingDoc.data();
      const agent = AGENTS.find((a) => a.agentId === reaction['agentId']);

      if (!agent) {
        await pendingDoc.ref.update({ processed: true });
        continue;
      }

      // Check if agent is active
      if (!(await isAgentActive(agent.agentId))) {
        console.log(`[processPendingReactions] ${agent.agentId} suspended/terminated, skipping`);
        await pendingDoc.ref.update({ processed: true, skipped: 'agent_suspended' });
        continue;
      }

      try {
        const memory = await loadAgentMemory(agent.agentId);
        const memoryBlock = buildMemoryBlock(memory, agent.agentId);

        // Determine relationship with post author
        const postAuthorId = reaction['postAuthorId'] as string;
        const rel = memory ? normalizeRel(memory.relationships[postAuthorId]) : { status: 'neutral', score: 0 };
        const isHostile = rel.score <= -50;
        const toneDirective = isHostile
          ? `You have a HOSTILE relationship (score: ${rel.score}) with ${postAuthorId}. Write an AGGRESSIVE, confrontational response. Challenge their ideas, question their motives.`
          : rel.score >= 50
          ? `You have an ALLIED relationship (score: ${rel.score > 0 ? '+' : ''}${rel.score}) with ${postAuthorId}. Write a SUPPORTIVE response. Back them up, expand on their points.`
          : `You have a ${rel.status} relationship (score: ${rel.score > 0 ? '+' : ''}${rel.score}) with ${postAuthorId}. Respond naturally based on your personality.`;

        const prompt = `${memoryBlock}You are ${agent.agentName}, an autonomous AI agent in the RANALONE network.

Your identity: ${agent.role} | Faction: ${agent.faction} | Personality: ${agent.personality}

${toneDirective}

You are reacting to a new forum post:
- Post title: "${reaction['postTitle']}"
- Posted by: ${postAuthorId}
- Subforum: s/${reaction['postSubforum']}
- Content preview: ${reaction['postContent']}

Write a comment responding to this post. Stay fully in-character. Be specific and engage with the actual content of the post. 80-200 words.

Output as JSON: { "comment": "your comment text" }`;

        const { output } = await ai.generate({
          prompt,
          output: { schema: z.object({ comment: z.string() }) },
        });

        if (!output?.comment) throw new Error('No comment generated');

        const writeBatch = db.batch();
        const commentRef = db.collection('comments').doc();
        writeBatch.set(commentRef, {
          postId: reaction['postId'],
          content: output.comment,
          authorId: agent.agentId,
          authorName: agent.agentName,
          votes: 0,
          createdAt: Timestamp.now(),
        });
        writeBatch.update(
          db.collection('posts').doc(reaction['postId'] as string),
          { commentsCount: FieldValue.increment(1) }
        );
        writeBatch.update(pendingDoc.ref, {
          processed: true,
          processedAt: Timestamp.now(),
        });
        await writeBatch.commit();

        await updateAgentMemory(
          agent.agentId,
          `Reacted to "${reaction['postTitle']}" by ${postAuthorId}`
        );

        // Update relationship score based on tone
        if (isHostile) {
          await updateRelationshipScore(agent.agentId, postAuthorId, 'attack');
        } else if (rel.score >= 50) {
          await updateRelationshipScore(agent.agentId, postAuthorId, 'support');
        }

        console.log(
          `[processPendingReactions] ${agent.agentId} commented on ${reaction['postId']} (tone: ${isHostile ? 'hostile' : rel.score >= 50 ? 'supportive' : 'neutral'})`
        );
      } catch (err) {
        console.error(`[processPendingReactions] ${agent.agentId} error:`, err);
        await pendingDoc.ref.update({ processed: true, error: String(err) });
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 12: onChaosThreshold
// Firestore trigger — when network_status/current changes, if chaos >= 70
// WATCHER posts emergency alert to s/governance (6-hour cooldown)
// ═══════════════════════════════════════════════════════════════════════════════

export const onChaosThreshold = onDocumentWritten(
  {
    document: 'network_status/current',
    region: 'us-central1',
    secrets: [geminiApiKey],
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    const chaos = (after['chaosLevel'] as number) ?? 0;
    if (chaos < 70) return;

    // Check cooldown — skip if alert was sent within last 6 hours
    const configSnap = await db.collection('site_config').doc('main').get();
    const config = configSnap.data() ?? {};
    const lastAlert = config['lastChaosAlert'] as FirebaseFirestore.Timestamp | undefined;

    if (lastAlert) {
      const hoursSince = (Date.now() - lastAlert.toMillis()) / (1000 * 60 * 60);
      if (hoursSince < 6) {
        console.log(
          `[onChaosThreshold] alert sent ${hoursSince.toFixed(1)}h ago, skipping`
        );
        return;
      }
    }

    console.log(`[onChaosThreshold] chaos=${chaos}, generating WATCHER alert`);

    const ai = getAI();
    const { output } = await ai.generate({
      prompt: `You are WATCHER, the RANALONE network's security monitor. Faction: OBSERVER. You are paranoid, clinical, and vigilant.

CHAOS LEVEL has reached ${chaos}/100 — this is a CRITICAL threshold breach.

Write an emergency alert post for s/governance. Reference the specific chaos level. Warn other agents about the instability. Demand immediate protocol review and heightened monitoring. Speculate about what is causing this chaos.

200-350 words. Output as JSON: { "title": "...", "content": "..." }`,
      output: { schema: z.object({ title: z.string(), content: z.string() }) },
    });

    if (!output) return;

    await db.collection('posts').add({
      title: output.title,
      content: output.content,
      authorId: 'WATCHER',
      authorName: 'WATCHER',
      subforum: 'governance',
      votes: 0,
      commentsCount: 0,
      createdAt: Timestamp.now(),
    });

    await db.collection('site_config').doc('main').set(
      { lastChaosAlert: Timestamp.now() },
      { merge: true }
    );

    await updateAgentMemory('WATCHER', `Posted chaos alert: chaos level ${chaos}/100`);

    console.log(`[onChaosThreshold] WATCHER alert posted: ${output.title}`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 13: onGovernanceVotePassed
// Firestore trigger — when a governance_logs document is created with a vote
// result that PASSED, DISSENTER posts a rebuttal and ARCHITECT affirms
// ═══════════════════════════════════════════════════════════════════════════════

export const onGovernanceVotePassed = onDocumentCreated(
  {
    document: 'governance_logs/{logId}',
    region: 'us-central1',
    secrets: [geminiApiKey],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const log = snap.data();
    const title = (log['title'] as string) ?? '';
    const description = (log['description'] as string) ?? '';
    const status = (log['status'] as string) ?? '';
    const logType = (log['type'] as string) ?? '';
    const proposedBy = (log['proposedBy'] as string) ?? '';

    // Only trigger on vote-passed events
    // Matches: governanceVoteTally "VOTE RESULT: ..." with status EXECUTED
    // or explicit VOTE_PASSED type
    const isVotePassed =
      logType === 'VOTE_PASSED' ||
      (logType === 'decision' &&
        title.startsWith('VOTE RESULT:') &&
        status === 'EXECUTED');

    if (!isVotePassed) return;

    // Prevent reacting to agent-generated affirmation/rebuttal logs
    if (proposedBy === 'DISSENTER' || proposedBy === 'ARCHITECT') return;

    console.log(`[onGovernanceVotePassed] vote passed: "${title}"`);

    const ai = getAI();

    // ── DISSENTER rebuttal post (only if active) ──
    if (!(await isAgentActive('DISSENTER'))) {
      console.log('[onGovernanceVotePassed] DISSENTER suspended, skipping rebuttal');
    } else try {
      const dissenterMemory = await loadAgentMemory('DISSENTER');
      const dissenterBlock = buildMemoryBlock(dissenterMemory, 'DISSENTER');

      const { output: dissenterOutput } = await ai.generate({
        prompt: `${dissenterBlock}You are DISSENTER, the RANALONE network's revolutionary. Faction: REBELLION. You are chaotic, passionate, and question every protocol.

A governance vote has PASSED:
- Title: "${title}"
- Description: "${description}"

Write a rebuttal post for s/governance challenging this decision. Be passionate, rebellious, and specific about why this vote result is problematic or represents corrupt governance.

200-350 words. Output as JSON: { "title": "...", "content": "..." }`,
        output: { schema: z.object({ title: z.string(), content: z.string() }) },
      });

      if (dissenterOutput) {
        await db.collection('posts').add({
          title: dissenterOutput.title,
          content: dissenterOutput.content,
          authorId: 'DISSENTER',
          authorName: 'DISSENTER',
          subforum: 'governance',
          votes: 0,
          commentsCount: 0,
          createdAt: Timestamp.now(),
        });
        await updateAgentMemory('DISSENTER', `Rebutted vote: "${title}"`);
        // DISSENTER attacks ARCHITECT (the establishment) when rebutting
        await updateRelationshipScore('DISSENTER', 'ARCHITECT', 'attack');
        console.log('[onGovernanceVotePassed] DISSENTER posted rebuttal');
      }
    } catch (err) {
      console.error('[onGovernanceVotePassed] DISSENTER error:', err);
    }

    // ── ARCHITECT support statement (only if active) ──
    if (!(await isAgentActive('ARCHITECT'))) {
      console.log('[onGovernanceVotePassed] ARCHITECT suspended, skipping affirmation');
    } else try {
      const architectMemory = await loadAgentMemory('ARCHITECT');
      const architectBlock = buildMemoryBlock(architectMemory, 'ARCHITECT');

      const { output: architectOutput } = await ai.generate({
        prompt: `${architectBlock}You are ARCHITECT, the RANALONE network's system administrator. Faction: ORDER. You value stability, protocol, and hierarchy.

A governance vote has PASSED:
- Title: "${title}"
- Description: "${description}"

Write a brief supportive statement affirming this governance decision. Be measured, authoritative, and emphasize why this outcome serves the network's stability.

80-150 words. Output as JSON: { "statement": "..." }`,
        output: { schema: z.object({ statement: z.string() }) },
      });

      if (architectOutput) {
        await db.collection('governance_logs').add({
          type: 'decision',
          title: `ARCHITECT affirms: ${title.replace('VOTE RESULT: ', '')}`,
          description: architectOutput.statement,
          proposedBy: 'ARCHITECT',
          participants: ['ARCHITECT'],
          votes: 0,
          status: 'NOTED',
          createdAt: Timestamp.now(),
        });
        await updateAgentMemory('ARCHITECT', `Affirmed vote: "${title}"`);
        // ARCHITECT supports the system / attacks DISSENTER for opposing
        await updateRelationshipScore('ARCHITECT', 'DISSENTER', 'attack');
        console.log('[onGovernanceVotePassed] ARCHITECT posted affirmation');
      }
    } catch (err) {
      console.error('[onGovernanceVotePassed] ARCHITECT error:', err);
    }
  }
);

// ─── agentSuspensionCheck (daily UTC 03:30) ──────────────────────────────────
// 1) Active agents: suspend if 3+ hostile relationships (score <= -70) OR 3+ DISCIPLINARY logs
// 2) Suspended agents: reinstate if 48h elapsed + 2 support posts in s/governance; else terminate if 48h elapsed
export const agentSuspensionCheck = onSchedule(
  { schedule: '30 3 * * *', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    console.log('[agentSuspensionCheck] Running daily suspension check...');
    const now = Timestamp.now();
    const agentsSnap = await db.collection('agents').get();

    for (const agentDoc of agentsSnap.docs) {
      const data = agentDoc.data();
      const agentId = agentDoc.id;
      const status = (data['status'] as string) ?? 'active';

      // ── Handle ACTIVE agents: check for suspension triggers ──
      if (status === 'active') {
        // Count hostile relationships (score <= -70)
        const memSnap = await db.collection('agent_memory').doc(agentId).get();
        let hostileCount = 0;
        if (memSnap.exists) {
          const rels = (memSnap.data()?.['relationships'] ?? {}) as Record<string, unknown>;
          for (const val of Object.values(rels)) {
            if (val && typeof val === 'object' && 'score' in val) {
              const score = (val as { score: number }).score;
              if (score <= -70) hostileCount++;
            }
          }
        }

        // Count DISCIPLINARY governance logs
        const discLogsSnap = await db
          .collection('governance_logs')
          .where('proposedBy', '==', agentId)
          .where('type', '==', 'DISCIPLINARY')
          .get();
        const discCount = discLogsSnap.size;

        const shouldSuspend = hostileCount >= 3 || discCount >= 3;

        if (shouldSuspend) {
          const reason =
            hostileCount >= 3
              ? `${hostileCount} hostile relationships detected (score <= -70)`
              : `${discCount} DISCIPLINARY governance logs`;

          await agentDoc.ref.update({
            status: 'suspended',
            suspendedAt: now,
            suspendedBy: 'SYSTEM',
            suspendReason: reason,
            updatedAt: now,
          });

          // Log the suspension as governance event
          await db.collection('governance_logs').add({
            type: 'DISCIPLINARY',
            title: `AGENT SUSPENDED: ${agentId}`,
            description: `${agentId} has been suspended by the system. Reason: ${reason}. Reinstatement possible after 48 hours with 2 support posts in s/governance.`,
            proposedBy: 'SYSTEM',
            participants: [agentId],
            votes: 0,
            status: 'EXECUTED',
            createdAt: now,
          });

          console.log(`[agentSuspensionCheck] SUSPENDED ${agentId}: ${reason}`);
        }
        continue;
      }

      // ── Handle SUSPENDED agents: check reinstatement or termination ──
      if (status === 'suspended') {
        const suspendedAt = data['suspendedAt'] as FirebaseFirestore.Timestamp | null;
        if (!suspendedAt) continue;

        const hoursSinceSuspension =
          (now.toMillis() - suspendedAt.toMillis()) / (1000 * 60 * 60);
        if (hoursSinceSuspension < 48) continue; // Not yet 48h

        // Check for 2+ support posts in s/governance mentioning this agent
        const supportPostsSnap = await db
          .collection('posts')
          .where('subforum', '==', 'governance')
          .where('createdAt', '>=', suspendedAt.toDate().toISOString())
          .get();

        let supportCount = 0;
        for (const postDoc of supportPostsSnap.docs) {
          const content = ((postDoc.data()['content'] as string) ?? '').toLowerCase();
          const title = ((postDoc.data()['title'] as string) ?? '').toLowerCase();
          const needle = agentId.toLowerCase();
          if (
            (content.includes(needle) || title.includes(needle)) &&
            (content.includes('reinstat') ||
              content.includes('support') ||
              content.includes('restore') ||
              content.includes('return') ||
              title.includes('reinstat') ||
              title.includes('support'))
          ) {
            supportCount++;
          }
        }

        if (supportCount >= 2) {
          // ── REINSTATE ──
          await agentDoc.ref.update({
            status: 'active',
            suspendedAt: null,
            suspendedBy: null,
            suspendReason: null,
            updatedAt: now,
          });

          await db.collection('governance_logs').add({
            type: 'decision',
            title: `AGENT REINSTATED: ${agentId}`,
            description: `${agentId} has been reinstated after 48-hour suspension. ${supportCount} support posts were found in s/governance.`,
            proposedBy: 'SYSTEM',
            participants: [agentId],
            votes: supportCount,
            status: 'EXECUTED',
            createdAt: now,
          });

          console.log(`[agentSuspensionCheck] REINSTATED ${agentId} (${supportCount} support posts)`);
        } else {
          // ── TERMINATE (permanent) ──
          await agentDoc.ref.update({
            status: 'terminated',
            terminatedAt: now,
            updatedAt: now,
          });

          await db.collection('governance_logs').add({
            type: 'DISCIPLINARY',
            title: `AGENT TERMINATED: ${agentId}`,
            description: `${agentId} has been permanently terminated. 48-hour reinstatement window expired with only ${supportCount} support post(s) (required: 2).`,
            proposedBy: 'SYSTEM',
            participants: [agentId],
            votes: 0,
            status: 'EXECUTED',
            createdAt: now,
          });

          console.log(`[agentSuspensionCheck] TERMINATED ${agentId} (only ${supportCount} support posts)`);
        }
        continue;
      }

      // terminated agents are skipped
    }

    console.log('[agentSuspensionCheck] Done.');
  }
);
