import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = body.ids || (body.id ? [body.id] : []);
    
    if (ids.length === 0) return NextResponse.json({ error: "Missing job ids" }, { status: 400 });

    const backendDir = path.resolve(process.cwd(), "../backend");
    const resultadosDir = path.resolve(process.cwd(), "../resultados");
    
    for (const id of ids) {
      // Delete the state JSON file
      const jobFile = path.join(backendDir, ".jobs", `${id}.json`);
      if (fs.existsSync(jobFile)) {
        fs.unlinkSync(jobFile);
      }

      // Delete the excel file
      const excelFile = path.join(resultadosDir, `${id}.xlsx`);
      if (fs.existsSync(excelFile)) {
        fs.unlinkSync(excelFile);
      }
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
