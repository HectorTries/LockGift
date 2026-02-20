/**
 * Gift Status API Route
 * 
 * GET /api/gifts/[id]/status
 * Get current status of a gift
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGift, lockGift, updateConfirmations } from '@/lib/supabase';
import { getUtxo, getNetwork } from '@/lib/bitcoin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gift = await getGift(id);

    if (!gift) {
      return NextResponse.json(
        { message: 'Gift not found' },
        { status: 404 }
      );
    }

    // If pending, check for deposits
    if (gift.status === 'pending') {
      const network = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'mainnet' | 'testnet';
      const mempoolUrl = process.env.NEXT_PUBLIC_MEMPOOL_URL || 'https://mempool.space/testnet/api';
      
      // Check if there's a UTXO at the deposit address
      const utxo = await getUtxo(gift.deposit_address, mempoolUrl);
      
      if (utxo) {
        // Update with deposit tx info
        // Note: In production, you'd trigger the locking tx here
        await updateConfirmations(id, 1); // Simplified
        
        // Return updated gift
        const updatedGift = await getGift(id);
        return NextResponse.json(updatedGift);
      }
    }

    return NextResponse.json(gift);
  } catch (error) {
    console.error('Get gift status error:', error);
    return NextResponse.json(
      { message: 'Failed to get gift status' },
      { status: 500 }
    );
  }
}
