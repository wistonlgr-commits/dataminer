import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("id");
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const resultadosDir = path.resolve(process.cwd(), "../resultados");
  const filePath = path.join(resultadosDir, `${jobId}.xlsx`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Excel no encontrado", data: [] }, { status: 404 });
  }

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Convert to json
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: "Error reading Excel" }, { status: 500 });
  }
}
