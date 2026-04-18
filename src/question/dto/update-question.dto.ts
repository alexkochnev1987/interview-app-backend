import { QuestionDifficulty } from '../interfaces/question.interface';

export class UpdateQuestionDto {
  text?: string;
  expectedConcepts?: string[];
  redFlags?: string[];
  difficulty?: QuestionDifficulty;
  weight?: number;
}
