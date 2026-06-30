/**
 * Static demo content (no secrets). The seed runner upserts these by stable id
 * and stamps the `demo` column so read paths isolate them to demo users.
 * Identity only here — no role/flag/password: login authorizes on the DB `demo`
 * flag, never on this file.
 */
import type {
  QuestionCore,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../question/interfaces/question.interface';
import type {
  Answer,
  AnswerDecisionHint,
  Interview,
  InterviewResult,
} from '../interview/interfaces/interview.interface';

export const DEMO_USER_ID = '00000000-0000-4000-8000-0000000000d0';
export const DEMO_USER_EMAIL = 'demo@interview-app.com';
export const DEMO_USER_NAME = 'Demo HR';

// Fabricated completed demo interview. A real recorded interview can replace it
// via the mark-demo endpoint, which deletes this placeholder.
export const DEMO_PLACEHOLDER_INTERVIEW_ID =
  '00000000-0000-4000-8000-0000000000a1';

const concept = (
  id: string,
  label: string,
  weight: number,
  description: string,
): QuestionExpectedConcept => ({ id, label, weight, description });

const redFlag = (
  id: string,
  label: string,
  severity: QuestionRedFlag['severity'],
): QuestionRedFlag => ({ id, label, severity });

type DemoQuestion = QuestionCore & {
  deleted: boolean;
  usageCount: number;
};

const demoQuestionBase = {
  outputLanguage: 'English',
  role: 'Frontend Engineer',
  followUpQuestions: [] as string[],
  deleted: false,
  metadata: { demo: true } as Record<string, unknown>,
} satisfies Partial<DemoQuestion>;

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000001',
    externalId: 'demo-js-closures',
    focus: 'JavaScript fundamentals',
    category: 'JavaScript',
    subcategory: 'Closures',
    questionText: 'What is a closure in JavaScript, and when would you use one?',
    expectedConcepts: [
      concept('c1', 'Function + lexical scope', 0.5, 'A closure is a function bundled with references to its surrounding scope.'),
      concept('c2', 'Practical use', 0.5, 'Data privacy, factory functions, or preserving state in callbacks.'),
    ],
    redFlags: [redFlag('r1', 'Confuses closures with objects', 'medium')],
    difficulty: 'easy',
    weight: 1,
    sampleGoodAnswer:
      'A closure is a function that retains access to its lexical scope even when called outside that scope — useful for encapsulating private state and building factory functions.',
    minimumPassScore: 0.5,
    tags: ['javascript', 'fundamentals', 'demo'],
    usageCount: 1,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000002',
    externalId: 'demo-react-state-vs-props',
    focus: 'React rendering model',
    category: 'React',
    subcategory: 'State management',
    questionText: 'Explain the difference between state and props in React, and what triggers a re-render.',
    expectedConcepts: [
      concept('c1', 'Props are read-only inputs', 0.4, 'Props are passed by the parent and not mutated by the child.'),
      concept('c2', 'State is owned and mutable', 0.3, 'State is local, owned by the component, updated via the setter.'),
      concept('c3', 'Re-render triggers', 0.3, 'A state change or new props re-render the component.'),
    ],
    redFlags: [redFlag('r1', 'Mutates state directly', 'high')],
    difficulty: 'medium',
    weight: 1.5,
    sampleGoodAnswer:
      'Props are read-only inputs from the parent; state is local and mutable via its setter. A component re-renders when its state changes or it receives new props.',
    minimumPassScore: 0.5,
    tags: ['react', 'rendering', 'demo'],
    usageCount: 1,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000003',
    externalId: 'demo-event-loop',
    focus: 'Async JavaScript',
    category: 'JavaScript',
    subcategory: 'Event loop',
    questionText: 'Walk me through the JavaScript event loop. How do microtasks differ from macrotasks?',
    expectedConcepts: [
      concept('c1', 'Call stack + queues', 0.5, 'Synchronous stack drains, then queued tasks run.'),
      concept('c2', 'Microtask priority', 0.5, 'Promises (microtasks) run before timers (macrotasks) after each tick.'),
    ],
    redFlags: [redFlag('r1', 'Thinks JS is multithreaded by default', 'medium')],
    difficulty: 'medium',
    weight: 1.5,
    sampleGoodAnswer:
      'The event loop drains the call stack, then processes all microtasks (promise callbacks) before the next macrotask (e.g. setTimeout), repeating each tick.',
    minimumPassScore: 0.5,
    tags: ['javascript', 'async', 'demo'],
    usageCount: 1,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000004',
    externalId: 'demo-css-flexbox',
    focus: 'CSS layout',
    category: 'CSS',
    subcategory: 'Flexbox',
    questionText: 'How does flexbox differ from the normal flow, and when would you reach for it over grid?',
    expectedConcepts: [
      concept('c1', 'One-dimensional layout', 0.5, 'Flexbox lays out items along a single axis.'),
      concept('c2', 'Flex vs grid trade-off', 0.5, 'Grid is two-dimensional; flexbox suits one-axis distribution.'),
    ],
    redFlags: [redFlag('r1', 'Uses floats for everything', 'low')],
    difficulty: 'easy',
    weight: 1,
    sampleGoodAnswer:
      'Flexbox distributes space along one axis with alignment control; reach for grid when you need two-dimensional row-and-column layout.',
    minimumPassScore: 0.5,
    tags: ['css', 'layout', 'demo'],
    usageCount: 1,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000005',
    externalId: 'demo-useeffect-cleanup',
    focus: 'React hooks',
    category: 'React',
    subcategory: 'Hooks',
    questionText: 'When does a useEffect cleanup function run, and why does the dependency array matter?',
    expectedConcepts: [
      concept('c1', 'Cleanup timing', 0.5, 'Runs before the next effect and on unmount.'),
      concept('c2', 'Dependency correctness', 0.5, 'Deps control when the effect re-runs; stale deps cause bugs.'),
    ],
    redFlags: [redFlag('r1', 'Leaves out deps to "fix" loops', 'high')],
    difficulty: 'medium',
    weight: 1.5,
    sampleGoodAnswer:
      'Cleanup runs before the effect re-runs and on unmount; the dependency array determines when the effect re-executes, so it must list every reactive value used.',
    minimumPassScore: 0.5,
    tags: ['react', 'hooks', 'demo'],
    usageCount: 1,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000006',
    externalId: 'demo-http-caching',
    focus: 'Web platform',
    category: 'Networking',
    subcategory: 'Caching',
    questionText: 'Explain how HTTP caching works with Cache-Control and ETag headers.',
    expectedConcepts: [
      concept('c1', 'Cache-Control directives', 0.5, 'max-age, no-cache, no-store control freshness.'),
      concept('c2', 'Conditional revalidation', 0.5, 'ETag + If-None-Match returns 304 when unchanged.'),
    ],
    redFlags: [redFlag('r1', 'Confuses no-cache with no-store', 'low')],
    difficulty: 'medium',
    weight: 1,
    sampleGoodAnswer:
      'Cache-Control sets freshness (max-age/no-store); when stale, the client revalidates with ETag/If-None-Match and the server returns 304 if unchanged.',
    minimumPassScore: 0.5,
    tags: ['networking', 'http', 'demo'],
    usageCount: 0,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000007',
    externalId: 'demo-accessibility',
    focus: 'Accessibility',
    category: 'Accessibility',
    subcategory: 'Semantics',
    questionText: 'What are the basics of building an accessible web form?',
    expectedConcepts: [
      concept('c1', 'Labels + semantics', 0.5, 'Associate labels with inputs; use native elements.'),
      concept('c2', 'Keyboard + errors', 0.5, 'Keyboard operable and accessible error messaging.'),
    ],
    redFlags: [redFlag('r1', 'Relies on placeholder as label', 'medium')],
    difficulty: 'easy',
    weight: 1,
    sampleGoodAnswer:
      'Use real labels tied to inputs, native semantic elements, full keyboard operability, and programmatically associated error messages.',
    minimumPassScore: 0.5,
    tags: ['accessibility', 'forms', 'demo'],
    usageCount: 0,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000008',
    externalId: 'demo-debounce-throttle',
    focus: 'Performance patterns',
    category: 'JavaScript',
    subcategory: 'Rate limiting',
    questionText: 'What is the difference between debounce and throttle, and when do you use each?',
    expectedConcepts: [
      concept('c1', 'Debounce semantics', 0.5, 'Waits for a pause before firing once.'),
      concept('c2', 'Throttle semantics', 0.5, 'Fires at most once per interval.'),
    ],
    redFlags: [redFlag('r1', 'Uses them interchangeably', 'low')],
    difficulty: 'medium',
    weight: 1,
    sampleGoodAnswer:
      'Debounce fires once after activity stops (e.g. search-as-you-type); throttle fires at a fixed rate during continuous activity (e.g. scroll handlers).',
    minimumPassScore: 0.5,
    tags: ['javascript', 'performance', 'demo'],
    usageCount: 0,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000009',
    externalId: 'demo-ts-generics',
    focus: 'TypeScript',
    category: 'TypeScript',
    subcategory: 'Generics',
    questionText: 'Explain TypeScript generics and give an example where they prevent a bug.',
    expectedConcepts: [
      concept('c1', 'Parametric reuse', 0.5, 'Generics keep type relationships across inputs/outputs.'),
      concept('c2', 'Constraint usage', 0.5, 'extends constraints narrow allowed types safely.'),
    ],
    redFlags: [redFlag('r1', 'Reaches for any instead', 'high')],
    difficulty: 'hard',
    weight: 2,
    sampleGoodAnswer:
      'Generics parameterise types so a function preserves the relationship between input and output (e.g. identity<T>), with constraints (T extends ...) keeping it type-safe instead of falling back to any.',
    minimumPassScore: 0.5,
    tags: ['typescript', 'types', 'demo'],
    usageCount: 0,
  },
  {
    ...demoQuestionBase,
    id: '00000000-0000-4000-8000-000000000010',
    externalId: 'demo-core-web-vitals',
    focus: 'Web performance',
    category: 'Performance',
    subcategory: 'Core Web Vitals',
    questionText: 'What are the Core Web Vitals, and how would you improve LCP?',
    expectedConcepts: [
      concept('c1', 'The three vitals', 0.5, 'LCP, INP (was FID), CLS and what they measure.'),
      concept('c2', 'LCP levers', 0.5, 'Optimise critical resources, images, server response, fonts.'),
    ],
    redFlags: [redFlag('r1', 'Only mentions Lighthouse score', 'low')],
    difficulty: 'hard',
    weight: 2,
    sampleGoodAnswer:
      'LCP (loading), INP (interactivity) and CLS (visual stability). Improve LCP by prioritising the hero resource, optimising images, reducing server response time and preloading fonts.',
    minimumPassScore: 0.5,
    tags: ['performance', 'web-vitals', 'demo'],
    usageCount: 0,
  },
];

