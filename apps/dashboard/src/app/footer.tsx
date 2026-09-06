import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { type FormEvent, useId, useState } from "react";
import { OwnerContactBlock } from "./owner-contact";

export function AppFooter() {
  const emailFieldId = useId();
  const statusId = useId();
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleNewsletterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("Newsletter signup is not available yet. Thanks for your interest.");
  };

  return (
    <footer className="mt-auto pb-2.5">
      <div className="layout-container">
        <div className="flex flex-col gap-8 rounded-xl border bg-muted/35 px-4 py-8 md:flex-row md:items-start md:justify-between md:gap-12 md:px-6">
          <OwnerContactBlock className="max-w-xl" />

          <div className="w-full max-w-sm shrink-0 space-y-3 md:ml-auto">
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight">Subscribe to newsletter</p>
              <p className="text-xs text-muted-foreground">
                Occasional notes on dashboards, data systems, and engineering. Coming soon.
              </p>
            </div>
            <form
              className="space-y-2"
              onSubmit={handleNewsletterSubmit}
              noValidate
              aria-describedby={statusMessage ? statusId : undefined}
            >
              <div className="space-y-1.5">
                <Label htmlFor={emailFieldId} className="text-xs text-muted-foreground">
                  Email address
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id={emailFieldId}
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (statusMessage) setStatusMessage(null);
                    }}
                    aria-describedby={statusMessage ? statusId : undefined}
                    className="bg-background"
                  />
                  <Button type="submit" variant="outline" className="shrink-0 sm:self-auto">
                    Subscribe
                  </Button>
                </div>
              </div>
              {statusMessage ? (
                <p
                  id={statusId}
                  role="status"
                  aria-live="polite"
                  className="text-xs text-muted-foreground"
                >
                  {statusMessage}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </footer>
  );
}
