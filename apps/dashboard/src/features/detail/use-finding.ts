import { skipToken, useQuery } from "@apollo/client/react";
import { isFindingId } from "@repo/shared";

import { FindingDetailDocument } from "../../graphql/operations";

export { isFindingId };

export function useFinding(id: string) {
  return useQuery(FindingDetailDocument, isFindingId(id) ? { variables: { id } } : skipToken);
}
