'use client';

import { useQuery } from '@tanstack/react-query';
import { publicClient } from '@/lib/viem';
import { useImportedTokens } from './useImportedTokens';

export type DiscoveredToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  raw: bigint;
  formatted: string;
  balanceNum: number;
  isImported?: boolean;
};

const WORLDSCAN_API = 'https://api.worldscan.org/api';
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || '';
const ALCHEMY_URL = ALCHEMY_KEY
  ? `https://worldchain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : '';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

function formatBalance(raw: bigint, decimals: number): {
  formatted: string;
  balanceNum: number;
} {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6);
  const formatted = `${whole.toString()}.${fracStr}`;
  return { formatted, balanceNum: parseFloat(formatted) };
}

// Estrategia 1: Worldscan API (sin API key, gratis)
async function fetchFromWorldscan(
  walletAddress: string
): Promise<DiscoveredToken[]> {
  try {
    // tokentx trae todas las transferencias de tokens
    // De ahí sacamos qué tokens tocó el wallet
    const url = `${WORLDSCAN_API}?module=account&action=tokentx&address=${walletAddress}&page=1&offset=200&sort=desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const txs = data?.result;
    if (!Array.isArray(txs)) return [];

    // Extraer tokens únicos
    const tokenMap = new Map<
      string,
      { symbol: string; name: string; decimals: number }
    >();
    for (const tx of txs) {
      const addr = (tx.contractAddress || '').toLowerCase();
      if (!addr || addr.length !== 42) continue;
      if (!tokenMap.has(addr)) {
        tokenMap.set(addr, {
          symbol: tx.tokenSymbol || '?',
          name: tx.tokenName || tx.tokenSymbol || '?',
          decimals: parseInt(tx.tokenDecimal || '18'),
        });
      }
    }

    if (tokenMap.size === 0) return [];

    // Para cada token, leer el balance ACTUAL on-chain
    const results: DiscoveredToken[] = [];
    const entries = Array.from(tokenMap.entries()).slice(0, 30);

    await Promise.all(
      entries.map(async ([addr, meta]) => {
        try {
          const balance = (await publicClient.readContract({
            address: addr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          })) as bigint;

          if (balance > 0n) {
            const { formatted, balanceNum } = formatBalance(
              balance,
              meta.decimals
            );
            results.push({
              address: addr,
              symbol: meta.symbol,
              name: meta.name,
              decimals: meta.decimals,
              raw: balance,
              formatted,
              balanceNum,
            });
          }
        } catch (err) {
          // Token con balance 0 o error de lectura, skip
        }
      })
    );

    return results;
  } catch (err) {
    console.error('Worldscan fetch error:', err);
    return [];
  }
}

// Estrategia 2: Alchemy (necesita API key)
async function fetchFromAlchemy(
  walletAddress: string
): Promise<DiscoveredToken[]> {
  if (!ALCHEMY_URL) return [];

  try {
    const balRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenBalances',
        params: [walletAddress, 'erc20'],
      }),
    });
    if (!balRes.ok) return [];

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

    const limited = nonZero.slice(0, 40);
    const metaResults = await Promise.all(
      limited.map(async (b: any) => {
        try {
          const r = await fetch(ALCHEMY_URL, {
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
          return { address: b.contractAddress, raw: b.tokenBalance, meta: data?.result };
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
        const { formatted, balanceNum } = formatBalance(rawBig, decimals);
        tokens.push({
          address: m.address,
          symbol: m.meta.symbol,
          name: m.meta.name || m.meta.symbol,
          decimals,
          logo: m.meta.logo || undefined,
          raw: rawBig,
          formatted,
          balanceNum,
        });
      } catch {}
    }
    return tokens;
  } catch (err) {
    console.error('Alchemy fetch error:', err);
    return [];
  }
}

// Estrategia 3: Tokens importados manualmente (lectura on-chain directa)
async function fetchImportedTokens(
  walletAddress: string,
  importedAddresses: string[]
): Promise<DiscoveredToken[]> {
  if (importedAddresses.length === 0) return [];

  const results: DiscoveredToken[] = [];

  await Promise.all(
    importedAddresses.map(async (addr) => {
      try {
        const [balance, decimals, symbol, name] = await Promise.all([
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }) as Promise<number>,
          publicClient.readContract({
            address: addr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }) as Promise<string>,
          publicClient
            .readContract({
              address: addr as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'name',
            })
            .catch(() => '') as Promise<string>,
        ]);

        const { formatted, balanceNum } = formatBalance(balance, decimals);
        results.push({
          address: addr.toLowerCase(),
          symbol: symbol || '?',
          name: name || symbol || '?',
          decimals,
          raw: balance,
          formatted,
          balanceNum,
          isImported: true,
        });
      } catch (err) {
        console.error(`Error reading imported token ${addr}:`, err);
      }
    })
  );

  return results;
}

export function useAllTokenBalances(walletAddress: string | null) {
  const { imported } = useImportedTokens();

  return useQuery({
    queryKey: ['balances-v2', walletAddress, imported.join(',')],
    queryFn: async (): Promise<DiscoveredToken[]> => {
      if (!walletAddress) return [];

      // Correr todas las estrategias en paralelo
      const [alchemyTokens, worldscanTokens, importedTokens] =
        await Promise.all([
          fetchFromAlchemy(walletAddress),
          fetchFromWorldscan(walletAddress),
          fetchImportedTokens(walletAddress, imported),
        ]);

      // Combinar y deduplicar por address
      const byAddr = new Map<string, DiscoveredToken>();

      // Worldscan primero (con balance siempre actualizado)
      for (const t of worldscanTokens) {
        byAddr.set(t.address.toLowerCase(), t);
      }

      // Alchemy enriquece con logo si no está
      for (const t of alchemyTokens) {
        const existing = byAddr.get(t.address.toLowerCase());
        if (existing) {
          if (!existing.logo && t.logo) existing.logo = t.logo;
        } else {
          byAddr.set(t.address.toLowerCase(), t);
        }
      }

      // Importados se marcan
      for (const t of importedTokens) {
        const existing = byAddr.get(t.address.toLowerCase());
        if (existing) {
          existing.isImported = true;
        } else {
          byAddr.set(t.address.toLowerCase(), t);
        }
      }

      return Array.from(byAddr.values()).sort(
        (a, b) => b.balanceNum - a.balanceNum
      );
    },
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
