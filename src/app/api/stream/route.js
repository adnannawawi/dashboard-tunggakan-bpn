// src/app/api/stream/route.js

let latestData = [];
let clients = [];

// Header CORS agar diizinkan oleh domain ATR/BPN
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 1. Handle Preflight Request (Sangat penting untuk mengatasi CORS error)
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// 2. SSE Stream Get
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      clients.push(controller);

      if (latestData.length > 0) {
        const initialPayload = `data: ${JSON.stringify({ data: latestData })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialPayload));
      }

      return () => {
        clients = clients.filter((c) => c !== controller);
      };
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// 3. Receive Data via POST
export async function POST(req) {
  try {
    const body = await req.json();
    const dataArray = Array.isArray(body) ? body : body.data || [];

    if (dataArray.length > 0) {
      latestData = dataArray;

      const payload = `data: ${JSON.stringify({
        data: latestData,
        lastUpdated: new Date().toLocaleString("id-ID")
      })}\n\n`;

      clients.forEach((client) => {
        try {
          client.enqueue(new TextEncoder().encode(payload));
        } catch (e) {}
      });

      return Response.json(
        { success: true, count: latestData.length },
        { headers: corsHeaders }
      );
    }

    return Response.json(
      { success: false, message: "Data kosong" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}