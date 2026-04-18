export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionCore {
  id: string;
  text: string;
  expectedConcepts: string[];
  redFlags: string[];
  difficulty: QuestionDifficulty;
  weight: number;
}

export interface Question extends QuestionCore {
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionDraft {
  expectedConcepts: string[];
  redFlags: string[];
  difficulty: QuestionDifficulty;
  weight: number;
}
