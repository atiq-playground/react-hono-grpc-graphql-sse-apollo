/**
 * T03 transport smoke: real gRPC server-streaming of FindingBlock messages,
 * plus dictionary encode/decode round trip.
 *
 * Uses Node http2 (T03 risk: Bun http2 server is newer/less proven).
 *
 * Run: bunx nx run proto:smoke
 */

import { readFileSync } from "node:fs";
import http2 from "node:http2";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { create } from "@bufbuild/protobuf";
import type { ConnectRouter } from "@connectrpc/connect";
import { createClient } from "@connectrpc/connect";
import { connectNodeAdapter, createGrpcTransport } from "@connectrpc/connect-node";
import { assertDictRoundTrip, encodeDictColumn } from "../src/dict.js";
import {
  FindingBlockSchema,
  FindingsService,
  StreamRequestSchema,
} from "../src/gen/findings/v1/findings_pb.js";
import { encodeOffsetStringArrays } from "../src/offsets.js";

const HOST = "127.0.0.1";
const PORT = 19_003;
const DATASET_VERSION = "t03-smoke-v1";

function sampleBlock(sequence: bigint, rowCount: number) {
  const severities = Array.from({ length: rowCount }, (_, i) =>
    i % 3 === 0 ? "critical" : i % 3 === 1 ? "high" : "medium",
  );
  const riskRows = Array.from({ length: rowCount }, (_, i) =>
    i % 2 === 0 ? ["Remote", "Network"] : ["Local"],
  );

  return create(FindingBlockSchema, {
    sequence,
    datasetVersion: DATASET_VERSION,
    rowCount,
    group: Array.from({ length: rowCount }, (_, i) => `group-${i % 2}`),
    repo: Array.from({ length: rowCount }, (_, i) => `repo-${i}`),
    image: Array.from({ length: rowCount }, () => "image-a"),
    cve: Array.from({ length: rowCount }, (_, i) => `CVE-2024-${1000 + i}`),
    packageName: Array.from({ length: rowCount }, () => "pkg"),
    packageVersion: Array.from({ length: rowCount }, () => "1.0.0"),
    path: Array.from({ length: rowCount }, () => ""),
    severity: encodeDictColumn(severities),
    packageType: encodeDictColumn(Array.from({ length: rowCount }, () => "npm")),
    status: encodeDictColumn(Array.from({ length: rowCount }, () => "open")),
    advisoryType: encodeDictColumn(Array.from({ length: rowCount }, () => "nvd")),
    buildType: encodeDictColumn(Array.from({ length: rowCount }, () => "")),
    type: encodeDictColumn(Array.from({ length: rowCount }, () => "vuln")),
    cvss: Array.from({ length: rowCount }, (_, i) => 5 + (i % 5)),
    description: Array.from({ length: rowCount }, () => "desc"),
    cause: Array.from({ length: rowCount }, () => ""),
    exploit: Array.from({ length: rowCount }, () => ""),
    fixDate: Array.from({ length: rowCount }, () => ""),
    published: Array.from({ length: rowCount }, () => ""),
    layerTime: Array.from({ length: rowCount }, () => ""),
    link: Array.from({ length: rowCount }, () => ""),
    owner: Array.from({ length: rowCount }, () => ""),
    vecStr: Array.from({ length: rowCount }, () => ""),
    kaiStatus: {
      rowIndices: [0],
      values: ["invalid - norisk"],
    },
    riskFactors: encodeOffsetStringArrays(riskRows),
    applicableRules: encodeOffsetStringArrays(Array.from({ length: rowCount }, () => ["rule-a"])),
  });
}

function routes(router: ConnectRouter): void {
  router.service(FindingsService, {
    async *streamFindings(req) {
      const start = req.afterSequence === 0n ? 1n : req.afterSequence + 1n;
      for (let seq = start; seq <= 3n; seq++) {
        yield sampleBlock(seq, 4);
      }
    },
  });
}

async function main(): Promise<void> {
  assertDictRoundTrip(["critical", "high", "critical", "medium", "high", "critical"]);
  console.log("dict round trip OK");

  const server = http2.createServer(connectNodeAdapter({ routes }));
  await new Promise<void>((resolve, reject) => {
    server.listen(PORT, HOST, () => resolve());
    server.on("error", reject);
  });

  try {
    const transport = createGrpcTransport({
      baseUrl: `http://${HOST}:${PORT}`,
      httpVersion: "2",
    });
    const client = createClient(FindingsService, transport);
    const received: bigint[] = [];
    for await (const block of client.streamFindings(
      create(StreamRequestSchema, {
        afterSequence: 0n,
        datasetVersion: DATASET_VERSION,
      }),
    )) {
      received.push(block.sequence);
      if (block.rowCount !== 4) {
        throw new Error(`Unexpected row_count ${block.rowCount}`);
      }
      if (!block.severity || block.severity.dictionary.length === 0) {
        throw new Error("Missing severity dictionary on block");
      }
    }
    if (received.length !== 3 || received.join(",") !== "1,2,3") {
      throw new Error(`Unexpected sequences: ${received.join(",")}`);
    }
    console.log(`gRPC stream OK (${received.length} FindingBlock messages)`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  const genFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/gen/findings/v1/findings_pb.ts",
  );
  const source = readFileSync(genFile, "utf8");
  if (/\bnode:/.test(source) || /from ["']fs["']/.test(source)) {
    throw new Error("Generated protobuf contains Node-only imports");
  }
  console.log("generated code browser-safe (no Node-only imports)");
  console.log("proto smoke passed");
}

main().catch((error: unknown) => {
  console.error("proto smoke failed:", error);
  process.exit(1);
});
