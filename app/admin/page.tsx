'use client';

/**
 * Admin Dashboard
 * 
 * /admin
 * Password-protected view of all gifts
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatSatsHuman, formatDate } from '@/lib/utils';
import type { Gift } from '@/lib/supabase';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setAuthenticated(true);
        fetchGifts();
      } else {
        setError('Invalid password');
      }
    } catch (e) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const fetchGifts = async () => {
    try {
      const response = await fetch('/api/admin/gifts');
      if (response.ok) {
        const data = await response.json();
        setGifts(data);
      }
    } catch (e) {
      console.error('Failed to fetch gifts:', e);
    }
  };

  if (!authenticated) {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Enter password to access dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    total: gifts.length,
    pending: gifts.filter(g => g.status === 'pending').length,
    locked: gifts.filter(g => g.status === 'locked').length,
    claimed: gifts.filter(g => g.status === 'claimed').length,
    totalSats: gifts.reduce((sum, g) => sum + g.amount_sats, 0),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Button variant="outline" onClick={fetchGifts}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Gifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-green-500">{stats.locked}</p>
            <p className="text-sm text-muted-foreground">Locked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-blue-500">{stats.claimed}</p>
            <p className="text-sm text-muted-foreground">Claimed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{formatSatsHuman(stats.totalSats)}</p>
            <p className="text-sm text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Gifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Gifts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Beneficiary</th>
                  <th className="text-left p-2">Unlock Date</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Deposit Tx</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((gift) => (
                  <tr key={gift.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-sm">{formatDate(gift.created_at)}</td>
                    <td className="p-2 text-sm font-medium">{formatSatsHuman(gift.amount_sats)}</td>
                    <td className="p-2 text-xs font-mono">{gift.beneficiary_address.slice(0, 12)}...</td>
                    <td className="p-2 text-sm">{formatDate(gift.unlock_at)}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        gift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        gift.status === 'locked' ? 'bg-green-100 text-green-800' :
                        gift.status === 'claimed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {gift.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs font-mono">
                      {gift.deposit_txid ? (
                        <a 
                          href={`https://mempool.space/testnet/tx/${gift.deposit_txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {gift.deposit_txid.slice(0, 8)}...
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
