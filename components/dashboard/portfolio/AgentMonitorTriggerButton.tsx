"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ApiRequestError, postJson } from "@/lib/api-client";

interface AgentMonitorSummary {
  projectsEvaluated: number;
  flagsCreated: number;
  flagsUpdated: number;
  flagsResolved: number;
}

/**
 * Runs the same monitoring sweep the cron job runs every 15 minutes, on
 * demand — for Management/Team Leads who want to see the flag-and-email
 * flow fire immediately (e.g. for a live demo) instead of waiting for the
 * next tick.
 */
export function AgentMonitorTriggerButton() {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const summary = await postJson<AgentMonitorSummary>("/api/v1/agent-monitor/trigger", {});
      toast.success(
        `Agent monitor ran: ${summary.flagsCreated} new, ${summary.flagsUpdated} updated, ${summary.flagsResolved} resolved across ${summary.projectsEvaluated} projects.`,
      );
    } catch (err) {
      toast.error(
        err instanceof ApiRequestError ? err.message : "Couldn’t run the agent monitor.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant="secondary" onClick={run} disabled={running} aria-busy={running}>
      {running ? "Running…" : "Run agent monitor now"}
    </Button>
  );
}
