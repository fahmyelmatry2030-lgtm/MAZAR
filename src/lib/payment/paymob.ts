export interface PaymentOrderRequest {
  bookingId?: string;
  unitName: string;
  amountCents: number; // in piasters (e.g. 3000 EGP = 300000)
  amountEgp: number;
  guestName: string;
  guestEmail?: string;
  guestPhone: string;
  description?: string;
}

export interface PaymentOrderResponse {
  success: boolean;
  paymentUrl?: string;
  orderId?: string | number;
  error?: string;
  mode: 'live' | 'test' | 'mock';
}

/**
 * Paymob Payment Integration Helper
 * Can run in live mode with PAYMOB_API_KEY, or mock mode for preview/testing
 */
export async function createPaymobOrder(req: PaymentOrderRequest): Promise<PaymentOrderResponse> {
  const apiKey = process.env.PAYMOB_API_KEY;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  const iframeId = process.env.PAYMOB_IFRAME_ID || '854123';

  if (!apiKey || !integrationId) {
    // Graceful fallback to interactive preview link
    return {
      success: true,
      mode: 'mock',
      orderId: `MOCK-${Date.now()}`,
      paymentUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=preview_token_for_${req.amountEgp}_egp`
    };
  }

  try {
    // 1. Authentication Request
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const authData = await authRes.json();
    const token = authData.token;
    if (!token) throw new Error('فشل تسجيل الدخول لبوابة الدفع');

    // 2. Order Registration
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: 'false',
        amount_cents: String(req.amountCents),
        currency: 'EGP',
        items: [{
          name: req.unitName || 'حجز فندقي - مزار',
          amount_cents: String(req.amountCents),
          description: req.description || `حجز فندقي للنزيل ${req.guestName}`,
          quantity: '1'
        }]
      }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.id;

    // 3. Payment Key Generation
    const [firstName, ...rest] = req.guestName.split(' ');
    const lastName = rest.join(' ') || 'النزيل';

    const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: String(req.amountCents),
        expiration: 3600,
        order_id: String(orderId),
        billing_data: {
          apartment: 'NA',
          email: req.guestEmail || 'guest@mazar-booking.com',
          floor: 'NA',
          first_name: firstName,
          street: 'NA',
          building: 'NA',
          phone_number: req.guestPhone || '+201000000000',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          last_name: lastName,
          state: 'Cairo'
        },
        currency: 'EGP',
        integration_id: Number(integrationId),
        lock_order_when_paid: 'true'
      }),
    });

    const keyData = await keyRes.json();
    const paymentToken = keyData.token;

    return {
      success: true,
      mode: 'live',
      orderId,
      paymentUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`
    };

  } catch (err: any) {
    console.error('[PAYMOB] Error creating order:', err);
    return {
      success: false,
      mode: 'live',
      error: err.message || 'حدث خطأ في إنشاء رابط الدفع الإلكتروني'
    };
  }
}
