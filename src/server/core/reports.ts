import { redis } from '@devvit/web/server';
import type { AggregatedReports, QueueItem, ReportEntry } from '../../shared/biddymod';

// HELPERS

export const KEYS = {
    reports: (contentId: string) => `reports:${contentId}`,
    queue: (subredditId: string) => `queue:${subredditId}`,
    scored: (contentId: string) => `scored:${contentId}`,
} as const;

// REPORT STORAGE

export const appendReport = async (
  contentId: string,
  reason: string
): Promise<number> => {
  const key = KEYS.reports(contentId);
  const reportedAt = new Date().toISOString();
  const entry: ReportEntry = {
    reason: reason || 'No reason given',
    reportAt: reportedAt,
  };

  await redis.zAdd(key, {
    member: JSON.stringify(entry),
    score: Date.parse(reportedAt),
  });
  await redis.expire(key, 60 * 60 * 24 * 30);

  return await redis.zCard(key);
};

// reads all reports for a given content ID
export const getReports = async (contentId: string): Promise<AggregatedReports> => {
    const key = KEYS.reports(contentId);
    const raw = await redis.zRange(key, 0, -1);
    const reports: ReportEntry[] = raw.map((r): ReportEntry => {
        const member = typeof r === 'string' ? r : r.member;
        try {
            return JSON.parse(member) as ReportEntry;
        } catch {
            return { reason: member, reportAt: new Date().toISOString() };
        }
    });
    return {
        contentId,
        contentType: contentId.startsWith('t1_') ? 'comment' : 'post',
        reports,
        count: reports.length,
        firstReportedAt: reports[0]?.reportAt || new Date().toISOString(),
        lastReportedAt: reports[reports.length - 1]?.reportAt || new Date().toISOString(),
    };
};

// DUPLICATE-SCORE GUARD
// returns true if the content is new
// mark scored on first call so we don't score the ssame post twice

export const markScoredIfNew = async (contentId: string): Promise<boolean> => {
    const key = KEYS.scored(contentId);
    const existing = await redis.get(key);
    if (existing) return false;
    await redis.set(key, '1');
    await redis.expire(key, 60 * 60 * 24 * 30);
    return true;
}

export const pushToQueue = async (
  subredditId: string,
  item: QueueItem
): Promise<void> => {
  const key = KEYS.queue(subredditId);

  await redis.zAdd(key, {
    member: JSON.stringify(item),
    score: item.score,
  });

  await redis.expire(key, 60 * 60 * 24 * 30);
};

// read the top N items from mod queue for a subreddit, highest scores first
export const getQueue = async (subredditId: string, limit = 50): Promise<QueueItem[]> => {
  const key = KEYS.queue(subredditId);
  const raw = await redis.zRange(key, 0, limit - 1, { reverse: true, by: 'rank' });

  return raw
    .map((r) => {
      const member = typeof r === 'string' ? r : r.member;
      try {
        return JSON.parse(member) as QueueItem;
      } catch {
        return null;
      }
    })
    .filter((item): item is QueueItem => item !== null);
};

// remove a single item from queue by contentId
export const removeFromQueue = async (
    subredditId: string,
    contentId: string
): Promise<void> => {
    const key = KEYS.queue(subredditId);
    const all = await redis.zRange(key, 0, -1);
    for (const raw of all) {
        try {
            const member = typeof raw === 'string' ? raw : raw.member;
            const item = JSON.parse(member) as QueueItem;
            if (item.contentId === contentId) {
                await redis.zRem(key, [member]);
                break;
            }
        } catch {
            // skip forward
        }
    }
}

export const updateQueueItem = async (
  subredditId: string,
  contentId: string,
  update: (item: QueueItem) => QueueItem
): Promise<QueueItem | null> => {
    const key = KEYS.queue(subredditId);
    const all = await redis.zRange(key, 0, -1);
    for (const raw of all) {
        try {
            const member = typeof raw === 'string' ? raw : raw.member;
            const item = JSON.parse(member) as QueueItem;
            if (item.contentId === contentId) {
                const updatedItem = update(item);
                await redis.zRem(key, [member]);
                await redis.zAdd(key, {
                    member: JSON.stringify(updatedItem),
                    score: updatedItem.score,
                });
                await redis.expire(key, 60 * 60 * 24 * 30);
                return updatedItem;
            }
        } catch {
            // skip forward
        }
    }
    return null;
}
