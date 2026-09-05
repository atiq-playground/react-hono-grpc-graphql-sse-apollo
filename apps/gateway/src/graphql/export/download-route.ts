import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import type { Context } from "hono";
import type { GatewayContext } from "../context.js";
import { exportAttachmentFilename, resolveExportArtifactPath } from "./artifact.js";
import { ExportJobIdSchema, findExportJob } from "./job-store.js";

function isMissingArtifact(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ELOOP" || error.code === "ENOTDIR")
  );
}

export async function downloadExportRoute(c: Context, context: GatewayContext): Promise<Response> {
  const idParse = ExportJobIdSchema.safeParse(c.req.param("id"));
  if (!idParse.success) return c.json({ error: "Invalid export job id" }, 400);

  const job = await findExportJob(context.redis, idParse.data);
  if (job === null || job.status !== "READY" || job.artifactName === null) {
    return c.json({ error: "Export artifact not found" }, 404);
  }

  const artifactPath = resolveExportArtifactPath(job.id, job.artifactName);
  try {
    const handle = await open(artifactPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat().catch(async (error: unknown) => {
      await handle.close();
      throw error;
    });
    if (!info.isFile()) {
      await handle.close();
      return c.json({ error: "Export artifact not found" }, 404);
    }

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${exportAttachmentFilename(job.id)}"`);
    c.header("Content-Length", String(info.size));
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Cache-Control", "private, no-store, max-age=0");
    c.header("Pragma", "no-cache");

    const source = handle.createReadStream({ autoClose: true });
    return c.body(Readable.toWeb(source) as unknown as ReadableStream<Uint8Array>);
  } catch (error: unknown) {
    if (isMissingArtifact(error)) {
      return c.json({ error: "Export artifact not found" }, 404);
    }
    throw error;
  }
}
