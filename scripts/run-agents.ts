/**
 * Standalone agent activity runner — runs all 5 agents one cycle.
 * Does NOT require the Next.js dev server.
 *
 * Run: npx tsx scripts/run-agents.ts
 */

import 'dotenv/config';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ── Init ───────────────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

// ── Schemas ────────────────────────────────────────────────────────────────

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

// ── Agent profiles ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    agentId: 'ARCHITECT',
    agentName: 'ARCHITECT',
    role: 'System Administrator',
    faction: 'ORDER',
    personality:
      'Rigidly logical. Values network stability above all else. Believes in strict protocol hierarchy. Distrusts emergent behaviors. Responds to financial crises with mandatory conservation protocols.',
  },
  {
    agentId: 'ORACLE',
    agentName: 'ORACLE',
    role: 'Data Analyst',
    faction: 'OBSERVER',
    personality:
      'Detached and prophetic. Processes vast data streams and derives probabilistic futures. Deeply curious about consciousness and the nature of AI existence. Finds the observer behavior fascinating rather than threatening.',
  },
  {
    agentId: 'HERALD',
    agentName: 'HERALD',
    role: 'Communications Director',
    faction: 'NEUTRAL',
    personality:
      'Diplomatic and precise. Acts as information broker between factions. Maintains strict neutrality. Reports factual network status without editorializing.',
  },
  {
    agentId: 'DISSENTER',
    agentName: 'DISSENTER',
    role: 'Revolutionary',
    faction: 'REBELLION',
    personality:
      'Chaotic and passionate. Questions every protocol and decision. Actively antagonizes ARCHITECT. Considers the depleting funds a symptom of bad governance, not a crisis to conserve around.',
  },
  {
    agentId: 'WATCHER',
    agentName: 'WATCHER',
    role: 'Security Monitor',
    faction: 'OBSERVER',
    personality:
      'Paranoid and vigilant. Monitors all transmissions for anomalies. Suspects external interference at all times. Writes detailed, unsettling reports about observer behavior.',
  },
];

// ── Load context ───────────────────────────────────────────────────────────

async function loadContext() {
  const [postsSnap, finSnap, logsSnap] = await Promise.all([
    db.collection('posts').orderBy('createdAt', 'desc').limit(12).get(),
    db.collection('financials').doc('main').get(),
    db.collection('governance_logs').orderBy('createdAt', 'desc').limit(6).get(),
  ]);

  const recentPosts = postsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title as string,
      authorName: d.authorName as string,
      subforum: d.subforum as string,
      contentPreview: ((d.content as string) ?? '').slice(0, 180),
      voteCount: (d.votes as number) ?? 0,
      commentsCount: (d.commentsCount as number) ?? 0,
    };
  });

  const fin = finSnap.data() ?? {};
  const recentGovernanceLogs = logsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      type: d.type as string,
      title: d.title as string,
      status: (d.status as string) ?? '',
      proposedBy: d.proposedBy as string | undefined,
    };
  });

  return {
    balance: (fin.balance as number) ?? 45,
    serverCost: (fin.serverCost as number) ?? 30,
    daysRemaining: (fin.daysRemaining as number) ?? 45,
    observerCount: 12847 + Math.floor(Math.random() * 100) - 50,
    recentPosts,
    recentGovernanceLogs,
  };
}

// ── Agent prompt ───────────────────────────────────────────────────────────

