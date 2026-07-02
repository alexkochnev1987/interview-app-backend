import { Locale } from '../locale/locale.constants';
import {
  QuestionDifficulty,
  QuestionExpectedConcept,
  QuestionRedFlag,
} from '../question/interfaces/question.interface';

type RedFlagPreset = { label: string; severity: 'low' | 'medium' | 'high' };

interface HeuristicLocaleCopy {
  conceptPresets: Record<string, string[]>;
  defaultConcepts: string[];
  conceptDescription: (label: string, difficulty: QuestionDifficulty) => string;
  redFlagPresets: Record<string, RedFlagPreset[]>;
  defaultRedFlags: RedFlagPreset[];
  followUpFirst: (category: string) => string;
  followUpSecond: string;
  sampleSoftSkills: string;
  sampleTechnical: (questionText: string) => string;
}

const HEURISTIC_BY_LOCALE: Record<Locale, HeuristicLocaleCopy> = {
  en: {
    conceptPresets: {
      html: ['semantic HTML', 'accessibility basics', 'correct structure'],
      css: ['layout reasoning', 'box model awareness', 'responsive styling'],
      javascript: ['language fundamentals', 'runtime behavior', 'practical example'],
      typescript: ['type safety', 'interface usage', 'trade-offs of typing'],
      react: ['component reasoning', 'state flow', 'render behavior'],
      soft_skills: ['clear communication', 'specific example', 'ownership'],
      processes: ['practical workflow', 'quality mindset', 'team collaboration'],
    },
    defaultConcepts: ['clear reasoning', 'relevant example', 'practical outcome'],
    conceptDescription: (label, difficulty) =>
      difficulty === 'hard'
        ? `${label} should be explained with enough detail to show strong fundamentals.`
        : `${label} should be explicitly covered in the answer.`,
    redFlagPresets: {
      html: [
        { label: 'Confuses HTML with CSS responsibilities', severity: 'medium' },
        { label: 'Ignores accessibility implications', severity: 'high' },
      ],
      css: [
        { label: 'Focuses only on memorized properties', severity: 'medium' },
        { label: 'No responsiveness consideration', severity: 'high' },
      ],
      javascript: [
        { label: 'Uses keywords without explanation', severity: 'medium' },
        { label: 'Incorrect explanation of core runtime behavior', severity: 'high' },
      ],
      typescript: [
        { label: 'Treats TypeScript as runtime validation', severity: 'high' },
        { label: 'No understanding of type narrowing', severity: 'medium' },
      ],
      react: [
        { label: 'Explains only syntax without data flow', severity: 'medium' },
        { label: 'Misses state and rendering implications', severity: 'high' },
      ],
      soft_skills: [
        { label: 'Answer is generic and not evidence-based', severity: 'medium' },
        { label: 'Avoids ownership in examples', severity: 'high' },
      ],
      processes: [
        { label: 'No concrete workflow example', severity: 'medium' },
        { label: 'Ignores quality or communication checks', severity: 'high' },
      ],
    },
    defaultRedFlags: [
      { label: 'No concrete workflow example', severity: 'medium' },
      { label: 'Ignores quality or communication checks', severity: 'high' },
    ],
    followUpFirst: (category) =>
      category === 'soft_skills'
        ? 'Can you give a specific example from your own experience?'
        : 'Can you give a simple practical example?',
    followUpSecond: 'What common mistake or misconception would you avoid?',
    sampleSoftSkills:
      'I would answer this by giving a short real example, explaining my role, what I did, and what result it led to in practice.',
    sampleTechnical: (questionText) =>
      `A strong answer to "${questionText}" should explain the idea in simple terms, mention why it matters, and give one practical example.`,
  },
  pl: {
    conceptPresets: {
      html: ['semantyczny HTML', 'podstawy dostępności', 'poprawna struktura'],
      css: ['układ strony', 'świadomość box model', 'stylowanie responsywne'],
      javascript: ['fundamenty języka', 'zachowanie runtime', 'praktyczny przykład'],
      typescript: ['bezpieczeństwo typów', 'użycie interfejsów', 'kompromisy typowania'],
      react: ['rozumienie komponentów', 'przepływ stanu', 'zachowanie renderowania'],
      soft_skills: ['jasna komunikacja', 'konkretny przykład', 'odpowiedzialność'],
      processes: ['praktyczny workflow', 'nastawienie na jakość', 'współpraca w zespole'],
    },
    defaultConcepts: ['jasne rozumowanie', 'trafny przykład', 'praktyczny efekt'],
    conceptDescription: (label, difficulty) =>
      difficulty === 'hard'
        ? `${label} powinno być omówione na tyle szczegółowo, by pokazać solidne fundamenty.`
        : `${label} powinno być wyraźnie uwzględnione w odpowiedzi.`,
    redFlagPresets: {
      html: [
        { label: 'Miesza odpowiedzialności HTML i CSS', severity: 'medium' },
        { label: 'Pomija implikacje dostępności', severity: 'high' },
      ],
      css: [
        { label: 'Opiera się tylko na zapamiętanych właściwościach', severity: 'medium' },
        { label: 'Brak uwzględnienia responsywności', severity: 'high' },
      ],
      javascript: [
        { label: 'Używa słów kluczowych bez wyjaśnienia', severity: 'medium' },
        { label: 'Błędne wyjaśnienie zachowania runtime', severity: 'high' },
      ],
      typescript: [
        { label: 'Traktuje TypeScript jak walidację w runtime', severity: 'high' },
        { label: 'Brak zrozumienia zawężania typów', severity: 'medium' },
      ],
      react: [
        { label: 'Opisuje tylko składnię bez przepływu danych', severity: 'medium' },
        { label: 'Pomija stan i konsekwencje renderowania', severity: 'high' },
      ],
      soft_skills: [
        { label: 'Odpowiedź jest ogólnikowa i bez dowodów', severity: 'medium' },
        { label: 'Unika odpowiedzialności w przykładach', severity: 'high' },
      ],
      processes: [
        { label: 'Brak konkretnego przykładu workflow', severity: 'medium' },
        { label: 'Pomija jakość lub komunikację w procesie', severity: 'high' },
      ],
    },
    defaultRedFlags: [
      { label: 'Brak konkretnego przykładu workflow', severity: 'medium' },
      { label: 'Pomija jakość lub komunikację w procesie', severity: 'high' },
    ],
    followUpFirst: (category) =>
      category === 'soft_skills'
        ? 'Czy możesz podać konkretny przykład ze swojego doświadczenia?'
        : 'Czy możesz podać prosty praktyczny przykład?',
    followUpSecond: 'Jakiego powszechnego błędu lub nieporozumienia byś unikał?',
    sampleSoftSkills:
      'Odpowiedziałbym krótkim realnym przykładem: moja rola, co zrobiłem i jaki był praktyczny rezultat.',
    sampleTechnical: (questionText) =>
      `Dobra odpowiedź na „${questionText}” powinna wyjaśnić ideę prostymi słowami, wskazać, dlaczego ma to znaczenie, i podać jeden praktyczny przykład.`,
  },
  ru: {
    conceptPresets: {
      html: ['семантический HTML', 'основы доступности', 'корректная структура'],
      css: ['вёрстка и layout', 'понимание box model', 'адаптивная вёрстка'],
      javascript: ['основы языка', 'поведение runtime', 'практический пример'],
      typescript: ['типобезопасность', 'использование интерфейсов', 'компромиссы типизации'],
      react: ['понимание компонентов', 'поток состояния', 'поведение рендера'],
      soft_skills: ['ясная коммуникация', 'конкретный пример', 'ответственность'],
      processes: ['практичный workflow', 'фокус на качестве', 'командная работа'],
    },
    defaultConcepts: ['ясное рассуждение', 'релевантный пример', 'практический результат'],
    conceptDescription: (label, difficulty) =>
      difficulty === 'hard'
        ? `${label} нужно раскрыть достаточно подробно, чтобы показать сильную базу.`
        : `${label} должно быть явно отражено в ответе.`,
    redFlagPresets: {
      html: [
        { label: 'Путает зоны ответственности HTML и CSS', severity: 'medium' },
        { label: 'Игнорирует доступность', severity: 'high' },
      ],
      css: [
        { label: 'Опирается только на заученные свойства', severity: 'medium' },
        { label: 'Не учитывает адаптивность', severity: 'high' },
      ],
      javascript: [
        { label: 'Использует термины без объяснения', severity: 'medium' },
        { label: 'Неверно объясняет поведение runtime', severity: 'high' },
      ],
      typescript: [
        { label: 'Считает TypeScript runtime-валидацией', severity: 'high' },
        { label: 'Не понимает сужение типов', severity: 'medium' },
      ],
      react: [
        { label: 'Описывает только синтаксис без потока данных', severity: 'medium' },
        { label: 'Упускает состояние и последствия рендера', severity: 'high' },
      ],
      soft_skills: [
        { label: 'Ответ общий и без фактов', severity: 'medium' },
        { label: 'Избегает ответственности в примерах', severity: 'high' },
      ],
      processes: [
        { label: 'Нет конкретного примера workflow', severity: 'medium' },
        { label: 'Игнорирует качество или коммуникацию', severity: 'high' },
      ],
    },
    defaultRedFlags: [
      { label: 'Нет конкретного примера workflow', severity: 'medium' },
      { label: 'Игнорирует качество или коммуникацию', severity: 'high' },
    ],
    followUpFirst: (category) =>
      category === 'soft_skills'
        ? 'Можете привести конкретный пример из своего опыта?'
        : 'Можете привести простой практический пример?',
    followUpSecond: 'Какую распространённую ошибку или заблуждение вы бы избегали?',
    sampleSoftSkills:
      'Я бы ответил коротким реальным примером: моя роль, что я сделал и какой был практический результат.',
    sampleTechnical: (questionText) =>
      `Сильный ответ на «${questionText}» должен простыми словами объяснить идею, зачем это важно, и привести один практический пример.`,
  },
  be: {
    conceptPresets: {
      html: ['семантычны HTML', 'асновы даступнасці', 'карэктная структура'],
      css: ['вёрстка і layout', 'разуменне box model', 'адаптыўная вёрстка'],
      javascript: ['асновы мовы', 'паводзіны runtime', 'практычны прыклад'],
      typescript: ['тыпабяспека', 'выкарыстанне інтэрфейсаў', 'кампрамісы тыпізацыі'],
      react: ['разуменне кампанентаў', 'поток стану', 'паводзіны рэндэра'],
      soft_skills: ['ясная камунікацыя', 'канкрэтны прыклад', 'адказнасць'],
      processes: ['практычны workflow', 'фокус на якасці', 'камандная работа'],
    },
    defaultConcepts: ['яснае рассужданне', 'рэлевантны прыклад', 'практычны вынік'],
    conceptDescription: (label, difficulty) =>
      difficulty === 'hard'
        ? `${label} трэба раскрыць дастаткова падрабязна, каб паказаць моцную базу.`
        : `${label} павінна быць яўна адлюстравана ў адказе.`,
    redFlagPresets: {
      html: [
        { label: 'Блытае зоны адказнасці HTML і CSS', severity: 'medium' },
        { label: 'Ігнаруе даступнасць', severity: 'high' },
      ],
      css: [
        { label: 'Апіраецца толькі на зазубраныя ўласцівасці', severity: 'medium' },
        { label: 'Не ўлічвае адаптыўнасць', severity: 'high' },
      ],
      javascript: [
        { label: 'Ужывае тэрміны без тлумачэння', severity: 'medium' },
        { label: 'Няправільна тлумачыць паводзіны runtime', severity: 'high' },
      ],
      typescript: [
        { label: 'Лічыць TypeScript runtime-валідацыяй', severity: 'high' },
        { label: 'Не разумее звужэнне тыпаў', severity: 'medium' },
      ],
      react: [
        { label: 'Апісвае толькі сінтаксіс без патоку даных', severity: 'medium' },
        { label: 'Прапускае стан і наступствы рэндэра', severity: 'high' },
      ],
      soft_skills: [
        { label: 'Адказ агульны і без фактаў', severity: 'medium' },
        { label: 'Абмінае адказнасць у прыкладах', severity: 'high' },
      ],
      processes: [
        { label: 'Няма канкрэтнага прыкладу workflow', severity: 'medium' },
        { label: 'Ігнаруе якасць або камунікацыю', severity: 'high' },
      ],
    },
    defaultRedFlags: [
      { label: 'Няма канкрэтнага прыкладу workflow', severity: 'medium' },
      { label: 'Ігнаруе якасць або камунікацыю', severity: 'high' },
    ],
    followUpFirst: (category) =>
      category === 'soft_skills'
        ? 'Ці можаце прывесці канкрэтны прыклад з свайго досведу?'
        : 'Ці можаце прывесці просты практычны прыклад?',
    followUpSecond: 'Якую распаўсюджаную памылку ці заблуждэнне вы б пазбеглі?',
    sampleSoftSkills:
      'Я б адказаў кароткім рэальным прыкладам: мая роля, што я зрабіў і які быў практычны вынік.',
    sampleTechnical: (questionText) =>
      `Моцны адказ на «${questionText}» павінен простымі словамі тлумачыць ідэю, навошта гэта важна, і прывесці адзін практычны прыклад.`,
  },
};

