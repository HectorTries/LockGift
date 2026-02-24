/**
 * Check Deposits API Route
 * 
 * GET /api/admin/check-deposits
 * Checks for new deposits on pending gifts and creates time-lock transactions
 * 
 * This should be called periodically (e.g., every 5 minutes) by a cron job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGift, lockGift, getAllGifts } from '@/lib/supabase';
import { getUtxo, getNetwork, buildLockingTransaction, broadcastTransaction } from '@/lib/bitcoin';

// Admin auth - simple password check
function checkAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) return false;
  return authHeader === `Bearer ${adminPassword}`;
}

export async function GET(request: NextRequest) {
  // Check admin auth
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const network = (process.env.NEXT_PUBLIC_NETWORK || 'mainnet') as 'mainnet' | 'testnet';
    const mempoolUrl = process.env.NEXT_PUBLIC_MEMPOOL_URL || 
      (network === 'mainnet' ? 'https://mempool.space/api' : 'https://mempool.space/testnet/api');
    
    // Get all pending gifts
    const gifts = await getAllGifts();
    const pendingGifts = gifts.filter(g => g.status === 'pending');
    
    const results = {
      checked: pendingGifts.length,
      depositsFound: 0,
      locked: 0,
      errors: [] as string[],
    };
    
    // Check each pending gift for deposits
    for (const gift of pendingGifts) {
      try {
        const utxo = await getUtxo(gift.deposit_address, mempoolUrl);
        
        if (!utxo) {
          continue; // No deposit yet
        }
        
        results.depositsFound++;
        
        // Check if we have enough confirmations (at least 1)
        if (utxo.amount < 6000) {
          console.log(`Gift ${gift.id}: Deposit too small (${utxo.amount} sats)`);
          continue;
        }
        
        // Get the private key for this HD index
        const hdSeed = process.env.HD_SEED;
        const hdIndex = gift.hd_index;
        
        if (!hdSeed || hdIndex === null) {
          results.errors.push(`Gift ${gift.id}: No HD seed or index`);
          continue;
        }
        
        // Import dynamically to avoid issues
        const { generateHDFeatureAddress } = await import('@/lib/bitcoin');
        
        const { privateKey } = generateHDFeatureAddress(hdSeed, hdIndex, network);
        
        // Calculate unlock timestamp
        const unlockTimestamp = Math.floor(new Date(gift.unlock_at).getTime() / 1000);
        
        // Build and broadcast the lock transaction
        const feePercent = parseFloat(process.env.FEE_PERCENT || '1');
        const feeAddress = process.env.FEE_ADDRESS;
        
        if (!feeAddress) {
          results.errors.push(`Gift ${gift.id}: No fee address configured`);
          continue;
        }
        
        const lockTx = buildLockingTransaction({
          utxoTxId: utxo.txid,
          utxoVout: utxo.vout,
          utxoAmountSats: utxo.amount,
          hotWalletWif: privateKey,
          beneficiaryAddress: gift.beneficiary_address,
          unlockTimestamp,
          feePercent,
          feeAddress,
          network,
        });
        
        // Broadcast the lock transaction
        const lockTxid = await broadcastTransaction(lockTx.psbt, mempoolUrl);
        
        // Update gift status
        await lockGift(gift.id, {
          depositTxid: utxo.txid,
          lockTxid,
          utxoTxid: utxo.txid,
          utxoVout: utxo.vout,
          utxoAmountSats: utxo.amount,
        });
        
        results.locked++;
        console.log(`Gift ${gift.id}: Locked! Deposit: ${utxo.amount} sats, Lock TX: ${lockTxid}`);
        
      } catch (error) {
        const msg = `Gift ${gift.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(msg);
        console.error(msg);
      }
    }
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Check deposits error:', error);
    return NextResponse.json(
      { error: 'Failed to check deposits' },
      { status: 500 }
    );
  }
}
