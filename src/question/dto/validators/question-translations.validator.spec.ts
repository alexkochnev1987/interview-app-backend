import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateQuestionDto } from '../create-question.dto';
import { UpdateQuestionDto } from '../update-question.dto';

function validPrimaryBlock(questionText: string) {
  return {
    questionText,
    followUpQuestions: [],
    expectedConcepts: [],
    redFlags: [],
    sampleGoodAnswer: 'Sample answer.',
  };
}

function createDto(
  payload: Partial<CreateQuestionDto> & Pick<CreateQuestionDto, 'primaryLocale' | 'translations'>,
): CreateQuestionDto {
  return plainToInstance(CreateQuestionDto, payload);
}

function updateDto(payload: Partial<UpdateQuestionDto>): UpdateQuestionDto {
  return plainToInstance(UpdateQuestionDto, payload);
}

describe('QuestionTranslationsMapConstraint', () => {
  it('accepts primary locale block and optional complete locales', async () => {
    const dto = createDto({
      primaryLocale: 'en',
      translations: {
        en: validPrimaryBlock('English'),
        ru: { questionText: 'Russian' },
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing primary locale block', async () => {
    const dto = createDto({
      primaryLocale: 'en',
      translations: {
        ru: { questionText: 'Russian only' },
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects incomplete primary locale block', async () => {
    const dto = createDto({
      primaryLocale: 'en',
      translations: {
        en: { questionText: 'partial only' },
        ru: { questionText: 'Russian' },
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid rubric severity in nested translation blocks', async () => {
    const dto = createDto({
      primaryLocale: 'en',
      translations: {
        en: {
          questionText: 'English',
          followUpQuestions: [],
          expectedConcepts: [
            { id: 'c1', label: 'Concept', weight: 1, description: 'desc' },
          ],
          redFlags: [{ id: 'r1', label: 'Flag', severity: 'critical' as 'low' }],
          sampleGoodAnswer: 'Sample answer.',
        },
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('QuestionTranslationsUpdateMapConstraint', () => {
  it('allows merge patch with a single locale block', async () => {
    const dto = updateDto({
      translations: { pl: { questionText: 'Polish' } },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires primary block when primaryLocale is set', async () => {
    const dto = updateDto({
      primaryLocale: 'en',
      translations: { ru: { questionText: 'Russian' } },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows replace mode without deprecated primaryLocale on the body', async () => {
    const dto = updateDto({
      translationsMode: 'replace',
      translations: { pl: { questionText: 'Polish' } },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
