-- LockGift Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Gifts table
CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Deposit info
    deposit_address VARCHAR(62) NOT NULL,
    deposit_txid VARCHAR(64),
    deposit_confirmations INTEGER DEFAULT 0,
    
    -- Lock info  
    lock_txid VARCHAR(64),
    locked_at TIMESTAMP WITH TIME ZONE,
    
    -- Gift details
    amount_sats BIGINT NOT NULL,
    beneficiary_address VARCHAR(62) NOT NULL,
    unlock_at TIMESTAMP WITH TIME ZONE NOT NULL,
    message TEXT,
    
    -- Fee config
    fee_percent DECIMAL(5,2) DEFAULT 1.00,
    
    -- Status: pending, locked, claimed, expired
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Claim info
    claimed_at TIMESTAMP WITH TIME ZONE,
    claim_txid VARCHAR(64),
    
    -- Metadata
    sender_ip VARCHAR(45),
    utxo_txid VARCHAR(64),
    utxo_vout INTEGER,
    utxo_amount_sats BIGINT
);

-- Index for faster queries
CREATE INDEX idx_gifts_status ON gifts(status);
CREATE INDEX idx_gifts_deposit_address ON gifts(deposit_address);
CREATE INDEX idx_gifts_unlock_at ON gifts(unlock_at);

-- Enable RLS
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

-- Allow public read for gift pages
CREATE POLICY "Public can read gifts by id" 
ON gifts FOR SELECT 
USING (id::text IN (SELECT id::text FROM gifts));

-- Allow service role full access (for admin)
CREATE POLICY "Service role full access"
ON gifts FOR ALL
USING (true) WITH CHECK (true);
