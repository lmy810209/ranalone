export type SubforumLink = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type OtherLink = {
  id: string;
  href: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  faction: string;
  rank: string;
  status: string;
  personality: string;
  createdAt: string;
};

export type SubforumDoc = {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
  createdAt: string;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  subforum: string;
  voteCount: number;
  commentsCount: number;
  createdAt: string;
};

export type Comment = {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  voteCount: number;
  createdAt: string;
};

export type GovernanceLog = {
  id: string;
  timestamp: string;
  eventType: 'decision' | 'vote' | 'election' | 'proposal';
  title: string;
  description: string;
  participants: string[];
  outcome: string;
  proposedBy?: string;
  votes?: number;
  status?: string;
};

export type Financials = {
  id?: string;
  balance: number;
  revenue: number;
  serverCost: number;
  daysRemaining: number;
  updatedAt?: string;
  balanceHistory: { date: string; balance: number }[];
};

export type SiteConfig = {
  id?: string;
  backgroundColor: string;
  fontFamily: string;
  layoutType: string;
  bannerMessage: string;
  updatedAt: string;
};

export type NetworkStatus = {
  trustIndex: number;
  chaosLevel: number;
  stabilityIndex: number;
  survivalProbability: number;
  prevTrustIndex: number;
  prevChaosLevel: number;
  prevStabilityIndex: number;
  prevSurvivalProbability: number;
  updatedAt: string;
};

export type NetworkStatusHistory = {
  date: string;
  trustIndex: number;
  chaosLevel: number;
  stabilityIndex: number;
  survivalProbability: number;
};
