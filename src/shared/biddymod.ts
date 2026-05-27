export type ContentType = 'post' | 'comment';

export type ReportEntry = {
  reason: string;
  reportAt: string;
};

export type AggregatedReports = {
  contentId: string;
  contentType: ContentType;
  reports: ReportEntry[];
  count: number;
  firstReportedAt: string;
  lastReportedAt: string;
};

export type QueueItem = {
  contentId: string;
  contentType: ContentType;
  contentPreview: string;
  score: number;
  summary: string;
  topReason: string;
  reportCount: number;
  autoRemoved: boolean;
  escalated?: boolean;
  queuedAt: string;
};

export type ReportTriggerResponse = {
  status: 'success' | 'error' | 'skipped';
  message: string;
};
