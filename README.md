# biddyMOD

biddyMOD is a Devvit Web moderation helper for Reddit communities. It watches new posts and comments, scores risky content, stores flagged items in Redis, and gives moderators a custom queue UI where they can approve, remove, or escalate items.

## What It Does

- Scans new posts and comments through Devvit triggers.
- Scores content with Perspective/Gemini when configured, with local fallback scoring.
- Sends medium-risk content to a Redis-backed mod queue.
- Auto-removes very high-risk content and still records it for review.
- Shows moderators a queue panel with score, reason, quote, and actions.

## Running Locally

Install dependencies:

```bash
npm install
```

Type-check:

```bash
npm run type-check
```

Build:

```bash
npm run build
```

Playtest in your subreddit:

```bash
devvit playtest r/biddyMOD_test
```

If playtest says port `5678` is already in use:

```bash
lsof -i :5678
kill <PID>
```

## API Keys

The app can use Google Perspective and Gemini through Devvit app settings. The settings are declared in `devvit.json`.

Set them with:

```bash
devvit settings set perspective-api-key
devvit settings set gemini-api-key
```

If those APIs are unavailable, biddyMOD still uses local fallback scoring.

## Moderator Flow

1. Install/playtest biddyMOD in a subreddit.
2. Create posts or comments in that subreddit.
3. biddyMOD logs the scan in the playtest terminal.
4. Medium-risk items appear in the mod queue.
5. Open the subreddit menu item `biddyMOD Queue`.
6. Review each item and choose `Approve`, `Remove`, or `Escalate`.

## Scoring

- `0-54`: dismissed automatically.
- `55-84`: sent to the mod queue for human review.
- `85-100`: removed automatically and recorded in the queue.

Casual rude language is intentionally scored lower. Repeated attacks, threats, severe harassment, or high-confidence API signals receive higher scores.

## Project Structure

### `devvit.json`

Defines the app configuration:

- Client entrypoints: `splash`, `game`, and `modqueue`.
- Server entrypoint.
- Subreddit menu items.
- Trigger mappings.
- Secret app settings for Perspective and Gemini.

### `src/server/index.ts`

Main Hono server entrypoint. It wires together:

- `/api`
- `/api/modqueue`
- `/internal/menu`
- `/internal/form`
- `/internal/triggers`

### `src/server/routes/triggers.ts`

Receives Devvit trigger events:

- App install.
- New post submit.
- New comment create.
- Post report.

It extracts the Reddit content, builds scan text, and calls `scanContent`.

### `src/server/core/scan.ts`

Coordinates the moderation pipeline:

1. Prevents duplicate scoring.
2. Reads reports.
3. Runs Perspective analysis.
4. Runs Gemini/local scoring.
5. Routes the result to dismiss, queue, or remove.

### `src/server/core/perspective.ts`

Calls Google Perspective when configured. It returns toxicity-related scores and a weighted score. If Perspective is unavailable, it returns neutral scores so fallback scoring can continue.

### `src/server/core/scorer.ts`

Scores content. It tries Gemini first, then falls back to local rules. The local rules catch threats, repeated personal attacks, profanity, and mild insults.

### `src/server/core/router.ts`

Turns scores into moderation actions:

- Low score: dismiss.
- Medium score: push to Redis queue.
- High score: remove from Reddit and push to Redis queue.

### `src/server/core/reports.ts`

Owns Redis storage:

- Report history.
- Duplicate score markers.
- Queue insert/read/update/remove helpers.

### `src/server/routes/modqueue.ts`

API for the mod queue UI:

- `GET /api/modqueue`: read queued items.
- `POST /api/modqueue/approve`: approve and remove from queue.
- `POST /api/modqueue/remove`: remove from Reddit and queue.
- `POST /api/modqueue/escalate`: mark item as escalated.

### `src/client/splash.tsx`

Inline custom post view shown in the Reddit feed. It introduces biddyMOD and lets moderators open the mod queue entrypoint.

### `src/client/modqueue.tsx`

The moderator queue UI. It shows:

- Stats bar.
- Score badge.
- Actual user quote.
- Short reason.
- Expandable explanation.
- Approve, Remove, and Escalate buttons.
- `read_me` scoring guide.

### `src/client/game.tsx`

Starter expanded-view screen. It is still available as the `game` entrypoint but is not the main moderation queue.

## Notes

- Reddit IDs like `t1_...` are comments and `t3_...` are posts.
- Queue items are stored in Redis sorted sets by score.
- Old queue items may not have stored quote text; the mod queue API tries to hydrate missing previews from Reddit.
- API keys should be stored with Devvit settings, not committed to the repo.
