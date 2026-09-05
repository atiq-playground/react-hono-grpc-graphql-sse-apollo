import { createReadStream } from "node:fs";
import { chain } from "stream-chain";
import { parser } from "stream-json";

const pipeline = chain([
  createReadStream("apps/producer/data/raw/ui_demo.json", { highWaterMark: 256 * 1024 }),
  parser(),
]);

type Mode = "root" | "groups" | "group" | "repos" | "repo" | "images" | "image" | "vulns";
const modes: Mode[] = ["root"];
let pendingKey: string | null = null;
let skipDepth = 0;
const groupVulns = new Map<string, number>();
let groupName = "";

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
        if (!groupVulns.has(groupName)) groupVulns.set(groupName, 0);
        modes.push("group");
        pendingKey = null;
      } else if (mode === "group" && pendingKey === "repos") {
        modes.push("repos");
        pendingKey = null;
      } else if (mode === "repos") {
        modes.push("repo");
        pendingKey = null;
      } else if (mode === "repo" && pendingKey === "images") {
        modes.push("images");
        pendingKey = null;
      } else if (mode === "images") {
        modes.push("image");
        pendingKey = null;
      } else if (mode === "vulns") {
        groupVulns.set(groupName, (groupVulns.get(groupName) ?? 0) + 1);
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
        modes.push("vulns");
        pendingKey = null;
      } else {
        skipDepth = 1;
        pendingKey = null;
      }
      break;
    case "endArray":
      if (mode === "vulns") modes.pop();
      pendingKey = null;
      break;
    case "stringValue":
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

const empty = [...groupVulns.entries()].filter(([, n]) => n === 0).map(([g]) => g);
console.log(JSON.stringify({ groups: groupVulns.size, emptyGroups: empty }, null, 2));
