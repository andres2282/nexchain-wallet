export const WORLDCHAIN = {
  id: 480,
  name: 'World Chain',
  rpc: 'https://worldchain-mainnet.g.alchemy.com/public',
  explorer: 'https://worldscan.org',
} as const;

export const APP_CONFIG = {
  appId:
    process.env.NEXT_PUBLIC_APP_ID ||
    'app_20c80a62293853c3f98455b3017d5e6c',
};

// App ID del Swap oficial de World (deeplinks)
export const WORLD_SWAP_APP_ID = 'app_a4f7f3e62c1de0b9490a5260cb390b56';

export function buildSwapDeeplink(
  fromTokenSymbol?: string,
  toTokenAddress?: string,
  amount?: string
) {
  const params = new URLSearchParams();
  if (fromTokenSymbol) params.set('fromToken', fromTokenSymbol);
  if (toTokenAddress) params.set('toToken', toTokenAddress);
  if (amount) params.set('amount', amount);
  const qs = params.toString();
  const path = qs ? `/?${qs}` : '/';
  return `https://worldcoin.org/mini-app?app_id=${WORLD_SWAP_APP_ID}&path=${encodeURIComponent(path)}`;
}
