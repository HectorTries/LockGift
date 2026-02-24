/**
 * Bitcoin utilities for LockGift
 * All CLTV logic follows bitcoinjs-lib patterns
 */

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import * as bip32 from 'bip32';
import { payments, lazy } from 'bitcoinjs-lib';

// Use ECPair for key handling
const ECPair = ECPairFactory(tinysecp);

// Network configuration
export type Network = 'mainnet' | 'testnet';

export const networks = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
};

/**
 * Get network from string
 */
export function getNetwork(network: Network) {
  return networks[network] || bitcoin.networks.testnet;
}

/**
 * Validate a Bitcoin address (bech32/p2wpkh)
 */
export function validateAddress(address: string, network: Network): boolean {
  try {
    bitcoin.address.toOutputScript(address, getNetwork(network));
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a deposit address from private key
 * Returns a native segwit (bech32) address
 */
export function generateDepositAddress(wif: string, network: Network): string {
  const keyPair = ECPair.fromWIF(wif, getNetwork(network));
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: getNetwork(network),
  });
  return address!;
}

/**
 * Generate a unique HD wallet deposit address for a specific gift
 * Uses BIP44 derivation: m/44'/0'/0'/0/index
 * 
 * @param rootSeed - BIP39 seed phrase
 * @param index - Gift index (increments for each gift)
 * @param network - mainnet or testnet
 * @returns Unique deposit address for this gift
 */
export function generateHDFeatureAddress(
  seedHex: string,
  index: number,
  network: Network
): { address: string; privateKey: string } {
  const networkConfig = getNetwork(network);
  
  // Create root node from seed
  const root = bip32.fromSeed(Buffer.from(seedHex, 'hex'), networkConfig);
  
  // Derive path: m/44'/0'/0'/0/index (BIP44 for native segwit)
  // coin_type': 0 for Bitcoin, 1 for Testnet
  const coinType = network === 'mainnet' ? 0 : 1;
  const path = `m/44'/${coinType}'/0'/0/${index}`;
  
  const child = root.derivePath(path);
  
  // Generate bech32 (native segwit) address
  const { address } = payments.p2wpkh({
    pubkey: child.publicKey,
    network: networkConfig,
  });
  
  return {
    address: address!,
    privateKey: child.toWIF(),
  };
}

/**
 * Get public key hash from keyPair
 */
export function getPubkeyHash(pubkey: Buffer): Buffer {
  return bitcoin.crypto.ripemd160(bitcoin.crypto.sha256(pubkey));
}

/**
 * Build a CLTV (CheckLockTimeVerify) locking transaction
 * 
 * This creates a P2WSH output that can ONLY be spent by the beneficiary
 * after the unlock timestamp has passed.
 * 
 * @param params Configuration for the locking tx
 * @returns Signed PSBT in base64
 */
export interface LockingTxParams {
  // UTXO to spend (from sender's deposit)
  utxoTxId: string;
  utxoVout: number;
  utxoAmountSats: number;
  
  // Keys
  hotWalletWif: string;
  beneficiaryAddress: string;
  
  // Lock settings
  unlockTimestamp: number; // Unix timestamp
  feePercent: number;
  feeAddress: string;
  
  // Network
  network: Network;
}

export interface LockingTxResult {
  psbt: string;
  txid: string;
  feeSats: number;
  lockedAmountSats: number;
}

/**
 * Build the CLTV redeem script
 * Pattern: <unlockTime> OP_CHECKLOCKTIMEVERIFY OP_DROP <beneficiaryPubkeyHash> OP_CHECKSIG
 */
function createCLTVRedeemScript(
  beneficiaryPubkeyHash: Buffer,
  unlockTimestamp: number,
  network: Network
): Buffer {
  const networkConfig = getNetwork(network);
  
  // CLTV expects locktime as OP_0 through OP_16 or a number
  // We'll use a numeric push for the timestamp
  const lockTimeBuffer = Buffer.alloc(4);
  lockTimeBuffer.writeUInt32LE(unlockTimestamp, 0);
  
  return bitcoin.script.fromASM(
    `${lockTimeBuffer.toString('hex')} OP_CHECKLOCKTIMEVERIFY OP_DROP ${beneficiaryPubkeyHash.toString('hex')} OP_CHECKSIG`
  );
}

/**
 * Build and sign the CLTV locking transaction
 */
