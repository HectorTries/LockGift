'use client';

/**
 * Gift Status Page
 * 
 * /gift/[id]
 * View and track a gift
 */

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { GiftStatus } from '@/components/gift-status';
import type { Gift } from '@/lib/supabase';

interface GiftPageProps {
  params: Promise<{ id: string }>;
}

export default function GiftPage({ params }: GiftPageProps) {
  const [gift, setGift] = useState<Gift | null>(null);
  const [loading, setLoading] = useState(true);
  const [giftId, setGiftId] = useState<string>('');

  const network = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'mainnet' | 'testnet';

  useEffect(() => {
    params.then(({ id }) => {
      setGiftId(id);
      fetchGift(id);
    });
  }, [params]);

  const fetchGift = async (id: string) => {
    try {
      const response = await fetch(`/api/gifts/${id}/status`);
      if (response.ok) {
        const data = await response.json();
        setGift(data);
      }
    } catch (e) {
      console.error('Failed to fetch gift:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!gift) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <GiftStatus gift={gift} network={network} />
    </div>
  );
}
