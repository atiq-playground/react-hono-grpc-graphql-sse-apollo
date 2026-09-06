/**
 * Stream a ~10MB sanitized contiguous prefix of the full ui_demo.json corpus
 * into apps/producer/data/sample/ for quick local setup. Never loads the full
 * file into memory.
 *
 * Usage: bunx nx run producer:make-sample
 */

import { createReadStream, createWriteStream, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { chain, none } from "stream-chain";
import { parser } from "stream-json";
import stringer from "stream-json/stringer.js";

const TARGET_BYTES = 10 * 1024 * 1024;
const FULL_CORPUS_DEFAULT = "apps/producer/data/raw/ui_demo.json";
const SAMPLE_DEFAULT = "apps/producer/data/sample/ui_demo.sample.json";
const MANIFEST_DEFAULT = "apps/producer/data/sample/MANIFEST.json";

type Token = { name: string; value?: unknown };
type Mode = "root" | "groups" | "group" | "repos" | "repo" | "images" | "image" | "vulns" | "skip";

/** Replace private registry hosts / org-looking names for the checked-in sample. */
function sanitizeText(value: string): string {
  return value
    .replace(/\b(?:[a-z0-9-]+\.)*[a-z0-9-]+\.priv\b/gi, "registry.example.invalid")
    .replace(/neelamcorp/gi, "example");
}

function sanitizeToken(token: Token): Token {
  if (
    (token.name === "stringValue" || token.name === "keyValue") &&
    typeof token.value === "string"
  ) {
    return { name: token.name, value: sanitizeText(token.value) };
  }
  return token;
}

function closingTokens(modes: Mode[]): Token[] {
  const tokens: Token[] = [];
  for (let i = modes.length - 1; i >= 0; i--) {
    const mode = modes[i];
    if (mode === "vulns") tokens.push({ name: "endArray" });
    else if (mode !== "skip") tokens.push({ name: "endObject" });
  }
  return tokens;
}

function writeJsonChunk(
  toJson: (token: Token) => unknown,
  out: NodeJS.WritableStream,
  token: Token,
): number {
  const chunk = toJson(sanitizeToken(token));
  if (chunk === none || chunk == null) return 0;
  const text = typeof chunk === "string" ? chunk : String(chunk);
  out.write(text);
  return Buffer.byteLength(text, "utf8");
}

async function main(): Promise<void> {
  const sourcePath = resolve(process.argv[2] ?? FULL_CORPUS_DEFAULT);
  const samplePath = resolve(process.argv[3] ?? SAMPLE_DEFAULT);
  const manifestPath = resolve(process.argv[4] ?? MANIFEST_DEFAULT);

  mkdirSync(dirname(samplePath), { recursive: true });

  const pipeline = chain([
    createReadStream(sourcePath, { highWaterMark: 256 * 1024 }),
    parser(),
  ]) as AsyncIterable<Token>;

  const out = createWriteStream(samplePath);
  const toJson = stringer({ useValues: true }) as (token: Token) => unknown;

  const modes: Mode[] = ["root"];
  let pendingKey: string | null = null;
  let skipDepth = 0;
  let vulnDepth = 0;
  let approxBytes = 0;
  let sourceRows = 0;
  let stopping = false;

  const emit = (token: Token): void => {
    approxBytes += writeJsonChunk(toJson, out, token);
  };

  for await (const rawToken of pipeline) {
    if (stopping) break;

    const token = rawToken;

    // Track vuln object depth so we only stop on complete vulnerability objects.
    if (vulnDepth > 0) {
      if (token.name === "startObject" || token.name === "startArray") vulnDepth += 1;
      if (token.name === "endObject" || token.name === "endArray") vulnDepth -= 1;
      emit(token);
      if (vulnDepth === 0 && token.name === "endObject") {
        sourceRows += 1;
        if (approxBytes >= TARGET_BYTES && sourceRows > 0) {
          stopping = true;
          for (const closer of closingTokens(modes)) emit(closer);
        }
      }
      continue;
    }

    if (skipDepth > 0) {
      if (token.name === "startObject" || token.name === "startArray") skipDepth += 1;
      if (token.name === "endObject" || token.name === "endArray") skipDepth -= 1;
      emit(token);
      continue;
    }

    const mode = modes[modes.length - 1] ?? "root";

    switch (token.name) {
      case "keyValue": {
        pendingKey = String(token.value);
        emit(token);
        break;
      }
      case "startObject": {
        if (modes.length === 1 && mode === "root" && pendingKey === null && approxBytes === 0) {
          // Root object already represented by modes=["root"]; first startObject opens it.
          emit(token);
          pendingKey = null;
        } else if (mode === "root" && pendingKey === "groups") {
          modes.push("groups");
          pendingKey = null;
          emit(token);
        } else if (mode === "groups") {
          modes.push("group");
          pendingKey = null;
          emit(token);
        } else if (mode === "group" && pendingKey === "repos") {
          modes.push("repos");
          pendingKey = null;
          emit(token);
        } else if (mode === "repos") {
          modes.push("repo");
          pendingKey = null;
          emit(token);
        } else if (mode === "repo" && pendingKey === "images") {
          modes.push("images");
          pendingKey = null;
          emit(token);
        } else if (mode === "images") {
          modes.push("image");
          pendingKey = null;
          emit(token);
        } else if (mode === "vulns") {
          vulnDepth = 1;
          pendingKey = null;
          emit(token);
        } else if (pendingKey !== null) {
          skipDepth = 1;
          pendingKey = null;
          emit(token);
        } else {
          emit(token);
        }
        break;
      }
      case "endObject": {
        if (
          mode === "group" ||
          mode === "repo" ||
          mode === "image" ||
          mode === "groups" ||
          mode === "repos" ||
          mode === "images"
        ) {
          modes.pop();
        }
        pendingKey = null;
        emit(token);
        if (approxBytes >= TARGET_BYTES && sourceRows > 0 && mode === "image") {
          // Image completed after vulns; close remaining ancestors.
          stopping = true;
          for (const closer of closingTokens(modes)) emit(closer);
        }
        break;
      }
      case "startArray": {
        if (mode === "image" && pendingKey === "vulnerabilities") {
          modes.push("vulns");
          pendingKey = null;
          emit(token);
        } else {
          skipDepth = 1;
          pendingKey = null;
          emit(token);
        }
        break;
      }
      case "endArray": {
        if (mode === "vulns") {
          modes.pop();
          emit(token);
          if (approxBytes >= TARGET_BYTES && sourceRows > 0) {
            stopping = true;
            for (const closer of closingTokens(modes)) emit(closer);
          }
        } else {
          emit(token);
        }
        pendingKey = null;
        break;
      }
      default: {
        emit(token);
        pendingKey = null;
        break;
      }
    }
  }

  if (!stopping && sourceRows === 0) {
    out.destroy();
    throw new Error(`no vulnerabilities found in ${sourcePath}`);
  }

  if (!stopping && approxBytes < TARGET_BYTES) {
    console.warn(
      `warning: source exhausted at ${approxBytes} bytes / ${sourceRows} rows (under ${TARGET_BYTES} target)`,
    );
  }

  out.end();
  await finished(out);

  const onDisk = statSync(samplePath).size;
  const manifest = {
    sourceRows,
    approxBytes: onDisk,
    note: "Sanitized contiguous prefix of ui_demo.json for local setup; regenerate with bunx nx run producer:make-sample",
  };
  mkdirSync(dirname(manifestPath), { recursive: true });
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  await Bun.write(manifestPath, manifestBody);

  console.info(
    JSON.stringify(
      {
        sourcePath,
        samplePath,
        manifestPath,
        sourceRows,
        approxBytes: onDisk,
        targetBytes: TARGET_BYTES,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error("make-sample failed:", error);
  process.exit(1);
});
