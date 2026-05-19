'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nexchain_imported_tokens';

export function useImportedTokens() {
  const [imported, setImported] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setImported(parsed);
      }
    } catch {}
  }, []);

  const save = useCallback((next: string[]) => {
    const dedup = Array.from(new Set(next.map((a) => a.toLowerCase())));
    setImported(dedup);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dedup));
      } catch {}
    }
  }, []);

  const add = useCallback(
    (address: string) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
      save([...imported, address.toLowerCase()]);
      return true;
    },
    [imported, save]
  );

  const remove = useCallback(
    (address: string) => {
      save(imported.filter((a) => a.toLowerCase() !== address.toLowerCase()));
    },
    [imported, save]
  );

  return { imported, add, remove };
}
