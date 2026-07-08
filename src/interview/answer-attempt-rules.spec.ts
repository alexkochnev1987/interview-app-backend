import {
  DEFAULT_MAX_ANSWER_ATTEMPTS_PER_QUESTION,
  getAnswerAttemptLimitBlockReason,
  getSavedAnswerVersions,
  resolveMaxAnswerAttemptsPerQuestion,
} from './answer-attempt-rules';

describe('answer-attempt-rules', () => {
  const envBackup = process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION;

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION;
    } else {
      process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION = envBackup;
    }
  });

  it('defaults to three attempts per question', () => {
    delete process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION;
    expect(resolveMaxAnswerAttemptsPerQuestion()).toBe(
      DEFAULT_MAX_ANSWER_ATTEMPTS_PER_QUESTION,
    );
  });

  it('reads MAX_ANSWER_ATTEMPTS_PER_QUESTION from env', () => {
    process.env.MAX_ANSWER_ATTEMPTS_PER_QUESTION = '5';
    expect(resolveMaxAnswerAttemptsPerQuestion()).toBe(5);
  });

  it('allows the first saved attempt', () => {
    expect(getAnswerAttemptLimitBlockReason([], 1)).toBeNull();
  });

  it('blocks a fourth new attempt when three versions already exist', () => {
    const versions = [{ versionNumber: 1 }, { versionNumber: 2 }, { versionNumber: 3 }];
    expect(getAnswerAttemptLimitBlockReason(versions, 4)).toMatch(
      /maximum of 3 recording attempts/i,
    );
    expect(getAnswerAttemptLimitBlockReason(versions)).toMatch(
      /maximum of 3 recording attempts/i,
    );
  });

  it('allows re-uploading an existing attempt slot', () => {
    const versions = [{ versionNumber: 1 }, { versionNumber: 2 }, { versionNumber: 3 }];
    expect(getAnswerAttemptLimitBlockReason(versions, 3)).toBeNull();
  });

  it('derives saved versions from legacy single-version answers', () => {
    expect(
      getSavedAnswerVersions({
        mediaKey: 'dev/interviews/x/answers/q0-camera-1.webm',
        selectedVersionNumber: 2,
      }),
    ).toEqual([{ versionNumber: 2 }]);
  });
});
