'use client';

/**
 * Create Gift Form Component
 * 
 * Form to create a new time-locked Bitcoin gift
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addYears, addMonths, addDays, min as dateMin } from 'date-fns';
import { Lock, Calendar, Copy, Check, Wallet, ArrowRight, Dollar, PoundSterling, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { validateAddress } from '@/lib/bitcoin';

const network = (process.env.NEXT_PUBLIC_NETWORK || 'mainnet') as 'mainnet' | 'testnet';

type Currency = 'gbp' | 'usd' | 'eur';

const currencySymbols: Record<Currency, { symbol: string; icon: React.ReactNode }> = {
  gbp: { symbol: '£', icon: <PoundSterling className="w-3 h-3" /> },
  usd: { symbol: '$', icon: <Dollar className="w-3 h-3" /> },
  eur: { symbol: '€', icon: <Euro className="w-3 h-3" /> },
};

const network = (process.env.NEXT_PUBLIC_NETWORK || 'mainnet') as 'mainnet' | 'testnet';

// Form validation schema
const giftSchema = z.object({
  amountSats: z.coerce.number().min(6000, 'Minimum 6,000 sats (to cover fees)'),
  beneficiaryAddress: z.string().min(1, 'Beneficiary address required').refine(
    (addr) => validateAddress(addr, network),
    'Invalid Bitcoin address'
  ),
  unlockDate: z.string().min(1, 'Unlock date required'),
  unlockTime: z.string().default('00:00'),
  message: z.string().max(500, 'Message too long').optional(),
});

type GiftFormData = z.infer<typeof giftSchema>;

interface GiftFormProps {
  onSuccess: (giftId: string, depositAddress: string) => void;
}

export function GiftForm({ onSuccess }: GiftFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currency, setCurrency] = useState<Currency>('gbp');
  const [prices, setPrices] = useState<Record<Currency, number>>({ gbp: 0, usd: 0, eur: 0 });

  // Fetch BTC prices in multiple currencies on mount
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp,usd,eur');
        const data = await res.json();
        setPrices({
          gbp: data.bitcoin.gbp,
          usd: data.bitcoin.usd,
          eur: data.bitcoin.eur,
        });
      } catch (e) {
        console.error('Failed to fetch BTC price:', e);
      }
    }
    fetchPrices();
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GiftFormData>({
    resolver: zodResolver(giftSchema),
    defaultValues: {
      unlockDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      unlockTime: '00:00',
      message: '',
    },
  });

  // Watch amount for currency conversion
  const amountSats = watch('amountSats') || 0;
  const btcAmount = amountSats / 100000000;
  const fiatEquivalent = btcAmount * prices[currency];
  const currentSymbol = currencySymbols[currency].symbol;

  const onSubmit = async (data: GiftFormData) => {
    setIsLoading(true);
    
    try {
      // Combine date and time
      const unlockAt = new Date(`${data.unlockDate}T${data.unlockTime}`);
      
      const response = await fetch('/api/gifts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountSats: data.amountSats,
          beneficiaryAddress: data.beneficiaryAddress,
          unlockAt: unlockAt.toISOString(),
          message: data.message,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create gift');
      }

      const { giftId, depositAddress } = await response.json();
      onSuccess(giftId, depositAddress);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minDate = format(new Date(), 'yyyy-MM-dd');
  
  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Create Time-Locked Gift
        </CardTitle>
        <CardDescription>
          Send Bitcoin that can only be claimed after a specific date
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amountSats">Amount (satoshis)</Label>
              <div className="flex gap-1">
                {(['gbp', 'usd', 'eur'] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-2 py-1 text-xs rounded ${
                      currency === c 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Input
                id="amountSats"
                type="number"
                placeholder="50000"
                {...register('amountSats')}
              />
              {fiatEquivalent > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-sm text-muted-foreground">
                  {currencySymbols[currency].icon}
                  <span className="ml-1">{fiatEquivalent.toFixed(2)}</span>
                </div>
              )}
            </div>
            {errors.amountSats && (
              <p className="text-sm text-red-500">{errors.amountSats.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Minimum 6,000 sats (~{currentSymbol}3)
            </p>
          </div>

          {/* Beneficiary Address */}
          <div className="space-y-2">
            <Label htmlFor="beneficiaryAddress">Beneficiary Bitcoin Address</Label>
            <Input
              id="beneficiaryAddress"
              placeholder="bc1q..."
              {...register('beneficiaryAddress')}
            />
            {errors.beneficiaryAddress && (
              <p className="text-sm text-red-500">{errors.beneficiaryAddress.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              bech32 address (starts with bc1q or tb1q)
            </p>
          </div>

          {/* Unlock Date */}
          <div className="space-y-2">
            <Label htmlFor="unlockDate">Unlock Date</Label>
            <Input
              id="unlockDate"
              type="date"
              min={minDate}
              {...register('unlockDate')}
            />
            {errors.unlockDate && (
              <p className="text-sm text-red-500">{errors.unlockDate.message}</p>
            )}
          </div>

          {/* Unlock Time */}
          <div className="space-y-2">
            <Label htmlFor="unlockTime">Unlock Time (UTC)</Label>
            <Input
              id="unlockTime"
              type="time"
              {...register('unlockTime')}
            />
            <p className="text-xs text-muted-foreground">
              Default: midnight UTC
            </p>
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Happy birthday! This Bitcoin unlocks when you turn 25..."
              {...register('message')}
            />
            {errors.message && (
              <p className="text-sm text-red-500">{errors.message.message}</p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? (
              'Creating...'
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                Create Gift
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            5% fee • Bitcoin locked immediately after deposit confirmation
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
