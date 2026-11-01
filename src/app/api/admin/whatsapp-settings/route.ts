import { NextRequest, NextResponse } from 'next/server';
import { getDbWhatsAppSettings, saveDbWhatsAppSettings } from '@/lib/actions/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getDbWhatsAppSettings();
  return NextResponse.json({ success: true, settings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await saveDbWhatsAppSettings(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
