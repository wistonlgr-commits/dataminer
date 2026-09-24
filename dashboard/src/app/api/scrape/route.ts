import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const { query, precision = 2 } = await req.json();
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const backendDir = path.resolve(process.cwd(), "../backend");
    
    // Detect OS for python path
    const isWindows = process.platform === "win32";
    const pythonExec = isWindows 
      ? path.join(backendDir, "venv", "Scripts", "python.exe")
      : path.join(backendDir, "venv", "bin", "python");
      
    const scriptPath = path.join(backendDir, "scrape_search.py");

    // Crear un ID seguro y corto para evitar el error ENAMETOOLONG del sistema operativo
    const firstLine = query.split('\n')[0].trim().replace(/[^a-zA-Z0-9_ ]/g, '');
    const shortPrefix = firstLine.substring(0, 40).replace(/\s+/g, '_').toLowerCase();
    const uniqueHash = Math.random().toString(36).substring(2, 8);
    const jobId = `${shortPrefix}_batch_${uniqueHash}`;

    const jobsDir = path.join(backendDir, ".jobs");
    if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir, { recursive: true });
    
    const jobFile = path.join(jobsDir, `${jobId}.json`);
    
    // Obtener el usuario actual
    const userCookie = req.cookies.get('scrapeflow_auth');
    const user = userCookie?.value || 'unknown';
    
    // Initial Job State
    const jobState = {
      user: user,
      status: "running",
      progress: 0,
      found: 0,
      logs: [] as string[],
      query: query,
      pid: 0
    };

    const child = spawn(pythonExec, [scriptPath, query, String(precision), jobId], { cwd: backendDir });
    jobState.pid = child.pid || 0;
    fs.writeFileSync(jobFile, JSON.stringify(jobState));

    child.stdout.on("data", (data) => {
      const lines = data.toString().split('\n');
      const currentState = JSON.parse(fs.readFileSync(jobFile, 'utf8'));

      lines.forEach((line: string) => {
        const t = line.trim();
        if (!t) return;

        if (t.startsWith("[PROGRESS]")) {
          currentState.progress = parseInt(t.replace("[PROGRESS]", "").trim());
        } else if (t.startsWith("[FOUND]")) {
          currentState.found = parseInt(t.replace("[FOUND]", "").trim());
        } else if (t.startsWith("[LOG]")) {
          currentState.logs.push(`[${new Date().toLocaleTimeString()}] ${t.replace("[LOG]", "").trim()}`);
          if (currentState.logs.length > 15) currentState.logs.shift();
        } else {
           // Other prints
           currentState.logs.push(`[${new Date().toLocaleTimeString()}] ${t}`);
           if (currentState.logs.length > 15) currentState.logs.shift();
        }
      });
      fs.writeFileSync(jobFile, JSON.stringify(currentState));
    });

    child.stderr.on("data", (data) => {
      const currentState = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      currentState.logs.push(`[ERROR] ${data.toString().trim()}`);
      fs.writeFileSync(jobFile, JSON.stringify(currentState));
    });

    child.on("close", (code) => {
      const currentState = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      currentState.status = code === 0 ? "completed" : "error";
      if (code === 0) currentState.progress = 100;
      currentState.logs.push(`[${new Date().toLocaleTimeString()}] Finalizado con código ${code}`);
      fs.writeFileSync(jobFile, JSON.stringify(currentState));
    });

    return NextResponse.json({ success: true, jobId, query });
  } catch (error) {
    return NextResponse.json({ error: "Failed to start scraping" }, { status: 500 });
  }
}
