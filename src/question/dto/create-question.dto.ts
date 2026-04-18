import { QuestionDifficulty } from '../interfaces/question.interface';

export class CreateQuestionDto {
  text: string;
  expectedConcepts?: string[];
  redFlags?: string[];
  difficulty?: QuestionDifficulty;
  weight?: number;
}
