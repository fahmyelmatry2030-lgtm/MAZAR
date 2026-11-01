import { NextRequest, NextResponse } from 'next/server';
import { getDbWhatsAppSettings } from '@/lib/actions/db';
import { DEFAULT_WHATSAPP_SETTINGS } from '@/data/whatsappMessages';

export const dynamic = 'force-dynamic';

// In-memory cooldown tracker to avoid spamming if a user types multiple messages in 10 minutes
const lastGreetingSentMap = new Map<string, number>();
const GREETING_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes cooldown

// Helper to sleep between messages for natural delivery
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper to normalize Arabic text for keyword matching
function normalizeText(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, ''); // strip Arabic tashkeel/diacritics
}

// 1. Thank-you / Closing keywords (Bot must stay completely silent)
const THANK_YOU_REGEX = /(شكرا|تسلم|تسلملي|الف شكر|حبيبي تسلم|ثانكس|thanks|thank you|تمام تسلم|جزاك الله خيرا|بارك الله فيك|تسلم يا غالي|تسلم ايدك|تسلم يارب)/;

// 2. Booking Intent / Video Request / Number of Persons (Trigger handover message)
const BOOKING_INTENT_REGEX = /(عايز احجز|عاوز احجز|محتاج احجز|احجزلي|احجز|حجز|فيديو|ابعتلي فيديو|عايز فيديو|شخصين|فردين|افراد|اشخاص|كام فرد|بكام|الاسعار|سعر|متاح|في متاح|فاضي|يوم \d+|تاريخ|كام السعر|احجز ازاي|نحجز ازاي)/;

// Helper to send message via UltraMsg
async function sendViaUltraMsg(instanceId: string, token: string, toPhone: string, text: string) {
  try {
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        to: toPhone,
        body: text
      })
    });
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('[ULTRAMSG ERROR]', err.message);
    return { success: false, error: err.message };
  }
}

