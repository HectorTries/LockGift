/**
 * Create Gift API Route
 * 
 * POST /api/gifts/create
 * Creates a new gift and generates a deposit address
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDepositAddress, validateAddress, getUtxo, broadcastTransaction, getNetwork } from '@/lib/bitcoin';
import { createGift, getGiftByDepositAddress } from '@/lib/supabase';

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

    // Validate amount
    if (amountSats < 10000) {
      return NextResponse.json(
        { message: 'Minimum amount is 10,000 sats' },
        { status: 400 }
      );
    }

    // Validate beneficiary address
    const network = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'mainnet' | 'testnet';
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

    // Get hot wallet key and generate deposit address
    const hotWalletWif = process.env.HOT_WALLET_WIF;
    if (!hotWalletWif) {
      return NextResponse.json(
        { message: 'Hot wallet not configured' },
        { status: 500 }
      );
    }

    // Generate a unique deposit address for this gift
    // In production, you'd use HD wallet derivation
    const depositAddress = generateDepositAddress(hotWalletWif, network);

    // Check if this address already has a pending gift
    const existingGift = await getGiftByDepositAddress(depositAddress);
    if (existingGift && existingGift.status === 'pending') {
      // Use the existing gift
      return NextResponse.json({
        giftId: existingGift.id,
        depositAddress: existingGift.deposit_address,
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
    });

    return NextResponse.json({
      giftId: gift.id,
      depositAddress: gift.deposit_address,
    });
  } catch (error) {
    console.error('Create gift error:', error);
    return NextResponse.json(
      { message: 'Failed to create gift' },
      { status: 500 }
    );
  }
}
