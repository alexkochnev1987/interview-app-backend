import { RecruiterAssistantIntentService } from './recruiter-assistant-intent.service';
import { ActingUser } from './recruiter-assistant.types';

describe('candidate intent probe', () => {
  const service = new RecruiterAssistantIntentService();
  const candidate: ActingUser = {
    id: 'candidate-1',
    role: 'candidate',
    demo: false,
    email: 'candidate@example.com',
    name: 'Candidate User',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avatarSource: 'none',
    hasGoogleAvatar: false,
  };

  const cases = [
    ['ru', 'какой статус моего интервью', 'interview_status'],
    ['ru', 'когда мое интервью', 'interview_status'],
    ['ru', 'есть ли у меня незавершенные интервью', 'list_own_interviews'],
    ['ru', 'просмотрено ли мое интервью', 'review_state'],
    ['ru', 'какой статус моего последнего интервью', 'interview_status'],
    ['be', "які статус маё інтэрв'ю", 'interview_status'],
    ['be', "калі маё інтэрв'ю", 'interview_status'],
    ['be', "ці ёсць у мяне незавершаныя інтэрв'ю", 'list_own_interviews'],
    ['pl', 'jaki jest status mojego interview', 'interview_status'],
    ['pl', 'kiedy moje interview', 'interview_status'],
    ['pl', 'czy mam nieukończone interview', 'list_own_interviews'],
    ['pl', 'czy moje interview zostało przejrzane', 'review_state'],
  ] as const;

  it.each(cases)('%s "%s" -> %s', (locale, message, expected) => {
    expect(service.classify(message, candidate, locale).kind).toBe(expected);
  });
});