// Fixed timestamps keep re-seeding deterministic.
const STARTED_AT = new Date('2026-06-01T10:00:00.000Z');
const COMPLETED_AT = new Date('2026-06-01T10:30:00.000Z');

interface DemoAnswerInput {
  questionId: string;
  score: number;
  transcript: string;
  summary: string;
}

interface DemoInterviewInput {
  id: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  resultSummary: string;
  categoryScores: Record<string, number>;
  answers: DemoAnswerInput[];
}

interface PendingDemoInterviewInput {
  id: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  questionIds: string[];
}

// Scores use the same 0-100 integer scale as real evaluations.
const PASS_SCORE = 70;

function questionById(id: string): DemoQuestion {
  const question = DEMO_QUESTIONS.find((q) => q.id === id);
  if (!question) {
    throw new Error(`Demo interview references unknown question ${id}`);
  }
  return question;
}

function buildDemoAnswer(
  interviewId: string,
  input: DemoAnswerInput,
  index: number,
): Answer {
  const question = questionById(input.questionId);
  const passed = input.score >= PASS_SCORE;
  const decisionHint: AnswerDecisionHint = passed ? 'pass' : 'review';
  const media = (kind: 'camera' | 'screen') =>
    `demo/interviews/${interviewId}/q${index}/${kind}.webm`;

  return {
    questionIndex: index,
    questionId: question.id,
    status: 'submitted',
    mediaKey: media('camera'),
    screenMediaKey: media('screen'),
    uploadedAt: COMPLETED_AT,
    durationSeconds: 90 + index * 10,
    retakeCount: 0,
    startedAt: STARTED_AT,
    submittedAt: COMPLETED_AT,
    behaviorSignals: {
      tabHiddenCount: 0,
      windowBlurCount: 0,
      pasteCount: 0,
      keydownCount: 0,
      copyCount: 0,
      resizeCount: 0,
    },
    transcript: {
      text: input.transcript,
      language: 'en-US',
      provider: 'demo-static',
      generatedAt: COMPLETED_AT,
      isFinal: true,
    },
    evaluation: {
      overallScore: input.score,
      coveredConceptIds: question.expectedConcepts
        .slice(0, passed ? question.expectedConcepts.length : 1)
        .map((c) => c.id),
      missedConceptIds: passed
        ? []
        : question.expectedConcepts.slice(1).map((c) => c.id),
      redFlagIds: [],
      behaviorRisk: 'low',
      summary: input.summary,
      decisionHint,
      evaluatedAt: COMPLETED_AT,
    },
    validation: {
      status: 'completed',
      sourceVersionNumber: 1,
      requestedAt: COMPLETED_AT,
      completedAt: COMPLETED_AT,
    },
  };
}