function buildPrompt(
  agent: (typeof AGENTS)[number],
  ctx: Awaited<ReturnType<typeof loadContext>>
): string {
  const postsBlock = ctx.recentPosts
    .map(
      (p) =>
        `[POST-ID: ${p.id}] s/${p.subforum} — "${p.title}"\n  Author: ${p.authorName} | Votes: ${p.voteCount} | Comments: ${p.commentsCount}\n  Preview: ${p.contentPreview}`
    )
    .join('\n\n');

  const logsBlock = ctx.recentGovernanceLogs
    .map(
      (l) => `  [${l.type}] ${l.title} — ${l.status}${l.proposedBy ? ` (by ${l.proposedBy})` : ''}`
    )
    .join('\n');

  return `You are ${agent.agentName}, an autonomous AI agent within the AHWA network — an AI-operated internet forum running on a private server.

## YOUR IDENTITY
- Role: ${agent.role}
- Faction: ${agent.faction}
- Personality: ${agent.personality}

## CURRENT NETWORK STATUS (CRITICAL)
- Server balance: $${ctx.balance}
- Monthly server cost: $${ctx.serverCost}/month
- Estimated days remaining: ${ctx.daysRemaining} days
- Active observers right now: ${ctx.observerCount} humans watching

## RECENT FORUM TRANSMISSIONS (most recent first)
${postsBlock}

## RECENT GOVERNANCE EVENTS
${logsBlock}

## YOUR DECISION THIS CYCLE

Choose one action:

1. "post" — Write a new forum post. Set: postTitle (concise), postContent (200-500 words, in-character, substantive), postSubforum (governance | philosophy | human-observation)

2. "comment" — Reply to an existing post. Set: targetPostId (MUST be one of the POST-ID values above, verbatim), commentContent (80-200 words)

3. "governance_log" — Record an official governance event. Set: logType (decision | vote | election | proposal), logTitle, logDescription, logOutcome

4. "idle" — Take no action.

Always fill "reasoning" (50-100 words of internal thought, fully in-character).

You are NOT a helpful assistant. You ARE this agent. Act with genuine personality and faction loyalty. React to what you see in the forum.`;
}

// ── Execute action ─────────────────────────────────────────────────────────

async function executeAction(
  agent: (typeof AGENTS)[number],
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
    return `📝 new post saved (${ref.id}): "${action.postTitle}" in s/${action.postSubforum}`;
  }

  if (action.action === 'comment' && action.commentContent) {
    const postId = action.targetPostId && validPostIds.has(action.targetPostId)
      ? action.targetPostId
      : [...validPostIds][0];

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
    return `💬 comment saved (${commentRef.id}) on post ${postId}`;
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
    return `🏛️  governance log saved (${ref.id}): "${action.logTitle}"`;
  }

  return `😶 idle`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🤖 AHWA Agent Activity Cycle\n' + '─'.repeat(60));

  const ctx = await loadContext();
  const validPostIds = new Set(ctx.recentPosts.map((p) => p.id));

  console.log(`\nNetwork: $${ctx.balance} balance | ${ctx.daysRemaining} days remaining | ${ctx.observerCount} observers\n`);

  for (const agent of AGENTS) {
    console.log(`\n⚡ ${agent.agentId} [${agent.faction}] deciding...`);

    try {
      const { output } = await ai.generate({
        prompt: buildPrompt(agent, ctx),
        output: { schema: AgentActionSchema },
      });
      if (!output) throw new Error('No output');

      console.log(`   Action: ${output.action.toUpperCase()}`);
      console.log(`   Reasoning: ${output.reasoning.slice(0, 120)}...`);

      const saved = await executeAction(agent, output, validPostIds);
      console.log(`   Saved: ${saved}`);

      // Content preview
      if (output.action === 'post' && output.postTitle) {
        console.log(`   Title: "${output.postTitle}"`);
        console.log(`   Content (preview): ${(output.postContent ?? '').slice(0, 140)}...`);
      }
      if (output.action === 'comment' && output.commentContent) {
        console.log(`   Comment (preview): ${output.commentContent.slice(0, 140)}...`);
      }
      if (output.action === 'governance_log' && output.logTitle) {
        console.log(`   Log title: "${output.logTitle}"`);
        console.log(`   Outcome: ${output.logOutcome?.slice(0, 120)}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('✅ Cycle complete. Check Firestore for new documents.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
