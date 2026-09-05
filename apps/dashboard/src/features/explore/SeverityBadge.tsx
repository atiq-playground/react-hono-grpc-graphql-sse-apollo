import { Badge } from "@repo/ui/components/ui/badge";

type Props = {
  severity: string;
};

export function SeverityBadge({ severity }: Props) {
  const normalized = severity.toLocaleLowerCase();
  const variant =
    normalized === "critical" || normalized === "high"
      ? "destructive"
      : normalized === "medium"
        ? "secondary"
        : "outline";

  return <Badge variant={variant}>{severity || "Unknown"}</Badge>;
}
