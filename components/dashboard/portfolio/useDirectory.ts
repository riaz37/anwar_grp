"use client";

import { useCallback, useRef, useState } from "react";
import { ApiRequestError, getJson } from "@/lib/api-client";
import type { DirectoryUser } from "./PersonPicker";

interface DirectoryState {
  users: DirectoryUser[];
  loading: boolean;
  error: string | null;
  /** Idempotent: safe to call on every popover open. */
  load: () => void;
}

/**
 * Lazily loads the person directory (`GET /api/v1/users`, which returns only
 * `{id, name, role}` — it is a reference lookup, not a user-management
 * endpoint) and caches it for the lifetime of the page.
 *
 * Shared across every row of the ownership queue so opening five pickers
 * costs one request, and a dashboard with no gaps costs none.
 */
export function useDirectory(): DirectoryState {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const load = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    setLoading(true);
    setError(null);
    getJson<DirectoryUser[]>("/api/v1/users")
      .then((data) => setUsers(data))
      .catch((cause: unknown) => {
        // Allow a retry on the next open rather than latching the failure.
        requested.current = false;
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : "Couldn’t load the list of people. Try again.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return { users, loading, error, load };
}
