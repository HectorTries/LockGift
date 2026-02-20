/**
 * Admin Gifts Route
 * 
 * GET /api/admin/gifts
 * Get all gifts (protected)
 */

import { NextResponse } from 'next/server';
import { getAllGifts } from '@/lib/supabase';

export async function GET() {
  try {
    const gifts = await getAllGifts();
    return NextResponse.json(gifts);
  } catch (error) {
    console.error('Admin gifts error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch gifts' },
      { status: 500 }
    );
  }
}
