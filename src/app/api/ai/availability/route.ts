import { NextRequest, NextResponse } from 'next/server';
import { getSystemUnits } from '@/lib/data-init';
import { getFreshDbBookings } from '@/lib/actions/db';
import { isUnitMatch, normalizeDateString, parseDateDMY, formatDateDMY } from '@/lib/utils';
import { validateAiApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleAvailability(req);
}

export async function POST(req: NextRequest) {
  return handleAvailability(req);
}

async function handleAvailability(req: NextRequest) {
  // 1. Security & Authentication Check
  const auth = validateAiApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({
      success: false,
      error: auth.error || 'Unauthorized: API Key required'
    }, { status: 401 });
  }

  try {
    let checkIn = '';
    let checkOut = '';
    let category = 'all';
    let branch: number | null = null;
    let guestsCount = 2;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        checkIn = body.checkIn || body.check_in || '';
        checkOut = body.checkOut || body.check_out || '';
        category = body.category || 'all';
        if (body.branch) branch = Number(body.branch);
        if (body.guests || body.guestsCount) guestsCount = Number(body.guests || body.guestsCount);
      } catch {}
    } else {
      const { searchParams } = new URL(req.url);
      checkIn = searchParams.get('checkIn') || searchParams.get('check_in') || '';
      checkOut = searchParams.get('checkOut') || searchParams.get('check_out') || '';
      category = searchParams.get('category') || 'all';
      const bParam = searchParams.get('branch');
      if (bParam) branch = Number(bParam);
      const gParam = searchParams.get('guests');
      if (gParam) guestsCount = Number(gParam);
    }

    // Normalize date strings
    checkIn = normalizeDateString(checkIn.includes('/') ? parseDateDMY(checkIn) : checkIn);
    checkOut = normalizeDateString(checkOut.includes('/') ? parseDateDMY(checkOut) : checkOut);

    if (!checkIn || !checkOut) {
      return NextResponse.json({
        success: false,
        error: 'يرجى تحديد تاريخ الوصول والمغادرة (checkIn & checkOut) بصيغة YYYY-MM-DD أو DD/MM/YYYY'
      }, { status: 400 });
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
      return NextResponse.json({
        success: false,
        error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول'
      }, { status: 400 });
    }

    const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Fetch units and bookings in parallel
    const [allUnits, allBookings] = await Promise.all([
      getSystemUnits(),
      getFreshDbBookings()
    ]);

    // Filter physical units (exclude master category templates)
    let units = allUnits.filter(u => 
      u.status !== 'صيانة' && 
      !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id)
    );

    if (branch) {
      units = units.filter(u => u.branch === branch);
    }

    // Active confirmed bookings
    const confirmedBookings = allBookings.filter((b: any) => 
      !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)
    );

    // Filter available units
    const availableUnits = units.filter(unit => {
      const overlaps = confirmedBookings.some((b: any) => {
        if (!isUnitMatch(b, unit.id, unit.title?.ar)) return false;
        const bIn = b.checkIn || b.check_in;
        const bOut = b.checkOut || b.check_out;
        if (!bIn || !bOut) return false;
        // Overlap rule: (bIn < checkOut) && (bOut > checkIn)
        return (bIn < checkOut) && (bOut > checkIn);
      });

      return !overlaps;
    });

    const host = req.headers.get('host') || 'mazar-booking.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const formattedUnits = availableUnits.map(u => {
      const pricePerNight = Number(u.price || 3000);
      const totalAmount = pricePerNight * nights;
      const depositRequired = pricePerNight; // 1-night deposit rule
      const remainingOnArrival = totalAmount - depositRequired;

      return {
        id: u.id,
        nameAr: u.title?.ar || u.id,
        nameEn: u.title?.en || u.id,
        branch: u.branch === 1 ? 'مزار 1 (الرئيسي)' : u.branch === 2 ? 'مزار 2 (الملحق)' : 'مزار 3 (عكورة)',
        type: u.type === 'studio' ? 'استوديو فندقي' : 'شقة فندقية',
        pricePerNight,
        nights,
        totalAmount,
        depositRequired,
        remainingOnArrival,
        features: u.features?.ar || ['تكييف', 'واي فاي سريع', 'شاشة سمارت', 'مطبخ مجهز'],
        videoUrl: u.video ? (u.video.startsWith('http') ? u.video : `${baseUrl}${u.video}`) : null,
        bookingUrl: `${baseUrl}/mazar/book?unit=${u.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      };
    });

    let suggestedReply = '';
    if (formattedUnits.length > 0) {
      suggestedReply = 
        `أهلاً بحضرتك في مجمع مزار الفندقي 🏨✨\n\n` +
        `يسعدنا إبلاغك بتوفر الوحدات التالية للفترة من *${formatDateDMY(checkIn)}* إلى *${formatDateDMY(checkOut)}* (${nights} ليالي):\n\n` +
        formattedUnits.slice(0, 4).map((u, i) => 
          `${i + 1}. *${u.nameAr}* (${u.branch})\n` +
          `   💵 السعر لليلة: ${u.pricePerNight.toLocaleString()} ج.م\n` +
          `   💰 الإجمالي (${nights} ليالي): ${u.totalAmount.toLocaleString()} ج.م\n` +
          `   💳 العربون المطلوب لتأكيد الحجز: ليلة واحدة فقط (${u.depositRequired.toLocaleString()} ج.م) والباقي عند الوصول\n` +
          `   🔗 رابط تفاصيل الوحدة وحجزها: ${u.bookingUrl}\n`
        ).join('\n') +
        `\nهل تحب أن أساعدك في تثبيت حجز أي من هذه الوحدات الآن؟`;
    } else {
      suggestedReply = 
        `أهلاً بحضرتك في مجمع مزار الفندقي 🏨\n` +
        `نعتذر لحضرتك، جميع الوحدات محجوزة بالكامل في الفترة من *${formatDateDMY(checkIn)}* إلى *${formatDateDMY(checkOut)}*.\n` +
        `هل يناسب حضرتك تغيير التواريخ يوماً قبل أو بعد هذا الموعد للبحث عن شواغر متاحة؟`;
    }

    return NextResponse.json({
      success: true,
      checkIn,
      checkOut,
      checkInFormatted: formatDateDMY(checkIn),
      checkOutFormatted: formatDateDMY(checkOut),
      nights,
      depositRule: 'قيمة ليلة واحدة مقدم والباقي عند الوصول',
      availableCount: formattedUnits.length,
      availableUnits: formattedUnits,
      claudeSuggestedReply: suggestedReply
    });

  } catch (error: any) {
    console.error('[API /api/ai/availability] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'حدث خطأ في الاستعلام عن الوحدات المتاحة',
      details: error.message
    }, { status: 500 });
  }
}
