import { QuestionDifficulty } from '../../question/interfaces/question.interface';
import { RecruiterAssistantSuggestedQuestionDto } from './dto/recruiter-assistant.dto';
import { ParsedRecruiterRequest } from './recruiter-assistant.types';

interface QuestionTopic {
  questionText: string;
  category: string;
  subcategory: string;
  tags: string[];
  expectedConcepts: string[];
  sampleGoodAnswer: string;
}

export function buildQuestionSuggestions(
  parsed: ParsedRecruiterRequest,
): RecruiterAssistantSuggestedQuestionDto[] {
  const topics = topicsForPosition(parsed.position);
  return topics.slice(0, parsed.count).map((topic, index) => {
    const difficulty: QuestionDifficulty =
      index < 3 ? 'medium' : index < 8 ? 'hard' : 'medium';
    return {
      key: `suggested-${index + 1}`,
      questionText: topic.questionText,
      role: parsed.position,
      category: topic.category,
      subcategory: topic.subcategory,
      difficulty,
      tags: topic.tags,
      expectedConcepts: topic.expectedConcepts,
      followUpQuestions: [
        'Can you give a concrete example from a real project?',
        'What trade-off would make you choose a different approach?',
      ],
      sampleGoodAnswer: topic.sampleGoodAnswer,
      needsCreation: true,
    };
  });
}

function topicsForPosition(position: string): QuestionTopic[] {
  const specific = positionSpecificTopics(position);
  const generic = genericTopics(position);
  return [...specific, ...generic];
}

function positionSpecificTopics(position: string): QuestionTopic[] {
  if (position === 'Backend Developer') {
    return [
      {
        questionText: 'How would you design a reliable REST API for a high-traffic service?',
        category: 'backend',
        subcategory: 'api-design',
        tags: ['backend', 'api', 'architecture'],
        expectedConcepts: ['resource modeling', 'validation', 'rate limiting'],
        sampleGoodAnswer:
          'A strong answer covers resource boundaries, validation, pagination, idempotency, observability, and backwards-compatible versioning.',
      },
      {
        questionText: 'Explain how you would handle database transactions in a service with concurrent writes.',
        category: 'backend',
        subcategory: 'database',
        tags: ['backend', 'database', 'transactions'],
        expectedConcepts: ['isolation levels', 'locks', 'idempotency'],
        sampleGoodAnswer:
          'A strong answer explains transaction scope, isolation, locking, retries, and how to avoid duplicate side effects.',
      },
      {
        questionText: 'How would you design background job processing for delayed and retryable tasks?',
        category: 'backend',
        subcategory: 'queues',
        tags: ['backend', 'queues', 'reliability'],
        expectedConcepts: ['retry policy', 'dead-letter queue', 'idempotent workers'],
        sampleGoodAnswer:
          'A strong answer covers queue semantics, retry backoff, dead-letter handling, idempotency, monitoring, and operational recovery.',
      },
    ];
  }

  return [];
}

