import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateInterviewDto } from '../interview/dto/create-interview.dto';
import { CreateQuestionDto } from '../question/dto/create-question.dto';

async function validateDto<T extends object>(
  Cls: new () => T,
  dto: object,
): Promise<ValidationError[]> {
  const instance = plainToInstance(Cls, dto);
  return validate(instance);
}

describe('DTO validation', () => {
  it('rejects CreateQuestionDto without questionText', async () => {
    const errors = await validateDto(CreateQuestionDto, {
      difficulty: 'medium',
      weight: 1,
    });
    expect(errors.some((error) => error.property === 'questionText')).toBe(
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
});
