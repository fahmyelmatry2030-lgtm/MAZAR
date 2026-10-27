import { NextRequest } from 'next/server';

export function validateAiApiKey(req: NextRequest): { valid: boolean; error?: string } {
  const configuredKey = process.env.MAZAR_AI_API_KEY || process.env.AI_SECRET_TOKEN || 'mazar_ai_sec_8921f7b0a43';

  // Check Authorization header: Bearer <token>
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === configuredKey) {
      return { valid: true };
    }
  }

  // Check x-api-key header
  const xApiKey = req.headers.get('x-api-key')?.trim();
  if (xApiKey && xApiKey === configuredKey) {
    return { valid: true };
  }

  // Also support query param apiKey for easy browser testing if provided
  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get('apiKey')?.trim() || searchParams.get('key')?.trim();
  if (queryKey && queryKey === configuredKey) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'غير مصرح بالوصول: مفتاح الأمان (API Key / Bearer Token) غير صحيح أو مفقود في ترويسة الطلب'
  };
}
