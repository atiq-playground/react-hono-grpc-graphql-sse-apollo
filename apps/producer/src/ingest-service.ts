import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ApplyChangesResponseSchema, IngestBlocksResponseSchema, IngestService } from "@repo/proto";
import { isFindingId } from "@repo/shared";

import { findingBlockToRows } from "./block.js";
import type { RegisterIngestService } from "./ingest-service.types.js";

function invalidArgument(message: string): never {
  throw new ConnectError(message, Code.InvalidArgument);
}

export const registerIngestService: RegisterIngestService = (router, dependencies) => {
  const { writer, publisher, datasetVersion, maxChanges } = dependencies;
  let operation = Promise.resolve();

  function serialize<Result>(work: () => Promise<Result>): Promise<Result> {
    const current = operation.then(work, work);
    operation = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  router.service(IngestService, {
    ingestBlocks(blocks, context) {
      return serialize(async () => {
        const replace = context.requestHeader.get("x-ingest-replace") === "true";
        const existing = await writer.countFinal();
        if (existing > 0 && !replace) {
          throw new ConnectError(
            `findings already contains ${existing} current rows; set x-ingest-replace: true`,
            Code.AlreadyExists,
          );
        }
        if (replace) await writer.truncate();

        let blockCount = 0n;
        let sourceRowCount = 0n;
        let previousSequence = 0n;
        for await (const block of blocks) {
          if (block.datasetVersion !== datasetVersion) {
            invalidArgument(
              `FindingBlock datasetVersion ${block.datasetVersion} does not match ${datasetVersion}`,
            );
          }
          if (block.sequence <= previousSequence) {
            invalidArgument("FindingBlock sequence must increase strictly");
          }
          const rows = findingBlockToRows(block);
          await writer.insertInitial(rows);
          previousSequence = block.sequence;
          blockCount += 1n;
          sourceRowCount += BigInt(rows.length);
        }

        if (blockCount === 0n) invalidArgument("IngestBlocks requires at least one FindingBlock");
        const currentFindings = await writer.countFinal();
        const terminalEventId = await publisher.publishDatasetVersionChanged();
        return create(IngestBlocksResponseSchema, {
          datasetVersion,
          blocksWritten: blockCount,
          sourceRowsWritten: sourceRowCount,
          terminalEventId,
          currentFindings: BigInt(currentFindings),
        });
      });
    },

    applyChanges(request) {
      return serialize(async () => {
        if (request.datasetVersion !== datasetVersion) {
          invalidArgument(
            `ApplyChanges datasetVersion ${request.datasetVersion} does not match ${datasetVersion}`,
          );
        }
        if (request.upserts && request.upserts.datasetVersion !== datasetVersion) {
          invalidArgument("ApplyChanges upsert block has a mismatched datasetVersion");
        }

        const upsertRows = request.upserts ? findingBlockToRows(request.upserts) : [];
        const deleteIds = request.deleteFindingIds;
        const changeCount = upsertRows.length + deleteIds.length;
        if (changeCount === 0) invalidArgument("ApplyChanges requires at least one change");
        if (changeCount > maxChanges) {
          invalidArgument(`ApplyChanges accepts at most ${maxChanges} changes`);
        }
        if (new Set(deleteIds).size !== deleteIds.length) {
          invalidArgument("ApplyChanges delete ids must be unique");
        }
        for (const id of deleteIds) {
          if (!isFindingId(id)) invalidArgument(`Invalid finding id ${id}`);
        }

        const upserts = await writer.applyUpserts(upsertRows);
        const deletes = await writer.applyDeletes(deleteIds);
        const eventIds: string[] = [];
        for (const upsert of upserts) {
          eventIds.push(await publisher.publishFindingUpserted(upsert.eventFinding));
        }
        for (const deletion of deletes) {
          eventIds.push(await publisher.publishFindingDeleted(deletion.id));
        }

        return create(ApplyChangesResponseSchema, {
          upsertsApplied: BigInt(upserts.length),
          deletesApplied: BigInt(deletes.length),
          eventIds,
        });
      });
    },
  });
};
