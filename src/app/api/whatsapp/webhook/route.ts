import { NextRequest, NextResponse } from 'next/server';
import { chatWithMazarClaude } from '@/lib/ai/claude-agent';

export const dynamic = 'force-dynamic';

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

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
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
    else if (body.data && body.data.body) {
      senderPhone = body.data.from;
      incomingText = body.data.body;
    } 
    // 3. Make.com / n8n / Custom direct JSON
    else {
      senderPhone = body.phone || body.from || body.sender || '';
      incomingText = body.message || body.text || body.body || '';
    }

    if (!incomingText) {
      return NextResponse.json({ success: true, note: 'No text message to process' });
    }

    console.log(`[WHATSAPP INCOMING] From: ${senderPhone} | Message: ${incomingText}`);

    // Call Claude AI Agent
    const aiReply = await chatWithMazarClaude(incomingText);
    console.log(`[CLAUDE REPLY] To: ${senderPhone} | Reply: ${aiReply}`);

    // Optional: Auto-reply via Meta Graph API if credentials exist
    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (whatsappToken && phoneId && senderPhone) {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: senderPhone,
            type: 'text',
            text: { body: aiReply }
          })
        });
      } catch (sendErr) {
        console.error('[WHATSAPP SEND ERROR]', sendErr);
      }
    }

    return NextResponse.json({
      success: true,
      from: senderPhone,
      incomingMessage: incomingText,
      reply: aiReply
    });

  } catch (err: any) {
    console.error('[WHATSAPP WEBHOOK ERROR]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
