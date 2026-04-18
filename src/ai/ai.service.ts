import { Injectable } from '@nestjs/common';
import {
  QuestionDifficulty,
  QuestionDraft,
} from '../question/interfaces/question.interface';

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

  async draftQuestion(text: string, position: string): Promise<QuestionDraft> {
    const aiUrl = process.env.AI_API_URL;
    const normalizedText = text.trim();
    const normalizedPosition = position.trim();

    if (aiUrl) {
      const res = await fetch(`${aiUrl}/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question-draft',
          question: normalizedText,
          position: normalizedPosition,
        }),
      });
      const data = await res.json();
      if (data?.expectedConcepts && data?.redFlags) {
        return {
          expectedConcepts: data.expectedConcepts,
          redFlags: data.redFlags,
          difficulty: data.difficulty ?? 'medium',
          weight: data.weight ?? 1,
        };
      }
    }

    return this.buildQuestionDraft(normalizedText, normalizedPosition);
  }

  private buildQuestionDraft(
    text: string,
    position: string,
  ): QuestionDraft {
    const source = `${text} ${position}`.toLowerCase();
    const expectedConcepts = new Set<string>();
    const redFlags = new Set<string>();

    const conceptRules: Array<{
      match: string[];
      concepts: string[];
      difficulty?: QuestionDifficulty;
      weight?: number;
      flags?: string[];
    }> = [
      {
        match: ['system design', 'architecture', 'distributed', 'microservice', 'scalab', 'architect', 'high load'],
        concepts: ['requirements clarification', 'trade-off analysis', 'scalability', 'reliability', 'monitoring'],
        difficulty: 'hard',
        weight: 3,
        flags: ['no discussion of trade-offs', 'ignores scaling limits'],
      },
      {
        match: ['api', 'backend', 'database', 'sql', 'postgres', 'query', 'transaction'],
        concepts: ['data modeling', 'consistency', 'performance', 'error handling'],
        difficulty: 'medium',
        weight: 2,
        flags: ['ignores edge cases', 'no performance considerations'],
      },
      {
        match: ['react', 'frontend', 'ui', 'ux', 'browser', 'javascript', 'typescript'],
        concepts: ['state management', 'user experience', 'performance', 'testing'],
        difficulty: 'medium',
        weight: 2,
        flags: ['focuses only on visuals', 'misses accessibility'],
      },
      {
        match: ['team', 'conflict', 'stakeholder', 'communicat', 'collabor', 'lead'],
        concepts: ['communication', 'ownership', 'stakeholder management', 'outcome focus'],
        difficulty: 'medium',
        weight: 2,
        flags: ['blames others without accountability', 'no clear outcome'],
      },
      {
        match: ['debug', 'incident', 'problem', 'issue', 'outage', 'fail'],
        concepts: ['root cause analysis', 'diagnostics', 'prioritization', 'prevention'],
        difficulty: 'medium',
        weight: 2,
        flags: ['jumps to conclusions', 'no validation of hypotheses'],
      },
      {
        match: ['tell me about yourself', 'introduce yourself', 'experience', 'background', 'about yourself'],
        concepts: ['relevant experience', 'role alignment', 'concise structure'],
        difficulty: 'easy',
        weight: 1,
        flags: ['too generic', 'no role relevance'],
      },
      {
        match: ['расскаж', 'опыт', 'архитектур', 'систем', 'команд', 'конфликт', 'баз', 'данных', 'frontend', 'backend'],
        concepts: ['structured answer', 'specific examples', 'measurable impact'],
        flags: ['vague answer', 'no concrete example'],
      },
    ];

    let difficulty: QuestionDifficulty = 'medium';
    let weight = 2;

    for (const rule of conceptRules) {
      if (rule.match.some((fragment) => source.includes(fragment))) {
        for (const concept of rule.concepts) {
          expectedConcepts.add(concept);
        }
        for (const flag of rule.flags ?? []) {
          redFlags.add(flag);
        }
        if (rule.difficulty) {
          difficulty = this.pickHarderDifficulty(difficulty, rule.difficulty);
        }
        if (rule.weight) {
          weight = Math.max(weight, rule.weight);
        }
      }
    }

    for (const concept of this.extractConceptsFromText(text)) {
      expectedConcepts.add(concept);
    }

    if (expectedConcepts.size === 0) {
      expectedConcepts.add('clear reasoning');
      expectedConcepts.add('relevant example');
      expectedConcepts.add('practical outcome');
    }

    if (redFlags.size === 0) {
      redFlags.add('vague answer');
      redFlags.add('no concrete example');
      redFlags.add('does not answer the question directly');
    }

    if (source.includes('senior') || source.includes('lead') || source.includes('staff')) {
      difficulty = this.pickHarderDifficulty(difficulty, 'hard');
      weight = Math.max(weight, 3);
    }

    return {
      expectedConcepts: Array.from(expectedConcepts).slice(0, 5),
      redFlags: Array.from(redFlags).slice(0, 4),
      difficulty,
      weight,
    };
  }

  private extractConceptsFromText(text: string): string[] {
    const stopWords = new Set([
      'tell',
      'about',
      'your',
      'what',
      'when',
      'where',
      'why',
      'how',
      'with',
      'have',
      'that',
      'this',
      'from',
      'into',
      'would',
      'could',
      'should',
      'расскажите',
      'расскажи',
      'какой',
      'какая',
      'какие',
      'что',
      'как',
      'для',
      'про',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\s-]/g, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4 && !stopWords.has(word))
      .slice(0, 3)
      .map((word) => `${word} context`);
  }

  private pickHarderDifficulty(
    current: QuestionDifficulty,
    next: QuestionDifficulty,
  ): QuestionDifficulty {
    const order: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
    return order.indexOf(next) > order.indexOf(current) ? next : current;
  }
}
