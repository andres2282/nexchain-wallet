'use client';

import { useState, useEffect } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { useSearchTokens, type SearchedToken } from '@/hooks/useSearchTokens';
import { TokenRowSkeleton } from './Skeletons';
import { buildSwapDeeplink } from '@/config/chain';

export function SearchView() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(id);
  }, [query]);

  const { data: results, isLoading } = useSearchTokens(debounced);

  return (
    <div className="px-4 py-5 pb-28 space-y-4 animate-fade-in">
      <div>
        <h1 className="font-cyber text-2xl font-black text-white">Buscar</h1>
        <p className="text-xs text-gray-400 mt-1">
          Encontrá tokens en World Chain
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Símbolo, nombre o 0x..."
          className="w-full pl-10 pr-3 py-3 rounded-2xl bg-nex-panel border border-white/10 text-sm text-white placeholder:text-gray-500 focus:border-nex-green/40 focus:outline-none"
        />
      </div>

      {!debounced || debounced.trim().length < 2 ? (
        <div className="text-center py-16 text-sm text-gray-500">
          Escribí al menos 2 caracteres para buscar
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          <TokenRowSkeleton />
          <TokenRowSkeleton />
          <TokenRowSkeleton />
        </div>
      ) : !results || results.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-nex-panel border border-white/5">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm text-gray-400">Sin resultados</div>
          <div className="text-xs text-gray-600 mt-1">
            Probá con otro nombre o dirección
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((t) => (
            <TokenResult key={t.address} token={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TokenResult({ token }: { token: SearchedToken }) {
  const isUp = token.change24h >= 0;
  const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };
  const fmtPrice = (n: number) => {
    if (n === 0) return '0';
    if (n < 0.0001) return n.toExponential(2);
    if (n < 1) return n.toFixed(6);
    return n.toFixed(4);
  };

  return (
    <a
      href={buildSwapDeeplink('WLD', token.address)}
      className="block p-3 rounded-2xl bg-nex-panel border border-white/5 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3">
        {token.icon ? (
          <img
            src={token.icon}
            alt={token.symbol}
            className="w-11 h-11 rounded-full bg-black/40 shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-nex-green/30 to-nex-cyan/30 flex items-center justify-center text-black text-xs font-black shrink-0">
            {token.symbol.slice(0, 2)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">
            {token.symbol}
          </div>
          <div className="text-xs text-gray-400 truncate">{token.name}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold text-white text-sm font-mono">
            ${fmtPrice(token.priceUsd)}
          </div>
          <div
            className={`text-xs ${isUp ? 'text-nex-green' : 'text-red-400'}`}
          >
            {isUp ? '+' : ''}
            {token.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
        <Stat label="MCap" value={fmtNum(token.marketCap)} />
        <Stat label="Liq" value={fmtNum(token.liquidity)} />
        <Stat label="Vol 24h" value={fmtNum(token.volume24h)} />
      </div>

      <div className="flex items-center justify-end gap-1 mt-2 text-[11px] text-nex-green">
        Tocar para ver en Swap
        <ExternalLink className="w-3 h-3" />
      </div>
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-xs text-white font-mono">{value}</div>
    </div>
  );
}
