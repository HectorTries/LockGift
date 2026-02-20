import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format satoshis to BTC string
 */
export function formatSatsToBTC(sats: number): string {
  return (sats / 100000000).toFixed(8);
}

/**
 * Format satoshis to BTC with unit
 */
export function formatSatsHuman(sats: number): string {
  if (sats >= 100000000) {
    return `${(sats / 100000000).toFixed(4)} BTC`;
  } else if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(2)}M sats`;
  } else if (sats >= 1000) {
    return `${(sats / 1000).toFixed(1)}K sats`;
  }
  return `${sats} sats`;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date relative (e.g., "in 2 days", "in 1 year")
 */
export function formatRelativeDate(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'Unlocked!';
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays < 7) {
    return `In ${diffDays} days`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `In ${months} month${months > 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `In ${years} year${years > 1 ? 's' : ''}`;
  }
}

/**
 * Get Mempool.space URL for transaction
 */
export function getMempoolUrl(network: 'mainnet' | 'testnet'): string {
  if (network === 'mainnet') {
    return 'https://mempool.space';
  }
  return 'https://mempool.space/testnet';
}

/**
 * Get explorer link for tx
 */
export function getExplorerTxLink(txid: string, network: 'mainnet' | 'testnet'): string {
  const base = getMempoolUrl(network);
  return `${base}/tx/${txid}`;
}

/**
 * Get explorer link for address
 */
export function getExplorerAddressLink(address: string, network: 'mainnet' | 'testnet'): string {
  const base = getMempoolUrl(network);
  return `${base}/address/${address}`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Generate UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
