/**
 * Local Postgres client for LockGift (replaces hosted Supabase).
 * Only stores metadata - never private keys!
 * Connection via DATABASE_URL. App connects with a restricted role;
 * the DB is bound to localhost / behind firewall (see README + schema.sql).
 */

import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

export const pool = connectionString
  ? new Pool({ connectionString, max: 10 })
  : null;

function requirePool(): Pool {
  if (!pool) throw new Error('DATABASE_URL not configured');
  return pool;
}

// Types for the gifts table (unchanged from supabase/schema.sql)
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

// Back-compat alias (old code imported { supabase })
export const supabase = null;

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
  const { rows } = await requirePool().query(
    `INSERT INTO gifts
      (deposit_address, amount_sats, beneficiary_address, unlock_at, message, fee_percent, status, hd_index)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
     RETURNING *`,
    [
      params.depositAddress,
      params.amountSats,
      params.beneficiaryAddress,
      params.unlockAt,
      params.message || null,
      params.feePercent ?? 1.0,
      params.hdIndex ?? null,
    ]
  );
  return rows[0];
}

/**
 * Get gift by ID
 */
export async function getGift(id: string): Promise<Gift | null> {
  if (!pool) return null;
  const { rows } = await pool.query(`SELECT * FROM gifts WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Get gift by deposit address
 */
export async function getGiftByDepositAddress(address: string): Promise<Gift | null> {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT * FROM gifts WHERE deposit_address = $1 LIMIT 1`,
    [address]
  );
  return rows[0] || null;
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
  await requirePool().query(
    `UPDATE gifts SET
       deposit_txid = $2, lock_txid = $3, utxo_txid = $4,
       utxo_vout = $5, utxo_amount_sats = $6,
       locked_at = NOW(), status = 'locked'
     WHERE id = $1`,
    [id, params.depositTxid, params.lockTxid, params.utxoTxid, params.utxoVout, params.utxoAmountSats]
  );
}

/**
 * Update gift status to claimed
 */
export async function claimGift(id: string, claimTxid: string): Promise<void> {
  await requirePool().query(
    `UPDATE gifts SET claim_txid = $2, claimed_at = NOW(), status = 'claimed' WHERE id = $1`,
    [id, claimTxid]
  );
}

/**
 * Update deposit confirmations
 */
export async function updateConfirmations(id: string, confirmations: number): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE gifts SET deposit_confirmations = $2 WHERE id = $1`,
      [id, confirmations]
    );
  } catch (e) {
    console.error('Failed to update confirmations:', e);
  }
}

/**
 * Get all gifts (admin)
 */
export async function getAllGifts(): Promise<Gift[]> {
  const { rows } = await requirePool().query(
    `SELECT * FROM gifts ORDER BY created_at DESC`
  );
  return rows;
}

/**
 * Get the next available HD index
 * Returns max(hd_index) + 1 from existing gifts, or the configured starting index
 */
export async function getNextHDIndex(): Promise<number> {
  const fallback = parseInt(process.env.HD_INDEX || '0', 10);
  if (!pool) return fallback;
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(hd_index), $1 - 1) + 1 AS next_idx FROM gifts WHERE hd_index IS NOT NULL`,
    [fallback]
  );
  return rows[0]?.next_idx ?? fallback;
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
  if (!pool) return { total: 0, pending: 0, locked: 0, claimed: 0 };
  const { rows } = await pool.query(`SELECT status FROM gifts`);
  return {
    total: rows.length,
    pending: rows.filter((g) => g.status === 'pending').length,
    locked: rows.filter((g) => g.status === 'locked').length,
    claimed: rows.filter((g) => g.status === 'claimed').length,
  };
}
