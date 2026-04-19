import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { runMigrations } from '../database/migration-runner';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionService } from './question.service';

function resolveInputPath(): string {
  const cliPath = process.argv[2];
  if (cliPath) {
    return path.resolve(process.cwd(), cliPath);
  }

  const envPath = process.env.QUESTIONS_FILE;
  if (envPath) {
    return path.resolve(process.cwd(), envPath);
  }

  const defaultPath = path.resolve(process.cwd(), '..', 'questions.json');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  throw new Error(
    'Questions file path is required. Pass it as the first argument or set QUESTIONS_FILE.',
  );
}

function pickArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.questions)) {
      return record.questions;
    }
    if (Array.isArray(record.question_bank)) {
      return record.question_bank;
    }
    if (record.question_bank_item) {
      return [record.question_bank_item];
    }
  }

  throw new Error('Unsupported questions payload format');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function toCreateQuestionDto(item: unknown): CreateQuestionDto {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Question item must be an object');
  }

  const record = item as Record<string, unknown>;
  const questionText =
    String(record.question_text ?? record.questionText ?? record.text ?? '').trim();

  if (!questionText) {
    throw new Error('Question item must include question_text or text');
  }

  const followUpQuestions = Array.isArray(record.follow_up_questions)
    ? (record.follow_up_questions as string[])
    : Array.isArray(record.followUpQuestions)
      ? (record.followUpQuestions as string[])
      : [];
  const tags = Array.isArray(record.tags) ? (record.tags as string[]) : [];

  return {
    externalId: String(
      record.external_id ?? record.externalId ?? record.id ?? slugify(questionText),
    ),
    role: typeof record.role === 'string' ? record.role : undefined,
    focus: typeof record.focus === 'string' ? record.focus : undefined,
    outputLanguage:
      typeof record.output_language === 'string'
        ? record.output_language
        : typeof record.outputLanguage === 'string'
          ? record.outputLanguage
          : 'English',
    category: typeof record.category === 'string' ? record.category : undefined,
    subcategory:
      typeof record.subcategory === 'string' ? record.subcategory : undefined,
    questionText,
    followUpQuestions,
    expectedConcepts: Array.isArray(record.expected_concepts)
      ? (record.expected_concepts as CreateQuestionDto['expectedConcepts'])
      : Array.isArray(record.expectedConcepts)
        ? (record.expectedConcepts as CreateQuestionDto['expectedConcepts'])
        : [],
    redFlags: Array.isArray(record.red_flags)
      ? (record.red_flags as CreateQuestionDto['redFlags'])
      : Array.isArray(record.redFlags)
        ? (record.redFlags as CreateQuestionDto['redFlags'])
        : [],
    difficulty:
      record.difficulty === 'easy' ||
      record.difficulty === 'medium' ||
      record.difficulty === 'hard'
        ? record.difficulty
        : 'medium',
    weight: Number(record.weight ?? 1),
    sampleGoodAnswer:
      typeof record.sample_good_answer === 'string'
        ? record.sample_good_answer
        : typeof record.sampleGoodAnswer === 'string'
          ? record.sampleGoodAnswer
          : undefined,
    minimumPassScore: Number(
      record.minimum_pass_score ?? record.minimumPassScore ?? 0,
    ),
    tags,
    metadata:
      record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {},
  };
}

async function main() {
  const inputPath = resolveInputPath();
  const raw = fs.readFileSync(inputPath, 'utf8');
  const items = pickArrayPayload(JSON.parse(raw)).map(toCreateQuestionDto);

  const databaseService = new DatabaseService();
  const questionService = new QuestionService(databaseService);

  try {
    await runMigrations(databaseService);

    let imported = 0;
    for (const item of items) {
      await questionService.upsertImportedQuestion(item);
      imported += 1;
    }

    console.log(`Imported ${imported} questions from ${inputPath}`);
  } finally {
    await databaseService.onModuleDestroy();
  }
}

void main().catch((error) => {
  console.error('Question import failed');
  console.error(error);
  process.exit(1);
});
