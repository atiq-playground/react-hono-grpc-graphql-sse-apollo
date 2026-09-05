import { gql, type TypedDocumentNode } from "@apollo/client";
import { skipToken, useSuspenseQuery } from "@apollo/client/react";
import { Suspense } from "react";
import { useParams } from "react-router";
import type { FindingDetailQuery, FindingDetailVariables } from "../graphql/generated";

const FINDING: TypedDocumentNode<FindingDetailQuery, FindingDetailVariables> = gql`
  query FindingDetail($id: ID!) {
    finding(id: $id) {
      id
      group
      repo
      image
      cve
      severity
      packageName
      packageVersion
      status
      kaiStatus
      description
      cvss
    }
  }
`;

function FindingDetailBody({ id }: { id: string }) {
  const { data, dataState } = useSuspenseQuery(FINDING, id ? { variables: { id } } : skipToken);

  if (!id || dataState !== "complete") {
    return <p className="mt-4 text-sm">Missing finding id.</p>;
  }

  const finding = data.finding;
  if (!finding) {
    return <p className="mt-4 text-sm">Finding not found.</p>;
  }

  return (
    <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
      <div>
        <dt className="font-medium">CVE</dt>
        <dd>{finding.cve}</dd>
      </div>
      <div>
        <dt className="font-medium">Severity</dt>
        <dd>{finding.severity}</dd>
      </div>
      <div>
        <dt className="font-medium">Package</dt>
        <dd>
          {finding.packageName}@{finding.packageVersion}
        </dd>
      </div>
      <div>
        <dt className="font-medium">Status</dt>
        <dd>{finding.status}</dd>
      </div>
      <div>
        <dt className="font-medium">Group / Repo</dt>
        <dd>
          {finding.group} / {finding.repo}
        </dd>
      </div>
      <div>
        <dt className="font-medium">Image</dt>
        <dd>{finding.image}</dd>
      </div>
      <div>
        <dt className="font-medium">CVSS</dt>
        <dd>{finding.cvss}</dd>
      </div>
      <div>
        <dt className="font-medium">kaiStatus</dt>
        <dd>{finding.kaiStatus ?? "—"}</dd>
      </div>
      <div className="md:col-span-2">
        <dt className="font-medium">Description</dt>
        <dd className="mt-1 whitespace-pre-wrap">{finding.description}</dd>
      </div>
    </dl>
  );
}

export function DetailPage() {
  const { id = "" } = useParams();

  return (
    <section aria-labelledby="detail-heading">
      <h1 id="detail-heading" className="text-2xl font-semibold">
        Finding detail
      </h1>
      <p className="text-muted-foreground mt-2 font-mono text-sm break-all">{id || "—"}</p>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <FindingDetailBody id={id} />
      </Suspense>
    </section>
  );
}
