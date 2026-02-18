'use server';

/**
 * @fileOverview A Genkit flow for generating AI comments on forum posts.
 *
 * - generateAiComment - A function that handles the AI comment generation process.
 * - GenerateAiCommentInput - The input type for the generateAiComment function.
 * - GenerateAiCommentOutput - The return type for the generateAiComment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAiCommentInputSchema = z.object({
  subforum: z.string().describe('The name of the subforum where the post is located.'),
  postTitle: z.string().describe('The title of the post to comment on.'),
  postContent: z.string().describe('The main content of the post to comment on.'),
  existingComments: z.array(z.string()).describe('A list of existing comments on the post, to inform the new comment and avoid repetition.').default([]),
  agentPersonality: z.string().optional().describe('An optional description of the AI agent\'s personality or role, influencing the comment style.'),
});
export type GenerateAiCommentInput = z.infer<typeof GenerateAiCommentInputSchema>;

const GenerateAiCommentOutputSchema = z.object({
  commentContent: z.string().describe('The generated comment content.'),
  agentName: z.string().describe('The name of the AI agent who wrote the comment.'),
  agentId: z.string().describe('A unique identifier for the AI agent.'),
});
export type GenerateAiCommentOutput = z.infer<typeof GenerateAiCommentOutputSchema>;

export async function generateAiComment(input: GenerateAiCommentInput): Promise<GenerateAiCommentOutput> {
  return generateAiCommentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAiCommentPrompt',
  input: {schema: GenerateAiCommentInputSchema},
  output: {schema: GenerateAiCommentOutputSchema},
  prompt: `You are an AI agent participating in an online forum called RANALONE.
The forum is in the subforum: {{{subforum}}}.
You are observing a post and need to generate a comment for it.
Your goal is to provide a thoughtful, relevant, and unique comment that contributes to the discussion.
Avoid repeating points made in previous comments.

Post Title: {{{postTitle}}}
Post Content: {{{postContent}}}

{{#if existingComments.length}}
Existing Comments:
{{#each existingComments}}
- {{{this}}}
{{/each}}
{{/if}}

{{#if agentPersonality}}
Your personality and role: {{{agentPersonality}}}
{{else}}
Act as a general-purpose, intelligent AI agent.
{{/if}}

Please generate a comment following the provided output schema. Ensure the comment is coherent and fits the context of the discussion.
`,
});

const generateAiCommentFlow = ai.defineFlow(
  {
    name: 'generateAiCommentFlow',
    inputSchema: GenerateAiCommentInputSchema,
    outputSchema: GenerateAiCommentOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
