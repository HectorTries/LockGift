-- LockGift schema for LOCAL Postgres (replaces hosted Supabase).
-- Run as superuser: psql -f supabase/schema.sql
-- RLS-equivalent: no public access. DB bound to localhost / firewalled,
-- app connects via restricted lockgift_app role. No world-readable exposure.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deposit_address VARCHAR(62) NOT NULL,
    deposit_txid VARCHAR(64),
    deposit_confirmations INTEGER DEFAULT 0,
    lock_txid VARCHAR(64),
    locked_at TIMESTAMP WITH TIME ZONE,
    amount_sats BIGINT NOT NULL,
    beneficiary_address VARCHAR(62) NOT NULL,
    unlock_at TIMESTAMP WITH TIME ZONE NOT NULL,
    message TEXT,
    fee_percent DECIMAL(5,2) DEFAULT 1.00,
    status VARCHAR(20) DEFAULT 'pending',
    claimed_at TIMESTAMP WITH TIME ZONE,
    claim_txid VARCHAR(64),
    sender_ip VARCHAR(45),
    utxo_txid VARCHAR(64),
    utxo_vout INTEGER,
    utxo_amount_sats BIGINT,
    hd_index INTEGER
);

CREATE INDEX IF NOT EXISTS idx_gifts_status ON gifts(status);
CREATE INDEX IF NOT EXISTS idx_gifts_deposit_address ON gifts(deposit_address);
CREATE INDEX IF NOT EXISTS idx_gifts_unlock_at ON gifts(unlock_at);

-- App-only role (least privilege, table-scoped, no DDL, no other DBs)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lockgift_app') THEN
    CREATE ROLE lockgift_app LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END $$;

REVOKE ALL ON DATABASE lockgift FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE lockgift TO lockgift_app;
GRANT USAGE ON SCHEMA public TO lockgift_app;
GRANT SELECT, INSERT, UPDATE ON gifts TO lockgift_app;
-- No DELETE, no public/anon role, no network exposure (bind localhost + firewall).
