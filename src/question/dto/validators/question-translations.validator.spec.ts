import { validate } from 'class-validator';
import { Locale } from '../../../locale/locale.constants';
import { CreateQuestionDto } from '../create-question.dto';
import { UpdateQuestionDto } from '../update-question.dto';

function validBlock(questionText: string) {
  return {
    questionText,
    followUpQuestions: [],
    expectedConcepts: [],
    redFlags: [],
  };
}

describe('QuestionTranslationsMapConstraint', () => {
  it('accepts primary locale block and optional complete locales', async () => {
    const dto = new CreateQuestionDto();
    dto.primaryLocale = 'en';
    dto.translations = {
      en: validBlock('English'),
      ru: validBlock('Russian'),
    };

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing primary locale block', async () => {
    const dto = new CreateQuestionDto();
    dto.primaryLocale = 'en';
    dto.translations = {
      ru: validBlock('Russian only'),
    };

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects partial locale blocks', async () => {
    const dto = new CreateQuestionDto();
    dto.primaryLocale = 'en';
    dto.translations = {
      en: validBlock('English'),
      ru: { questionText: 'partial only' } as CreateQuestionDto['translations'][Locale],
    };

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('QuestionTranslationsUpdateMapConstraint', () => {
  it('allows merge patch with a single locale block', async () => {
    const dto = new UpdateQuestionDto();
    dto.translations = { pl: validBlock('Polish') };

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires primary block when primaryLocale is set', async () => {
    const dto = new UpdateQuestionDto();
    dto.primaryLocale = 'en';
    dto.translations = { ru: validBlock('Russian') };

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
