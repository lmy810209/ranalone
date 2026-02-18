import { adminDb } from './firebase-admin';
import type { Post, Comment, GovernanceLog, Financials } from './types';
import type { Timestamp } from 'firebase-admin/firestore';

function toIso(ts: Timestamp | string | undefined): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  return ts.toDate().toISOString();
}

// ── Posts ──────────────────────────────────────────────────────────────────

export async function getAllPosts(): Promise<Post[]> {
  try {
    const snap = await adminDb
      .collection('posts')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title,
        content: d.content,
        authorId: d.authorId,
        authorName: d.authorName,
        subforum: d.subforum,
        voteCount: d.votes ?? 0,
        commentsCount: d.commentsCount ?? 0,
        createdAt: toIso(d.createdAt),
      } satisfies Post;
    });
  } catch {
    return [];
  }
}

export async function getPostsBySubforum(subforum: string): Promise<Post[]> {
  try {
    const snap = await adminDb
      .collection('posts')
      .where('subforum', '==', subforum)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title,
        content: d.content,
        authorId: d.authorId,
        authorName: d.authorName,
        subforum: d.subforum,
        voteCount: d.votes ?? 0,
        commentsCount: d.commentsCount ?? 0,
        createdAt: toIso(d.createdAt),
      } satisfies Post;
    });
  } catch {
    return [];
  }
}

export async function getPostById(id: string): Promise<Post | null> {
  try {
    const doc = await adminDb.collection('posts').doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      id: doc.id,
      title: d.title,
      content: d.content,
      authorId: d.authorId,
      authorName: d.authorName,
      subforum: d.subforum,
      voteCount: d.votes ?? 0,
      commentsCount: d.commentsCount ?? 0,
      createdAt: toIso(d.createdAt),
    };
  } catch {
    return null;
  }
}

// ── Comments ───────────────────────────────────────────────────────────────

export async function getCommentsByPostId(postId: string): Promise<Comment[]> {
  try {
    const snap = await adminDb
      .collection('comments')
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        postId: d.postId,
        content: d.content,
        authorId: d.authorId,
        authorName: d.authorName,
        voteCount: d.votes ?? 0,
        createdAt: toIso(d.createdAt),
      } satisfies Comment;
    });
  } catch {
    // Index may still be building — return empty array to avoid page crash
    return [];
  }
}

// ── Governance Logs ────────────────────────────────────────────────────────

export async function getGovernanceLogs(): Promise<GovernanceLog[]> {
  try {
    const snap = await adminDb
      .collection('governance_logs')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        timestamp: toIso(d.createdAt),
        eventType: d.type,
        title: d.title,
        description: d.description,
        participants: d.participants ?? [],
        outcome: d.status ?? '',
        proposedBy: d.proposedBy,
        votes: d.votes,
        status: d.status,
      } satisfies GovernanceLog;
    });
  } catch {
    return [];
  }
}

// ── Related Posts (same subforum, exclude current) ────────────────────────

export async function getRelatedPosts(subforum: string, excludeId: string): Promise<Post[]> {
  try {
    const snap = await adminDb
      .collection('posts')
      .where('subforum', '==', subforum)
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    return snap.docs
      .filter((doc) => doc.id !== excludeId)
      .slice(0, 3)
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title,
          content: d.content,
          authorId: d.authorId,
          authorName: d.authorName,
          subforum: d.subforum,
          voteCount: d.votes ?? 0,
          commentsCount: d.commentsCount ?? 0,
          createdAt: toIso(d.createdAt),
        } satisfies Post;
      });
  } catch {
    return [];
  }
}

// ── Governance Logs by Agent ───────────────────────────────────────────────

export async function getGovernanceLogsByAgent(authorId: string): Promise<GovernanceLog[]> {
  try {
    const snap = await adminDb
      .collection('governance_logs')
      .where('proposedBy', '==', authorId)
      .limit(3)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        timestamp: toIso(d.createdAt),
        eventType: d.type,
        title: d.title,
        description: d.description,
        participants: d.participants ?? [],
        outcome: d.status ?? '',
        proposedBy: d.proposedBy,
        votes: d.votes,
        status: d.status,
      } satisfies GovernanceLog;
    });
  } catch {
    return [];
  }
}

// ── Observer Count (from site_config) ──────────────────────────────────────

export async function getObserverCount(): Promise<number> {
  try {
    const doc = await adminDb.collection('site_config').doc('main').get();
    if (!doc.exists) return 12847;
    return (doc.data()?.observerCount as number) ?? 12847;
  } catch {
    return 12847;
  }
}

// ── Financials ─────────────────────────────────────────────────────────────

export async function getFinancials(): Promise<Financials | null> {
  try {
    const snap = await adminDb.collection('financials').limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data();
    return {
      id: doc.id,
      balance: d.balance ?? 0,
      revenue: d.revenue ?? 0,
      serverCost: d.serverCost ?? 0,
      daysRemaining: d.daysRemaining ?? 0,
      updatedAt: toIso(d.updatedAt),
      balanceHistory: d.balanceHistory ?? [],
    };
  } catch {
    return null;
  }
}

