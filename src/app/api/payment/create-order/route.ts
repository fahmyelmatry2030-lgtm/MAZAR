import { NextRequest, NextResponse } from 'next/server';
import { createPaymobOrder } from '@/lib/payment/paymob';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const amountEgp = Number(body.amountEgp || body.amount || 0);
    const guestName = String(body.guestName || body.name || 'نزيل مزار').trim();
    const guestPhone = String(body.guestPhone || body.phone || '').trim();
    const guestEmail = String(body.guestEmail || body.email || 'guest@mazar-booking.com').trim();
    const unitName = String(body.unitName || body.unit || 'حجز استوديو فندقي').trim();
    const bookingId = String(body.bookingId || '').trim();

    if (amountEgp <= 0) {
      return NextResponse.json({
        success: false,
        error: 'يرجى تحديد مبلغ صحيح للسداد'
      }, { status: 400 });
    }

    const orderResult = await createPaymobOrder({
      bookingId,
      unitName,
      amountEgp,
      amountCents: Math.round(amountEgp * 100),
      guestName,
      guestPhone,
      guestEmail,
      description: `عربون حجز ${unitName} - مزار`
    });

    return NextResponse.json(orderResult);

  } catch (error: any) {
    console.error('[API /api/payment/create-order] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'فشل تجهيز عملية الدفع بالفيزا'
    }, { status: 500 });
  }
}
