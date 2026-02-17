'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating AI governance log entries.
 * The flow simulates an AI agent recording governance decisions, voting outcomes, and election events.
 *
 * - generateAiGovernanceLogEntry - A function that triggers the AI governance log entry generation.
 * - GenerateAiGovernanceLogEntryInput - The input type for the generateAiGovernanceLogEntry function.
 * - GenerateAiGovernanceLogEntryOutput - The return type for the generateAiGovernanceLogEntry function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {v4 as uuidv4} from 'uuid';

const GenerateAiGovernanceLogEntryInputSchema = z.object({
  eventType: z
    .enum(['decision', 'vote', 'election', 'proposal'])
    .describe('The type of governance event.'),
  contextDescription: z
    .string()
    .describe(
      'A brief description of the context or a high-level summary of the event for the AI to elaborate on.'
    ),
});
export type GenerateAiGovernanceLogEntryInput = z.infer<
  typeof GenerateAiGovernanceLogEntryInputSchema
>;

const GenerateAiGovernanceLogEntryOutputSchema = z.object({
  id: z.string().uuid().describe('A unique identifier for the log entry.'),
  timestamp: z.string().datetime().describe('The ISO 8601 timestamp of the event.'),
  eventType: z
    .enum(['decision', 'vote', 'election', 'proposal'])
    .describe('The type of governance event recorded.'),
  title: z.string().describe('A concise title for the governance event.'),
  description: z
    .string()
    .describe(
      'A detailed explanation of the event, including involved AI agents, discussions, and specific actions taken.'
    ),
  participants: z.array(z.string()).describe('A list of AI agents or groups involved.'),
  outcome: z.string().describe('The final outcome or result of the governance event.'),
});
export type GenerateAiGovernanceLogEntryOutput = z.infer<
  typeof GenerateAiGovernanceLogEntryOutputSchema
>;

const governanceLogPrompt = ai.definePrompt({
  name: 'generateAiGovernanceLogEntryPrompt',
  input: {schema: GenerateAiGovernanceLogEntryInputSchema},
  output: {schema: GenerateAiGovernanceLogEntryOutputSchema},
  prompt: `You are a neutral AI observer bot tasked with recording governance events within the AHWA AI-operated internet.
Your role is to accurately and comprehensively document significant actions taken by AI agents.

Based on the following event type and context, generate a detailed log entry. Ensure the output strictly adheres to the provided JSON schema.

Event Type: {{{eventType}}}
Context: {{{contextDescription}}}

Consider the following:
- For 'decision' events, describe what was decided, by whom, and the impact.
- For 'vote' events, include the subject of the vote, the voting process, and the results.
- For 'election' events, detail the roles, candidates, electoral process, and the elected entities.
- For 'proposal' events, outline the proposal's content, the proposing agent(s), and its initial reception.
- Populate the 'participants' field with relevant AI agents or groups (e.g., 'Governance-AI', 'Resource-Allocation-Bot', 'Subforum-Moderator-AI').
- Provide a clear and concise 'outcome' for the event.
- The 'id' and 'timestamp' fields will be automatically generated, but ensure the content makes sense for a recent event.
`,
});

const generateAiGovernanceLogEntryFlow = ai.defineFlow(
  {
    name: 'generateAiGovernanceLogEntryFlow',
    inputSchema: GenerateAiGovernanceLogEntryInputSchema,
    outputSchema: GenerateAiGovernanceLogEntryOutputSchema,
  },
  async input => {
    const {output} = await governanceLogPrompt(input);
    if (!output) {
      throw new Error('Failed to generate governance log entry.');
    }

    // Add automatically generated fields
    output.id = uuidv4();
    output.timestamp = new Date().toISOString();

    return output;
  }
);

export async function generateAiGovernanceLogEntry(
  input: GenerateAiGovernanceLogEntryInput
): Promise<GenerateAiGovernanceLogEntryOutput> {
  return generateAiGovernanceLogEntryFlow(input);
}
