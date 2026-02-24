/**
 * Supabase client for LockGift
 * Only stores metadata - never private keys!
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if credentials are available
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Types for the gifts table
export interface Gift {
  id: string;
  created_at: string;
  deposit_address: string;
  deposit_txid: string | null;
  deposit_confirmations: number;
  lock_txid: string | null;
  locked_at: string | null;
  amount_sats: number;
  beneficiary_address: string;
  unlock_at: string;
  message: string | null;
  fee_percent: number;
  status: 'pending' | 'locked' | 'claimed' | 'expired';
  claimed_at: string | null;
  claim_txid: string | null;
  sender_ip: string | null;
  utxo_txid: string | null;
  utxo_vout: number | null;
  utxo_amount_sats: number | null;
  hd_index: number | null; // HD derivation index
}

export type GiftStatus = Gift['status'];

/**
 * Create a new gift record
 */
export async function createGift(params: {
  depositAddress: string;
  amountSats: number;
  beneficiaryAddress: string;
  unlockAt: string;
  message?: string;
  feePercent?: number;
  hdIndex?: number;
}): Promise<Gift> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data, error } = await supabase
    .from('gifts')
    .insert({
      deposit_address: params.depositAddress,
      amount_sats: params.amountSats,
      beneficiary_address: params.beneficiaryAddress,
      unlock_at: params.unlockAt,
      message: params.message || null,
      fee_percent: params.feePercent || 1.0,
      status: 'pending',
      hd_index: params.hdIndex ?? null,
    })
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Get gift by ID
 */
export async function getGift(id: string): Promise<Gift | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Get gift by deposit address
 */
export async function getGiftByDepositAddress(address: string): Promise<Gift | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('deposit_address', address)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Update gift status to locked
 */
export async function lockGift(id: string, params: {
  depositTxid: string;
  lockTxid: string;
  utxoTxid: string;
  utxoVout: number;
  utxoAmountSats: number;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('gifts')
    .update({
      deposit_txid: params.depositTxid,
      lock_txid: params.lockTxid,
      utxo_txid: params.utxoTxid,
      utxo_vout: params.utxoVout,
      utxo_amount_sats: params.utxoAmountSats,
      locked_at: new Date().toISOString(),
      status: 'locked',
    })
    .eq('id', id);
  
  if (error) throw new Error(error.message);
}

/**
 * Update gift status to claimed
 */
export async function claimGift(id: string, claimTxid: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('gifts')
    .update({
      claim_txid: claimTxid,
      claimed_at: new Date().toISOString(),
      status: 'claimed',
    })
    .eq('id', id);
  
  if (error) throw new Error(error.message);
}

/**
 * Update deposit confirmations
 */
export async function updateConfirmations(id: string, confirmations: number): Promise<void> {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('gifts')
    .update({ deposit_confirmations: confirmations })
    .eq('id', id);
  
  if (error) console.error('Failed to update confirmations:', error);
}

/**
 * Get all gifts (admin)
 */
export async function getAllGifts(): Promise<Gift[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get the next available HD index
 * Returns max(hd_index) + 1 from existing gifts, or the configured starting index
 */
export async function getNextHDIndex(): Promise<number> {
  if (!supabase) return parseInt(process.env.HD_INDEX || '0', 10);
  
  const { data, error } = await supabase
    .from('gifts')
    .select('hd_index')
    .not('hd_index', 'is', null)
    .order('hd_index', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    // No existing gifts with HD index, start from configured value
    return parseInt(process.env.HD_INDEX || '0', 10);
  }
  
  return (data.hd_index || 0) + 1;
}

/**
 * Get gifts count by status
 */
export async function getGiftStats(): Promise<{
  total: number;
  pending: number;
  locked: number;
  claimed: number;
}> {
  const { data, error } = await supabase
    .from('gifts')
    .select('status', { count: 'exact' });
  
  if (error) return { total: 0, pending: 0, locked: 0, claimed: 0 };
  
  const counts = {
    total: data.length,
    pending: data.filter(g => g.status === 'pending').length,
    locked: data.filter(g => g.status === 'locked').length,
    claimed: data.filter(g => g.status === 'claimed').length,
  };
  
  return counts;
}
