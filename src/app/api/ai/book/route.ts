import { NextRequest, NextResponse } from 'next/server';
import { getSystemUnits } from '@/lib/data-init';
import { saveDbBooking, getFreshDbBookings } from '@/lib/actions/db';
import { isUnitMatch, normalizeDateString, parseDateDMY, formatDateDMY, formatWhatsAppNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = String(body.name || '').trim();
    const rawPhone = String(body.phone || '').trim();
    let checkIn = String(body.checkIn || body.check_in || '').trim();
    let checkOut = String(body.checkOut || body.check_out || '').trim();
    const unitId = String(body.unitId || body.unit_id || body.apartmentId || '').trim();
    const guestsCount = Number(body.guestsCount || body.guests || 2);
    const clientNotes = String(body.notes || '').trim();
    const paymentMethod = body.paymentMethod || 'instapay_bank';

    if (!name || name.length < 3) {
      return NextResponse.json({ success: false, error: 'يرجى تقديم اسم الضيف الثلاثي بالكامل' }, { status: 400 });
    }

    if (!rawPhone || rawPhone.length < 8) {
      return NextResponse.json({ success: false, error: 'يرجى تقديم رقم هاتف أو واتساب صحيح' }, { status: 400 });
    }

    if (!unitId) {
      return NextResponse.json({ success: false, error: 'يرجى تحديد كود الوحدة المطلوبة (unitId)' }, { status: 400 });
    }

    checkIn = normalizeDateString(checkIn.includes('/') ? parseDateDMY(checkIn) : checkIn);
    checkOut = normalizeDateString(checkOut.includes('/') ? parseDateDMY(checkOut) : checkOut);

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
      return NextResponse.json({ success: false, error: 'تاريخ الوصول والمغادرة غير صحيح' }, { status: 400 });
    }

    const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Load units to get price and title
    const allUnits = await getSystemUnits();
    const selectedUnit = allUnits.find(u => u.id === unitId || u.title?.ar === unitId);

    if (!selectedUnit) {
      return NextResponse.json({ success: false, error: `الوحدة المطلوبة (${unitId}) غير موجودة في النظام` }, { status: 404 });
    }

    // Verify availability to avoid conflict
    const allBookings = await getFreshDbBookings();
    const isOccupied = allBookings.some((b: any) => {
      if (['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
      if (!isUnitMatch(b, selectedUnit.id, selectedUnit.title?.ar)) return false;
      const bIn = b.checkIn || b.check_in;
      const bOut = b.checkOut || b.check_out;
      return (bIn < checkOut) && (bOut > checkIn);
    });

    if (isOccupied) {
      return NextResponse.json({
        success: false,
        error: `الوحدة (${selectedUnit.title?.ar || selectedUnit.id}) محجوزة بالفعل في هذه التواريخ، يرجى اختيار وحدة أخرى أو تاريخ مختلف.`
      }, { status: 409 });
    }

    const pricePerNight = Number(selectedUnit.price || 3000);
    const totalAmount = pricePerNight * nights;
    const depositRequired = pricePerNight; // 1-night deposit rule
    const remainingOnArrival = totalAmount - depositRequired;
    const unitTitleAr = selectedUnit.title?.ar || selectedUnit.id;

    const bookingPayload = {
      name,
      phone: formatWhatsAppNumber(rawPhone),
      checkIn,
      checkOut,
      numberOfDays: nights,
      pricePerNight,
      totalAmount,
      apartmentId: selectedUnit.id,
      studio: unitTitleAr,
      branch: selectedUnit.branch || 1,
      paymentMethod,
      clientStatus: 'انتظار',
      status: 'جديد',
      source: 'ai_whatsapp',
      isWebsiteBooking: true,
      guestsCount,
      notes: `[طلب واتساب عبر الذكاء الاصطناعي Claude] ${clientNotes ? `| ملاحظات: ${clientNotes}` : ''} | عربون ليلة واحدة مطلوب: ${depositRequired} ج.م`
    };

    const saveResult = await saveDbBooking(bookingPayload);

    if (!saveResult.success) {
      return NextResponse.json({ success: false, error: saveResult.error || 'فشل حفظ الحجز في قاعدة البيانات' }, { status: 500 });
    }

    const customerWhatsAppSummary = 
      `*تم تسجيل طلب حجزك بنجاح في مجمع مزار 🏨🎉*\n\n` +
      `👤 *اسم الضيف:* ${name}\n` +
      `📱 *الهاتف:* ${rawPhone}\n` +
      `🏨 *الوحدة:* ${unitTitleAr}\n` +
      `📅 *فترة الإقامة:* من ${formatDateDMY(checkIn)} إلى ${formatDateDMY(checkOut)} (${nights} ليالي)\n` +
      `👥 *عدد الضيوف:* ${guestsCount}\n` +
      `💵 *إجمالي الاستضافة:* ${totalAmount.toLocaleString()} ج.م\n` +
      `💳 *العربون المطلوب للتأكيد (ليلة واحدة):* ${depositRequired.toLocaleString()} ج.م\n` +
      `🏨 *المتبقي عند الوصول:* ${remainingOnArrival.toLocaleString()} ج.م\n\n` +
      `يرجى تحويل مبلغ العربون عبر إنستاباي لتثبيت الحجز، وسيتم إرسال إشعار التسكين لك فوراً. شكراً لاختيارك مزار! ✨`;

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل الحجز بنجاح وإدراجه في لوحة تحكم الإدارة كطلب جديد للتأكيد',
      booking: {
        id: (saveResult.data && saveResult.data[0]?.id) || `B-${Date.now()}`,
        name,
        phone: rawPhone,
        unit: unitTitleAr,
        unitId: selectedUnit.id,
        checkIn: formatDateDMY(checkIn),
        checkOut: formatDateDMY(checkOut),
        nights,
        totalAmount,
        depositRequired,
        remainingOnArrival
      },
      claudeWhatsAppMessage: customerWhatsAppSummary
    });

  } catch (error: any) {
    console.error('[API /api/ai/book] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'حدث خطأ في إنشاء الحجز' }, { status: 500 });
  }
}
