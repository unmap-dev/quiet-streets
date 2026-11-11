"use client";

import { useCallback, useEffect, useState } from "react";
import { parseState, writeState, type QuietState } from "@/lib/url";

/**
 * The city and the Day / Night colouring, kept in the query string so a link opens on them.
 * `ready` is false until the URL has been read, so a shared link to a city never flashes the
 * picker first.
 */
export function useQuietState(): [QuietState & { ready: boolean }, (next: Partial<QuietState>) => void] {
  const [state, setState] = useState<QuietState & { ready: boolean }>({ city: null, period: "day", ready: false });
  useEffect(() => {
    // The URL only exists after mount in a static export.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ...parseState(window.location.search), ready: true });
  }, []);
  const update = useCallback((next: Partial<QuietState>) => {
    setState((current) => {
      const merged = { ...current, ...next };
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${writeState(window.location.search, merged)}`);
      return merged;
    });
  }, []);
  return [state, update];
}
