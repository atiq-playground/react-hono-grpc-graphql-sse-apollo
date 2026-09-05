import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useParams } from "react-router";

const FINDING = gql`
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

type FindingResult = {
  finding: {
    id: string;
    group: string;
    repo: string;
    image: string;
    cve: string;
    severity: string;
    packageName: string;
    packageVersion: string;
    status: string;
    kaiStatus: string | null;
    description: string;
    cvss: number;
  } | null;
};

export function DetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useQuery<FindingResult>(FINDING, {
    variables: { id },
    skip: !id,
  });
  const finding = data?.finding;

  return (
    <section aria-labelledby="detail-heading">
      <h1 id="detail-heading" className="text-2xl font-semibold">
        Finding detail
      </h1>
      <p className="text-muted-foreground mt-2 font-mono text-sm break-all">{id}</p>
      {loading ? <p className="mt-4">Loading…</p> : null}
      {error ? (
        <p className="text-destructive mt-4 text-sm">
          {error.message === "Invalid finding id"
            ? "Invalid finding id"
            : "Could not load this finding. Try again later."}
        </p>
      ) : null}
      {finding ? (
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
      ) : null}
      {!loading && !error && finding === null ? (
        <p className="mt-4 text-sm">Finding not found.</p>
      ) : null}
    </section>
  );
}
