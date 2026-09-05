/**
 * ClickHouse row -> columnar FindingBlock helpers (T05).
 */
import { create } from "@bufbuild/protobuf";
import {
  encodeDictColumn,
  encodeOffsetStringArrays,
  type FindingBlock,
  FindingBlockSchema,
  SparseStringColumnSchema,
} from "@repo/proto";

export type FindingRow = {
  group: string;
  repo: string;
  image: string;
  cve: string;
  severity: string;
  packageName: string;
  packageVersion: string;
  packageType: string;
  path: string;
  status: string;
  advisoryType: string;
  buildType: string;
  type: string;
  cvss: number;
  description: string;
  cause: string;
  exploit: string;
  fixDate: string;
  published: string;
  layerTime: string;
  link: string;
  owner: string;
  vecStr: string;
  kaiStatus: string | null;
  riskFactors: string[];
  applicableRules: string[];
};

export const BLOCK_SIZE = Number(process.env.PRODUCER_BLOCK_SIZE ?? 2_048);

export function rowsToFindingBlock(
  rows: FindingRow[],
  sequence: bigint,
  datasetVersion: string,
): FindingBlock {
  const rowCount = rows.length;
  const block = create(FindingBlockSchema, {
    sequence,
    datasetVersion,
    rowCount,
    group: new Array<string>(rowCount),
    repo: new Array<string>(rowCount),
    image: new Array<string>(rowCount),
    cve: new Array<string>(rowCount),
    packageName: new Array<string>(rowCount),
    packageVersion: new Array<string>(rowCount),
    path: new Array<string>(rowCount),
    cvss: new Array<number>(rowCount),
    description: new Array<string>(rowCount),
    cause: new Array<string>(rowCount),
    exploit: new Array<string>(rowCount),
    fixDate: new Array<string>(rowCount),
    published: new Array<string>(rowCount),
    layerTime: new Array<string>(rowCount),
    link: new Array<string>(rowCount),
    owner: new Array<string>(rowCount),
    vecStr: new Array<string>(rowCount),
  });
  
  const severity = new Array<string>(rowCount);
  const packageType = new Array<string>(rowCount);
  const status = new Array<string>(rowCount);
  const advisoryType = new Array<string>(rowCount);
  const buildType = new Array<string>(rowCount);
  const type = new Array<string>(rowCount);
  const riskFactors = new Array<string[]>(rowCount);
  const applicableRules = new Array<string[]>(rowCount);
  const kaiIndices: number[] = [];
  const kaiValues: string[] = [];

  for (let index = 0; index < rowCount; index++) {
    // biome-ignore lint/style/noNonNullAssertion: index is bounded by rowCount.
    const row = rows[index]!;
    block.group[index] = row.group;
    block.repo[index] = row.repo;
    block.image[index] = row.image;
    block.cve[index] = row.cve;
    block.packageName[index] = row.packageName;
    block.packageVersion[index] = row.packageVersion;
    block.path[index] = row.path;
    block.cvss[index] = row.cvss;
    block.description[index] = row.description;
    block.cause[index] = row.cause;
    block.exploit[index] = row.exploit;
    block.fixDate[index] = row.fixDate;
    block.published[index] = row.published;
    block.layerTime[index] = row.layerTime;
    block.link[index] = row.link;
    block.owner[index] = row.owner;
    block.vecStr[index] = row.vecStr;
    severity[index] = row.severity;
    packageType[index] = row.packageType;
    status[index] = row.status;
    advisoryType[index] = row.advisoryType;
    buildType[index] = row.buildType;
    type[index] = row.type;
    riskFactors[index] = row.riskFactors ?? [];
    applicableRules[index] = row.applicableRules ?? [];

    if (row.kaiStatus != null) {
      kaiIndices.push(index);
      kaiValues.push(row.kaiStatus);
    }
  }

  block.severity = encodeDictColumn(severity);
  block.packageType = encodeDictColumn(packageType);
  block.status = encodeDictColumn(status);
  block.advisoryType = encodeDictColumn(advisoryType);
  block.buildType = encodeDictColumn(buildType);
  block.type = encodeDictColumn(type);
  block.kaiStatus = create(SparseStringColumnSchema, {
    rowIndices: kaiIndices,
    values: kaiValues,
  });
  block.riskFactors = encodeOffsetStringArrays(riskFactors);
  block.applicableRules = encodeOffsetStringArrays(applicableRules);

  return block;
}
