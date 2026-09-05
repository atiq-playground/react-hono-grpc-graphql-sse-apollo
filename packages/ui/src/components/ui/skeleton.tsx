import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
