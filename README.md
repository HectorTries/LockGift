# LockGift ⏰🔒

**By [Living on BTC](https://livingonbtc.com)**

Send Bitcoin through time. A time-locked Bitcoin gift platform built with Next.js 15.

## How It Works

1. **Sender** fills a form: amount (BTC), unlock date, beneficiary address, optional message
2. **App** generates a one-time deposit address from the configured hot wallet
3. **Sender** pays on-chain (any wallet)
4. **Backend** detects payment → immediately builds and broadcasts a CLTV locking transaction
5. **Locking tx**: 
   - Fee % goes to Hector's fee address (spendable immediately)
   - Remaining → P2WSH CLTV output (locked until unlock date)
6. **Sender** gets a permanent `/gift/[uuid]` link with live status and txids

## Features

- ⏰ Time-locked Bitcoin gifts (up to 50 years)
- 🔒 P2WSH CLTV — mathematically impossible to unlock early
- 💰 Configurable fee (default 1%)
- 🖥️ Beautiful mobile-first UI with shadcn/ui
- 📊 Live status via Mempool.space API
- 🔑 Admin dashboard (password protected)
- 🧪 Testnet mode by default

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui + lucide-react
- **bitcoinjs-lib** + tiny-secp256k1
- **Supabase** (free tier) — metadata only, no keys
- **Mempool.space** REST API
- **React Hook Form** + Zod
- **date-fns**

## Quick Start

```bash
# Clone & install
git clone https://github.com/your-org/lockgift.git
cd lockgift
npm install

# Copy environment
cp .env.example .env.local

# Run locally
npm run dev
```

## Environment Variables

```env
# Bitcoin Network
NEXT_PUBLIC_NETWORK=testnet  # "testnet" or "mainnet"

# Hot Wallet (private key in WIF format - ONLY for testnet!)
HOT_WALLET_WIF=cN5u...
FEE_ADDRESS=tb1q...  # Where fees go

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Admin
ADMIN_PASSWORD=your-secure-password

# Mempool API
NEXT_PUBLIC_MEMPOOL_URL=https://mempool.space/testnet/api
```

## Supabase Setup

```bash
# Create project at https://supabase.com
# Run the schema:
psql -h your-db.supabase.co -U postgres -d postgres -f supabase/schema.sql
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add env vars in Vercel dashboard.

## Security Notes

- Private keys stay server-side only
- No keys ever in frontend or database
- Testnet mode by default — always test first!
- This is trust-minimized but you trust the operator to broadcast correct locking tx

## License

MIT — Open source under **Living on BTC** branding.

## Author

Built by Hector / Living on BTC
