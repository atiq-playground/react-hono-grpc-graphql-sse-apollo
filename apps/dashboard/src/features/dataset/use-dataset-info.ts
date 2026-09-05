import { useQuery } from "@apollo/client/react";

import { DatasetInfoDocument } from "../../graphql/operations";

export function useDatasetInfo() {
  return useQuery(DatasetInfoDocument);
}