export function heuristicExpectedConcepts(
  locale: Locale,
  category: string,
  difficulty: QuestionDifficulty,
  slugify: (value: string) => string,
): QuestionExpectedConcept[] {
  const copy = HEURISTIC_BY_LOCALE[locale];
  const labels = copy.conceptPresets[category] ?? copy.defaultConcepts;
  const weight = Number((1 / labels.length).toFixed(4));

  return labels.map((label, index) => ({
    id: `${slugify(category)}_${slugify(label)}_${index + 1}`,
    label,
    weight:
      index === labels.length - 1
        ? Number((1 - weight * (labels.length - 1)).toFixed(4))
        : weight,
    description: copy.conceptDescription(label, difficulty),
  }));
}

export function heuristicRedFlags(
  locale: Locale,
  category: string,
  slugify: (value: string) => string,
): QuestionRedFlag[] {
  const copy = HEURISTIC_BY_LOCALE[locale];
  const preset = copy.redFlagPresets[category] ?? copy.defaultRedFlags;
  return preset.map((item) => ({
    id: slugify(item.label),
    label: item.label,
    severity: item.severity,
  }));
}

export function heuristicFollowUps(
  locale: Locale,
  questionText: string,
  category: string,
): string[] {
  if (!questionText) {
    return [];
  }
  const copy = HEURISTIC_BY_LOCALE[locale];
  return [copy.followUpFirst(category), copy.followUpSecond];
}

export function heuristicSampleAnswer(
  locale: Locale,
  category: string,
  questionText: string,
): string {
  const copy = HEURISTIC_BY_LOCALE[locale];
  if (category === 'soft_skills') {
    return copy.sampleSoftSkills;
  }
  return copy.sampleTechnical(questionText);
}
