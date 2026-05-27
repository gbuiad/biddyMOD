import { analyzeWithPerspective } from './perspective';
import { scoreWithGemini } from './scorer';
import { getReports, markScoredIfNew } from './reports';
import { routeContent, type RoutingResult } from './router';
import type { ContentType } from '../../shared/biddymod';

export type ScanResult = RoutingResult & {
  contentId: string;
  contentType: ContentType;
  score: number;
  summary: string;
  topReason: string;
  reportCount: number;
};

export const scanContent = async (
  contentId: string,
  contentType: ContentType,
  subredditId: string,
  text: string
): Promise<ScanResult | null> => {
  const isNew = await markScoredIfNew(contentId);

  if (!isNew) {
    return null;
  }

  const reports = await getReports(contentId);
  const perspective = await analyzeWithPerspective(text);
  const scored = await scoreWithGemini({
    text,
    reportReasons: reports.reports.map((report) => report.reason),
    reportCount: reports.count,
    perspective,
  });

  const routing = await routeContent(
    contentId,
    contentType,
    subredditId,
    scored.score,
    scored.summary,
    scored.topReason,
    reports.count,
    getContentPreview(text)
  );

  return {
    ...routing,
    contentId,
    contentType,
    score: scored.score,
    summary: scored.summary,
    topReason: scored.topReason,
    reportCount: reports.count,
  };
};

const getContentPreview = (text: string): string => {
  const preview = text.replace(/\s+/g, ' ').trim();
  return preview.length > 180 ? `${preview.slice(0, 177)}...` : preview;
};
