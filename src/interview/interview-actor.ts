import { User } from '../user/interfaces/user.interface';
import { InterviewActor } from './interfaces/interview.interface';

type ActingUser = Omit<User, 'passwordHash'>;

export function toInterviewActor(user: ActingUser): InterviewActor {
  return {
    id: user.id,
    role: user.role,
    demo: user.demo,
    onboardingCompletedAt: user.onboardingCompletedAt,
  };
}
