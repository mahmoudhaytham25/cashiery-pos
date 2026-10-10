import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/api";

// Fetch `endpoint` whenever `endpoint`, `skip`, or `deps` change. Each run
// aborts the previous request so stale responses never land, cleanup aborts
// on unmount, and `pollInterval` reschedules only after a request settles so
// polls never overlap. `refetch` triggers a fresh run.
export function useFetch(endpoint, { deps = [], skip = false, transform = (d) => d, pollInterval } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (skip) return;

    const controller = new AbortController();
    let timeoutId;

    const schedule = () => {
      timeoutId = setTimeout(() => {
        // Skip polls while the tab is hidden; retry at the next interval.
        if (document.visibilityState === "hidden") {
          schedule();
        } else {
          load();
        }
      }, pollInterval);
    };

    const load = async () => {
      setLoading(true);
      try {
        const result = await apiRequest(endpoint, "GET", null, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setData(transform(result));
        setError(null);
      } catch (err) {
        if (err.name === "AbortError" || controller.signal.aborted) return;
        setError(err.message || "Request failed");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (pollInterval) schedule();
        }
      }
    };

    load();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, skip, reloadKey, ...deps]);

  return { data, loading, error, refetch };
}

// Imperative counterpart for event-handler fetches. A new run() aborts the
// previous in-flight request (its promise resolves to undefined), so the
// latest request always wins; pending requests abort on unmount.
export function useApiCall() {
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async (endpoint, method = "GET", body = null) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      return await apiRequest(endpoint, method, body, { signal: controller.signal });
    } catch (err) {
      if (err.name === "AbortError" || controller.signal.aborted) {
        return undefined;
      }
      throw err;
    } finally {
      if (controllerRef.current === controller && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  return { run, loading };
}
