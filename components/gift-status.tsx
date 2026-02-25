'use client';

/**
 * Gift Status Component
 * 
 * Displays live status of a gift with txids and explorer links
 */

import { useEffect, useState } from 'react';
import { 
  Clock, 
  Lock, 
  Unlock, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Copy,
  RefreshCw,
  MessageSquare,
  Share2,
  Wallet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  formatSatsHuman, 
  formatDate, 
  formatRelativeDate,
  getExplorerTxLink,
  getExplorerAddressLink 
} from '@/lib/utils';
import type { Gift } from '@/lib/supabase';

interface GiftStatusProps {
  gift: Gift;
  network: 'mainnet' | 'testnet';
}

type StatusDisplay = {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
};

const statusConfig: Record<string, StatusDisplay> = {
  pending: {
    icon: <Clock className="w-6 h-6" />,
    label: 'Waiting for Deposit',
    description: 'Send Bitcoin to the deposit address below',
    color: 'text-yellow-500',
  },
  locked: {
    icon: <Lock className="w-6 h-6" />,
    label: 'Bitcoin Locked!',
    description: 'Your Bitcoin is now time-locked and cannot be accessed until the unlock date',
    color: 'text-green-500',
  },
  claimed: {
    icon: <CheckCircle className="w-6 h-6" />,
    label: 'Claimed!',
    description: 'The beneficiary has claimed this Bitcoin',
    color: 'text-blue-500',
  },
  expired: {
    icon: <AlertCircle className="w-6 h-6" />,
    label: 'Expired',
    description: 'This gift was not claimed within the validity period',
    color: 'text-red-500',
  },
};

export function GiftStatus({ gift, network }: GiftStatusProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentGift, setCurrentGift] = useState(gift);

  const status = statusConfig[currentGift.status] || statusConfig.pending;
  const mempoolUrl = network === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet';

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/gifts/${gift.id}/status`);
      if (response.ok) {
        const updated = await response.json();
        setCurrentGift(updated);
      }
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const shareLink = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Bitcoin Time Gift',
        text: `I've sent you a time-locked Bitcoin gift!`,
        url,
      });
    } else {
      copyToClipboard(url, 'share');
    }
  };

  const isUnlocked = new Date(currentGift.unlock_at) <= new Date();
  const canClaim = isUnlocked && currentGift.status === 'locked';

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className={status.color}>{status.icon}</span>
            {status.label}
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={shareLink}
              title="Share gift link"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={refreshStatus}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <CardDescription>{status.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Amount */}
        <div className="text-center py-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="text-3xl font-bold">{formatSatsHuman(currentGift.amount_sats)}</p>
          {currentGift.fee_percent > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {currentGift.fee_percent}% fee applied
            </p>
          )}
        </div>

        {/* Message (if exists) */}
        {currentGift.message && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Message
            </Label>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm italic">"{currentGift.message}"</p>
            </div>
          </div>
        )}

        {/* Deposit Address (if pending) */}
        {currentGift.status === 'pending' && (
          <div className="space-y-2">
            <Label>Deposit Address</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded text-xs break-all">
                {currentGift.deposit_address}
              </code>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(currentGift.deposit_address, 'deposit')}
              >
                {copied === 'deposit' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send exactly {formatSatsHuman(currentGift.amount_sats)} to this address
            </p>
          </div>
        )}

        {/* Beneficiary */}
        <div className="space-y-2">
          <Label>Beneficiary Address</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
              {currentGift.beneficiary_address}
            </code>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => copyToClipboard(currentGift.beneficiary_address, 'beneficiary')}
            >
              {copied === 'beneficiary' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Unlock Date */}
        <div className="space-y-2">
          <Label>Unlocks At</Label>
          <div className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <span>{formatDate(currentGift.unlock_at)}</span>
            <span className="text-sm text-muted-foreground">
              ({formatRelativeDate(currentGift.unlock_at)})
            </span>
          </div>
        </div>

        {/* Message (if any) */}
        {currentGift.message && (
          <div className="space-y-2">
            <Label>Message</Label>
            <p className="p-3 bg-muted rounded text-sm italic">
              "{currentGift.message}"
            </p>
          </div>
        )}

        {/* Transaction IDs */}
        {(currentGift.deposit_txid || currentGift.lock_txid) && (
          <div className="space-y-3 pt-4 border-t">
            {currentGift.deposit_txid && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Deposit Transaction</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                    {currentGift.deposit_txid}
                  </code>
                  <Button variant="outline" size="icon" asChild>
                    <a 
                      href={getExplorerTxLink(currentGift.deposit_txid, network)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {currentGift.lock_txid && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Lock Transaction</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                    {currentGift.lock_txid}
                  </code>
                  <Button variant="outline" size="icon" asChild>
                    <a 
                      href={getExplorerTxLink(currentGift.lock_txid, network)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claim button (if locked and unlock date passed) */}
        {canClaim && (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-center text-muted-foreground">
              This gift is ready to claim! Enter your wallet address to claim.
            </p>
            <Button className="w-full" size="lg">
              <Wallet className="w-4 h-4 mr-2" />
              Claim Bitcoin
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
