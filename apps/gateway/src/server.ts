/**
 * Gateway HTTP server: GraphQL control plane (T07) + SSE data plane (T06).
 */
import { ApolloServer } from "@apollo/server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  createClickHouse,
  type GatewayContext,
  loadTypeDefs,
  resolvers,
} from "./graphql/resolvers.js";
import { initGatewaySentry } from "./sentry.js";
import { sseRoute } from "./sse.js";

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);
const HOST = process.env.GATEWAY_HOST ?? "127.0.0.1";

async function main(): Promise<void> {
  initGatewaySentry();
  const ch = createClickHouse();
  const apollo = new ApolloServer<GatewayContext>({
    typeDefs: loadTypeDefs(),
    resolvers,
  });
  await apollo.start();

  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post("/graphql", async (c) => {
    const body = (await c.req.json()) as {
      query?: string;
      variables?: Record<string, unknown>;
      operationName?: string;
    };
    const result = await apollo.executeOperation(
      {
        query: body.query ?? "",
        variables: body.variables,
        operationName: body.operationName,
      },
      { contextValue: { ch } },
    );
    if (result.body.kind === "single") {
      return c.json(result.body.singleResult);
    }
    return c.json({ errors: [{ message: "Incremental results not supported" }] }, 500);
  });

  app.get("/api/stream", (c) => sseRoute(c));

  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
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
