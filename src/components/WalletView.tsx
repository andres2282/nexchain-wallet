'use client';

import { useMemo, useState } from 'react';
import { Send, Download, ArrowLeftRight, Copy, Check, X } from 'lucide-react';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { TokenRowSkeleton } from './Skeletons';
import { buildSwapDeeplink } from '@/config/chain';

export function WalletView({ walletAddress }: { walletAddress: string }) {
  const { data: tokens, isLoading } = useAllTokenBalances(walletAddress);
  const addresses = useMemo(() => tokens?.map((t) => t.address) || [], [tokens]);
  const { data: prices } = useTokenPrices(addresses);
  const [showReceive, setShowReceive] = useState(false);

  const enriched = useMemo(() => {
    if (!tokens) return [];
    return tokens
      .map((t) => {
        const p = prices?.[t.address.toLowerCase()];
        const usd = p?.usd || 0;
        const change = p?.change24h || 0;
        return {
          ...t,
          usd,
          change,
          usdValue: t.balanceNum * usd,
        };
      })
      .sort((a, b) => b.usdValue - a.usdValue);
  }, [tokens, prices]);

  const totalUsd = enriched.reduce((s, t) => s + t.usdValue, 0);

  const openSwap = () => {
    window.location.href = buildSwapDeeplink('WLD');
  };

  const openSend = () => {
    // Deeplink al Send oficial de World (la wallet nativa lo abre)
    alert('Para enviar tokens, usá el botón "Enviar" de tu wallet en World App');
  };

  return (
    <div className="px-4 py-5 pb-28 space-y-5 animate-fade-in">
      {/* Balance grande estilo DropWallet */}
      <div className="text-center py-2">
        <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">
          Saldo Total
        </div>
        <div className="font-cyber text-5xl font-black text-white">
          ${totalUsd.toFixed(2)}
        </div>
      </div>

      {/* 3 acciones grandes */}
      <div className="grid grid-cols-3 gap-3">
        <ActionBtn icon={Send} label="Enviar" onClick={openSend} />
        <ActionBtn
          icon={Download}
          label="Recibir"
          onClick={() => setShowReceive(true)}
        />
        <ActionBtn
          icon={ArrowLeftRight}
          label="Swap"
          highlight
          onClick={openSwap}
        />
      </div>

      {/* Tokens del usuario */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <h2 className="font-cyber text-base font-bold text-white">
            Mis Tokens
          </h2>
          {!isLoading && enriched.length > 0 && (
            <span className="text-[11px] text-gray-500">
              {enriched.length}{' '}
              {enriched.length === 1 ? 'token' : 'tokens'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <TokenRowSkeleton />
            <TokenRowSkeleton />
            <TokenRowSkeleton />
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-nex-panel border border-white/5">
            <div className="text-4xl mb-2">🪙</div>
            <div className="text-sm text-gray-400">
              No hay tokens en tu wallet
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Recibí WLD o cualquier token para empezar
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {enriched.map((t) => (
              <TokenRow key={t.address} token={t} />
            ))}
          </div>
        )}
      </section>

      {/* Modal Recibir */}
      {showReceive && (
        <ReceiveModal
          address={walletAddress}
          onClose={() => setShowReceive(false)}
        />
      )}
    </div>
  );
}

function TokenRow({ token }: { token: any }) {
  const isUp = token.change >= 0;
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-nex-panel border border-white/5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {token.logo ? (
          <img
            src={token.logo}
            alt={token.symbol}
            className="w-11 h-11 rounded-full bg-black/40 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-nex-green/30 to-nex-cyan/30 flex items-center justify-center text-black text-xs font-black shrink-0">
            {token.symbol.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-bold text-white text-sm">{token.symbol}</div>
          <div className="text-xs text-gray-400 font-mono">
            {token.balanceNum.toLocaleString('en-US', {
              maximumFractionDigits: 4,
            })}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold text-white text-sm">
          ${token.usdValue.toFixed(2)}
        </div>
        {token.change !== 0 && (
          <div
            className={`text-xs ${isUp ? 'text-nex-green' : 'text-red-400'}`}
          >
            {isUp ? '+' : ''}
            {token.change.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  highlight,
  onClick,
}: {
  icon: any;
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border transition-all active:scale-95 ${
        highlight
          ? 'bg-gradient-to-br from-nex-green/20 to-nex-cyan/10 border-nex-green/40 shadow-glow-green'
          : 'bg-nex-panel border-white/10'
      }`}
    >
      <Icon
        className={`w-5 h-5 ${highlight ? 'text-nex-green' : 'text-white'}`}
      />
      <span className="text-[11px] text-white font-medium">{label}</span>
    </button>
  );
}

function ReceiveModal({
  address,
  onClose,
}: {
  address: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=0B1525&color=00FF88&margin=8&data=${encodeURIComponent(address)}`;

  return (
    <div
      className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full bg-nex-bg border-t border-white/10 rounded-t-3xl p-5 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto" />

        <div className="flex items-center justify-between">
          <h3 className="font-cyber text-lg font-bold text-white">
            Recibir tokens
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-nex-panel flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="bg-nex-panel rounded-2xl p-4 flex flex-col items-center gap-3 border border-white/10">
          <div className="rounded-xl overflow-hidden bg-nex-panel p-2">
            <img src={qrUrl} alt="QR" width={240} height={240} />
          </div>
          <div className="text-xs text-gray-400 text-center">
            Escaneá este QR o copiá tu dirección
          </div>
        </div>

        <button
          onClick={copy}
          className="w-full p-3 rounded-2xl bg-nex-panel border border-nex-green/30 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <span className="font-mono text-xs text-white truncate flex-1 text-left">
            {address}
          </span>
          {copied ? (
            <Check className="w-4 h-4 text-nex-green shrink-0 ml-2" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
          )}
        </button>

        <p className="text-[11px] text-center text-gray-500 leading-relaxed">
          Solo recibí tokens en{' '}
          <span className="text-nex-green">World Chain</span>. Enviar tokens
          desde otras redes puede resultar en pérdida.
        </p>
      </div>
    </div>
  );
}
