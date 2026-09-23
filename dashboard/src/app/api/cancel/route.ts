import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const { jobId: decodedId } = await req.json();
  if (!decodedId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  const jobId = encodeURIComponent(decodedId);
  const backendDir = path.resolve(process.cwd(), "../backend");
  const jobFile = path.join(backendDir, ".jobs", `${jobId}.json`);

  if (!fs.existsSync(jobFile)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const jobState = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  
  if (jobState.status === "running" && jobState.pid) {
    try {
      const treeKill = require("tree-kill");
      treeKill(jobState.pid, 'SIGKILL', (err: any) => {
        if (err) console.log("Error killing process tree", err);
      });
    } catch (e) {
      console.log("Error requiring tree-kill", e);
      try { process.kill(jobState.pid); } catch(e2) {}
    }
    jobState.status = "error";
    jobState.logs.push(`[${new Date().toLocaleTimeString()}] Búsqueda cancelada por el usuario.`);
    fs.writeFileSync(jobFile, JSON.stringify(jobState));
    return NextResponse.json({ success: true, message: "Killed" });
  }

  return NextResponse.json({ success: false, message: "Not running" });
}