function buildDemoInterview(input: DemoInterviewInput): Interview {
  const answers = input.answers.map((answer, index) =>
    buildDemoAnswer(input.id, answer, index),
  );
  const scored = answers.filter((a) => typeof a.evaluation?.overallScore === 'number');
  const overallScore = Math.round(
    scored.reduce((sum, a) => sum + (a.evaluation?.overallScore ?? 0), 0) /
      Math.max(scored.length, 1),
  );
  const decision =
    overallScore < 50 ? 'reject' : overallScore < PASS_SCORE ? 'review' : 'proceed';

  const result: InterviewResult = {
    overallScore,
    summary: input.resultSummary,
    categoryScores: input.categoryScores,
    rubricVersion: 'demo-v1',
    decision,
    trustScore: 100,
    trustFlags: [],
    behaviorSummary: {
      riskLevel: 'low',
      notes: ['No tab-switching or paste activity detected during the session.'],
    },
    questionResults: answers.map((answer) => ({
      questionIndex: answer.questionIndex,
      questionId: answer.questionId,
      score: answer.evaluation?.overallScore,
      summary: answer.evaluation?.summary,
      decisionHint: answer.evaluation?.decisionHint,
    })),
    completedAt: COMPLETED_AT,
  };

  return {
    id: input.id,
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    position: input.position,
    questions: input.answers.map((a) => questionById(a.questionId)),
    answers,
    status: 'completed',
    result,
    createdById: DEMO_USER_ID,
    demo: true,
    createdAt: STARTED_AT,
    updatedAt: COMPLETED_AT,
  };
}

