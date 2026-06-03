import type { IntegrationAgent } from './integration-app';
import { parseCandidateToken } from './integration-app';
import { authCookie } from './integration-auth';

const now = () => new Date();

function buildMediaKey(
  interviewId: string,
  questionIndex: number,
  mediaType: 'camera' | 'screen',
) {
  return `test/interviews/${interviewId}/answers/q${questionIndex}-${mediaType}-${Date.now()}.webm`;
}

export function emptyBehaviorSignals() {
  return {
    tabHiddenCount: 0,
    windowBlurCount: 0,
    pasteCount: 0,
    keydownCount: 0,
    copyCount: 0,
    resizeCount: 0,
  };
}

export function buildAnswerProgressPayload(
  interviewId: string,
  questionIndex = 0,
  versionNumber = 1,
) {
  const startedAt = now();
  return {
    questionIndex,
    versionNumber,
    mediaKey: buildMediaKey(interviewId, questionIndex, 'camera'),
    screenMediaKey: buildMediaKey(interviewId, questionIndex, 'screen'),
    durationSeconds: 12,
    startedAt: startedAt.toISOString(),
    behaviorSignals: emptyBehaviorSignals(),
    clientTranscript: {
      text: 'Integration test draft answer.',
      language: 'en',
      provider: 'browser',
      generatedAt: startedAt.toISOString(),
      isFinal: false,
    },
  };
}

export function buildSubmitAnswerPayload(
  interviewId: string,
  questionIndex = 0,
  versionNumber = 1,
) {
  const startedAt = now();
  const submittedAt = new Date(startedAt.getTime() + 12_000);
  return {
    questionIndex,
    versionNumber,
    submitAnswer: true,
    mediaKey: buildMediaKey(interviewId, questionIndex, 'camera'),
    screenMediaKey: buildMediaKey(interviewId, questionIndex, 'screen'),
    durationSeconds: 12,
    startedAt: startedAt.toISOString(),
    submittedAt: submittedAt.toISOString(),
    cameraFileSizeBytes: 4096,
    screenFileSizeBytes: 8192,
    behaviorSignals: emptyBehaviorSignals(),
    clientTranscript: {
      text: 'Integration test submitted answer.',
      language: 'en',
      provider: 'browser',
      generatedAt: submittedAt.toISOString(),
      isFinal: true,
    },
  };
}

export async function createTakeInterview(
  agent: IntegrationAgent,
  staffSession: string,
  questionId: string,
) {
  const interview = await agent
    .post('/interviews')
    .set(authCookie(staffSession))
    .send({
      candidateName: 'Take Flow Candidate',
      candidateEmail: 'take-flow-candidate@test.local',
      position: 'Integration Take Role',
      questionIds: [questionId],
    })
    .expect(201);

  const interviewId = interview.body.id as string;

  const linkResponse = await agent
    .post(`/interviews/${interviewId}/candidate-link`)
    .set(authCookie(staffSession))
    .expect(201);

  return {
    interviewId,
    token: parseCandidateToken(linkResponse.body.candidateLink),
  };
}

export async function openCandidateTakeSession(
  agent: IntegrationAgent,
  interviewId: string,
  token: string,
) {
  return agent.get(`/take/${interviewId}`).query({ token }).expect(200);
}

export async function submitCandidateAnswer(
  agent: IntegrationAgent,
  interviewId: string,
  token: string,
) {
  await openCandidateTakeSession(agent, interviewId, token);

  await agent
    .post(`/take/${interviewId}/answer`)
    .send(buildSubmitAnswerPayload(interviewId, 0, 1))
    .expect(201);
}
