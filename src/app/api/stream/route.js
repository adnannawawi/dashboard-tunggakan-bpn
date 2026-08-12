// src/app/api/stream/route.js

export const dynamic = 'force-dynamic'; // Mencegah Next.js melakukan caching pada endpoint ini

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Kirim event pertama saat koneksi terbentuk
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ message: "Connected to SSE stream" })}\n\n`)
      );

      // Simulasi ping/interval kirim data pembaruan tiap 5 detik
      const interval = setInterval(() => {
        const payload = {
          timestamp: new Date().toISOString(),
          // Anda bisa memanggil database/cache di sini untuk cek status terbaru
          status: "active"
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      }, 5000);

      // Hentikan interval jika koneksi terputus dari sisi client
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}