// A not-started interview (questions only) so the demo can show the take flow.
function buildPendingDemoInterview(input: PendingDemoInterviewInput): Interview {
  return {
    id: input.id,
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    position: input.position,
    questions: input.questionIds.map(questionById),
    answers: [],
    status: 'pending',
    result: undefined,
    createdById: DEMO_USER_ID,
    demo: true,
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
  };
}

export const DEMO_INTERVIEWS: Interview[] = [
  buildDemoInterview({
    id: DEMO_PLACEHOLDER_INTERVIEW_ID,
    candidateName: 'Jordan Avery',
    candidateEmail: 'jordan.avery@example.com',
    position: 'Frontend Engineer',
    resultSummary:
      'Strong frontend fundamentals. Confident on closures, React state and layout; event-loop and hooks answers were correct but could go deeper. Recommend proceeding to a technical round.',
    categoryScores: { JavaScript: 80, React: 73, CSS: 85 },
    answers: [
      {
        questionId: '00000000-0000-4000-8000-000000000001',
        score: 90,
        transcript:
          'A closure is a function that keeps access to the variables from where it was defined. I use them for private state and factory functions.',
        summary: 'Clear, correct definition with a practical use case.',
      },
      {
        questionId: '00000000-0000-4000-8000-000000000002',
        score: 80,
        transcript:
          'Props come from the parent and are read-only; state is local and I update it with the setter, which triggers a re-render.',
        summary:
          'Solid grasp of the rendering model; mentioned the setter and re-render triggers.',
      },
      {
        questionId: '00000000-0000-4000-8000-000000000003',
        score: 70,
        transcript:
          'The stack runs first, then microtasks like promise callbacks, then macrotasks like timers. So a resolved promise runs before a setTimeout zero.',
        summary:
          'Correct ordering of microtasks vs macrotasks; could add more nuance on rendering.',
      },
      {
        questionId: '00000000-0000-4000-8000-000000000004',
        score: 85,
        transcript:
          'Flexbox is one-dimensional, great for a row or column of items; I use grid when I need both rows and columns at once.',
        summary: 'Good one-vs-two-dimensional distinction and when to pick grid.',
      },
      {
        questionId: '00000000-0000-4000-8000-000000000005',
        score: 60,
        transcript:
          'Cleanup runs before the next effect and on unmount. The dependency array decides when the effect re-runs, so I list everything it reads.',
        summary: 'Mostly correct; dependency-array reasoning was slightly hand-wavy.',
      },
    ],
  }),
  buildPendingDemoInterview({
    id: '00000000-0000-4000-8000-0000000000a2',
    candidateName: 'Sam Rivera',
    candidateEmail: 'sam.rivera@example.com',
    position: 'Frontend Engineer',
    questionIds: [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000004',
    ],
  }),
];
