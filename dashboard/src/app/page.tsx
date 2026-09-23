import { FileText, Activity, Download, CheckCircle, Database } from "lucide-react";
import fs from "fs";
import path from "path";

// Forzar Next.js a no cachear esta página para que los datos siempre estén frescos
export const dynamic = 'force-dynamic';

export default async function Home() {
  const backendDir = path.resolve(process.cwd(), "../backend");
  const jobsDir = path.join(backendDir, ".jobs");
  
  let activeJobs = 0;
  let totalFound = 0;
  let totalDataSizeMB = 0;
  let totalJobs = 0;
  let successfulJobs = 0;

  // 1. Leer los trabajos
  if (fs.existsSync(jobsDir)) {
    const jobFiles = fs.readdirSync(jobsDir).filter(f => f.endsWith('.json'));
    totalJobs = jobFiles.length;
    
    for (const file of jobFiles) {
      try {
        const content = fs.readFileSync(path.join(jobsDir, file), 'utf-8');
        const job = JSON.parse(content);
        
        if (job.status === "running") activeJobs++;
        if (job.status === "completed") successfulJobs++;
        
        if (job.found && typeof job.found === 'number') {
          totalFound += job.found;
        }
      } catch (e) {
        // ignorar archivos corruptos
      }
    }
  }

  // 2. Leer el tamaño de los Excel generados
  const resultadosDir = path.resolve(process.cwd(), "../resultados");
  if (fs.existsSync(resultadosDir)) {
    const files = fs.readdirSync(resultadosDir).filter(f => f.endsWith('.xlsx'));
    let totalBytes = 0;
    for (const file of files) {
      const stats = fs.statSync(path.join(resultadosDir, file));
      totalBytes += stats.size;
    }
    totalDataSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
  }

  const successRate = totalJobs > 0 ? ((successfulJobs / totalJobs) * 100).toFixed(1) : "100.0";

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Resumen de tu Cuenta (En Vivo)</h1>
        <p className="text-gray-600 mt-2 text-lg">Monitorea tus extracciones de datos reales y el rendimiento del servidor.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Búsquedas Activas</h3>
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-4xl font-black text-gray-900">{activeJobs}</p>
          <p className="text-sm text-green-600 mt-2 font-medium flex items-center">
            {activeJobs > 0 ? (
              <><span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span> Procesando ahora</>
            ) : (
              <span className="text-gray-500">Todo en calma</span>
            )}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Archivos Generados</h3>
            <Download className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-4xl font-black text-gray-900">{totalDataSizeMB} MB</p>
          <p className="text-sm text-gray-600 mt-2 font-medium">De Excel almacenado</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Registros Obtenidos</h3>
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-4xl font-black text-gray-900">{totalFound}</p>
          <p className="text-sm text-gray-600 mt-2 font-medium">Negocios extraídos</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tasa de Éxito</h3>
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-4xl font-black text-gray-900">{successRate}%</p>
          <p className="text-sm text-gray-600 mt-2 font-medium">{successfulJobs} trabajos completados</p>
        </div>
      </div>

      {/* Explicación Visual o Bienvenida */}
      {totalJobs === 0 ? (
        <div className="bg-indigo-50 p-8 rounded-xl border border-indigo-100 flex items-start shadow-sm">
          <Database className="w-12 h-12 text-indigo-600 mr-6 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-indigo-900 mb-2">¡Bienvenido a ScrapeFlow!</h2>
            <p className="text-indigo-800 text-lg mb-4">
              Tu motor de extracción de Google Maps está listo. Aún no has realizado ninguna búsqueda.
            </p>
            <a href="/jobs" className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
              Crear tu primera búsqueda →
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 p-8 rounded-xl border border-blue-100 flex items-start">
          <Database className="w-12 h-12 text-blue-600 mr-6 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-blue-900 mb-2">¡Tu Motor está Operativo!</h2>
            <p className="text-blue-800 text-lg">
              Estas estadísticas están conectadas directamente a tu servidor leyendo cada trabajo completado y cada Megabyte generado por Python en tiempo real. 
              Dirígete a <strong>"Nueva Búsqueda"</strong> para seguir alimentando la base de datos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
