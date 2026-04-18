import { Injectable } from '@nestjs/common';

interface ChatMessage {
  role: 'system' | 'assistant' | 'candidate';
  content: string;
}

@Injectable()
export class AiService {
  // Mock implementation — replace with real LLM endpoint later
  // Endpoint will be configured via AI_API_URL env var

  async rephrase(question: string): Promise<string> {
    const aiUrl = process.env.AI_API_URL;

    if (aiUrl) {
      // Real AI endpoint — TODO: implement when ready
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rephrase',
          question,
        }),
      });
      const data = await res.json();
      return data.rephrased;
    }

    // Mock: simple rephrasing
    return `Let me put it differently: ${question} — In other words, could you share your experience or thoughts on this topic?`;
  }

  async chat(
    question: string,
    position: string,
    candidateName: string,
    history: ChatMessage[],
    candidateMessage: string,
  ): Promise<string> {
    const aiUrl = process.env.AI_API_URL;

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          question,
          position,
          candidateName,
          history,
          candidateMessage,
        }),
      });
      const data = await res.json();
      return data.response;
    }

    // Mock responses
    const msg = candidateMessage.toLowerCase();

    if (msg.includes('rephras') || msg.includes('перефразир') || msg.includes('другими словами')) {
      return await this.rephrase(question);
    }

    if (msg.includes('explain') || msg.includes('объясни') || msg.includes('что имеется')) {
      return `Great question! I'm asking about your experience related to: "${question}". Feel free to share a specific example from your work.`;
    }

    if (msg.includes('ready') || msg.includes('готов') || msg.includes('понял')) {
      return 'Perfect! Go ahead and record your answer when you\'re ready.';
    }

    return 'I can help clarify the question, but I cannot help with the answer itself. Would you like me to rephrase the question?';
  }

  async greet(candidateName: string, position: string, totalQuestions: number): Promise<string> {
    const aiUrl = process.env.AI_API_URL;

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'greet',
          candidateName,
          position,
          totalQuestions,
        }),
      });
      const data = await res.json();
      return data.response;
    }

    return `Hello, ${candidateName}! I'm your AI interviewer for the ${position} position. The interview has ${totalQuestions} questions, up to 4 minutes each. You can ask me to rephrase any question. Ready to begin?`;
  }
}
