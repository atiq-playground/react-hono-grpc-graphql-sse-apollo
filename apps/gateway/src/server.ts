/** Gateway HTTP server: bounded GraphQL control plane and DatasetEvent SSE relay. */
import { ApolloServer } from "@apollo/server";
import { serve } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { z } from "zod/mini";
import { GATEWAY_HOST, GATEWAY_PORT } from "./env.js";
import { createClickHouse, createRedis, type GatewayContext } from "./graphql/context.js";
import { formatGatewayError } from "./graphql/errors.js";
import { downloadExportRoute } from "./graphql/export/download-route.js";
import { resumeExportJobs } from "./graphql/export/export-worker.js";
import { resolvers } from "./graphql/resolvers/index.js";
import typeDefs from "./graphql/schema.graphql" with { type: "text" };
import { initGatewaySentry } from "./sentry.js";
import { sseRoute } from "./sse.js";

const GRAPHQL_BODY_MAX_BYTES = 1_048_576;

// [schemas]

const GraphqlBodySchema = z.object({
  query: z.string().check(z.minLength(1), z.maxLength(65_536)),
  variables: z.optional(z.record(z.string(), z.unknown())),
  operationName: z.optional(z.string().check(z.minLength(1), z.maxLength(128))),
});

async function handleGraphql(
  c: Context,
  apollo: ApolloServer<GatewayContext>,
  ctx: GatewayContext,
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ errors: [{ message: "Invalid request body" }] }, 400);
  }
  const bodyParse = GraphqlBodySchema.safeParse(rawBody);
  if (!bodyParse.success) {
    return c.json({ errors: [{ message: "Invalid GraphQL request body" }] }, 400);
  }
  const body = bodyParse.data;

  try {
    const result = await apollo.executeOperation(
      {
        query: body.query,
        variables: body.variables,
        operationName: body.operationName,
      },
      { contextValue: ctx },
    );
    if (result.body.kind === "single") {
      return c.json(result.body.singleResult);
    }
    return c.json({ errors: [{ message: "Something went wrong" }] }, 500);
  } catch (error: unknown) {
    console.error("gateway /graphql failed:", error);
    return c.json({ errors: [{ message: "Something went wrong" }] }, 500);
  }
}

async function main(): Promise<void> {
  initGatewaySentry();
  const ch = createClickHouse();
  const redis = createRedis();
  const ctx: GatewayContext = { ch, redis };
  const apollo = new ApolloServer<GatewayContext>({
    typeDefs,
    resolvers,
    formatError: formatGatewayError,
    includeStacktraceInErrorResponses: false,
  });
  await apollo.start();

  const app = new Hono();
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.use(
    "/graphql",
    bodyLimit({
      maxSize: GRAPHQL_BODY_MAX_BYTES,
      onError: (c) => c.json({ errors: [{ message: "GraphQL request body is too large" }] }, 413),
    }),
  );
  app.use("/graphql", compress());
  app.post("/graphql", (c) => handleGraphql(c, apollo, ctx));
  // SSE is intentionally excluded: Hono compression cannot explicitly flush
  // each event, so middleware buffering could delay live frames and keepalives.
  app.get("/api/stream", (c) => sseRoute(c));
  app.get("/api/exports/:id", (c) => downloadExportRoute(c, ctx));

  serve({ fetch: app.fetch, port: GATEWAY_PORT, hostname: GATEWAY_HOST }, (info) => {
    console.log(`gateway listening on http://${info.address}:${info.port}`);
  });
  void resumeExportJobs(ctx).catch(() => {
    console.error("gateway could not resume incomplete export jobs");
  });

  const shutdown = async () => {
    await apollo.stop();
    await ch.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  console.error("gateway failed:", error);
  process.exit(1);
});
