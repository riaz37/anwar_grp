"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

/**
 * The PMO agent's "is it alive" indicator — a user-approved exception to
 * DESIGN.md §8 ("no animation library"), scoped to AgentChatPanel only.
 * `theme="auto"` resolves off this app's own `data-theme` attribute
 * (`next-themes`), so it stays correct across the light/dark toggle without
 * a second theme prop threaded through.
 */
export function AgentThinkingOrb({
  state,
  size = 20,
}: {
  state: OrbState;
  size?: 20 | 64;
}) {
  return <ThinkingOrb size={size} state={state} theme="auto" />;
}
