import type { FindingDetailQuery } from "../../graphql/__generated__/graphql";

export type FindingDetail = NonNullable<FindingDetailQuery["finding"]>;
