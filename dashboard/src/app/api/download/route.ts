import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("id");
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const resultadosDir = path.resolve(process.cwd(), "../resultados");
  const filePath = path.join(resultadosDir, `${jobId}.xlsx`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Archivo no encontrado. Espera a que termine la extracción." }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${jobId}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
