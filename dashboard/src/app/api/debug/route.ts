import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Sirve la última captura/HTML de depuración del scraper:
//   /api/debug        -> debug.png
//   /api/debug?type=html -> debug.html (como texto plano)
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") === "html" ? "html" : "png";
  const file = path.resolve(process.cwd(), "../backend/.jobs", `debug.${type}`);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "No hay captura de depuración todavía" }, { status: 404 });
  }
  const data = fs.readFileSync(file);
  return new NextResponse(data, {
    headers: {
      "Content-Type": type === "png" ? "image/png" : "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
