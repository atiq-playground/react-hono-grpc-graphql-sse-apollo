/**
 * Transport smoke: real gRPC client-streaming of FindingBlock messages,
 * plus unary ApplyChanges and dictionary encode/decode round trips.
 *
 * Uses Node HTTP/2 to exercise the same server-only transport as producer.
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
  ApplyChangesRequestSchema,
  ApplyChangesResponseSchema,
  FindingBlockSchema,
  IngestBlocksResponseSchema,
  IngestService,
} from "../src/gen/findings/v2/findings_pb.js";
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
  router.service(IngestService, {
    async ingestBlocks(blocks) {
      let blockCount = 0n;
      let rowCount = 0n;
      for await (const block of blocks) {
        blockCount += 1n;
        rowCount += BigInt(block.rowCount);
      }
      return create(IngestBlocksResponseSchema, {
        datasetVersion: DATASET_VERSION,
        blocksWritten: blockCount,
        sourceRowsWritten: rowCount,
        terminalEventId: "1-0",
        currentFindings: rowCount,
      });
    },
    applyChanges(request) {
      return create(ApplyChangesResponseSchema, {
        upsertsApplied: BigInt(request.upserts?.rowCount ?? 0),
        deletesApplied: BigInt(request.deleteFindingIds.length),
        eventIds: ["2-0"],
      });
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
    });
    const client = createClient(IngestService, transport);
    async function* blocks() {
      for (let sequence = 1n; sequence <= 3n; sequence++) {
        yield sampleBlock(sequence, 4);
      }
    }
    const ingest = await client.ingestBlocks(blocks());
    if (ingest.blocksWritten !== 3n || ingest.sourceRowsWritten !== 12n) {
      throw new Error("Unexpected IngestBlocks response");
    }
    console.log(`gRPC client stream OK (${ingest.blocksWritten} FindingBlock messages)`);

    const changes = await client.applyChanges(
      create(ApplyChangesRequestSchema, {
        datasetVersion: DATASET_VERSION,
        upserts: sampleBlock(1n, 1),
        deleteFindingIds: ["0123456789abcdef0123456789abcdef"],
      }),
    );
    if (changes.upsertsApplied !== 1n || changes.deletesApplied !== 1n) {
      throw new Error("Unexpected ApplyChanges response");
    }
    console.log("gRPC ApplyChanges OK");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  const genFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/gen/findings/v2/findings_pb.ts",
  );
  const source = readFileSync(genFile, "utf8");
  if (/\bnode:/.test(source) || /from ["']fs["']/.test(source)) {
    throw new Error("Generated protobuf contains Node-only imports");
  }
  console.log("generated protobuf has no unexpected Node built-in imports");
  console.log("proto smoke passed");
}

main().catch((error: unknown) => {
  console.error("proto smoke failed:", error);
  process.exit(1);
});
