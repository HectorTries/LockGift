/**
 * Mempool Webhook / Polling Endpoint
 * 
 * POST /api/webhooks/mempool
 * Called when a deposit is detected at our address
 * Builds and broadcasts the CLTV locking transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGiftByDepositAddress, lockGift, getGift } from '@/lib/supabase';
import { 
  buildLockingTransaction, 
  broadcastTransaction, 
  getNetwork,
  getFeeRate,
  getUtxo 
} from '@/lib/bitcoin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, txid, vout } = body;

    if (!address) {
      return NextResponse.json({ message: 'Address required' }, { status: 400 });
    }

    // Find gift by deposit address
    const gift = await getGiftByDepositAddress(address);
    
    if (!gift) {
      return NextResponse.json({ message: 'No gift found for this address' }, { status: 404 });
    }

    if (gift.status !== 'pending') {
      return NextResponse.json({ message: 'Gift already processed' }, { status: 200 });
    }

    // Get UTXO details
    const network = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'mainnet' | 'testnet';
    const mempoolUrl = process.env.NEXT_PUBLIC_MEMPOOL_URL || 'https://mempool.space/testnet/api';
    const hotWalletWif = process.env.HOT_WALLET_WIF;
    const feeAddress = process.env.FEE_ADDRESS;

    if (!hotWalletWif || !feeAddress) {
      return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
    }

    // Get the UTXO that was just deposited
    const utxo = await getUtxo(address, mempoolUrl);
    if (!utxo) {
      return NextResponse.json({ message: 'UTXO not found' }, { status: 404 });
    }

    // Get current fee rate
    const feeRate = await getFeeRate(mempoolUrl);
    
    // Build the CLTV locking transaction
    const unlockTimestamp = Math.floor(new Date(gift.unlock_at).getTime() / 1000);
    
    try {
      const lockingResult = buildLockingTransaction({
        utxoTxId: utxo.txid,
        utxoVout: utxo.vout,
        utxoAmountSats: utxo.amount,
        hotWalletWif,
        beneficiaryAddress: gift.beneficiary_address,
        unlockTimestamp,
        feePercent: gift.fee_percent,
        feeAddress,
        network,
      });

      // Broadcast the locking transaction
      const lockTxId = await broadcastTransaction(lockingResult.psbt, mempoolUrl);

      // Update gift status
      await lockGift(gift.id, {
        depositTxid: txid || utxo.txid,
        lockTxid: lockTxId,
        utxoTxid: utxo.txid,
        utxoVout: utxo.vout,
        utxoAmountSats: utxo.amount,
      });

      return NextResponse.json({
        success: true,
        lockTxId,
        lockedAmount: lockingResult.lockedAmountSats,
        feeAmount: lockingResult.feeSats,
      });
    } catch (buildError) {
      console.error('Locking transaction failed:', buildError);
      return NextResponse.json(
        { message: 'Failed to build locking transaction' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
