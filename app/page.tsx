'use client';

/**
 * Home Page - Create Gift
 */

import { useState } from 'react';
import { GiftForm } from '@/components/gift-form';
import { GiftStatus } from '@/components/gift-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Clock, Wallet, Shield } from 'lucide-react';

export default function HomePage() {
  const [createdGift, setCreatedGift] = useState<{
    id: string;
    depositAddress: string;
  } | null>(null);
  const [giftData, setGiftData] = useState<any>(null);

  const network = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'mainnet' | 'testnet';

  const handleSuccess = async (giftId: string, depositAddress: string) => {
    setCreatedGift({ id: giftId, depositAddress });
    
    // Fetch the gift data
    const response = await fetch(`/api/gifts/${giftId}/status`);
    if (response.ok) {
      const data = await response.json();
      setGiftData(data);
    }
  };

  // Show gift status if created
  if (createdGift && giftData) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <GiftStatus gift={giftData} network={network} />
        
        <p className="text-center text-sm text-muted-foreground">
          <a href="/" className="underline hover:text-foreground">
            Create another gift
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Send Bitcoin Through Time ⏰</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Create a time-locked Bitcoin gift. The recipient can only claim it after 
          the date you choose. Perfect for birthdays, milestones, or savings.
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <Lock className="w-8 h-8 text-primary mb-2" />
            <CardTitle className="text-lg">Time-Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bitcoin is locked with CLTV — mathematically impossible to unlock early
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <Clock className="w-8 h-8 text-primary mb-2" />
            <CardTitle className="text-lg">Set Any Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Lock for days, months, or up to 50 years — you choose
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <Shield className="w-8 h-8 text-primary mb-2" />
            <CardTitle className="text-lg">Trust-Minimized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Once locked, even we can't touch it. The code is open source.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <GiftForm onSuccess={handleSuccess} />

      {/* Warning */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This is a trust-minimized system but you trust the 
            operator to broadcast the correct locking transaction. Always verify 
            the lock transaction on mempool.space before considering the gift complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
