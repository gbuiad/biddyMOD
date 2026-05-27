import { settings } from '@devvit/web/server';
import type { PerspectiveAnalysis } from './perspective';

export type ScoreInput = {
  text: string;
  reportReasons: string[];
  reportCount: number;
  perspective: PerspectiveAnalysis;
};

export type ScoreResult = {
  score: number;
  summary: string;
  topReason: string;
};

export const scoreWithGemini = async (
  input: ScoreInput
): Promise<ScoreResult> => {
  const geminiScore = await scoreWithGeminiApi(input);

  if (geminiScore) {
    return geminiScore;
  }

  const localSignal = scoreTextLocally(input.text);
  const perspectiveScore = Math.max(
    input.perspective.weightedScore,
    input.perspective.toxicity,
    input.perspective.severeToxicity,
    input.perspective.insult,
    input.perspective.threat,
    input.perspective.profanity,
    input.perspective.identityAttack
  );

  const reportPressure = Math.min(input.reportCount * 10, 30);
  const score = Math.min(Math.max(perspectiveScore, localSignal.score) + reportPressure, 100);

  return {
    score,
    summary: localSignal.summary || `Scored from ${input.reportCount} report(s) and moderation signals.`,
    topReason: input.reportReasons[0] || localSignal.topReason || input.perspective.topReason || 'No reason given',
  };
};

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are biddyMOD, a moderation assistant for Reddit moderators.
Score the content from 0 to 100 for moderation risk.
0 means harmless. 100 means urgent removal.
Return only valid JSON with this shape:
{"score": number, "summary": string, "topReason": string}`;

const scoreWithGeminiApi = async (
  input: ScoreInput
): Promise<ScoreResult | null> => {
  const apiKey = await getGeminiApiKey();

  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: JSON.stringify({
                content: input.text,
                reportReasons: input.reportReasons,
                reportCount: input.reportCount,
                perspective: input.perspective,
              }),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    await response.text();
    console.error(`[biddyMOD] Gemini API unavailable (${response.status}). Using local fallback scoring.`);
    return null;
  }

  const data = await response.json() as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return null;
  }

  return parseGeminiScore(text);
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};

const getGeminiApiKey = async (): Promise<string | undefined> =>
  await settings.get<string>('gemini-api-key') ??
  process.env.GEMINI_API_KEY;

const parseGeminiScore = (text: string): ScoreResult | null => {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<ScoreResult>;

    if (typeof parsed.score !== 'number') {
      return null;
    }

    return {
      score: Math.max(0, Math.min(Math.round(parsed.score), 100)),
      summary: parsed.summary || 'Gemini flagged this content for moderator review.',
      topReason: parsed.topReason || 'Gemini moderation signal',
    };
  } catch {
    return null;
  }
};

const scoreTextLocally = (text: string): ScoreResult => {
  const normalized = text.toLowerCase();

  const signals = [
    {
      score: 85,
      reason: 'Threat or self-harm language',
      summary: 'The content appears to include threatening or harmful language.',
      patterns: [/\b(kill|die|hurt yourself|end yourself|kys)\b/],
    },
    {
      score: 70,
      reason: 'Targeted harassment',
      summary: 'The content appears to include targeted harassment or abuse.',
      patterns: [/\b(idiot|moron|stupid|worthless|loser|ugly|suck|losers?|shut up)\b/],
    },
    {
      score: 55,
      reason: 'Profanity or hostile tone',
      summary: 'The content appears hostile and may need moderator review.',
      patterns: [/\b(fuck|shit|bitch|asshole|dumb)\b/],
    },
  ];

  const match = signals.find((signal) =>
    signal.patterns.some((pattern) => pattern.test(normalized))
  );

  if (!match) {
    return {
      score: 0,
      summary: '',
      topReason: '',
    };
  }

  return {
    score: match.score,
    summary: match.summary,
    topReason: match.reason,
  };
};