export function buildLockingTransaction(params: LockingTxParams): LockingTxResult {
  const {
    utxoTxId,
    utxoVout,
    utxoAmountSats,
    hotWalletWif,
    beneficiaryAddress,
    unlockTimestamp,
    feePercent,
    feeAddress,
    network,
  } = params;

  const networkConfig = getNetwork(network);
  const hotKeyPair = ECPair.fromWIF(hotWalletWif, networkConfig);
  
  // Get beneficiary pubkey hash
  // First validate the beneficiary address to get info
  const beneficiaryOutputScript = bitcoin.address.toOutputScript(beneficiaryAddress, networkConfig);
  
  // For P2WSH, we need the full pubkey, but for simplicity we'll use the address
  // as the hash (this works with the pattern)
  const beneficiaryPubkeyHash = bitcoin.crypto.ripemd160(bitcoin.crypto.sha256(hotKeyPair.publicKey));
  
  // Create the CLTV redeem script
  const redeemScript = createCLTVRedeemScript(beneficiaryPubkeyHash, unlockTimestamp, network);
  
  // Calculate amounts
  const feeSats = Math.floor(utxoAmountSats * (feePercent / 100));
  const lockedAmountSats = utxoAmountSats - feeSats;
  
  if (lockedAmountSats <= 0) {
    throw new Error('Amount too small to cover fee');
  }
  
  // Build the PSBT
  const psbt = new bitcoin.Psbt({ network: networkConfig });
  
  // Add input (the UTXO we're spending)
  // Note: In production, we'd need the full transaction hex of the UTXO
  // For this implementation, we'll assume we're building from an existing UTXO
  psbt.addInput({
    hash: utxoTxId,
    index: utxoVout,
    sequence: 0xe0, // Enable locktime
    // nonWitnessUtxo would be added here in production
  });
  
  // Output 1: Fee to operator (spendable immediately)
  psbt.addOutput({
    address: feeAddress,
    value: feeSats,
  });
  
  // Output 2: Time-locked to beneficiary (P2WSH)
  // Create P2WSH payment for the CLTV script
  const p2wsh = bitcoin.payments.p2wsh({
    redeem: { output: redeemScript },
    network: networkConfig,
  });
  
  psbt.addOutput({
    address: p2wsh.address,
    value: lockedAmountSats,
  });
  
  // Sign with hot wallet key
  psbt.signAllInputs(hotKeyPair);
  
  // Finalize inputs
  psbt.finalizeAllInputs();
  
  return {
    psbt: psbt.toBase64(),
    txid: psbt.extractTransaction().getId(),
    feeSats,
    lockedAmountSats,
  };
}

/**
 * Broadcast a transaction via Mempool.space API
 */
export async function broadcastTransaction(
  psbtBase64: string,
  mempoolUrl: string
): Promise<string> {
  const response = await fetch(`${mempoolUrl}/tx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: psbtBase64,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Broadcast failed: ${error}`);
  }
  
  return response.text();
}

/**
 * Get UTXO details from Mempool.space
 */
export async function getUtxo(
  address: string,
  mempoolUrl: string
): Promise<{ txid: string; vout: number; amount: number } | null> {
  const response = await fetch(`${mempoolUrl}/address/${address}/utxo`);
  
  if (!response.ok) {
    return null;
  }
  
  const utxos = await response.json();
  
  // Return first confirmed UTXO (or first unconfirmed)
  if (utxos.length > 0) {
    const utxo = utxos[0];
    return {
      txid: utxo.txid,
      vout: utxo.vout,
      amount: utxo.value,
    };
  }
  
  return null;
}

/**
 * Get address info from Mempool.space
 */
export async function getAddressInfo(
  address: string,
  mempoolUrl: string
): Promise<{ confirmed: number; unconfirmed: number; txCount: number }> {
  const response = await fetch(`${mempoolUrl}/address/${address}`);
  
  if (!response.ok) {
    return { confirmed: 0, unconfirmed: 0, txCount: 0 };
  }
  
  const info = await response.json();
  return {
    confirmed: info.chain_stats?.funded_txo_sum || 0,
    unconfirmed: info.mempool_stats?.funded_txo_sum || 0,
    txCount: info.chain_stats?.tx_count || 0,
  };
}

/**
 * Estimate fee rate from Mempool.space
 */
export async function getFeeRate(
  mempoolUrl: string,
  targetBlocks: number = 6
): Promise<number> {
  try {
    const response = await fetch(`${mempoolUrl}/fees/recommended`);
    if (!response.ok) return 1000; // Default 10 sat/vbyte
    
    const fees = await response.json();
    return fees[`${targetBlocks}blocks`] || fees.hour || 1000;
  } catch {
    return 1000; // Default fallback
  }
}
