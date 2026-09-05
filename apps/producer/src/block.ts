/**
 * ClickHouse row -> columnar FindingBlock helpers (T05).
 */
import { create } from "@bufbuild/protobuf";
import {
  appendOffsetRow,
  createDictEncodeState,
  createOffsetEncodeState,
  type FindingBlock,
  FindingBlockSchema,
  internDictValue,
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
  const group = new Array<string>(rowCount);
  const repo = new Array<string>(rowCount);
  const image = new Array<string>(rowCount);
  const cve = new Array<string>(rowCount);
  const packageName = new Array<string>(rowCount);
  const packageVersion = new Array<string>(rowCount);
  const path = new Array<string>(rowCount);
  const cvss = new Array<number>(rowCount);
  const description = new Array<string>(rowCount);
  const cause = new Array<string>(rowCount);
  const exploit = new Array<string>(rowCount);
  const fixDate = new Array<string>(rowCount);
  const published = new Array<string>(rowCount);
  const layerTime = new Array<string>(rowCount);
  const link = new Array<string>(rowCount);
  const owner = new Array<string>(rowCount);
  const vecStr = new Array<string>(rowCount);

  const severity = createDictEncodeState(rowCount);
  const packageType = createDictEncodeState(rowCount);
  const status = createDictEncodeState(rowCount);
  const advisoryType = createDictEncodeState(rowCount);
  const buildType = createDictEncodeState(rowCount);
  const type = createDictEncodeState(rowCount);
  const riskFactors = createOffsetEncodeState(rowCount);
  const applicableRules = createOffsetEncodeState(rowCount);
  const kaiRowIndices: number[] = [];
  const kaiValues: string[] = [];

  for (let index = 0; index < rowCount; index++) {
    const row = rows[index]!;

    group[index] = row.group;
    repo[index] = row.repo;
    image[index] = row.image;
    cve[index] = row.cve;
    packageName[index] = row.packageName;
    packageVersion[index] = row.packageVersion;
    path[index] = row.path;
    cvss[index] = row.cvss;
    description[index] = row.description;
    cause[index] = row.cause;
    exploit[index] = row.exploit;
    fixDate[index] = row.fixDate;
    published[index] = row.published;
    layerTime[index] = row.layerTime;
    link[index] = row.link;
    owner[index] = row.owner;
    vecStr[index] = row.vecStr;

    internDictValue(severity, row.severity, index);
    internDictValue(packageType, row.packageType, index);
    internDictValue(status, row.status, index);
    internDictValue(advisoryType, row.advisoryType, index);
    internDictValue(buildType, row.buildType, index);
    internDictValue(type, row.type, index);
    appendOffsetRow(riskFactors, row.riskFactors ?? [], index);
    appendOffsetRow(applicableRules, row.applicableRules ?? [], index);

    if (row.kaiStatus != null) {
      kaiRowIndices.push(index);
      kaiValues.push(row.kaiStatus);
    }
  }

  return create(FindingBlockSchema, {
    sequence,
    datasetVersion,
    rowCount,
    group,
    repo,
    image,
    cve,
    packageName,
    packageVersion,
    path,
    cvss,
    description,
    cause,
    exploit,
    fixDate,
    published,
    layerTime,
    link,
    owner,
    vecStr,
    severity: { dictionary: severity.dictionary, indices: severity.indices },
    packageType: { dictionary: packageType.dictionary, indices: packageType.indices },
    status: { dictionary: status.dictionary, indices: status.indices },
    advisoryType: { dictionary: advisoryType.dictionary, indices: advisoryType.indices },
    buildType: { dictionary: buildType.dictionary, indices: buildType.indices },
    type: { dictionary: type.dictionary, indices: type.indices },
    kaiStatus: { rowIndices: kaiRowIndices, values: kaiValues },
    riskFactors: { values: riskFactors.values, offsets: riskFactors.offsets },
    applicableRules: { values: applicableRules.values, offsets: applicableRules.offsets },
  });
}
