import * as Sentry from "@sentry/node";

const SCRUB = /password|secret|token|authorization|cookie|credential|payload/i;

export function initGatewaySentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (SCRUB.test(key)) event.request.headers[key] = "[Filtered]";
        }
      }
      return event;
    },
  });
}
