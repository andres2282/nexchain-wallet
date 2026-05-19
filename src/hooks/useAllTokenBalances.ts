'use client';

import { useQuery } from '@tanstack/react-query';
import { WORLDCHAIN } from '@/config/chain';

export type DiscoveredToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  raw: bigint;
  formatted: string;
  balanceNum: number;
};

const ALCHEMY = WORLDCHAIN.rpc;

export function useAllTokenBalances(walletAddress: string | null) {
  return useQuery({
    queryKey: ['balances', walletAddress],
    queryFn: async (): Promise<DiscoveredToken[]> => {
      if (!walletAddress) return [];

      // 1) Listar todos los tokens ERC-20 con balance
      const balRes = await fetch(ALCHEMY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [walletAddress, 'erc20'],
        }),
      });
      const balData = await balRes.json();
      const raw = balData?.result?.tokenBalances || [];

      const nonZero = raw.filter((b: any) => {
        if (!b.tokenBalance) return false;
        try {
          return BigInt(b.tokenBalance) > 0n;
        } catch {
          return false;
        }
      });

      if (nonZero.length === 0) return [];

      // 2) Metadata en paralelo (limitar a 40 para no rate-limit)
      const limited = nonZero.slice(0, 40);
      const metaResults = await Promise.all(
        limited.map(async (b: any) => {
          try {
            const r = await fetch(ALCHEMY, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'alchemy_getTokenMetadata',
                params: [b.contractAddress],
              }),
            });
            const data = await r.json();
            return {
              address: b.contractAddress,
              raw: b.tokenBalance,
              meta: data?.result,
            };
          } catch {
            return null;
          }
        })
      );

      const tokens: DiscoveredToken[] = [];
      for (const m of metaResults) {
        if (!m || !m.meta || !m.meta.symbol) continue;
        try {
          const rawBig = BigInt(m.raw);
          const decimals = m.meta.decimals ?? 18;
          const divisor = BigInt(10) ** BigInt(decimals);
          const whole = rawBig / divisor;
          const frac = rawBig % divisor;
          const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6);
          const formatted = `${whole.toString()}.${fracStr}`;
          tokens.push({
            address: m.address,
            symbol: m.meta.symbol,
            name: m.meta.name || m.meta.symbol,
            decimals,
            logo: m.meta.logo || undefined,
            raw: rawBig,
            formatted,
            balanceNum: parseFloat(formatted),
          });
        } catch {}
      }
      return tokens;
    },
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
