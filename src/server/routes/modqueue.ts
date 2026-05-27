import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { getQueue } from '../core/reports';

export const modqueue = new Hono();

modqueue.get('/', async (c) => {
  const items = await getQueue(context.subredditId);

  return c.json({
    items,
  });
});
