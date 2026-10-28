import { NextRequest, NextResponse } from 'next/server';
import { chatWithMazarClaude } from '@/lib/ai/claude-agent';
import { validateAiApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Validate Security Key
  const auth = validateAiApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({
      success: false,
      error: auth.error || 'Unauthorized: API Key required'
    }, { status: 401 });
  }

  try {
    const body = await req.json();
    const userMessage = String(body.message || body.text || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!userMessage) {
      return NextResponse.json({
        success: false,
        error: 'يرجى تقديم نص الرسالة (message)'
      }, { status: 400 });
    }

    const reply = await chatWithMazarClaude(userMessage, history);

    return NextResponse.json({
      success: true,
      userMessage,
      reply
    });

  } catch (error: any) {
    console.error('[API /api/ai/chat] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'حدث خطأ في محادثة كلود'
    }, { status: 500 });
  }
}
