import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { DraftQuestionDto } from '../ai/dto/ai.dto';
import { CreateInterviewDto } from '../interview/dto/create-interview.dto';
import { CreateQuestionDto } from '../question/dto/create-question.dto';

async function validateDto<T extends object>(
  Cls: new () => T,
  dto: object,
): Promise<ValidationError[]> {
  const instance = plainToInstance(Cls, dto);
  return validate(instance);
}

async function validateDtoWithWhitelist<T extends object>(
  Cls: new () => T,
  dto: object,
): Promise<T> {
  const instance = plainToInstance(Cls, dto, { enableImplicitConversion: true });
  const errors = await validate(instance, { whitelist: true });
  expect(errors).toHaveLength(0);
  return instance;
}

describe('DTO validation', () => {
  it('rejects CreateQuestionDto without primary translations block', async () => {
    const errors = await validateDto(CreateQuestionDto, {
      difficulty: 'medium',
      weight: 1,
    });
    expect(errors.some((error) => error.property === 'translations')).toBe(
      true,
    );
  });

  it('rejects CreateInterviewDto with empty questionIds', async () => {
    const errors = await validateDto(CreateInterviewDto, {
      candidateName: 'Contract Test Candidate',
      position: 'Engineer',
      questionIds: [],
    });
    expect(errors.some((error) => error.property === 'questionIds')).toBe(true);
  });

  it('accepts minimal valid CreateInterviewDto', async () => {
    const errors = await validateDto(CreateInterviewDto, {
      candidateName: 'Alex',
      position: 'Engineer',
      questionIds: ['question-1'],
    });
    expect(errors).toHaveLength(0);
  });

  it('keeps nested rubric fields on DraftQuestionDto under ValidationPipe whitelist', async () => {
    const instance = await validateDtoWithWhitelist(DraftQuestionDto, {
      mode: 'translate',
      locale: 'pl',
      question: {
        primaryLocale: 'ru',
        questionText: 'Что такое DOM?',
        followUpQuestions: ['Можете привести пример?', 'Какую ошибку избегаете?'],
        expectedConcepts: [
          { id: 'dom_model', label: 'модель DOM', weight: 0.34, description: 'структура' },
          { id: 'rendering', label: 'отрисовка', weight: 0.33, description: 'обновления' },
          { id: 'practical_use', label: 'практика', weight: 0.33, description: 'пример' },
        ],
        redFlags: [
          { id: 'confuses_dom', label: 'Путает DOM', severity: 'medium' },
          { id: 'no_example', label: 'Нет примера', severity: 'high' },
        ],
        sampleGoodAnswer: 'DOM — объектная модель документа в браузере.',
      },
    });

    expect(instance.question?.expectedConcepts).toHaveLength(3);
    expect(instance.question?.expectedConcepts?.[0]).toEqual({
      id: 'dom_model',
      label: 'модель DOM',
      weight: 0.34,
      description: 'структура',
    });
    expect(instance.question?.redFlags?.[0]).toEqual({
      id: 'confuses_dom',
      label: 'Путает DOM',
      severity: 'medium',
    });
  });
});