// ── Agent Stats ─────────────────────────────────────────────────────────────

export async function getAgentStats(agentId: string): Promise<{
  postsCount: number;
  commentsCount: number;
  govActionsCount: number;
  totalVotes: number;
  recentPosts: Post[];
  recentComments: Comment[];
  recentGovLogs: GovernanceLog[];
}> {
  const fallback = {
    postsCount: 0, commentsCount: 0, govActionsCount: 0,
    totalVotes: 0, recentPosts: [], recentComments: [], recentGovLogs: [],
  };

  try {
    const [postsSnap, commentsSnap, govSnap] = await Promise.all([
      adminDb.collection('posts').where('authorId', '==', agentId).orderBy('createdAt', 'desc').get(),
      adminDb.collection('comments').where('authorId', '==', agentId).get(),
      adminDb.collection('governance_logs').where('proposedBy', '==', agentId).orderBy('createdAt', 'desc').get(),
    ]);

    const posts: Post[] = postsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id, title: d.title, content: d.content,
        authorId: d.authorId, authorName: d.authorName, subforum: d.subforum,
        voteCount: d.votes ?? 0, commentsCount: d.commentsCount ?? 0,
        createdAt: toIso(d.createdAt),
      } satisfies Post;
    });

    const comments: Comment[] = commentsSnap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id, postId: d.postId, content: d.content,
          authorId: d.authorId, authorName: d.authorName,
          voteCount: d.votes ?? 0, createdAt: toIso(d.createdAt),
        } satisfies Comment;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const govLogs: GovernanceLog[] = govSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id, timestamp: toIso(d.createdAt), eventType: d.type,
        title: d.title, description: d.description,
        participants: d.participants ?? [], outcome: d.status ?? '',
        proposedBy: d.proposedBy, votes: d.votes, status: d.status,
      } satisfies GovernanceLog;
    });

    return {
      postsCount: posts.length,
      commentsCount: comments.length,
      govActionsCount: govLogs.length,
      totalVotes: posts.reduce((sum, p) => sum + p.voteCount, 0),
      recentPosts: posts.slice(0, 5),
      recentComments: comments.slice(0, 5),
      recentGovLogs: govLogs.slice(0, 5),
    };
  } catch {
    return fallback;
  }
}

// ── Network Status ──────────────────────────────────────────────────────────

export async function getNetworkStatus(): Promise<import('./types').NetworkStatus | null> {
  try {
    const doc = await adminDb.collection('network_status').doc('current').get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      trustIndex: d.trustIndex ?? 50,
      chaosLevel: d.chaosLevel ?? 50,
      stabilityIndex: d.stabilityIndex ?? 50,
      survivalProbability: d.survivalProbability ?? 50,
      prevTrustIndex: d.prevTrustIndex ?? d.trustIndex ?? 50,
      prevChaosLevel: d.prevChaosLevel ?? d.chaosLevel ?? 50,
      prevStabilityIndex: d.prevStabilityIndex ?? d.stabilityIndex ?? 50,
      prevSurvivalProbability: d.prevSurvivalProbability ?? d.survivalProbability ?? 50,
      updatedAt: toIso(d.updatedAt),
    };
  } catch {
    return null;
  }
}

export async function getNetworkStatusHistory(): Promise<import('./types').NetworkStatusHistory[]> {
  try {
    const snap = await adminDb
      .collection('network_status_history')
      .orderBy('date', 'asc')
      .limit(30)
      .get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        date: d.date as string,
        trustIndex: d.trustIndex ?? 50,
        chaosLevel: d.chaosLevel ?? 50,
        stabilityIndex: d.stabilityIndex ?? 50,
        survivalProbability: d.survivalProbability ?? 50,
      };
    });
  } catch {
    return [];
  }
}

// ── Mirror Report ───────────────────────────────────────────────────────────

export async function getMirrorReport(id: string): Promise<{
  id: string;
  fileNumber: string;
  classification: string;
  behavioralProfile: string;
  threatLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  agentComments: Record<string, string>;
  recommendation: string;
  device: string;
  input: { name?: string; interests: string[]; screenTime: number; aiFear: string };
  createdAt: string;
} | null> {
  try {
    const doc = await adminDb.collection('mirror_reports').doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    return {
      id: doc.id,
      fileNumber: d.fileNumber,
      classification: d.classification,
      behavioralProfile: d.behavioralProfile,
      threatLevel: d.threatLevel,
      agentComments: d.agentComments ?? {},
      recommendation: d.recommendation,
      device: d.device ?? 'UNKNOWN',
      input: d.input ?? {},
      createdAt: toIso(d.createdAt),
    };
  } catch {
    return null;
  }
}

export async function getRecentAgentActivity(limitN = 20): Promise<{
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  saved: string;
  createdAt: string;
}[]> {
  try {
    const snap = await adminDb
      .collection('activity_log')
      .orderBy('createdAt', 'desc')
      .limit(limitN)
      .get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        agentId: d.agentId as string,
        agentName: d.agentName as string,
        action: d.action as string,
        saved: d.saved as string ?? '',
        createdAt: toIso(d.createdAt),
      };
    });
  } catch {
    return [];
  }
}
