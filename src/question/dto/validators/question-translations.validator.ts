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
      `translations must include a complete block for primaryLocale. ` +
      `Each locale key (${supportedLocaleListHint()}) must include ` +
      `questionText, followUpQuestions, expectedConcepts, redFlags, and sampleGoodAnswer.`
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
    if (dto.translationsMode === 'replace' && dto.primaryLocale) {
      return (
        `translations replace mode requires a complete block for primaryLocale (${dto.primaryLocale}). ` +
        `Each provided locale (${supportedLocaleListHint()}) must be a complete block.`
      );
    }
    if (dto.primaryLocale) {
      return (
        `when primaryLocale is set, translations must include a complete block for that locale. ` +
        `Each provided locale must be a complete block.`
      );
    }
    return (
      `each translations locale key (${supportedLocaleListHint()}) must be a complete block ` +
      `(questionText, followUpQuestions, expectedConcepts, redFlags, sampleGoodAnswer).`
    );
  }
}
