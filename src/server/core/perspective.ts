import { settings } from '@devvit/web/server';

export type PerspectiveAnalysis = {
  toxicity: number;
  severeToxicity: number;
  insult: number;
  threat: number;
  profanity: number;
  identityAttack: number;
  weightedScore: number;
  topReason: string;
};

export const analyzeWithPerspective = async (
  text: string
): Promise<PerspectiveAnalysis> => {
  if (!text.trim()) {
    return emptyPerspective('No text to analyze');
  }

  const apiKey = await getPerspectiveApiKey();

  if (!apiKey) {
    return emptyPerspective('Perspective API not configured');
  }

  const response = await fetch(`${PERSPECTIVE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comment: { text },
      languages: ['en'],
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        INSULT: {},
        THREAT: {},
        PROFANITY: {},
        IDENTITY_ATTACK: {},
      },
    }),
  });

  if (!response.ok) {
    console.error(`[biddyMOD] Perspective API failed: ${response.status} ${response.statusText}`);
    return emptyPerspective('Perspective API request failed');
  }

  const data = await response.json() as PerspectiveResponse;
  const scores = {
    toxicity: getScore(data, 'TOXICITY'),
    severeToxicity: getScore(data, 'SEVERE_TOXICITY'),
    insult: getScore(data, 'INSULT'),
    threat: getScore(data, 'THREAT'),
    profanity: getScore(data, 'PROFANITY'),
    identityAttack: getScore(data, 'IDENTITY_ATTACK'),
  };
  const weightedScore = getWeightedScore(scores);
  const topReason = getTopReason(scores);

  return {
    ...scores,
    weightedScore,
    topReason,
  };
};

const PERSPECTIVE_URL =
  'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

const WEIGHTS = {
  toxicity: 0.2,
  severeToxicity: 0.25,
  insult: 0.15,
  threat: 0.25,
  profanity: 0.05,
  identityAttack: 0.1,
} as const;

type PerspectiveAttribute =
  | 'TOXICITY'
  | 'SEVERE_TOXICITY'
  | 'INSULT'
  | 'THREAT'
  | 'PROFANITY'
  | 'IDENTITY_ATTACK';

type PerspectiveResponse = {
  attributeScores?: Partial<Record<PerspectiveAttribute, {
    summaryScore?: {
      value?: number;
    };
  }>>;
};

const getPerspectiveApiKey = async (): Promise<string | undefined> =>
  await settings.get<string>('perspective-api-key') ??
  process.env.PERSPECTIVE_API_KEY;

const getScore = (
  data: PerspectiveResponse,
  attribute: PerspectiveAttribute
): number => {
  const value = data.attributeScores?.[attribute]?.summaryScore?.value;
  return typeof value === 'number' ? Math.round(value * 100) : 0;
};

const getTopReason = (
  scores: PerspectiveScores
): string => {
  const labels: Record<keyof typeof scores, string> = {
    toxicity: 'Toxicity',
    severeToxicity: 'Severe toxicity',
    insult: 'Insult',
    threat: 'Threat',
    profanity: 'Profanity',
    identityAttack: 'Identity attack',
  };
  const [topKey] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] ?? ['toxicity'];

  return labels[topKey as keyof typeof scores] ?? 'Toxicity';
};

type PerspectiveScores = Omit<PerspectiveAnalysis, 'topReason' | 'weightedScore'>;

const getWeightedScore = (scores: PerspectiveScores): number =>
  Math.round(
    Object.entries(scores).reduce(
      (total, [key, score]) => total + score * WEIGHTS[key as keyof PerspectiveScores],
      0
    )
  );

const emptyPerspective = (topReason: string): PerspectiveAnalysis => ({
  toxicity: 0,
  severeToxicity: 0,
  insult: 0,
  threat: 0,
  profanity: 0,
  identityAttack: 0,
  weightedScore: 0,
  topReason,
});
