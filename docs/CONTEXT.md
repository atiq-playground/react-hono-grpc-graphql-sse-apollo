# Security Vulnerability Dashboard

A dashboard for exploring vulnerability information about software packages from
a large supplied source dataset or analytical warehouses such as ClickHouse.

## Language

**Source Dataset**:
The complete supplied JSON corpus used to produce one dashboard data release.
It is evidence about the source domain and may not be treated as a product
schema until measured.

**Source Record**:
One occurrence exactly as represented within the hierarchy of a Source Dataset,
identified only within its Dataset Version. Separate occurrences remain
separate Source Records even when they share the same CVE, package attributes,
or canonical record content.
_Avoid_: Finding, CVE, vulnerability instance

**Affected Package**:
A software package described by a Source Record as affected by vulnerability
information.
_Avoid_: Application, repository, dependency (unless the source explicitly
establishes that meaning)

**Source Context**:
The group, repository, image, and Affected Package information to which a
Source Record belongs. Source-provided context values remain preserved when
blank rather than being omitted or inferred.
_Avoid_: Source Record identity, CVE

**Vulnerability Attribute**:
A source-provided property used to describe, group, filter, sort, or explain
Source Records. Missing and unknown values remain distinct from inferred values.
_Avoid_: Metadata (when a specific source property is meant)

**CVE**:
A non-unique Vulnerability Attribute carried by a Source Record. Multiple Source
Records may have the same CVE without becoming one record.
_Avoid_: Source Record, unique vulnerability identity

**Risk Factor**:
A source-provided factor that helps a user understand prioritization or
exposure. The dashboard does not invent a Risk Factor when the source omits it.
_Avoid_: Risk score (unless the source establishes a numeric score)

**Dataset Version**:
One immutable published snapshot derived from a Source Dataset. All dashboard
views in a session and all Source Record identities refer to one Dataset Version;
no Source Record identity is claimed across Dataset Versions.
_Avoid_: Latest data (when a specific snapshot is meant), mutable dataset

**Finding Block**:
A columnar protobuf message carrying parallel typed columns (and dictionary
state) for a contiguous slice of Source Records in one Dataset Version. Blocks
are the unit of gRPC streaming, Redis fan-out, and SSE relay.
_Avoid_: Row-oriented JSON batch, GraphQL payload

**Stream Cursor**:
A resume position for the findings firehose, typically a block sequence number
(and Dataset Version). Clients reconnect with the last applied cursor so the
stream continues without duplicates or gaps.
_Avoid_: Page offset, GraphQL pagination cursor (unless the product equates them)

**Compact Index**:
The in-worker columnar representation of the Dataset Version built from decoded
Finding Blocks (typed arrays and string dictionaries). The Web Worker owns this
index; filtering, sorting, pagination, and export run against it off the main
thread.
_Avoid_: Apollo cache, Zustand store of all rows, raw Source Dataset

**Result Set**:
The Source Records in the active Dataset Version that match the current search
and filters, in the current sort order, before page slicing.
_Avoid_: Page (which is only one slice), all records

**Record Detail**:
The source-preserving information shown for one selected Source Record.
_Avoid_: Finding detail, CVE detail

**Analysis**:
A Result Set that excludes Source Records whose `kaiStatus` is exactly
`invalid - norisk`. Source Records without `kaiStatus` remain included.
_Avoid_: AI Analysis, CVE deduplication

**AI Analysis**:
A Result Set that excludes Source Records whose `kaiStatus` is exactly
`ai-invalid-norisk`. Source Records without `kaiStatus` remain included.
_Avoid_: Analysis, inferred analysis

**Dashboard Preferences**:
User-specific display choices that do not change which Source Records belong to
a Result Set.
_Avoid_: Filters, sort state
