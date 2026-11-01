import { NextRequest, NextResponse } from 'next/server';
import { MAZAR_WHATSAPP_AUTO_REPLIES } from '@/data/whatsappMessages';

export const dynamic = 'force-dynamic';

// In-memory cooldown tracker to avoid spamming the same customer if they send multiple messages in a row
// Stores phone -> timestamp
const lastRepliedMap = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes cooldown per customer

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

// Helper to send message via Meta WhatsApp Cloud API (if used)
async function sendViaMeta(token: string, phoneId: string, toPhone: string, text: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: text }
      })
    });
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('[META SEND ERROR]', err.message);
    return { success: false, error: err.message };
  }
}

// Webhook Verification (Meta WhatsApp Cloud API Requirement)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mazar_whatsapp_verify_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WHATSAPP WEBHOOK] Verified successfully!');
    return new NextResponse(challenge, { status: 200 });
  }

  // Also allow GET status check
  return NextResponse.json({
    status: 'online',
    service: 'Mazar WhatsApp Auto-Reply System',
    messagesConfigured: MAZAR_WHATSAPP_AUTO_REPLIES.length,
    cooldownMinutes: 60
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
    // 2. UltraMsg / Generic Webhook Format
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
      return NextResponse.json({ success: true, note: 'No message to reply to' });
    }

    console.log(`[WHATSAPP INCOMING] From: ${senderPhone} | Message: ${incomingText}`);

    // Check cooldown for this phone number
    const now = Date.now();
    const lastReplied = lastRepliedMap.get(senderPhone) || 0;
    if (now - lastReplied < COOLDOWN_MS) {
      console.log(`[WHATSAPP COOLDOWN] Skipped auto-reply for ${senderPhone} (Already greeted recently)`);
      return NextResponse.json({ 
        success: true, 
        status: 'cooldown_active', 
        note: 'Customer already received welcome messages recently' 
      });
    }

    // Mark as replied
    lastRepliedMap.set(senderPhone, now);

    // Credentials
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID || 'instance195641';
    const ultraToken = process.env.ULTRAMSG_TOKEN || 'dqgr70zrc62t8lrr';
    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Send the 3 official Mazar messages sequentially with 1.5s delay
    const sendResults = [];

    for (let i = 0; i < MAZAR_WHATSAPP_AUTO_REPLIES.length; i++) {
      const msgText = MAZAR_WHATSAPP_AUTO_REPLIES[i];

      // Delay between messages for realistic delivery
      if (i > 0) {
        await sleep(1500);
      }

      if (ultraInstance && ultraToken) {
        const res = await sendViaUltraMsg(ultraInstance, ultraToken, senderPhone, msgText);
        sendResults.push({ msgIndex: i + 1, ...res });
      } else if (whatsappToken && phoneId) {
        const res = await sendViaMeta(whatsappToken, phoneId, senderPhone, msgText);
        sendResults.push({ msgIndex: i + 1, ...res });
      }
    }

    console.log(`[WHATSAPP 3-MESSAGES SENT] Successfully dispatched to ${senderPhone}`);

    return NextResponse.json({
      success: true,
      recipient: senderPhone,
      messagesSentCount: MAZAR_WHATSAPP_AUTO_REPLIES.length,
      details: sendResults
    });

  } catch (err: any) {
    console.error('[WHATSAPP WEBHOOK ERROR]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
