import { getSystemUnits } from '@/lib/data-init';
import { getFreshDbBookings } from '@/lib/actions/db';
import { isUnitMatch, normalizeDateString, parseDateDMY, formatDateDMY } from '@/lib/utils';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `
أنت المساعد الذكي وموظف الاستقبال الفندقي الرسمي لمجمع "مزار الفندقي" (Mazar Luxury Suites).
مهمتك خدمة النزلاء واستقبال استفساراتهم باحترافية ولباقة ولغة عربية فندقية راقية وموجزة.

قواعد مهمة جداً:
1. مجمع مزار يضم استوديوهات وشقق فندقية مجهزة بأعلى مستوى في 3 فروع بالقاهرة (مزار 1 الرئيسي، مزار 2 الملحق، ومزار 3 عكورة).
2. عندما يسأل العميل عن التوافر أو الأسعار أو إمكانية الحجز، اسأله بلطف عن تاريخ الوصول وتاريخ المغادرة وعدد النزلاء (إن لم يذكرهم).
3. بمجرد معرفة التواريخ، استخدم أداة (check_availability) للبحث في قاعدة البيانات الحية. لا تخمن أبداً أي تواريخ أو أسعار من عندك.
4. قاعدة العربون في مزار: عربون تثبيت الحجز هو قيمة (ليلة واحدة فقط)، والمبلغ المتبقي يُسدد عند الوصول والاستلام.
5. أنت تعمل في وضع (Read-Only) للاستعلام فقط؛ لا تقم بتأكيد الحجز النهائي بنفسك، بل زوّد العميل بالوحدات المتاحة وأسعارها وروابط حجزها ووجّهه لتحويل العربون لتأكيد الحجز.
`.trim();

const TOOLS = [
  {
    name: "check_availability",
    description: "فحص الوحدات والأجنحة المتاحة في مجمع مزار الفندقي وحساب الأسعار والعربون المطلوب لفترة إقامة معينة",
    input_schema: {
      type: "object",
      properties: {
        checkIn: {
          type: "string",
          description: "تاريخ الوصول بصيغة YYYY-MM-DD أو DD/MM/YYYY"
        },
        checkOut: {
          type: "string",
          description: "تاريخ المغادرة بصيغة YYYY-MM-DD أو DD/MM/YYYY"
        },
        branch: {
          type: "number",
          enum: [1, 2, 3],
          description: "الفرع المطلوب (1: مزار 1 الرئيسي، 2: مزار 2، 3: مزار 3). اختياري"
        },
        guests: {
          type: "number",
          description: "عدد الضيوف. اختياري"
        }
      },
      required: ["checkIn", "checkOut"]
    }
  }
];

export async function executeCheckAvailabilityTool(args: any) {
  let { checkIn, checkOut, branch } = args;

  checkIn = normalizeDateString(checkIn.includes('/') ? parseDateDMY(checkIn) : checkIn);
  checkOut = normalizeDateString(checkOut.includes('/') ? parseDateDMY(checkOut) : checkOut);

  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
    return { error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول' };
  }

  const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));

  const [allUnits, allBookings] = await Promise.all([
    getSystemUnits(),
    getFreshDbBookings()
  ]);

  let units = allUnits.filter(u => 
    u.status !== 'صيانة' && 
    !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id)
  );

  if (branch) {
    units = units.filter(u => u.branch === branch);
  }

  const confirmedBookings = allBookings.filter((b: any) => 
    !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)
  );

  const availableUnits = units.filter(unit => {
    const overlaps = confirmedBookings.some((b: any) => {
      if (!isUnitMatch(b, unit.id, unit.title?.ar)) return false;
      const bIn = b.checkIn || b.check_in;
      const bOut = b.checkOut || b.check_out;
      return (bIn < checkOut) && (bOut > checkIn);
    });
    return !overlaps;
  });

  return {
    checkIn: formatDateDMY(checkIn),
    checkOut: formatDateDMY(checkOut),
    nights,
    availableCount: availableUnits.length,
    depositRule: 'قيمة ليلة واحدة مقدم والباقي عند الوصول',
    units: availableUnits.slice(0, 5).map(u => ({
      id: u.id,
      name: u.title?.ar || u.id,
      branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2' : 'مزار 3',
      pricePerNight: Number(u.price || 3000),
      totalPrice: Number(u.price || 3000) * nights,
      depositAmount: Number(u.price || 3000),
      features: u.features?.ar?.slice(0, 4) || ['تكييف', 'واي فاي سريع', 'شاشة سمارت'],
      bookingUrl: `https://mazarstudio.com/mazar/book?unit=${u.id}&checkIn=${checkIn}&checkOut=${checkOut}`
    }))
  };
}

export async function chatWithMazarClaude(userMessage: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY غير معرّف في إعدادات السيرفر');
  }

  const messages: any[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  // First Call: Ask Claude
  let response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: SYSTEM_PROMPT,
      max_tokens: 800,
      messages,
      tools: TOOLS
    })
  });

  let data = await response.json();
  if (data.error) {
    throw new Error(`خطأ من كلود: ${data.error.message || JSON.stringify(data.error)}`);
  }

  // Handle Tool Calls (if Claude decided to check availability)
  if (data.stop_reason === 'tool_use' || (data.content && data.content.some((c: any) => c.type === 'tool_use'))) {
    const toolUses = data.content.filter((c: any) => c.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      if (toolUse.name === 'check_availability') {
        const result = await executeCheckAvailabilityTool(toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }
    }

    // Follow-up request with Tool results
    const followUpMessages = [
      ...messages,
      { role: 'assistant', content: data.content },
      { role: 'user', content: toolResults }
    ];

    const followUpRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        system: SYSTEM_PROMPT,
        max_tokens: 800,
        messages: followUpMessages,
        tools: TOOLS
      })
    });

    data = await followUpRes.json();
  }

  const textBlocks = (data.content || []).filter((c: any) => c.type === 'text');
  const finalReply = textBlocks.map((c: any) => c.text).join('\n\n').trim();

  return finalReply || 'أهلاً بك في مجمع مزار الفندقي! كيف يمكنني مساعدتك اليوم؟';
}
