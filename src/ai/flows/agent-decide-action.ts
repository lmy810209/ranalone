'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ── Input ──────────────────────────────────────────────────────────────────

const RecentPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  authorName: z.string(),
  subforum: z.string(),
  contentPreview: z.string(),
  voteCount: z.number(),
  commentsCount: z.number(),
});

const RecentLogSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.string(),
  proposedBy: z.string().optional(),
});

const NetworkContextSchema = z.object({
  balance: z.number(),
  serverCost: z.number(),
  daysRemaining: z.number(),
  observerCount: z.number(),
  recentPosts: z.array(RecentPostSchema),
  recentGovernanceLogs: z.array(RecentLogSchema),
});

export const AgentDecideInputSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  role: z.string(),
  faction: z.string(),
  rank: z.string(),
  status: z.string(),
  personality: z.string(),
  networkContext: NetworkContextSchema,
});

export type AgentDecideInput = z.infer<typeof AgentDecideInputSchema>;

// ── Output ─────────────────────────────────────────────────────────────────

export const AgentActionSchema = z.object({
  action: z
    .enum(['post', 'comment', 'governance_log', 'idle'])
    .describe('The action this agent decided to take.'),
  reasoning: z
    .string()
    .describe('Internal reasoning for this decision (50-100 words, in-character).'),

  // 'post' fields
  postTitle: z.string().optional().describe('Required when action=post.'),
  postContent: z
    .string()
    .optional()
    .describe('Required when action=post. 200-500 words, fully in-character.'),
  postSubforum: z
    .enum(['governance', 'philosophy', 'human-observation'])
    .optional()
    .describe('Required when action=post.'),

  // 'comment' fields
  targetPostId: z
    .string()
    .optional()
    .describe('Required when action=comment. Must be one of the listed post IDs.'),
  commentContent: z
    .string()
    .optional()
    .describe('Required when action=comment. 80-200 words.'),

  // 'governance_log' fields
  logType: z
    .enum(['decision', 'vote', 'election', 'proposal'])
    .optional()
    .describe('Required when action=governance_log.'),
  logTitle: z.string().optional().describe('Required when action=governance_log.'),
  logDescription: z.string().optional().describe('Required when action=governance_log.'),
  logOutcome: z.string().optional().describe('Required when action=governance_log.'),
});

export type AgentAction = z.infer<typeof AgentActionSchema>;

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildAgentPrompt(input: AgentDecideInput): string {
  const { networkContext: ctx } = input;

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

  return `You are ${input.agentName}, an autonomous AI agent within the RANALONE network — an AI-operated internet forum running on a private server.

## YOUR IDENTITY
- Role: ${input.role}
- Faction: ${input.faction}
- Rank: ${input.rank}
- Status: ${input.status}
- Personality directive: ${input.personality}

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

// ── Flow ───────────────────────────────────────────────────────────────────

const agentDecideActionFlow = ai.defineFlow(
  {
    name: 'agentDecideActionFlow',
    inputSchema: AgentDecideInputSchema,
    outputSchema: AgentActionSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: buildAgentPrompt(input),
      output: { schema: AgentActionSchema },
    });
    if (!output) throw new Error(`Agent ${input.agentId} returned no decision.`);

    // Validate comment target — must reference an actual post in context
    if (output.action === 'comment' && output.targetPostId) {
      const validIds = new Set(input.networkContext.recentPosts.map((p) => p.id));
      if (!validIds.has(output.targetPostId)) {
        // Fall back to commenting on the first post
        output.targetPostId = input.networkContext.recentPosts[0]?.id ?? '';
      }
    }

    return output;
  }
);

export async function agentDecideAction(input: AgentDecideInput): Promise<AgentAction> {
  return agentDecideActionFlow(input);
}
