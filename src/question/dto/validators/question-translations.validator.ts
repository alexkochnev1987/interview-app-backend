import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isLocale } from '../../../locale/locale.constants';
import { CreateQuestionDto } from '../create-question.dto';
import { UpdateQuestionDto } from '../update-question.dto';
import {
  supportedLocaleListHint,
  validatePrimaryTranslationBlock,
  validateTranslationMapKeys,
} from '../../question-translation.validation';

@ValidatorConstraint({ name: 'questionTranslationsMap', async: false })
export class QuestionTranslationsMapConstraint implements ValidatorConstraintInterface {
  validate(translations: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateQuestionDto;
    if (!validateTranslationMapKeys(translations)) {
      return false;
    }
    const primaryLocale = dto.primaryLocale;
    if (!primaryLocale || !isLocale(primaryLocale)) {
      return false;
    }
    return validatePrimaryTranslationBlock(
      translations as Record<string, unknown>,
      primaryLocale,
    );
  }

  defaultMessage(): string {
    return (
      `translations[primaryLocale] must include all five rubric fields: ` +
      `questionText, followUpQuestions, expectedConcepts, redFlags, sampleGoodAnswer. ` +
      `Locale keys must be one of: ${supportedLocaleListHint()}. ` +
      `Non-primary locales require questionText only.`
    );
  }
}

@ValidatorConstraint({ name: 'questionTranslationsUpdateMap', async: false })
export class QuestionTranslationsUpdateMapConstraint implements ValidatorConstraintInterface {
  validate(translations: unknown, args: ValidationArguments): boolean {
    if (translations === undefined) {
      return true;
    }
    if (!validateTranslationMapKeys(translations)) {
      return false;
    }

    const dto = args.object as UpdateQuestionDto;
    const record = translations as Record<string, unknown>;

    if (dto.primaryLocale && isLocale(dto.primaryLocale)) {
      if (!validatePrimaryTranslationBlock(record, dto.primaryLocale)) {
        return false;
      }
    }

    if (dto.translationsMode === 'replace' && dto.primaryLocale && isLocale(dto.primaryLocale)) {
      return validatePrimaryTranslationBlock(record, dto.primaryLocale);
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as UpdateQuestionDto;
    if (dto.translationsMode === 'replace') {
      return (
        `translations replace mode requires a complete primaryLocale block in translations ` +
        `(questionText, followUpQuestions, expectedConcepts, redFlags, sampleGoodAnswer). ` +
        `Non-primary locales must provide at least questionText.`
      );
    }
    if (dto.primaryLocale) {
      return (
        `when primaryLocale is set, translations must include a complete block for that locale. ` +
        `Each non-primary locale must include at least questionText.`
      );
    }
    return (
      `each translations locale key (${supportedLocaleListHint()}) must include questionText; ` +
      `primaryLocale must include full rubric fields.`
    );
  }
}
