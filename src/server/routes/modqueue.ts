import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { getQueue, removeFromQueue, updateQueueItem } from '../core/reports';

export const modqueue = new Hono();

modqueue.get('/', async (c) => {
  const items = await getQueue(context.subredditId);
  const hydratedItems = await Promise.all(items.map(hydratePreview));

  return c.json({
    items: hydratedItems,
    stats: {
      pendingReview: hydratedItems.length,
      autoRemoved: hydratedItems.filter((item) => item.autoRemoved).length,
      totalScannedToday: hydratedItems.length,
    },
  });
});

modqueue.post('/approve', async (c) => {
  const input = await c.req.json<{ contentId: string }>();

  if (isRedditContentId(input.contentId)) {
    await reddit.approve(input.contentId);
  }

  await removeFromQueue(context.subredditId, input.contentId);
  return c.json({ status: 'success' });
});

modqueue.post('/remove', async (c) => {
  const input = await c.req.json<{ contentId: string }>();

  if (!isRedditContentId(input.contentId)) {
    return c.json({ status: 'error', message: 'Invalid Reddit content id' }, 400);
  }

  await reddit.remove(input.contentId, false);
  await removeFromQueue(context.subredditId, input.contentId);
  return c.json({ status: 'success' });
});

modqueue.post('/escalate', async (c) => {
  const input = await c.req.json<{ contentId: string }>();

  const item = await updateQueueItem(context.subredditId, input.contentId, (queueItem) => ({
    ...queueItem,
    escalated: true,
  }));

  if (!item) {
    return c.json({ status: 'error', message: 'Queue item not found' }, 404);
  }

  console.log(`[biddyMOD] Escalated ${input.contentId} for senior moderator review.`);
  return c.json({ status: 'success', item });
});

type RedditContentId = `t1_${string}` | `t3_${string}`;
type RedditCommentId = `t1_${string}`;
type RedditPostId = `t3_${string}`;

const isRedditContentId = (id: string): id is RedditContentId =>
  id.startsWith('t1_') || id.startsWith('t3_');

const isRedditCommentId = (id: string): id is RedditCommentId =>
  id.startsWith('t1_');

const isRedditPostId = (id: string): id is RedditPostId =>
  id.startsWith('t3_');

const hydratePreview = async <T extends { contentId: string; contentType: 'post' | 'comment'; contentPreview?: string }>(
  item: T
): Promise<T> => {
  if (item.contentPreview?.trim()) {
    return item;
  }

  try {
    if (item.contentType === 'comment' && isRedditCommentId(item.contentId)) {
      const comment = await reddit.getCommentById(item.contentId);
      return {
        ...item,
        contentPreview: comment.body,
      };
    }

    if (item.contentType === 'post' && isRedditPostId(item.contentId)) {
      const post = await reddit.getPostById(item.contentId);
      return {
        ...item,
        contentPreview: [post.title, post.body].filter(Boolean).join('\n\n'),
      };
    }
  } catch (error) {
    console.error(`[biddyMOD] Could not hydrate queue preview for ${item.contentId}: ${error}`);
  }

  return item;
};
