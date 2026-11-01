import { NextRequest, NextResponse } from 'next/server';
import { getSystemUnits } from '@/lib/data-init';
import { getFreshDbBookings } from '@/lib/actions/db';
import { isUnitMatch, normalizeDateString, parseDateDMY, formatDateDMY } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// CORS headers for Claude Connectors
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, mcp-session-id, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ----------------- TOOL DEFINITIONS -----------------

const TOOLS = [
  {
    name: 'get_system_overview',
    description: 'استرجاع الدليل الشامل لمجمع مزار الفندقي (الفروع، أنواع الوحدات، سياسة الأسعار والعربون، طرق الدفع، مواعيد الدخول والخروج)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_all_units',
    description: 'استرجاع قائمة كافة الاستوديوهات والشقق الفندقية في مزار مع حالاتها الحالية والأسعار والمميزات',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'تصفية حسب الفرع (1: مزار 1 الرئيسي، 2: مزار 2 الملحق، 3: مزار 3 عكورة). اختياري'
        }
      }
    }
  },
  {
    name: 'check_availability',
    description: 'فحص التوافر الحقيقي للوحدات ومنع التعارض لفترة معينة، وحساب إجمالي السعر والعربون المطلوب ورابط الحجز',
    inputSchema: {
      type: 'object',
      properties: {
        checkIn: {
          type: 'string',
          description: 'تاريخ الوصول بصيغة YYYY-MM-DD أو DD/MM/YYYY (مثال: 2026-11-15 أو 15/11/2026)'
        },
        checkOut: {
          type: 'string',
          description: 'تاريخ المغادرة بصيغة YYYY-MM-DD أو DD/MM/YYYY (مثال: 2026-11-20 أو 20/11/2026)'
        },
        branch: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'رقم الفرع (1، 2، أو 3). اختياري'
        },
        guests: {
          type: 'number',
          description: 'عدد الضيوف. اختياري'
        }
      },
      required: ['checkIn', 'checkOut']
    }
  },
  {
    name: 'get_bookings',
    description: 'البحث في حجوزات مزار واستعراض الحجوزات الحالية والمستقبلية باسم الضيف أو الهاتف أو التاريخ',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'كلمة بحث (اسم الضيف، رقم الهاتف، أو اسم الاستوديو)'
        },
        status: {
          type: 'string',
          description: 'تصفية بحالة الحجز (مثل: approved أو مؤكد أو جديد). اختياري'
        },
        limit: {
          type: 'number',
          description: 'الحد الأقصى لعدد النتائج (الافتراضي 15)'
        }
      }
    }
  },
  {
    name: 'read_whatsapp_conversations',
    description: 'قراءة أرشيف محادثات الواتساب ونماذج الاستفسارات والردود لتعلم أسلوب وطريقة خدمة عملاء مزار',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'عدد الرسائل المطلوبة (الافتراضي 20)'
        }
      }
    }
  }
];

// ----------------- TOOL LOGIC -----------------