// Helper to check user chat history in UltraMsg (determines if new or inactive >= 30 days)
async function checkCustomerInactivity(instanceId: string, token: string, phone: string, thresholdDays: number): Promise<{ isFirstTime: boolean; isInactiveOverDays: boolean; daysSinceLast: number }> {
  try {
    const chatId = `${phone}@c.us`;
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/chats/messages?token=${token}&chatId=${encodeURIComponent(chatId)}&limit=10`);
    const messages = await res.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return { isFirstTime: true, isInactiveOverDays: true, daysSinceLast: 999 };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    // Find the latest previous message (ignore messages sent in the last 15 seconds)
    const prevMessages = messages.filter((m: any) => (nowSeconds - (m.timestamp || 0)) > 15);

    if (prevMessages.length === 0) {
      return { isFirstTime: true, isInactiveOverDays: true, daysSinceLast: 999 };
    }

    const latestPrev = prevMessages[0];
    const diffSeconds = Math.max(0, nowSeconds - (latestPrev.timestamp || 0));
    const daysSinceLast = diffSeconds / 86400;

    return {
      isFirstTime: false,
      isInactiveOverDays: daysSinceLast >= thresholdDays,
      daysSinceLast: Math.round(daysSinceLast * 10) / 10,
    };
  } catch (err: any) {
    console.warn('[ULTRAMSG HISTORY CHECK FAILED]', err.message);
    // Safe fallback: treat as first time to ensure customer gets service
    return { isFirstTime: true, isInactiveOverDays: true, daysSinceLast: 999 };
  }
}

// Webhook Verification (Meta WhatsApp Cloud API Requirement) & Health Check
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mazar_whatsapp_verify_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  const settings = await getDbWhatsAppSettings();

  return NextResponse.json({
    status: 'online',
    service: 'Mazar WhatsApp Auto-Reply & Handover System',
    enabled: settings.enabled,
    inactivityThresholdDays: settings.inactivityDays,
    messagesCount: settings.messages.length,
    transferMessageConfigured: !!settings.transferMessage,
  });
}

// Inbound Message Handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let senderPhone = '';
    let incomingText = '';

    // 1. Meta WhatsApp Cloud API Payload Format
    if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value?.messages) {
      const msg = body.entry[0].changes[0].value.messages[0];
      senderPhone = msg.from;
      incomingText = msg.text?.body || '';
    } 
    // 2. UltraMsg Format
    else if (body.data && (body.data.body || body.data.caption)) {
      // Don't reply to our own outgoing messages
      if (body.data.fromMe === true) {
        return NextResponse.json({ success: true, note: 'Skipping outgoing message from bot' });
      }

      // Ignore group chats (@g.us) to prevent spamming groups
      if (body.data.from && body.data.from.includes('@g.us')) {
        return NextResponse.json({ success: true, note: 'Skipping group message' });
      }

      senderPhone = body.data.from?.replace('@c.us', '') || body.data.from;
      incomingText = body.data.body || body.data.caption || '';
    } 
    // 3. Make.com / n8n / Custom direct JSON
    else {
      senderPhone = body.phone || body.from || body.sender || '';
      incomingText = body.message || body.text || body.body || '';
    }

    if (!senderPhone || !incomingText) {
      return NextResponse.json({ success: true, note: 'No message to process' });
    }

    const cleanIncoming = normalizeText(incomingText);
    console.log(`[WHATSAPP INCOMING] From: ${senderPhone} | Text: "${incomingText}"`);

    // Fetch dynamic settings from DB
    const settings = await getDbWhatsAppSettings();

    if (!settings.enabled) {
      console.log('[WHATSAPP BOT] Bot is disabled in settings. Skipping.');
      return NextResponse.json({ success: true, note: 'Bot currently disabled in settings' });
    }

    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID || 'instance195641';
    const ultraToken = process.env.ULTRAMSG_TOKEN || 'dqgr70zrc62t8lrr';

    // -------------------------------------------------------------
    // RULE 1: THANK YOU / CLOSING WORDS -> STAY COMPLETELY SILENT
    // -------------------------------------------------------------
    if (THANK_YOU_REGEX.test(cleanIncoming)) {
      console.log(`[WHATSAPP SILENT] Detected thank you / close from ${senderPhone}. Staying silent.`);
      return NextResponse.json({
        success: true,
        action: 'silent_thank_you',
        note: 'Customer expressed thanks or closed conversation. Bot remained silent.'
      });
    }

    // -------------------------------------------------------------
    // RULE 2: BOOKING INTENT / VIDEO REQUEST / PERSONS COUNT
    // -> Send Handover Message and then stay silent
    // -------------------------------------------------------------
    if (BOOKING_INTENT_REGEX.test(cleanIncoming)) {
      console.log(`[WHATSAPP HANDOVER] Booking intent detected from ${senderPhone}. Sending handover message.`);
      const handoverText = settings.transferMessage || DEFAULT_WHATSAPP_SETTINGS.transferMessage;
      
      const sendRes = await sendViaUltraMsg(ultraInstance, ultraToken, senderPhone, handoverText);
      return NextResponse.json({
        success: true,
        action: 'transferred_to_agent',
        sentMessage: handoverText,
        details: sendRes
      });
    }

    // -------------------------------------------------------------
    // RULE 3: 3 WELCOME MESSAGES ELIGIBILITY CHECK
    // Only sent if:
    //  a) First time customer EVER
    //  OR
    //  b) Inactive for >= inactivityDays (Default: 30 days)
    // -------------------------------------------------------------
    const inactivityInfo = await checkCustomerInactivity(
      ultraInstance,
      ultraToken,
      senderPhone,
      settings.inactivityDays || 30
    );

    // If customer has an ongoing active chat within the last 30 days -> DO NOT SEND 3 MESSAGES
    if (!inactivityInfo.isFirstTime && !inactivityInfo.isInactiveOverDays) {
      console.log(`[WHATSAPP ACTIVE CHAT] Customer ${senderPhone} active within last ${inactivityInfo.daysSinceLast} days. Skipping 3 greeting messages.`);
      return NextResponse.json({
        success: true,
        action: 'skip_active_customer',
        note: `Customer active within last ${inactivityInfo.daysSinceLast} days (< ${settings.inactivityDays} threshold). No spam sent.`
      });
    }

    // Check recent in-memory cooldown to prevent repeat within the hour
    const now = Date.now();
    const lastGreeting = lastGreetingSentMap.get(senderPhone) || 0;
    if (now - lastGreeting < GREETING_COOLDOWN_MS) {
      console.log(`[WHATSAPP COOLDOWN] Greeting already sent to ${senderPhone} recently.`);
      return NextResponse.json({
        success: true,
        action: 'cooldown_active',
        note: '3 messages already sent within the last hour'
      });
    }

    // Mark as greeted
    lastGreetingSentMap.set(senderPhone, now);

    // Send the 3 official Mazar messages sequentially
    const messagesToSend = settings.messages.length > 0 ? settings.messages : DEFAULT_WHATSAPP_SETTINGS.messages;
    const sendResults = [];

    console.log(`[WHATSAPP DISPATCHING 3 MESSAGES] To ${senderPhone} (isFirstTime: ${inactivityInfo.isFirstTime}, daysSinceLast: ${inactivityInfo.daysSinceLast})`);

    for (let i = 0; i < messagesToSend.length; i++) {
      const msgText = messagesToSend[i];

      // Delay between messages for natural feel
      if (i > 0) {
        await sleep(settings.delayBetweenMessagesMs || 1500);
      }

      const res = await sendViaUltraMsg(ultraInstance, ultraToken, senderPhone, msgText);
      sendResults.push({ msgIndex: i + 1, ...res });
    }

    return NextResponse.json({
      success: true,
      action: '3_messages_sent',
      recipient: senderPhone,
      isFirstTime: inactivityInfo.isFirstTime,
      daysSinceLast: inactivityInfo.daysSinceLast,
      messagesSentCount: messagesToSend.length,
      details: sendResults
    });

  } catch (err: any) {
    console.error('[WHATSAPP WEBHOOK ERROR]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
