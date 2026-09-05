import {
  excludedKaiStatus,
  FILTER_FIELDS,
  type FilterField,
  type FindingSort,
  formatClickHouseDateTime,
} from "@repo/shared";
import { decodeCursor } from "./cursor.js";
import type { FindingsQueryInput, QueryParameters, QueryScope } from "./findings-query.types.js";

interface CompileWhereOptions {
  readonly prefix: string;
  readonly excludeFilter?: FilterField;
}

export interface CompiledSqlFragment {
  readonly sql: string;
  readonly params: QueryParameters;
}

const SORT_PARAMETER_TYPES: Readonly<Record<FindingSort["field"], string>> = {
  cvss: "Float64",
  severity: "String",
  cve: "String",
  publishedAt: "DateTime",
  fixedAt: "DateTime",
  packageName: "String",
  repo: "String",
  updatedAt: "DateTime64(3)",
};

const NULLABLE_SORT_FIELDS = new Set<FindingSort["field"]>(["publishedAt", "fixedAt"]);

export function compileWhere(
  scope: QueryScope,
  { prefix, excludeFilter }: CompileWhereOptions,
): CompiledSqlFragment {
  const conditions = [`isDeleted = {${prefix}_active:UInt8}`];
  const params: QueryParameters = { [`${prefix}_active`]: 0 };

  let filterIndex = 0;
  for (const field of FILTER_FIELDS) {
    const values = scope.filters[field];
    if (field === excludeFilter || values === undefined || values.length === 0) continue;

    const columnParameter = `${prefix}_filter_column_${filterIndex}`;
    const valuesParameter = `${prefix}_filter_values_${filterIndex}`;
    params[columnParameter] = field;
    params[valuesParameter] = values;
    conditions.push(
      field === "riskFactors"
        ? `hasAny({${columnParameter}:Identifier}, {${valuesParameter}:Array(String)})`
        : `ifNull(toString({${columnParameter}:Identifier}), '') IN {${valuesParameter}:Array(String)}`,
    );
    filterIndex += 1;
  }

  const excludedStatus = excludedKaiStatus(scope.analysisMode);
  if (excludedStatus !== null) {
    const parameter = `${prefix}_excluded_kai_status`;
    params[parameter] = excludedStatus;
    conditions.push(`(kaiStatus IS NULL OR kaiStatus != {${parameter}:String})`);
  }

  if (scope.timeRange.from !== null) {
    const parameter = `${prefix}_published_from`;
    params[parameter] = formatClickHouseDateTime(scope.timeRange.from);
    conditions.push(`publishedAt >= {${parameter}:DateTime64(3)}`);
  }
  if (scope.timeRange.to !== null) {
    const parameter = `${prefix}_published_to`;
    params[parameter] = formatClickHouseDateTime(scope.timeRange.to);
    conditions.push(`publishedAt <= {${parameter}:DateTime64(3)}`);
  }

  if (scope.search !== null) {
    const parameter = `${prefix}_search`;
    params[parameter] = scope.search;
    conditions.push(`(
      positionCaseInsensitiveUTF8(cve, {${parameter}:String}) > 0
      OR positionCaseInsensitiveUTF8(packageName, {${parameter}:String}) > 0
      OR positionCaseInsensitiveUTF8(image, {${parameter}:String}) > 0
      OR positionCaseInsensitiveUTF8(repo, {${parameter}:String}) > 0
    )`);
  }

  return {
    sql: conditions.join("\nAND "),
    params,
  };
}

export function compileKeyset(
  input: FindingsQueryInput,
  prefix: string,
): CompiledSqlFragment | null {
  if (input.after === null) return null;

  const cursor = decodeCursor(input.after, input.sort);
  const sortColumn = `${prefix}_sort_column`;
  const cursorId = `${prefix}_cursor_id`;
  const params: QueryParameters = {
    [sortColumn]: input.sort.field,
    [cursorId]: cursor.id,
  };

  if (cursor.s === null) {
    return {
      sql: `isNull({${sortColumn}:Identifier}) AND findingId > {${cursorId}:String}`,
      params,
    };
  }

  const cursorSort = `${prefix}_cursor_sort`;
  const comparison = input.sort.direction === "asc" ? ">" : "<";
  params[cursorSort] = cursor.s;
  const valuePredicate = `(
    {${sortColumn}:Identifier} ${comparison} {${cursorSort}:${SORT_PARAMETER_TYPES[input.sort.field]}}
    OR (
      {${sortColumn}:Identifier} = {${cursorSort}:${SORT_PARAMETER_TYPES[input.sort.field]}}
      AND findingId > {${cursorId}:String}
    )
  )`;

  return {
    sql: NULLABLE_SORT_FIELDS.has(input.sort.field)
      ? `(
          (isNull({${sortColumn}:Identifier}) = 0 AND ${valuePredicate})
          OR isNull({${sortColumn}:Identifier}) = 1
        )`
      : valuePredicate,
    params,
  };
}

export function compileOrderBy(sort: FindingSort, prefix: string): CompiledSqlFragment {
  const sortColumn = `${prefix}_sort_column`;
  return {
    sql: `isNull({${sortColumn}:Identifier}) ASC, {${sortColumn}:Identifier} ${
      sort.direction === "asc" ? "ASC" : "DESC"
    }, findingId ASC`,
    params: { [sortColumn]: sort.field },
  };
}
