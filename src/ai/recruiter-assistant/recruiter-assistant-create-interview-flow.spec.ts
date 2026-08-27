import { TemplateService } from '../../template/template.service';
import { UserService } from '../../user/user.service';
import { AiService } from '../ai.service';
import { RecruiterAssistantToolsService } from './recruiter-assistant-tools.service';
import { RecruiterConversationStore } from './recruiter-conversation.store';
import { RecruiterPendingActionStore } from './recruiter-pending-action.store';
import { RecruiterQuestionMatcherService } from './recruiter-question-matcher.service';

describe('RecruiterAssistantToolsService create interview flow', () => {
  const user = {
    id: 'admin-1',
    role: 'admin' as const,
    demo: false,
    email: 'admin@example.com',
    name: 'Admin',
    createdAt: new Date(),
    avatarSource: 'none' as const,
    hasGoogleAvatar: false,
  };

  const registeredAlice = {
    id: 'candidate-1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
  };

  const conversationStore = { update: vi.fn() };
  const pendingActionStore = { issue: vi.fn().mockReturnValue('pending-1') };
  const templateSummary = {
    id: 'template-1',
    name: 'React pack',
    position: 'React Developer',
    questionCount: 1,
    storedQuestionCount: 1,
    demo: false,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const templateService = {
    findAll: vi.fn().mockResolvedValue([templateSummary]),
    findOne: vi.fn().mockResolvedValue({
      ...templateSummary,
      questions: [{ id: 'q-1', questionText: 'Explain React hooks.' }],
    }),
  };
  const userService = {
    searchCandidates: vi.fn().mockResolvedValue([]),
  };

  const service = new RecruiterAssistantToolsService(
    {} as RecruiterQuestionMatcherService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    userService as unknown as UserService,
    pendingActionStore as unknown as RecruiterPendingActionStore,
    conversationStore as unknown as RecruiterConversationStore,
    { draftQuestion: vi.fn() } as unknown as AiService,
    templateService as unknown as TemplateService,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    userService.searchCandidates.mockReset();
    userService.searchCandidates.mockResolvedValue([]);
    templateService.findAll.mockReset();
    templateService.findAll.mockResolvedValue([templateSummary]);
    templateService.findOne.mockReset();
    templateService.findOne.mockResolvedValue({
      ...templateSummary,
      questions: [{ id: 'q-1', questionText: 'Explain React hooks.' }],
    });
    conversationStore.update.mockReset();
    pendingActionStore.issue.mockReset();
    pendingActionStore.issue.mockReturnValue('pending-1');
  });

  it('lists registered candidates when no candidate is provided', async () => {
    userService.searchCandidates.mockResolvedValueOnce([registeredAlice]);

    const response = await service.prepareCreateInterview(
      undefined,
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'candidateChoice',
    });
    expect(response.candidates).toEqual([registeredAlice]);
  });

  it('asks to confirm when a provided name matches one registered candidate', async () => {
    userService.searchCandidates.mockResolvedValueOnce([registeredAlice]);

    const response = await service.prepareCreateInterview(
      'Alice',
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'confirmRegisteredCandidate',
    });
    expect(response.candidates).toEqual([registeredAlice]);
  });

  it('continues with a new candidate when the registered match is declined', async () => {
    const response =
      await service.continueCreateInterviewRegisteredCandidateConfirm(
        {
          flow: 'create_interview',
          awaitingInput: 'confirmRegisteredCandidate',
          slots: {
            candidateName: 'Alice',
            position: 'React Developer',
            matchedCandidateId: registeredAlice.id,
            matchedCandidateName: registeredAlice.name,
            matchedCandidateEmail: registeredAlice.email,
          },
        },
        'no',
        user,
        'en',
        'session-1',
      );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.pendingAction).toBeUndefined();
  });

  it('declines registered match via continueCreateInterviewFlow without cancelling', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        awaitingInput: 'confirmRegisteredCandidate',
        slots: {
          candidateName: 'Alice',
          position: 'React Developer',
          matchedCandidateId: registeredAlice.id,
          matchedCandidateName: registeredAlice.name,
          matchedCandidateEmail: registeredAlice.email,
        },
      },
      user,
      'en',
      'session-1',
      'no',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.response).not.toBe('Cancelled. No changes were made.');
  });

  it('lists templates when a new candidate name has no registered match', async () => {
    const response = await service.prepareCreateInterview(
      'Alice',
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.templates).toHaveLength(1);
  });

  it('assigns a registered candidate when the picker id is chosen', async () => {
    userService.searchCandidates.mockResolvedValueOnce([registeredAlice]);

    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          position: 'React Developer',
          candidateIds: registeredAlice.id,
          candidateSearchQuery: '',
          candidateChoice: registeredAlice.id,
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
  });

  it('redirects when no templates match the position', async () => {
    templateService.findAll.mockResolvedValue([]);

    const response = await service.prepareCreateInterview(
      'Alice',
      'React Developer',
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      redirect: {
        path: '/interviews/new',
        query: {
          candidateName: 'Alice',
          position: 'React Developer',
        },
      },
    });
  });

  it('returns confirmation when a template number is chosen', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice Johnson',
          candidateEmail: 'alice@example.com',
          candidateResolution: 'registered',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: '1',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'needs_confirmation',
      pendingActionId: 'pending-1',
    });
    expect(response.pendingAction).toMatchObject({
      type: 'create_interview',
      candidateName: 'Alice Johnson',
      candidateEmail: 'alice@example.com',
      position: 'React Developer',
    });
    expect(templateService.findOne).toHaveBeenCalledWith('template-1', 'en', {
      demo: false,
    });
  });

  it('resolves candidate choice before template choice when both are present', async () => {
    userService.searchCandidates.mockResolvedValueOnce([registeredAlice]);

    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          position: 'React Developer',
          candidateIds: registeredAlice.id,
          candidateSearchQuery: '',
          candidateChoice: registeredAlice.id,
          templateChoice: '1',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.pendingAction).toBeUndefined();
  });

  it('redirects with candidate email when the user chooses create my own', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice Johnson',
          candidateEmail: 'alice@example.com',
          candidateResolution: 'registered',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: 'create my own',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      redirect: {
        path: '/interviews/new',
        query: {
          candidateName: 'Alice Johnson',
          candidateEmail: 'alice@example.com',
          position: 'React Developer',
        },
      },
    });
    expect(conversationStore.update).toHaveBeenCalledWith(
      'admin-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
  });

  it('redirects when the user chooses create my own', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice',
          candidateResolution: 'new',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: 'create my own',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      redirect: {
        path: '/interviews/new',
        query: {
          candidateName: 'Alice',
          position: 'React Developer',
        },
      },
    });
    expect(conversationStore.update).toHaveBeenCalledWith(
      'admin-1',
      'session-1',
      { flow: 'idle', slots: {} },
    );
  });

  it('re-prompts when the template number is out of range', async () => {
    const response = await service.continueCreateInterviewFlow(
      {
        flow: 'create_interview',
        slots: {
          candidateName: 'Alice',
          candidateResolution: 'new',
          position: 'React Developer',
          templateIds: 'template-1',
          templateChoice: '99',
        },
      },
      user,
      'en',
      'session-1',
    );

    expect(response).toMatchObject({
      status: 'answered',
      awaitingInput: 'templateChoice',
    });
    expect(response.templates).toHaveLength(1);
  });
});
