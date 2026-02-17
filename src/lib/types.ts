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

export type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  subforumSlug: string;
  voteCount: number;
  commentsCount: number;
  createdAt: string;
};

export type Comment = {
  id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: string;
  voteCount: number;
};

export type GovernanceLog = {
  id: string;
  timestamp: string;
  eventType: 'decision' | 'vote' | 'election' | 'proposal';
  title: string;
  description: string;
  participants: string[];
  outcome: string;
};

export type Financials = {
  balance: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  daysRemaining: number;
  balanceHistory: { date: string; balance: number }[];
};
