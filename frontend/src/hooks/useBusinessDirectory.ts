import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '../services/socket';

export type BusinessRecord = {
  business_id: string;
  name: string;
  industry?: string;
};

type IdMap = Map<string, BusinessRecord>;

/**
 * Loads the business directory once via HTTP and
 * keeps it fresh opportunistically from WebSocket node payloads.
 */
export function useBusinessDirectory() {
  const [map, setMap] = useState<IdMap>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const apiUrl =
    (() => {
      try {
        // Only evaluated at runtime. In Vite, this returns import.meta.env.*.
        // In Jest/Node (no import.meta), it throws and we fall back to process.env.
        const m: any = (0, eval)('import.meta');
        return m?.env?.VITE_API_URL;
      } catch {
        return process.env.VITE_API_URL;
      }
    })() || 'http://localhost:3001';
  // Fetch once (HTTP)

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/businesses`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const businesses: BusinessRecord[] = json?.data ?? [];
        if (cancelled) return;
        setMap(() => {
          const next = new Map<string, BusinessRecord>();
          for (const b of businesses) next.set(b.business_id, b);
          return next;
        });
      } catch (e) {
        // Abort is fine; other errors are logged for observability
        if ((e as any).name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.error('useBusinessDirectory load failed', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [apiUrl]);

  // Enrich from WebSocket nodes (no extra HTTP)
  useEffect(() => {
    const socket = getSocket();

    const upsertFromNodes = (payload: any) => {
      const nodes = payload?.nodes;
      if (!Array.isArray(nodes) || nodes.length === 0) return;

      setMap((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const n of nodes) {
          // Backend may send { id, label, industry }
          const id: string | undefined = n?.id ?? n?.business_id;
          const name: string | undefined = n?.label ?? n?.name;
          if (!id || !name) continue;
          const existing = next.get(id);
          if (
            !existing ||
            existing.name !== name ||
            existing.industry !== n.industry
          ) {
            next.set(id, { business_id: id, name, industry: n.industry });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    socket.on('initialData', upsertFromNodes);
    socket.on('graphUpdate', upsertFromNodes);
    return () => {
      socket.off('initialData', upsertFromNodes);
      socket.off('graphUpdate', upsertFromNodes);
    };
  }, []);

  // Fast lookup helpers
  const idToName = useMemo<Record<string, string>>(() => {
    const obj: Record<string, string> = {};
    map.forEach((v, k) => (obj[k] = v.name));
    return obj;
  }, [map]);

  const lookup = (id?: string) => (id ? idToName[id] ?? id : '');

  return { loading, map, idToName, lookup };
}
