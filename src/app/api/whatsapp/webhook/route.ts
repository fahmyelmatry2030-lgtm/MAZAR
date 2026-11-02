import { NextRequest, NextResponse } from 'next/server';
import { getDbWhatsAppSettings } from '@/lib/actions/db';
import { DEFAULT_WHATSAPP_SETTINGS } from '@/data/whatsappMessages';

export const dynamic = 'force-dynamic';

// In-memory tracker for phones that have received the welcome greeting
// Tracks phone -> timestamp of when greeting was sent
const greetedPhonesMap = new Map<string, number>();
const GREETING_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Helper to sleep between messages for natural delivery
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

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
async function checkCustomerInactivity(instanceId: string, token: string, phone: string, thresholdDays: number): Promise<{ isFirstTime: boolean; isInactiveOverDays: boolean; daysSinceLast: number; hasExistingMessages: boolean }> {
  try {
    const chatId = `${phone}@c.us`;
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/chats/messages?token=${token}&chatId=${encodeURIComponent(chatId)}&limit=15`);
    const messages = await res.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return { isFirstTime: true, isInactiveOverDays: true, daysSinceLast: 999, hasExistingMessages: false };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    // Find previous messages excluding any message received in the last 15 seconds
    const prevMessages = messages.filter((m: any) => (nowSeconds - (m.timestamp || 0)) > 15);

    if (prevMessages.length === 0) {
      return { isFirstTime: true, isInactiveOverDays: true, daysSinceLast: 999, hasExistingMessages: false };
    }

    const latestPrev = prevMessages[0];
    const diffSeconds = Math.max(0, nowSeconds - (latestPrev.timestamp || 0));
    const daysSinceLast = diffSeconds / 86400;

    return {
      isFirstTime: false,
      isInactiveOverDays: daysSinceLast >= thresholdDays,
      daysSinceLast: Math.round(daysSinceLast * 10) / 10,
      hasExistingMessages: true,
    };
  } catch (err: any) {
    console.warn('[ULTRAMSG HISTORY CHECK FAILED]', err.message);
    // On error, rely on in-memory map
    return { isFirstTime: false, isInactiveOverDays: false, daysSinceLast: 0, hasExistingMessages: true };
  }
}

// Webhook Verification & Health Check
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
    service: 'Mazar WhatsApp Auto-Reply System (Welcome Messages Only - Strict Silence Afterward)',
    enabled: settings.enabled,
    inactivityThresholdDays: settings.inactivityDays,
    messagesCount: settings.messages.length,
    greetedPhonesTracked: greetedPhonesMap.size
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

    console.log(`[WHATSAPP INCOMING] From: ${senderPhone} | Text: "${incomingText}"`);

    // Fetch dynamic settings from DB
    const settings = await getDbWhatsAppSettings();

    if (!settings.enabled) {
      console.log('[WHATSAPP BOT] Bot is disabled in settings. Skipping.');
      return NextResponse.json({ success: true, note: 'Bot currently disabled in settings' });
    }

    const now = Date.now();
    const thresholdDays = settings.inactivityDays || 30;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    // --------------------------------------------------------------------------
    // RULE 1: IN-MEMORY CHECK - HAS THIS CUSTOMER ALREADY BEEN GREETED?
    // Once the welcome messages are sent, the bot FREEZES completely for this customer!
    // No follow-up bot messages, no handover messages. Human team takes over.
    // --------------------------------------------------------------------------
    const lastGreetedAt = greetedPhonesMap.get(senderPhone) || 0;
    if (now - lastGreetedAt < thresholdMs) {
      console.log(`[WHATSAPP BOT SILENT] Customer ${senderPhone} already received welcome messages. Bot remains 100% silent.`);
      return NextResponse.json({
        success: true,
        action: 'bot_silent_already_greeted',
        note: 'Customer already received welcome messages. Human management handles all subsequent messages.'
      });
    }

    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID || 'instance195641';
    const ultraToken = process.env.ULTRAMSG_TOKEN || 'dqgr70zrc62t8lrr';

    // --------------------------------------------------------------------------
    // RULE 2: HISTORICAL CHAT CHECK IN ULTRAMSG
    // If the customer has an active ongoing chat with Mazar within the last 30 days:
    // DO NOT SEND the welcome messages! Keep the bot silent.
    // --------------------------------------------------------------------------
    const inactivityInfo = await checkCustomerInactivity(
      ultraInstance,
      ultraToken,
      senderPhone,
      thresholdDays
    );

    // Active customer within the threshold -> DO NOT send messages
    if (!inactivityInfo.isFirstTime && !inactivityInfo.isInactiveOverDays) {
      console.log(`[WHATSAPP ACTIVE CHAT] Customer ${senderPhone} active within last ${inactivityInfo.daysSinceLast} days. Bot stays silent.`);
      // Update in-memory tracker so subsequent requests are fast
      greetedPhonesMap.set(senderPhone, now);
      return NextResponse.json({
        success: true,
        action: 'skip_active_customer',
        note: `Customer active within last ${inactivityInfo.daysSinceLast} days (< ${thresholdDays} threshold). Bot stays silent.`
      });
    }

    // --------------------------------------------------------------------------
    // RULE 3: DISPATCH WELCOME MESSAGES (ONLY ONCE)
    // Sent ONLY to new customers or customers inactive for >= 30 days.
    // After this, the bot NEVER replies again to this customer!
    // --------------------------------------------------------------------------
    greetedPhonesMap.set(senderPhone, now);

    const messagesToSend = (Array.isArray(settings.messages) && settings.messages.length > 0)
      ? settings.messages
      : DEFAULT_WHATSAPP_SETTINGS.messages;

    const sendResults = [];
    console.log(`[WHATSAPP DISPATCHING ${messagesToSend.length} WELCOME MESSAGES] To ${senderPhone}`);

    for (let i = 0; i < messagesToSend.length; i++) {
      const msgText = messagesToSend[i];

      // Delay between messages for natural feel
      if (i > 0) {
        await sleep(settings.delayBetweenMessagesMs || 1500);
      }

      const res = await sendViaUltraMsg(ultraInstance, ultraToken, senderPhone, msgText);
      sendResults.push({ msgIndex: i + 1, ...res });
    }

    console.log(`[WHATSAPP WELCOME COMPLETED] Sent ${messagesToSend.length} messages to ${senderPhone}. Bot is now permanently silent for this conversation.`);

    return NextResponse.json({
      success: true,
      action: 'welcome_messages_sent',
      recipient: senderPhone,
      isFirstTime: inactivityInfo.isFirstTime,
      daysSinceLast: inactivityInfo.daysSinceLast,
      messagesSentCount: messagesToSend.length,
      details: sendResults,
      note: 'Welcome messages delivered. Bot is now completely silent; human team handles all replies and video dispatch.'
    });

  } catch (err: any) {
    console.error('[WHATSAPP WEBHOOK ERROR]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
