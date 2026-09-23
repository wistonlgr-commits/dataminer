import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const decodedId = req.nextUrl.searchParams.get("id");
  if (!decodedId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  // The filename on disk was saved using encodeURIComponent
  const jobId = encodeURIComponent(decodedId);
  const backendDir = path.resolve(process.cwd(), "../backend");
  const jobFile = path.join(backendDir, ".jobs", `${jobId}.json`);

  if (!fs.existsSync(jobFile)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const jobState = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  return NextResponse.json(jobState);
}
