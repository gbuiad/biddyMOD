import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentCreateRequest,
  OnPostReportRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { scanContent } from '../core/scan';
import type { ReportTriggerResponse } from '../../shared/biddymod';

const createPost = async () => ({ id: 'install-post' });

export const triggers = new Hono();

// ─── App install ──────────────────────────────────────────────────────────────

triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    const post = await createPost();
    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `biddyMOD installed on ${context.subredditName}, post created: ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error on install: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to install' }, 400);
  }
});

// ─── Auto-scan: new post submitted ───────────────────────────────────────────
// Fires the moment anyone creates a post. No waiting for reports.

triggers.post('/on-post-submit', async (c) => {
  try {
    const input = await c.req.json<OnPostSubmitRequest>();
 
    const postId = input.post?.id;
    const subredditId = input.subreddit?.id ?? input.post?.subredditId;
    const title = input.post?.title ?? '';
    const body = input.post?.selftext;
    if (!postId || !subredditId) {
      return c.json<ReportTriggerResponse>(
        { status: 'error', message: 'Missing postId or subredditId' },
        400
      );
    }
 
    const text = [title, body].filter(Boolean).join('\n\n');
    console.log(`[biddyMOD] New post submitted. Scanning post ${postId}: "${previewText(text)}"`);
    const result = await scanContent(postId, 'post', subredditId, text);
 
    if (!result) {
      return c.json<ReportTriggerResponse>(
        { status: 'skipped', message: `Post ${postId} was already scanned` },
        200
      );
    }

    return c.json<ReportTriggerResponse>(
      {
        status: 'success',
        message: `Post ${postId} → action: ${result.action}${result.autoRemoved ? ' (auto-removed)' : ''}`,
      },
      200
    );
  } catch (error) {
    console.error(`[biddyMOD] Error scanning post: ${error}`);
    return c.json<ReportTriggerResponse>({ status: 'error', message: 'Failed to scan post' }, 400);
  }
});

// ─── Auto-scan: new comment created ──────────────────────────────────────────

triggers.post('/on-comment-create', async (c) => {
  try {
    const input = await c.req.json<OnCommentCreateRequest>();
 
    const commentId = input.comment?.id;
    const subredditId = input.subreddit?.id ?? input.comment?.subredditId;
    const body = input.comment?.body ?? '';
    if (!commentId || !subredditId) {
      return c.json<ReportTriggerResponse>(
        { status: 'error', message: 'Missing commentId or subredditId' },
        400
      );
    }
 
    if (!body?.trim()) {
      return c.json<ReportTriggerResponse>({ status: 'skipped', message: 'Empty comment body' }, 200);
    }
 
    console.log(`[biddyMOD] New comment submitted. Scanning comment ${commentId}: "${previewText(body)}"`);
    const result = await scanContent(commentId, 'comment', subredditId, body);
    
    if (!result) {
      return c.json<ReportTriggerResponse>(
        { status: 'skipped', message: `Comment ${commentId} was already scanned` },
        200
      );
    }

    return c.json<ReportTriggerResponse>(
      {
        status: 'success',
        message: `Comment ${commentId} → action: ${result.action}${result.autoRemoved ? ' (auto-removed)' : ''}`,
      },
      200
    );
  } catch (error) {
    console.error(`[biddyMOD] Error scanning comment: ${error}`);
    return c.json<ReportTriggerResponse>({ status: 'error', message: 'Failed to scan comment' }, 400);
  }
});

const previewText = (text: string): string => {
  const preview = text.replace(/\s+/g, ' ').trim();
  return preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;
};

// ─── Keep manual report route too (belt and suspenders) ──────────────────────
// If a user reports something that scored low on auto-scan,
// the extra signal can re-trigger a Gemini review.

triggers.post('/on-post-report', async (c) => {
  try {
    const input = await c.req.json<OnPostReportRequest>();
 
    const postId = input.post?.id;
    const subredditId = input.subreddit?.id ?? input.post?.subredditId;
    const reportReason = input.reason;
    const title = input.post?.title;
    const body = input.post?.selftext;
    if (!postId || !subredditId) {
      return c.json<ReportTriggerResponse>(
        { status: 'error', message: 'Missing postId or subredditId' },
        400
      );
    }
 
    const baseText = [title, body].filter(Boolean).join('\n\n') || 'No content available';
    const text = reportReason ? `${baseText}\n\nReport reason: ${reportReason}` : baseText;
    const result = await scanContent(postId, 'post', subredditId, text);

    if (!result) {
      return c.json<ReportTriggerResponse>(
        { status: 'skipped', message: `Post ${postId} was already scanned` },
        200
      );
    }
 
    return c.json<ReportTriggerResponse>(
      {
        status: 'success',
        message: `Post ${postId} re-scanned with report → action: ${result.action}`,
      },
      200
    );
  } catch (error) {
    console.error(`[biddyMOD] Error handling post report: ${error}`);
    return c.json<ReportTriggerResponse>({ status: 'error', message: 'Failed to handle report' }, 400);
  }
});
