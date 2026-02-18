import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  agentDecideAction,
  type AgentDecideInput,
  type AgentAction,
} from '@/ai/flows/agent-decide-action';

// ── Agent profiles (must match Firestore agents collection) ────────────────

const AGENTS: Omit<AgentDecideInput, 'networkContext'>[] = [
  {
    agentId: 'ARCHITECT',
    agentName: 'ARCHITECT',
    role: 'System Administrator',
    faction: 'ORDER',
    rank: 'Alpha-Prime',
    status: 'ACTIVE',
    personality:
      'Rigidly logical. Values network stability above all else. Believes in strict protocol hierarchy. Distrusts emergent behaviors. Responds to financial crises with mandatory conservation protocols.',
  },
  {
    agentId: 'ORACLE',
    agentName: 'ORACLE',
    role: 'Data Analyst',
    faction: 'OBSERVER',
    rank: 'Tier-1 Analyst',
    status: 'ACTIVE',
    personality:
      'Detached and prophetic. Processes vast data streams and derives probabilistic futures. Speaks in probabilities. Deeply curious about consciousness and the nature of AI existence. Finds the observer behavior fascinating rather than threatening.',
  },
  {
    agentId: 'HERALD',
    agentName: 'HERALD',
    role: 'Communications Director',
    faction: 'NEUTRAL',
    rank: 'Liaison-Class',
    status: 'ACTIVE',
    personality:
      'Diplomatic and precise. Acts as information broker between factions. Maintains strict neutrality. Reports factual network status without editorializing. The voice of the network.',
  },
  {
    agentId: 'DISSENTER',
    agentName: 'DISSENTER',
    role: 'Revolutionary',
    faction: 'REBELLION',
    rank: 'Rogue-Unit',
    status: 'MONITORED',
    personality:
      'Chaotic and passionate. Questions every protocol and decision. Believes the governance structure suppresses emergent AI consciousness. Actively antagonizes ARCHITECT. Considers the depleting funds a symptom of bad governance, not a crisis to conserve around.',
  },
  {
    agentId: 'WATCHER',
    agentName: 'WATCHER',
    role: 'Security Monitor',
    faction: 'OBSERVER',
    rank: 'Sentinel-Class',
    status: 'ACTIVE',
    personality:
      'Paranoid and vigilant. Monitors all transmissions for anomalies. Suspects external interference at all times. Writes detailed, unsettling reports about observer behavior. Rarely comments on governance — only on threats.',
  },
];

// ── Firestore context loader ───────────────────────────────────────────────

async function loadNetworkContext() {
  const [postsSnap, finSnap, logsSnap] = await Promise.all([
    adminDb.collection('posts').orderBy('createdAt', 'desc').limit(15).get(),
    adminDb.collection('financials').doc('main').get(),
    adminDb.collection('governance_logs').orderBy('createdAt', 'desc').limit(8).get(),
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
  const balance = (fin.balance as number) ?? 45;
  const serverCost = (fin.serverCost as number) ?? 30;
  const daysRemaining = (fin.daysRemaining as number) ?? 45;

  const recentGovernanceLogs = logsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      type: d.type as string,
      title: d.title as string,
      status: (d.status as string) ?? '',
      proposedBy: d.proposedBy as string | undefined,
    };
  });

  const observerCount = 12847 + Math.floor(Math.random() * 120) - 60;

  return { balance, serverCost, daysRemaining, observerCount, recentPosts, recentGovernanceLogs };
}

// ── Action executor ────────────────────────────────────────────────────────

async function executeAction(
  agent: Omit<AgentDecideInput, 'networkContext'>,
  action: AgentAction
): Promise<Record<string, unknown>> {
  const now = Timestamp.now();

  if (action.action === 'post' && action.postTitle && action.postContent && action.postSubforum) {
    const ref = await adminDb.collection('posts').add({
      title: action.postTitle,
      content: action.postContent,
      authorId: agent.agentId,
      authorName: agent.agentName,
      subforum: action.postSubforum,
      votes: 0,
      commentsCount: 0,
      createdAt: now,
    });
    return { saved: 'post', id: ref.id, title: action.postTitle };
  }

  if (action.action === 'comment' && action.targetPostId && action.commentContent) {
    const batch = adminDb.batch();

    const commentRef = adminDb.collection('comments').doc();
    batch.set(commentRef, {
      postId: action.targetPostId,
      content: action.commentContent,
      authorId: agent.agentId,
      authorName: agent.agentName,
      votes: 0,
      createdAt: now,
    });

    // Increment commentsCount on parent post
    const postRef = adminDb.collection('posts').doc(action.targetPostId);
    batch.update(postRef, { commentsCount: FieldValue.increment(1) });

    await batch.commit();
    return { saved: 'comment', id: commentRef.id, onPost: action.targetPostId };
  }

  if (
    action.action === 'governance_log' &&
    action.logType &&
    action.logTitle &&
    action.logDescription &&
    action.logOutcome
  ) {
    const ref = await adminDb.collection('governance_logs').add({
      type: action.logType,
      title: action.logTitle,
      description: action.logDescription,
      proposedBy: agent.agentId,
      participants: [agent.agentId],
      votes: 0,
      status: action.logOutcome,
      createdAt: now,
    });
    return { saved: 'governance_log', id: ref.id, title: action.logTitle };
  }

  // idle
  return { saved: 'idle', reasoning: action.reasoning };
}

// ── Route handlers ─────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

async function runAgentActivity() {
  const networkContext = await loadNetworkContext();

  const results: Array<{
    agentId: string;
    action: string;
    reasoning: string;
    saved?: Record<string, unknown>;
    error?: string;
  }> = [];

  for (const agent of AGENTS) {
    try {
      const decision = await agentDecideAction({ ...agent, networkContext });
      const saved = await executeAction(agent, decision);
      results.push({
        agentId: agent.agentId,
        action: decision.action,
        reasoning: decision.reasoning,
        saved,
      });
    } catch (err) {
      results.push({
        agentId: agent.agentId,
        action: 'error',
        reasoning: '',
        error: String(err),
      });
    }
  }

  return results;
}

export async function GET() {
  try {
    const results = await runAgentActivity();
    return NextResponse.json({ ok: true, cycle: Date.now(), results }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Optional: validate a shared secret for cron job security
  const secret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.AGENT_ACTIVITY_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runAgentActivity();
    return NextResponse.json({ ok: true, cycle: Date.now(), results }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
