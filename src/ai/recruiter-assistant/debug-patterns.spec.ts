import {
  COUNT_QUESTIONS_PATTERNS,
  LIST_INTERVIEWS_PATTERNS,
  LIST_TEAM_PATTERNS,
  matchesAnyPattern,
} from './recruiter-assistant-intent-patterns';

describe('debug patterns', () => {
  it('debug', () => {
    console.log(
      'list',
      matchesAnyPattern('покажи все интервью', LIST_INTERVIEWS_PATTERNS),
    );
    console.log(
      'count',
      matchesAnyPattern('сколько у нас вопросов', COUNT_QUESTIONS_PATTERNS),
    );
    LIST_INTERVIEWS_PATTERNS.forEach((pattern, index) => {
      if (pattern.test('покажи все интервью')) {
        console.log('list matched', index, pattern.source);
      }
    });
    COUNT_QUESTIONS_PATTERNS.forEach((pattern, index) => {
      if (pattern.test('сколько у нас вопросов')) {
        console.log('count matched', index, pattern.source);
      }
    });
    console.log(
      'team',
      matchesAnyPattern('покажи мою команду', LIST_TEAM_PATTERNS),
    );
  });
});
