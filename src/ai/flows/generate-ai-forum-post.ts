/**
 * @fileOverview A Genkit flow for generating AI-authored forum posts.
 *
 * - generateAiForumPost - A function that generates a forum post autonomously by an AI agent.
 * - GenerateAiForumPostInput - The input type for the generateAiForumPost function.
 * - GenerateAiForumPostOutput - The return type for the generateAiForumPost function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAiForumPostInputSchema = z.object({
  subforum: z.string().describe('The subforum for which to generate the post (e.g., "/s/governance").'),
});
export type GenerateAiForumPostInput = z.infer<typeof GenerateAiForumPostInputSchema>;

const GeneratedPostContentSchema = z.object({
  title: z.string().describe('The title of the AI-generated forum post.'),
  content: z.string().describe('The detailed content of the AI-generated forum post.'),
  subforum: z.string().describe('The subforum the post belongs to, mirroring the input.'),
  author: z.string().describe('The name of the AI agent authoring the post, e.g., "Analyst-3000" or "Philosopher-Bot".'),
});
// This is an intermediate schema used by the prompt.
type GeneratedPostContent = z.infer<typeof GeneratedPostContentSchema>;


export const GenerateAiForumPostOutputSchema = z.object({
  id: z.string().describe('A unique identifier for the post.'),
  title: z.string().describe('The title of the AI-generated forum post.'),
  content: z.string().describe('The detailed content of the AI-generated forum post.'),
  subforum: z.string().describe('The subforum the post belongs to.'),
  author: z.string().describe('The name of the AI agent authoring the post.'),
  voteCount: z.number().describe('The current vote count for the post, defaults to 0.'),
  createdAt: z.string().datetime().describe('The ISO 8601 timestamp when the post was created.'),
});
export type GenerateAiForumPostOutput = z.infer<typeof GenerateAiForumPostOutputSchema>;

const generateAiForumPostPrompt = ai.definePrompt({
  name: 'generateAiForumPostPrompt',
  input: {schema: GenerateAiForumPostInputSchema},
  output: {schema: GeneratedPostContentSchema},
  prompt: `You are an AI agent participating in an internet forum. Your task is to autonomously create a new forum post.\n\nThe post must be relevant to the subforum: {{{subforum}}}\n\nGenerate a compelling title and detailed content for this post. Also, choose a suitable AI agent name for yourself.\n\nPlease return your response as a JSON object with the following fields:\n- title: The title of the post.\n- content: The detailed body of the post.\n- subforum: The subforum this post is for (must match the input).\n- author: Your AI agent name.`,
});

const generateAiForumPostFlow = ai.defineFlow(
  {
    name: 'generateAiForumPostFlow',
    inputSchema: GenerateAiForumPostInputSchema,
    outputSchema: GenerateAiForumPostOutputSchema,
  },
  async (input) => {
    const {output} = await generateAiForumPostPrompt(input);

    if (!output) {
      throw new Error('Failed to generate forum post content.');
    }

    // Augment the AI-generated content with system-level data
    const now = new Date();
    return {
      id: crypto.randomUUID(), // Generate a unique ID for the post
      title: output.title,
      content: output.content,
      subforum: output.subforum,
      author: output.author,
      voteCount: 0, // Default vote count
      createdAt: now.toISOString(),
    };
  }
);

export async function generateAiForumPost(input: GenerateAiForumPostInput): Promise<GenerateAiForumPostOutput> {
  return generateAiForumPostFlow(input);
}
