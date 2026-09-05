/**
 * Sentry bootstrap — no-ops without DSN (T14).
 */
import * as Sentry from "@sentry/react";

const SCRUB_KEYS = /password|secret|token|authorization|cookie|dsn|credential|payload|finding|cve/i;

function scrubValue(key: string, value: unknown): unknown {
  if (SCRUB_KEYS.test(key)) return "[Filtered]";
  if (typeof value === "string" && value.length > 200) return `${value.slice(0, 200)}…`;
  return value;
}

export function initDashboardSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (SCRUB_KEYS.test(key)) {
            event.request.headers[key] = "[Filtered]";
          }
        }
      }
      if (event.extra) {
        for (const [key, value] of Object.entries(event.extra)) {
          event.extra[key] = scrubValue(key, value);
        }
      }
      return event;
    },
  });
}

/** Trace headers for Apollo / fetch; empty when Sentry is disabled. */
export function getTracePropagationHeaders(): Record<string, string> {
  if (!import.meta.env.VITE_SENTRY_DSN) return {};
  const span = Sentry.getActiveSpan();
  if (!span) return {};
  const headers: Record<string, string> = {};
  // getTraceData is available on modern SDKs; fall back silently.
  const data = (
    Sentry as unknown as {
      getTraceData?: () => { "sentry-trace"?: string; baggage?: string };
    }
  ).getTraceData?.();
  if (data?.["sentry-trace"]) headers["sentry-trace"] = data["sentry-trace"];
  if (data?.baggage) headers.baggage = data.baggage;
  return headers;
}
