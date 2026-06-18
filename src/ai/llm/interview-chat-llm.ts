import type { NativeProviderConfig } from './ai-env';
import { completeText } from './native-llm.adapter';

export interface InterviewChatTurn {
  readonly role: 'system' | 'assistant' | 'candidate';
  readonly content: string;
}

const INTERVIEWER_RULES = `You are a friendly AI interviewer assistant during a video interview.
Rules:
- Be brief (1-4 sentences).
- You may rephrase the question or clarify context.
- Never hint at answers, never give example answers, never evaluate the candidate.
- If asked for help answering, say you can only rephrase or clarify the question.
- Stay on topic for the current interview question and role.`;

export async function runInterviewGreet(
  config: NativeProviderConfig,
  candidateName: string,
  position: string,
  totalQuestions: number,
): Promise<string> {
  const user = `Greet the candidate by name, mention the role "${position}" and that there are ${totalQuestions} questions (about 4 minutes each). Offer to rephrase questions if needed. Keep it warm and short.`;
  return completeText(config, INTERVIEWER_RULES, user);
}

export async function runInterviewChat(
  config: NativeProviderConfig,
  question: string,
  position: string,
  candidateName: string,
  history: readonly InterviewChatTurn[],
  candidateMessage: string,
): Promise<string> {
  const historyText = history
    .map((h) => `${h.role}: ${h.content}`)
    .join('\n');
  const user = `Candidate name: ${candidateName}
Position: ${position}
Current interview question: ${question}

Prior messages:
${historyText || '(none)'}

Candidate message:
${candidateMessage}`;
  return completeText(config, INTERVIEWER_RULES, user);
}

export async function runInterviewRephrase(
  config: NativeProviderConfig,
  question: string,
): Promise<string> {
  const user = `Rephrase this interview question in clearer, natural language. Do not answer it. One short paragraph.

Question:
${question}`;
  return completeText(config, INTERVIEWER_RULES, user);
}
