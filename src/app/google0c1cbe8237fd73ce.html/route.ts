export async function GET() {
  return new Response('google-site-verification: google0c1cbe8237fd73ce.html', {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
