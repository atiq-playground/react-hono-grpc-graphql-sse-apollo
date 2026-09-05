import { Badge } from "@repo/ui/components/ui/badge";
import {
  AtomIcon,
  BinaryIcon,
  BoxesIcon,
  DatabaseIcon,
  HexagonIcon,
  type LucideIcon,
  OrbitIcon,
  RadioIcon,
  ServerIcon,
  WindIcon,
  ZapIcon,
} from "lucide-react";

type TechStackTag = {
  name: string;
  Icon: LucideIcon;
};

/** Defining stack from docs/TECH_STACK.md — not a full dependency dump. */
const TECH_STACK_TAGS: readonly TechStackTag[] = [
  { name: "React", Icon: AtomIcon },
  { name: "Apollo", Icon: OrbitIcon },
  { name: "GraphQL", Icon: HexagonIcon },
  { name: "Hono", Icon: ServerIcon },
  { name: "gRPC", Icon: BinaryIcon },
  { name: "Redis", Icon: RadioIcon },
  { name: "ClickHouse", Icon: DatabaseIcon },
  { name: "Nx", Icon: BoxesIcon },
  { name: "Bun", Icon: ZapIcon },
  { name: "Tailwind", Icon: WindIcon },
];

export function TechStackTags() {
  return (
    <ul className="mb-4 flex max-w-3xl flex-wrap gap-1.5" aria-label="Tech stack">
      {TECH_STACK_TAGS.map(({ name, Icon }) => (
        <li key={name}>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            <Icon aria-hidden="true" />
            {name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
