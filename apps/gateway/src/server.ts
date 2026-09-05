/**
 * Gateway HTTP server: GraphQL control plane (T07) + SSE data plane (T06).
 */
import { ApolloServer } from "@apollo/server";
import { serve } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { GATEWAY_HOST, GATEWAY_PORT } from "./env.js";
import { formatGatewayError } from "./graphql/errors.js";
import {
  createClickHouse,
  type GatewayContext,
  loadTypeDefs,
  resolvers,
} from "./graphql/resolvers.js";
import { initGatewaySentry } from "./sentry.js";
import { sseRoute } from "./sse.js";

type GraphqlBody = {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
};

async function handleGraphql(
  c: Context,
  apollo: ApolloServer<GatewayContext>,
  ctx: GatewayContext,
): Promise<Response> {
  let body: GraphqlBody;
  try {
    body = (await c.req.json()) as GraphqlBody;
  } catch {
    return c.json({ errors: [{ message: "Invalid request body" }] }, 400);
  }

  try {
    const result = await apollo.executeOperation(
      {
        query: body.query ?? "",
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
  const ctx: GatewayContext = { ch };
  const apollo = new ApolloServer<GatewayContext>({
    typeDefs: loadTypeDefs(),
    resolvers,
    formatError: formatGatewayError,
    includeStacktraceInErrorResponses: false,
  });
  await apollo.start();

  const app = new Hono();
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.post("/graphql", (c) => handleGraphql(c, apollo, ctx));
  app.get("/api/stream", (c) => sseRoute(c));

  serve({ fetch: app.fetch, port: GATEWAY_PORT, hostname: GATEWAY_HOST }, (info) => {
    console.log(`gateway listening on http://${info.address}:${info.port}`);
  });

  const shutdown = async () => {
    await apollo.stop();
    await ch.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  console.error("gateway failed:", error);
  process.exit(1);
});
