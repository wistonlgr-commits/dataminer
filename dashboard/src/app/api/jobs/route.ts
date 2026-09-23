import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const backendDir = path.resolve(process.cwd(), "../backend");
  const jobsDir = path.join(backendDir, ".jobs");

  if (!fs.existsSync(jobsDir)) {
    return NextResponse.json({ jobs: [] });
  }

  const jobFiles = fs.readdirSync(jobsDir).filter(f => f.endsWith('.json'));
  const jobs = [];

  for (const file of jobFiles) {
    try {
      const content = fs.readFileSync(path.join(jobsDir, file), 'utf-8');
      const job = JSON.parse(content);
      
      // Calculate file modification time to sort them
      const stats = fs.statSync(path.join(jobsDir, file));
      
      jobs.push({
        id: file.replace('.json', ''),
        query: job.query,
        status: job.status,
        progress: job.progress,
        found: job.found,
        updatedAt: stats.mtimeMs
      });
    } catch (e) {}
  }

  // Sort by most recent first
  jobs.sort((a, b) => b.updatedAt - a.updatedAt);

  return NextResponse.json({ jobs });
}
