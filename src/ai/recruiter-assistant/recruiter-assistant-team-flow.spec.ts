import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

describe('RecruiterAssistantToolsService list team', () => {
  const admin = {
    id: 'admin-1',
    role: 'admin' as const,
    demo: false,
    email: 'admin@example.com',
    name: 'Admin',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };
  const hr = {
    id: 'hr-1',
    role: 'hr' as const,
    demo: false,
    email: 'hr@example.com',
    name: 'HR',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };
  const member = {
    id: 'hr-2',
    role: 'hr' as const,
    demo: false,
    email: 'hr2@example.com',
    name: 'HR Two',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };

  const userService = {
    countUsersByRole: vi.fn(),
    listAll: vi.fn(),
  };
  const recruiterAssistantConfig = {
    isRecruiterAssistantEnabledForRole: vi.fn().mockResolvedValue(true),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    userService as never,
    {} as RecruiterPendingActionStore,
    {} as RecruiterConversationStore,
    {} as never,
    {} as never,
    recruiterAssistantConfig as never,
    {} as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    userService.countUsersByRole.mockResolvedValue({
      super_admin: 0,
      admin: 1,
      hr: 2,
      candidate: 0,
    });
    userService.listAll.mockResolvedValue([admin, member]);
  });

  it('returns team summary and members for admins', async () => {
    const result = await service.listTeam(admin, 'en', {
      includeSummary: true,
    });

    expect(userService.countUsersByRole).toHaveBeenCalledWith({ demo: false });
    expect(userService.listAll).toHaveBeenCalledWith({
      demo: false,
      role: undefined,
      limit: 200,
    });
    expect(result.status).toBe('answered');
    expect(result.teamSummary).toEqual({
      superAdmin: 0,
      admin: 1,
      hr: 2,
      candidate: 0,
      total: 3,
    });
    expect(result.teamMembers).toHaveLength(2);
    expect(result.teamMembers?.[0]).toMatchObject({
      id: 'admin-1',
      recruiterAssistantEnabled: true,
    });
  });

  it('denies hr users', async () => {
    const result = await service.listTeam(hr, 'en', { includeSummary: true });

    expect(userService.countUsersByRole).not.toHaveBeenCalled();
    expect(result.status).toBe('denied');
    expect(result.escalateTo).toBe('admin');
  });

  it('lists team members filtered by role without summary', async () => {
    userService.listAll.mockResolvedValue([member]);
    const result = await service.listTeam(admin, 'en', {
      role: 'hr',
      includeSummary: false,
    });

    expect(userService.countUsersByRole).not.toHaveBeenCalled();
    expect(userService.listAll).toHaveBeenCalledWith({
      demo: false,
      role: 'hr',
      limit: 200,
    });
    expect(result.teamSummary).toBeUndefined();
    expect(result.response).toContain(' hr team member(s)');
    expect(result.teamMembers).toHaveLength(1);
  });
});