function genericTopics(position: string): QuestionTopic[] {
  return [
    {
      questionText: `What are the most important architecture trade-offs you consider when building a ${position} feature?`,
      category: 'software-engineering',
      subcategory: 'architecture',
      tags: ['architecture', 'trade-offs', 'design'],
      expectedConcepts: ['requirements', 'maintainability', 'scalability'],
      sampleGoodAnswer:
        'A strong answer starts from requirements and explains trade-offs around complexity, maintainability, performance, and team ownership.',
    },
    {
      questionText: `How do you debug a production issue in a ${position} role when the root cause is unclear?`,
      category: 'software-engineering',
      subcategory: 'debugging',
      tags: ['debugging', 'production', 'observability'],
      expectedConcepts: ['hypothesis-driven debugging', 'logs', 'metrics'],
      sampleGoodAnswer:
        'A strong answer explains how to triage impact, form hypotheses, inspect logs and metrics, reduce blast radius, and verify the fix.',
    },
    {
      questionText: `Describe how you would review a complex pull request for a ${position} position.`,
      category: 'software-engineering',
      subcategory: 'code-review',
      tags: ['code-review', 'quality', 'collaboration'],
      expectedConcepts: ['correctness', 'readability', 'tests'],
      sampleGoodAnswer:
        'A strong answer focuses on correctness, maintainability, API boundaries, tests, risk, and clear feedback to the author.',
    },
    {
      questionText: `How do you decide what tests are necessary for a ${position} feature?`,
      category: 'software-engineering',
      subcategory: 'testing',
      tags: ['testing', 'quality', 'risk'],
      expectedConcepts: ['risk-based testing', 'unit tests', 'integration tests'],
      sampleGoodAnswer:
        'A strong answer ties test scope to risk and explains what belongs in unit, integration, and end-to-end tests.',
    },
    {
      questionText: `How would you improve performance in a slow ${position} workflow?`,
      category: 'software-engineering',
      subcategory: 'performance',
      tags: ['performance', 'profiling', 'optimization'],
      expectedConcepts: ['measurement', 'profiling', 'bottlenecks'],
      sampleGoodAnswer:
        'A strong answer measures first, identifies bottlenecks, evaluates trade-offs, and verifies improvements with objective metrics.',
    },
    {
      questionText: `Tell me about a time you had to make a technical trade-off under delivery pressure as a ${position}.`,
      category: 'software-engineering',
      subcategory: 'delivery',
      tags: ['delivery', 'trade-offs', 'communication'],
      expectedConcepts: ['scope control', 'risk communication', 'follow-up work'],
      sampleGoodAnswer:
        'A strong answer explains constraints, options considered, risk communication, and how technical debt was managed after delivery.',
    },
    {
      questionText: `How do you keep a ${position} codebase maintainable as the team and product grow?`,
      category: 'software-engineering',
      subcategory: 'maintainability',
      tags: ['maintainability', 'ownership', 'architecture'],
      expectedConcepts: ['module boundaries', 'conventions', 'refactoring'],
      sampleGoodAnswer:
        'A strong answer covers clear boundaries, conventions, incremental refactoring, documentation, and ownership practices.',
    },
    {
      questionText: `How would you onboard to an unfamiliar ${position} codebase and become productive quickly?`,
      category: 'software-engineering',
      subcategory: 'onboarding',
      tags: ['onboarding', 'learning', 'collaboration'],
      expectedConcepts: ['system mapping', 'local setup', 'small changes'],
      sampleGoodAnswer:
        'A strong answer describes building a mental model, running the system locally, reading tests, and shipping a small low-risk change.',
    },
    {
      questionText: `What security concerns should a ${position} engineer keep in mind during implementation?`,
      category: 'software-engineering',
      subcategory: 'security',
      tags: ['security', 'validation', 'access-control'],
      expectedConcepts: ['input validation', 'authorization', 'data protection'],
      sampleGoodAnswer:
        'A strong answer covers validation, authorization, secrets, sensitive data, dependency risk, and secure defaults.',
    },
    {
      questionText: `How do you communicate technical risk to non-technical stakeholders as a ${position}?`,
      category: 'software-engineering',
      subcategory: 'communication',
      tags: ['communication', 'risk', 'stakeholders'],
      expectedConcepts: ['impact framing', 'options', 'recommendation'],
      sampleGoodAnswer:
        'A strong answer translates technical risk into product impact, presents options, and recommends a practical path forward.',
    },
    {
      questionText: `How do you evaluate whether a new library or framework is appropriate for a ${position} project?`,
      category: 'software-engineering',
      subcategory: 'tooling',
      tags: ['tooling', 'libraries', 'decision-making'],
      expectedConcepts: ['maintenance', 'fit', 'migration cost'],
      sampleGoodAnswer:
        'A strong answer considers maturity, maintenance, security, team familiarity, integration cost, and long-term ownership.',
    },
    {
      questionText: `Describe a situation where you simplified an overcomplicated ${position} implementation.`,
      category: 'software-engineering',
      subcategory: 'simplicity',
      tags: ['simplicity', 'refactoring', 'design'],
      expectedConcepts: ['complexity reduction', 'behavior preservation', 'tests'],
      sampleGoodAnswer:
        'A strong answer explains the original complexity, the simpler design, how behavior was preserved, and what improved afterward.',
    },
  ];
}
