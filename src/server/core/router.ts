import { reddit } from '@devvit/web/server';
import { pushToQueue } from './reports';
import type { QueueItem } from '../../shared/biddymod';

// ─── Thresholds ───────────────────────────────────────────────────────────────
// These map the 0–100 score to an action.
// Tune these based on your subreddit's tolerance.

const THRESHOLDS = {
  DISMISS_BELOW: 55,   // score < 55  → quietly dismiss
  REMOVE_ABOVE: 85,    // score >= 85 → auto-remove + alert mods
  // 55–84 → push to mod queue for human review
} as const;

export type RoutingAction = 'dismiss' | 'escalate' | 'remove';

export type RoutingResult = {
  action: RoutingAction;
  autoRemoved: boolean;
};

type RemovableContentId = `t1_${string}` | `t3_${string}`;

const isRemovableContentId = (id: string): id is RemovableContentId =>
  id.startsWith('t1_') || id.startsWith('t3_');

export const routeContent = async (
  contentId: string,
  contentType: 'post' | 'comment',
  subredditId: string,
  score: number,
  summary: string,
  topReason: string,
  reportCount: number,
  contentPreview: string
): Promise<RoutingResult> => {
  const label = describeContent(contentId, contentType);

  // ── Low severity: do nothing ──────────────────────────────────────────────
  if (score < THRESHOLDS.DISMISS_BELOW) {
    console.log(`[biddyMOD] Reviewed ${label}: score ${score}/100. Action: dismissed. Reason: ${topReason}.`);
    return { action: 'dismiss', autoRemoved: false };
  }

  // ── High severity: auto-remove + push to queue so mods can see why ────────
  if (score >= THRESHOLDS.REMOVE_ABOVE) {
    try {
      if (!isRemovableContentId(contentId)) {
        throw new Error(`Invalid removable Reddit content id: ${contentId}`);
      }

      await reddit.remove(contentId, false);
      console.log(`[biddyMOD] Reviewed ${label}: score ${score}/100. Action: auto-removed. Reason: ${topReason}.`);
    } catch (err) {
      console.error(`[biddyMOD] Could not remove ${label}: ${err}`);
    }

    await pushToQueue(subredditId, buildQueueItem({
      contentId, contentType, contentPreview, score, summary, topReason, reportCount,
      autoRemoved: true,
    }));

    return { action: 'remove', autoRemoved: true };
  }

  // ── Medium severity: push to mod queue for human review ───────────────────
  await pushToQueue(subredditId, buildQueueItem({
    contentId, contentType, contentPreview, score, summary, topReason, reportCount,
    autoRemoved: false,
  }));

  console.log(`[biddyMOD] Reviewed ${label}: score ${score}/100. Action: sent to mod queue. Reason: ${topReason}.`);
  return { action: 'escalate', autoRemoved: false };
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const buildQueueItem = (args: {
  contentId: string;
  contentType: 'post' | 'comment';
  contentPreview: string;
  score: number;
  summary: string;
  topReason: string;
  reportCount: number;
  autoRemoved: boolean;
}): QueueItem => ({
  ...args,
  queuedAt: new Date().toISOString(),
});

const describeContent = (
  contentId: string,
  contentType: 'post' | 'comment'
): string => {
  const readableType = contentType === 'post' ? 'post' : 'comment';
  return `${readableType} ${contentId}`;
};
