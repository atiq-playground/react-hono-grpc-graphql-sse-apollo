/**
 * Bounded streaming census of ui_demo.json (no full parse).
 * Prints counts only — no vulnerability payloads.
 */
import { createReadStream } from "node:fs";
import { chain } from "stream-chain";
import { parser } from "stream-json";

const filePath = process.argv[2] ?? "apps/producer/data/raw/ui_demo.json";
const pipeline = chain([createReadStream(filePath, { highWaterMark: 256 * 1024 }), parser()]);

type Mode = "root" | "groups" | "group" | "repos" | "repo" | "images" | "image" | "vulns";

const modes: Mode[] = ["root"];
let pendingKey: string | null = null;
let skipDepth = 0;
const groups = new Set<string>();
const repos = new Set<string>();
const imageKeys = new Set<string>();
const imageNames = new Set<string>();
let vulnArrays = 0;
let nonEmptyVulnArrays = 0;
let vulnsInCurrent = 0;
let vulnTotal = 0;
let groupName = "";
let repoName = "";
let imageKey = "";

for await (const token of pipeline as AsyncIterable<{ name: string; value?: unknown }>) {
  if (skipDepth > 0) {
    if (token.name === "startObject" || token.name === "startArray") skipDepth += 1;
    if (token.name === "endObject" || token.name === "endArray") skipDepth -= 1;
    continue;
  }
  const mode = modes[modes.length - 1] ?? "root";
  switch (token.name) {
    case "keyValue":
      pendingKey = String(token.value);
      break;
    case "startObject":
      if (mode === "root" && pendingKey === "groups") {
        modes.push("groups");
        pendingKey = null;
      } else if (mode === "groups") {
        groupName = pendingKey ?? "";
        groups.add(groupName);
        modes.push("group");
        pendingKey = null;
      } else if (mode === "group" && pendingKey === "repos") {
        modes.push("repos");
        pendingKey = null;
      } else if (mode === "repos") {
        repoName = pendingKey ?? "";
        repos.add(`${groupName}/${repoName}`);
        modes.push("repo");
        pendingKey = null;
      } else if (mode === "repo" && pendingKey === "images") {
        modes.push("images");
        pendingKey = null;
      } else if (mode === "images") {
        imageKey = pendingKey ?? "";
        imageKeys.add(`${groupName}/${repoName}/${imageKey}`);
        modes.push("image");
        pendingKey = null;
      } else if (mode === "vulns") {
        vulnsInCurrent += 1;
        vulnTotal += 1;
        skipDepth = 1;
        pendingKey = null;
      } else if (pendingKey !== null) {
        skipDepth = 1;
        pendingKey = null;
      }
      break;
    case "endObject":
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
      break;
    case "startArray":
      if (mode === "image" && pendingKey === "vulnerabilities") {
        vulnArrays += 1;
        vulnsInCurrent = 0;
        modes.push("vulns");
        pendingKey = null;
      } else {
        skipDepth = 1;
        pendingKey = null;
      }
      break;
    case "endArray":
      if (mode === "vulns") {
        if (vulnsInCurrent > 0) nonEmptyVulnArrays += 1;
        modes.pop();
      }
      pendingKey = null;
      break;
    case "stringValue":
      if (mode === "image" && pendingKey === "name") {
        imageNames.add(String(token.value));
      }
      pendingKey = null;
      break;
    case "numberValue":
    case "trueValue":
    case "falseValue":
    case "nullValue":
      pendingKey = null;
      break;
    default:
      break;
  }
}

console.log(
  JSON.stringify(
    {
      groups: groups.size,
      repos: repos.size,
      imageKeys: imageKeys.size,
      imageNames: imageNames.size,
      vulnArrays,
      nonEmptyVulnArrays,
      vulnTotal,
    },
    null,
    2,
  ),
);
