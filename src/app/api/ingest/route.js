import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Jalur penyimpanan file JSON di folder internal proyek
const filePath = path.join(process.cwd(), "data_berkas_cache.json");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Tangkap data array dan timestamp dari request body
    const incomingData = Array.isArray(body) ? body : body.data || [];
    const incomingTimestamp = body.lastUpdated || `${new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB`;

    if (!incomingData || incomingData.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data kosong" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Struktur payload yang disimpan ke file cache
    const payloadToSave = {
      data: incomingData,
      lastUpdated: incomingTimestamp,
    };

    // Simpan data & timestamp secara permanen ke file JSON
    fs.writeFileSync(filePath, JSON.stringify(payloadToSave, null, 2), "utf-8");

    return NextResponse.json(
      { 
        success: true, 
        message: "Data berhasil disimpan permanen!", 
        count: incomingData.length,
        lastUpdated: incomingTimestamp 
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  try {
    // BACA data dan timestamp dari file tersimpan jika ada
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, "utf-8");
      const parsedContent = JSON.parse(fileData);

      // Mendukung format file lama (array) maupun format baru ({ data, lastUpdated })
      if (Array.isArray(parsedContent)) {
        return NextResponse.json(
          { success: true, data: parsedContent, lastUpdated: "" },
          { headers: corsHeaders }
        );
      }

      return NextResponse.json(
        { 
          success: true, 
          data: parsedContent.data || [], 
          lastUpdated: parsedContent.lastUpdated || "" 
        },
        { headers: corsHeaders }
      );
    }
    
    return NextResponse.json({ success: true, data: [], lastUpdated: "" }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], lastUpdated: "" }, { headers: corsHeaders });
  }
}