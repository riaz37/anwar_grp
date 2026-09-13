"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ai-elements/loader";
import { ApiRequestError, postJson } from "@/lib/api-client";

interface AgentMonitorSummary {
  projectsEvaluated: number;
  flagsCreated: number;
  flagsUpdated: number;
  flagsResolved: number;
}

const SWEEP_PHASES = [
  "Scanning portfolio projects…",
  "Checking milestones and blockers…",
  "Evaluating risk signals…",
  "Flagging RACI ownership gaps…",
] as const;

const PHASE_INTERVAL_MS = 1800;

/**
 * Runs the same monitoring sweep the cron job runs every 15 minutes, on
 * demand — for Management/Team Leads who want to see the flag-and-email
 * flow fire immediately (e.g. for a live demo) instead of waiting for the
 * next tick.
 */
export function AgentMonitorTriggerButton() {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!running) return;
    setPhaseIndex(0);
    const id = setInterval(() => {
      setPhaseIndex((i) => (i + 1) % SWEEP_PHASES.length);
    }, PHASE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running]);

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
    <div className="flex flex-col items-start gap-ds-xs">
      <Button variant="secondary" onClick={run} disabled={running} aria-busy={running}>
        {running && <Loader size={14} className="mr-ds-xs" />}
        {running ? "Running…" : "Run agent monitor now"}
      </Button>
      {running && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-ds-xs rounded-md border border-outline-low bg-surface-2 px-ds-sm py-ds-xs text-caption-2 text-text-med"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-med opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary-med" />
          </span>
          <span key={phaseIndex} className="rise-in">
            {SWEEP_PHASES[phaseIndex]}
          </span>
        </div>
      )}
    </div>
  );
}
