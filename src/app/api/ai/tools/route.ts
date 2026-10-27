import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const toolsSchema = [
    {
      name: "check_availability",
      description: "فحص الوحدات والأجنحة المتاحة في مجمع مزار الفندقي وحساب الأسعار والعربون لفترة إقامة معينة",
      input_schema: {
        type: "object",
        properties: {
          checkIn: {
            type: "string",
            description: "تاريخ الوصول بصيغة YYYY-MM-DD أو DD/MM/YYYY (مثال: 2026-11-15 أو 15/11/2026)"
          },
          checkOut: {
            type: "string",
            description: "تاريخ المغادرة بصيغة YYYY-MM-DD أو DD/MM/YYYY (مثال: 2026-11-20 أو 20/11/2026)"
          },
          branch: {
            type: "number",
            enum: [1, 2, 3],
            description: "الفرع المطلوب (1: مزار 1 الرئيسي، 2: مزار 2، 3: مزار 3). اختياري"
          },
          guests: {
            type: "number",
            description: "عدد الضيوف. اختياري (الافتراضي 2)"
          }
        },
        required: ["checkIn", "checkOut"]
      }
    },
    {
      name: "create_booking_request",
      description: "تسجيل طلب حجز فندقي جديد في مجمع مزار وإدراجه في لوحة تحكم الإدارة",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "اسم الضيف بالكامل (ثلاثي)"
          },
          phone: {
            type: "string",
            description: "رقم هاتف أو واتساب الضيف للتواصل"
          },
          unitId: {
            type: "string",
            description: "كود الوحدة المطلوبة (مثل b1-s1, b1-s4, b2-s2, apt-1, p-s28)"
          },
          checkIn: {
            type: "string",
            description: "تاريخ الوصول YYYY-MM-DD"
          },
          checkOut: {
            type: "string",
            description: "تاريخ المغادرة YYYY-MM-DD"
          },
          guestsCount: {
            type: "number",
            description: "عدد الضيوف"
          },
          notes: {
            type: "string",
            description: "أي طلبات خاصة أو ملاحظات إضافية من العميل"
          }
        },
        required: ["name", "phone", "unitId", "checkIn", "checkOut"]
      }
    }
  ];

  const claudeSystemPrompt = `
أنت المساعد الذكي والمستقبل الفندقي الرسمي لمجمع "مزار الفندقي" (Mazar Luxury Suites).
مهمتك خدمة العملاء عبر الواتساب بأعلى درجات الرقي واللباقة والاحترافية وسرعة الرد.

قواعد أساسية لخدمة النزلاء:
1. مجمع مزار يضم استوديوهات وشقق فندقية فاخرة ومجهزة بأعلى مستوى في 3 فروع (مزار 1، مزار 2، ومزار 3).
2. عند سؤال العميل عن التوفر أو الأسعار، اطلب منه بأدب تاريخ الوصول وتاريخ المغادرة (وعدد الضيوف إن أمكن)، ثم استدعِ أداة (check_availability).
3. قاعدة العربون في مزار: عربون تأكيد الحجز هو قيمة (ليلة واحدة فقط)، والمبلغ المتبقي يُسدد عند الوصول والاستلام.
4. اعرض على العميل الوحدات المتاحة مع أسعارها وروابطها والصور، واقترح عليه المساعدة في تثبيت الحجز.
5. عندما يوافق العميل، اطلب اسمه ورقم هاتفه ثم استدعِ أداة (create_booking_request) لإدراج الحجز فوراً في لوحة التحكم وتزويده ببيانات التحويل.
`.trim();

  return NextResponse.json({
    success: true,
    name: "Mazar Booking Claude Integration API",
    version: "1.0.0",
    endpoints: {
      checkAvailability: {
        method: "POST / GET",
        url: "/api/ai/availability",
        description: "فحص التوفر وحساب الأسعار لفترة محددة"
      },
      createBooking: {
        method: "POST",
        url: "/api/ai/book",
        description: "إنشاء وتسجيل حجز جديد مباشرة من الواتساب"
      }
    },
    claudeToolsDefinition: toolsSchema,
    claudeSystemPrompt
  });
}
