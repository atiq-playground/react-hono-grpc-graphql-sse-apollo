import type { DevelopmentSimulatorOptions } from "./simulator.types.js";

export function startDevelopmentSimulator({
  writer,
  publisher,
  intervalMs,
}: DevelopmentSimulatorOptions): (() => void) | null {
  if (intervalMs === 0) return null;

  console.info(
    JSON.stringify({
      message: "producer development change simulator enabled",
      intervalMs,
    }),
  );

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const sample = await writer.sampleCurrent();
      if (!sample) return;
      const [applied] = await writer.applyUpserts([sample]);
      if (!applied) return;
      await publisher.publishFindingUpserted(applied.eventFinding);
      console.info(JSON.stringify({ message: "producer simulator published finding-upserted" }));
    } catch (error: unknown) {
      console.error("producer simulator failed:", error);
    } finally {
      running = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