async function executeTool(name: string, args: any) {
  if (name === 'get_system_overview') {
    return {
      propertyName: "مجمع مزار الفندقي (Mazar Luxury Suites)",
      website: "https://mazarstudio.com",
      branches: [
        {
          id: 1,
          name: "مزار 1 (الرئيسي)",
          type: "استوديوهات فندقية فاخرة (سنجل ودبل وتريبل)",
          unitsCount: 12,
          unitsRange: "b1-s1 إلى b1-s12"
        },
        {
          id: 2,
          name: "مزار 2 (الملحق)",
          type: "استوديوهات فندقية بريميوم حديثة (دبل وتريبل)",
          unitsCount: 12,
          unitsRange: "b2-s1 إلى b2-s12"
        },
        {
          id: 3,
          name: "مزار 3 (عكورة)",
          type: "شقق فندقية عائلية (غرفتين وثلاث غرف)",
          unitsRange: "p-s25 إلى p-s30 بالإضافة لشقق فاخرة (apt-1, apt-2, apt-3)"
        }
      ],
      pricingAndPolicies: {
        standardPricePerNight: "3,000 جنيه مصري في المتوسط للاستوديو",
        depositPolicy: "قيمة ليلة واحدة فقط مقدماً لتأكيد الحجز، والمبلغ المتبقي يُسدد عند الوصول والاستلام.",
        checkInTime: "الساعة 2:00 ظهراً",
        checkOutTime: "الساعة 12:00 ظهراً",
        cancellationPolicy: "إلغاء مجاني قبل موعد الوصول بـ 48 ساعة"
      },
      paymentMethods: [
        "فودافون كاش: 01005318003 / 01021691745",
        "إنستاباي (InstaPay)",
        "تحويل بنكي (البنك التجاري الدولي CIB / البنك الأهلي NBE)",
        "فيزا وماستركارد عبر بوابة الدفع الإلكتروني"
      ],
      featuresIncluded: [
        "تكييف سبليت حديث في كل وحدة",
        "واي فاي عالي السرعة فندقي مجاني",
        "شاشة سمارت TV مسطحة",
        "مطبخ مجهز (ثلاجة، ميكروويف، غلاية، أواني)",
        "حمام خاص ومستلزمات فندقية معقمة",
        "خدمة نظافة فندقية دورية ومصعد وأمن 24 ساعة"
      ]
    };
  }

  if (name === 'get_all_units') {
    const allUnits = await getSystemUnits();
    let list = allUnits.filter(u => !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id));
    if (args.branch) {
      list = list.filter(u => u.branch === args.branch);
    }
    return {
      total: list.length,
      units: list.map(u => ({
        id: u.id,
        name: u.title?.ar || u.title?.en || u.id,
        branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3 عكورة',
        type: u.type,
        status: u.status || 'متاح',
        price: Number(u.price || 3000),
        features: u.features?.ar || ['تكييف', 'واي فاي سريع', 'شاشة سمارت']
      }))
    };
  }

  if (name === 'check_availability') {
    let { checkIn, checkOut, branch } = args;
    if (!checkIn || !checkOut) {
      return { error: 'تاريخ الوصول والمغادرة مطلوبان' };
    }

    checkIn = normalizeDateString(checkIn.includes('/') ? parseDateDMY(checkIn) : checkIn);
    checkOut = normalizeDateString(checkOut.includes('/') ? parseDateDMY(checkOut) : checkOut);

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
      return { error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بصيغة YYYY-MM-DD' };
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
      units: availableUnits.slice(0, 10).map(u => ({
        id: u.id,
        name: u.title?.ar || u.id,
        branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3 عكورة',
        pricePerNight: Number(u.price || 3000),
        totalPrice: Number(u.price || 3000) * nights,
        depositAmount: Number(u.price || 3000),
        remainingOnArrival: (Number(u.price || 3000) * nights) - Number(u.price || 3000),
        features: u.features?.ar?.slice(0, 4) || ['تكييف', 'واي فاي سريع', 'شاشة سمارت'],
        bookingUrl: `https://mazarstudio.com/mazar/book?unit=${u.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      }))
    };
  }

  if (name === 'get_bookings') {
    const allBookings = await getFreshDbBookings();
    let list = allBookings;

    if (args.status) {
      const st = String(args.status).trim().toLowerCase();
      list = list.filter((b: any) => String(b.status).toLowerCase().includes(st));
    }

    if (args.query) {
      const q = String(args.query).trim().toLowerCase();
      list = list.filter((b: any) => 
        String(b.name || '').toLowerCase().includes(q) ||
        String(b.phone || '').includes(q) ||
        String(b.studio || '').toLowerCase().includes(q) ||
        String(b.apartmentId || '').toLowerCase().includes(q)
      );
    }

    const limit = args.limit || 15;
    return {
      total: list.length,
      bookings: list.slice(0, limit).map((b: any) => ({
        id: b.id,
        guestName: b.name,
        phone: b.phone,
        studio: b.studio,
        checkIn: b.checkIn || b.check_in,
        checkOut: b.checkOut || b.check_out,
        status: b.status,
        paymentInfo: b.paymentInfo || b.payment_info,
        totalAmount: b.totalAmount || b.total_amount,
        notes: b.notes
      }))
    };
  }

  if (name === 'read_whatsapp_conversations') {
    return {
      source: "Mazar Standard Customer Service Archive",
      note: "نماذج الاستفسارات والردود المعتمدة لخدمة عملاء مزار لتعلم أسلوب التخاطب الراقي والمهني.",
      conversationSamples: [
        {
          scenario: "استفسار عن التوافر والأسعار",
          customer: "السلام عليكم، متاح استوديو لشخصين من يوم 5 نوفمبر لحد 8 نوفمبر وبكام؟",
          mazarTeamReply: "أهلاً وسهلاً بك في مجمع مزار الفندقي 🏨✨ متاح لدينا استوديو بريميوم مجهز بالكامل في مزار 2 (الملحق). السعر لليلة 3,000 ج.م، وإجمالي الـ 3 ليالٍ 9,000 ج.م. لتثبيت الحجز يُطلب عربون ليلة واحدة فقط (3,000 ج.م) والباقي يُسدد عند الوصول والاستلام. هل تحب أرسل لحضرتك رابط الحجز وصور الاستوديو؟"
        },
        {
          scenario: "طلب بيانات تحويل العربون",
          customer: "تمام عايز أحجز، أحول العربون إزاي؟",
          mazarTeamReply: "تحت أمرك يا فندم! يمكنك تحويل عربون الليلة الأولى (3,000 ج.م) عبر:\n1. فودافون كاش: 01005318003 أو 01021691745\n2. أو عبر إنستاباي (InstaPay)\nبعد التحويل يرجى إرسال إيصال السداد هنا لتسجيل وتأكيد حجزك رسمياً في السيستم."
        },
        {
          scenario: "استفسار عن مواعيد الدخول والخروج والمميزات",
          customer: "مواعيد الدخول والخروج إيه؟ وهل في واي فاي ومطبخ؟",
          mazarTeamReply: "مواعيدنا الفندقية:\n- تسجيل الدخول: بدءاً من الساعة 2:00 ظهراً\n- تسجيل الخروج: حتى الساعة 12:00 ظهراً\nجميع استوديوهاتنا مكيفة ومجهزة بواي فاي فندقي مجاني فائق السرعة، شاشة سمارت، ومطبخ متكامل (ثلاجة، ميكروويف، غلاية، أواني). نتشرف باستضافتك دائماً!"
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${name}`);
}

// ----------------- REQUEST HANDLERS -----------------

export async function GET(req: NextRequest) {
  const acceptHeader = req.headers.get('accept') || '';

  // 1. If SSE is requested (Claude Connectors SSE transport)
  if (acceptHeader.includes('text/event-stream')) {
    const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const postEndpoint = `https://mazarstudio.com/api/mcp?sessionId=${sessionId}`;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial endpoint event as required by MCP SSE specification
        const initialEvent = `event: endpoint\ndata: ${postEndpoint}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialEvent));

        // Keep-alive ping every 15 seconds
        const interval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
          } catch {
            clearInterval(interval);
          }
        }, 15000);

        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });
  }

  // 2. Normal GET (Status & Schema info)
  return NextResponse.json({
    status: 'online',
    protocol: 'Model Context Protocol (MCP)',
    version: '2024-11-05',
    server: 'mazar-booking-mcp',
    transport: 'HTTP / SSE (Remote MCP)',
    mcpServerUrl: 'https://mazarstudio.com/api/mcp',
    toolsCount: TOOLS.length,
    tools: TOOLS.map(t => ({ name: t.name, description: t.description }))
  }, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support single request or batch requests
    const isBatch = Array.isArray(body);
    const requests = isBatch ? body : [body];
    const responses: any[] = [];

    for (const r of requests) {
      const { id, method, params } = r || {};

      if (method === 'initialize') {
        responses.push({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'mazar-booking-mcp',
              version: '1.0.0'
            }
          }
        });
      } else if (method === 'notifications/initialized') {
        // Notification, no result needed or return ack
        if (id !== undefined) {
          responses.push({ jsonrpc: '2.0', id, result: {} });
        }
      } else if (method === 'ping') {
        responses.push({ jsonrpc: '2.0', id, result: {} });
      } else if (method === 'tools/list') {
        responses.push({
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        });
      } else if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const toolResult = await executeTool(toolName, toolArgs);
          responses.push({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(toolResult, null, 2)
                }
              ],
              isError: false
            }
          });
        } catch (err: any) {
          responses.push({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Error executing ${toolName}: ${err.message}`
                }
              ],
              isError: true
            }
          });
        }
      } else {
        // Unknown method
        if (id !== undefined) {
          responses.push({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          });
        }
      }
    }

    const finalResponse = isBatch ? responses : responses[0];
    return NextResponse.json(finalResponse || { success: true }, { headers: CORS_HEADERS });

  } catch (err: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` }
    }, { status: 400, headers: CORS_HEADERS });
  }
}
