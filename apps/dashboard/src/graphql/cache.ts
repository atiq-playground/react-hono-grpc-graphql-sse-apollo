import { InMemoryCache } from "@apollo/client";
import type { TypePolicies } from "@apollo/client/cache";
import type { Reference, StoreObject } from "@apollo/client/utilities";

/**
 * The gateway clamps pages to 200 rows. Retaining three maximum-sized recent
 * pages bounds each findings argument partition to 600 edges.
 */
export const FINDINGS_CACHE_PAGE_CAP = 3;
export const FINDINGS_CACHE_EDGE_CAP = 200 * FINDINGS_CACHE_PAGE_CAP;

type Edge = StoreObject & {
  readonly cursor?: string;
  readonly node?: Reference | StoreObject;
};

type FindingConnection = StoreObject & {
  readonly edges?: readonly Edge[];
  readonly pageInfo?: StoreObject;
  readonly totalCount?: number;
  readonly partitionKey?: string;
};

const FINDINGS_PARTITION_ARGUMENTS = [
  "filters",
  "sort",
  "search",
  "timeRange",
  "analysisMode",
] as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function findingsPartitionKey(args: Record<string, unknown> | null): string {
  return JSON.stringify(
    canonicalize(
      Object.fromEntries(FINDINGS_PARTITION_ARGUMENTS.map((name) => [name, args?.[name] ?? null])),
    ),
  );
}

function edgeIdentity(
  edge: Edge,
  readField: <T>(fieldName: string, from: StoreObject | Reference) => T | undefined,
): { cursor?: string; id?: string } {
  const cursor = readField<string>("cursor", edge) ?? edge.cursor;
  const node = readField<Reference | StoreObject>("node", edge) ?? edge.node;
  const id = node ? readField<string>("id", node) : undefined;
  return { cursor, id };
}

export const dashboardTypePolicies: TypePolicies = {
  Finding: {
    keyFields: ["id"],
  },
  FindingRow: {
    keyFields: ["id"],
  },
  FindingDetail: {
    keyFields: ["id"],
  },
  Query: {
    fields: {
      findings: {
        // One active argument partition is retained. read/merge compare exactly
        // these five canonicalized arguments, while a partition change replaces
        // the old one so arbitrary filter combinations cannot grow cache memory.
        keyArgs: false,
        read(existing: FindingConnection | undefined, options): FindingConnection | undefined {
          return existing?.partitionKey === findingsPartitionKey(options.args)
            ? existing
            : undefined;
        },
        merge(existing: FindingConnection | undefined, incoming: FindingConnection, options) {
          const partitionKey = findingsPartitionKey(options.args);
          const isSamePartition = existing?.partitionKey === partitionKey;
          const incomingEdges = incoming.edges ?? [];
          const incomingIds = new Set<string>();
          const incomingCursors = new Set<string>();

          for (const edge of incomingEdges) {
            const { cursor, id } = edgeIdentity(edge, options.readField);
            if (cursor) incomingCursors.add(cursor);
            if (id) incomingIds.add(id);
          }

          // A request without `after` is a first-page load/refetch and replaces
          // the partition. Cursor pages append after removing stale overlaps.
          const existingEdges =
            options.args?.after == null || !isSamePartition
              ? []
              : (existing?.edges ?? []).filter((edge) => {
                  const { cursor, id } = edgeIdentity(edge, options.readField);
                  return !(cursor && incomingCursors.has(cursor)) && !(id && incomingIds.has(id));
                });

          const seenIds = new Set<string>();
          const seenCursors = new Set<string>();
          const mergedEdges = [...existingEdges, ...incomingEdges].filter((edge) => {
            const { cursor, id } = edgeIdentity(edge, options.readField);
            if ((cursor && seenCursors.has(cursor)) || (id && seenIds.has(id))) return false;
            if (cursor) seenCursors.add(cursor);
            if (id) seenIds.add(id);
            return true;
          });

          return {
            ...incoming,
            edges: mergedEdges.slice(-FINDINGS_CACHE_EDGE_CAP),
            pageInfo: incoming.pageInfo,
            totalCount: incoming.totalCount,
            partitionKey,
          };
        },
      },
    },
  },
};

export function createDashboardCache(): InMemoryCache {
  return new InMemoryCache({ typePolicies: dashboardTypePolicies });
}
