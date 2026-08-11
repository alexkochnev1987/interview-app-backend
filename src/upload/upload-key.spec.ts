import { buildInterviewMediaKey, getInterviewMediaPrefix } from './upload-key';

describe('upload-key', () => {
  describe('getInterviewMediaPrefix', () => {
    it('matches the interview segment used by buildInterviewMediaKey', () => {
      const interviewId = 'abc-123';
      const prefix = 'uploads';
      const mediaKey = buildInterviewMediaKey({
        prefix,
        interviewId,
        questionIndex: 0,
        mediaType: 'camera',
        timestamp: 1,
      });

      expect(getInterviewMediaPrefix(prefix, interviewId)).toBe(
        'uploads/interviews/abc-123/',
      );
      expect(
        mediaKey.startsWith(getInterviewMediaPrefix(prefix, interviewId)),
      ).toBe(true);
    });

    it('normalizes empty and slash-padded prefixes', () => {
      expect(getInterviewMediaPrefix('', 'id-1')).toBe('interviews/id-1/');
      expect(getInterviewMediaPrefix('/uploads/', 'id-1')).toBe(
        'uploads/interviews/id-1/',
      );
      expect(getInterviewMediaPrefix('  /dev/uploads/  ', 'id-1')).toBe(
        'dev/uploads/interviews/id-1/',
      );
    });
  });
});
