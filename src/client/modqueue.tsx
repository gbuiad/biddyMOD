import './index.css';

import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { QueueItem } from '../shared/biddymod';

type QueueResponse = {
  items: QueueItem[];
  stats: {
    totalScannedToday: number;
    autoRemoved: number;
    pendingReview: number;
  };
};

type ActionState = {
  contentId: string;
  label: string;
} | null;

export const ModQueue = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueResponse['stats']>({
    totalScannedToday: 0,
    autoRemoved: 0,
    pendingReview: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [showReadMe, setShowReadMe] = useState(false);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.score - a.score),
    [items]
  );

  const loadQueue = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/modqueue');

      if (!response.ok) {
        throw new Error(`Queue request failed with ${response.status}`);
      }

      const data = await response.json() as QueueResponse;
      setItems(data.items);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const takeAction = async (
    endpoint: 'approve' | 'remove' | 'escalate',
    item: QueueItem
  ) => {
    setActionState({ contentId: item.contentId, label: endpoint });
    setError(null);

    try {
      const response = await fetch(`/api/modqueue/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId: item.contentId }),
      });

      if (!response.ok) {
        throw new Error(`${endpoint} failed`);
      }

      if (endpoint === 'escalate') {
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.contentId === item.contentId
              ? { ...currentItem, escalated: true }
              : currentItem
          )
        );
      } else {
        setItems((current) =>
          current.filter((currentItem) => currentItem.contentId !== item.contentId)
        );
        setStats((current) => ({
          ...current,
          pendingReview: Math.max(current.pendingReview - 1, 0),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionState(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#1c1c1c]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-[#d8dadd] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#576f76]">
              biddyMOD
            </p>
            <h1 className="text-2xl font-bold">Mod queue</h1>
          </div>
          <div className="flex gap-2">
            <button
              className="h-9 rounded border border-[#b9c0c4] bg-white px-3 text-sm font-medium text-[#1c1c1c] shadow-sm"
              onClick={() => setShowReadMe((current) => !current)}
            >
              read_me
            </button>
            <button
              className="h-9 rounded border border-[#b9c0c4] bg-white px-3 text-sm font-medium text-[#1c1c1c] shadow-sm"
              onClick={() => void loadQueue()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </header>

        {showReadMe && <ReadMePanel />}

        <section className="grid grid-cols-3 gap-2">
          <Stat label="Scanned today" value={stats.totalScannedToday} />
          <Stat label="Auto-removed" value={stats.autoRemoved} />
          <Stat label="Pending review" value={stats.pendingReview} />
        </section>

        {error && (
          <div className="border border-[#ffb4a8] bg-[#fff4f1] px-3 py-2 text-sm text-[#8a1c00]">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-3">
          {loading && (
            <div className="border border-[#d8dadd] bg-white px-4 py-6 text-center text-sm text-[#576f76]">
              Loading flagged content...
            </div>
          )}

          {!loading && sortedItems.length === 0 && (
            <div className="border border-[#d8dadd] bg-white px-4 py-8 text-center">
              <h2 className="text-lg font-semibold">Queue clear</h2>
              <p className="mt-1 text-sm text-[#576f76]">
                biddyMOD has no flagged content waiting for review.
              </p>
            </div>
          )}

          {!loading &&
            sortedItems.map((item) => (
              <QueueCard
                key={item.contentId}
                item={item}
                actionState={actionState}
                onAction={takeAction}
              />
            ))}
        </section>
      </div>
    </main>
  );
};

const Stat = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="border border-[#d8dadd] bg-white px-3 py-3">
    <div className="text-xl font-bold">{value}</div>
    <div className="mt-1 text-xs font-medium text-[#576f76]">{label}</div>
  </div>
);

const ReadMePanel = () => (
  <section className="border border-[#c9d6dc] bg-[#eef7fa] px-4 py-3 text-sm text-[#26383e]">
    <h2 className="font-semibold">How biddyMOD scores</h2>
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      <div>
        <div className="font-semibold">0-54: dismiss</div>
        <p className="text-[#4d636b]">Low-risk or casual rude language.</p>
      </div>
      <div>
        <div className="font-semibold">55-84: review</div>
        <p className="text-[#4d636b]">Repeated personal attacks or stronger abuse.</p>
      </div>
      <div>
        <div className="font-semibold">85-100: remove</div>
        <p className="text-[#4d636b]">Threats, severe harassment, or urgent risk.</p>
      </div>
    </div>
  </section>
);

const QueueCard = ({
  item,
  actionState,
  onAction,
}: {
  item: QueueItem;
  actionState: ActionState;
  onAction: (
    endpoint: 'approve' | 'remove' | 'escalate',
    item: QueueItem
  ) => Promise<void>;
}) => {
  const busy = actionState?.contentId === item.contentId;
  const [showMore, setShowMore] = useState(false);

  return (
    <article className="border border-[#d8dadd] bg-white">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-1 text-sm font-bold ${getScoreClass(item.score)}`}>
            {item.score}/100
          </span>
          <span className="rounded border border-[#d8dadd] px-2 py-1 text-xs font-semibold uppercase text-[#576f76]">
            {item.contentType}
          </span>
          <span className="text-xs text-[#576f76]">ID: {item.contentId}</span>
          {item.autoRemoved && (
            <span className="rounded bg-[#fff4d6] px-2 py-1 text-xs font-semibold text-[#6f4b00]">
              Auto-removed
            </span>
          )}
          {item.escalated && (
            <span className="rounded bg-[#eef7fa] px-2 py-1 text-xs font-semibold text-[#24515d]">
              Escalated
            </span>
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold">
            "{item.contentPreview || 'No content available'}"
          </h2>
          <p className="mt-1 text-sm font-medium text-[#576f76]">{item.topReason}</p>
          <button
            className="mt-2 text-sm font-semibold text-[#24515d]"
            onClick={() => setShowMore((current) => !current)}
          >
            {showMore ? 'less' : 'more'}
          </button>
          {showMore && (
            <p className="mt-2 text-sm text-[#3f474a]">
              {getTwoSentenceSummary(item.summary)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#576f76]">
            {item.reportCount} report{item.reportCount === 1 ? '' : 's'} · queued {formatQueuedAt(item.queuedAt)}
          </span>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              label="Approve"
              disabled={busy}
              onClick={() => void onAction('approve', item)}
            />
            <ActionButton
              label="Remove"
              tone="danger"
              disabled={busy}
              onClick={() => void onAction('remove', item)}
            />
            <ActionButton
              label="Escalate"
              tone="warning"
              disabled={busy}
              onClick={() => void onAction('escalate', item)}
            />
          </div>
        </div>
      </div>
    </article>
  );
};

const ActionButton = ({
  label,
  tone = 'neutral',
  disabled,
  onClick,
}: {
  label: string;
  tone?: 'neutral' | 'danger' | 'warning';
  disabled: boolean;
  onClick: () => void;
}) => {
  const className = {
    neutral: 'border-[#b9c0c4] bg-white text-[#1c1c1c]',
    danger: 'border-[#d93900] bg-[#d93900] text-white',
    warning: 'border-[#b7791f] bg-[#fff4d6] text-[#6f4b00]',
  }[tone];

  return (
    <button
      className={`h-9 rounded border px-3 text-sm font-semibold disabled:opacity-50 ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

const getScoreClass = (score: number): string => {
  if (score >= 85) return 'bg-[#ffe5df] text-[#8a1c00]';
  if (score >= 55) return 'bg-[#fff4d6] text-[#6f4b00]';
  return 'bg-[#e7f5ea] text-[#1b6b2a]';
};

const getTwoSentenceSummary = (summary: string): string => {
  if (!summary) return 'biddyMOD flagged this item for moderator review.';
  const sentences = summary.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [summary];
  return sentences.slice(0, 2).join(' ').trim();
};

const formatQueuedAt = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModQueue />
  </StrictMode>
);
