/**
 * Create Gift API Route
 * 
 * POST /api/gifts/create
 * Creates a new gift with a unique HD wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateHDFeatureAddress, validateAddress, getNetwork } from '@/lib/bitcoin';
import { createGift, getGiftByDepositAddress, getNextHDIndex } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amountSats, beneficiaryAddress, unlockAt, message } = body;

    // Validate required fields
    if (!amountSats || !beneficiaryAddress || !unlockAt) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate amount (minimum for covering fees)
    if (amountSats < 6000) {
      return NextResponse.json(
        { message: 'Minimum amount is 6,000 sats (to cover fees)' },
        { status: 400 }
      );
    }

    // Validate beneficiary address
    const network = (process.env.NEXT_PUBLIC_NETWORK || 'mainnet') as 'mainnet' | 'testnet';
    if (!validateAddress(beneficiaryAddress, network)) {
      return NextResponse.json(
        { message: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    // Validate unlock date (must be in the future)
    const unlockDate = new Date(unlockAt);
    if (unlockDate <= new Date()) {
      return NextResponse.json(
        { message: 'Unlock date must be in the future' },
        { status: 400 }
      );
    }

    // Get HD seed
    const hdSeed = process.env.HD_SEED;
    if (!hdSeed) {
      return NextResponse.json(
        { message: 'HD wallet not configured' },
        { status: 500 }
      );
    }

    // Get next HD index
    const hdIndex = await getNextHDIndex();

    // Generate unique deposit address for this gift
    const { address: depositAddress, privateKey } = generateHDFeatureAddress(
      hdSeed,
      hdIndex,
      network
    );

    // Check if this address already has a pending gift
    const existingGift = await getGiftByDepositAddress(depositAddress);
    if (existingGift && existingGift.status === 'pending') {
      // Return existing pending gift
      return NextResponse.json({
        giftId: existingGift.id,
        depositAddress: existingGift.deposit_address,
        status: existingGift.status,
      });
    }

    // Create gift record in database
    const feePercent = parseFloat(process.env.FEE_PERCENT || '1');
    const gift = await createGift({
      depositAddress,
      amountSats,
      beneficiaryAddress,
      unlockAt,
      message,
      feePercent,
      hdIndex,
    });

    // In production: store the private key securely (encrypted in DB orHSM)
    // For now, we just return the address - the backend will watch for deposits
    // and use the HD seed to create the lock transaction

    return NextResponse.json({
      giftId: gift.id,
      depositAddress: gift.deposit_address,
      status: 'waiting_for_deposit',
      message: 'Send any amount of Bitcoin to the address above. The gift will be locked once deposit is detected.',
    });
  } catch (error) {
    console.error('Create gift error:', error);
    return NextResponse.json(
      { message: 'Failed to create gift' },
      { status: 500 }
    );
  }
}
