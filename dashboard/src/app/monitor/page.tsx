"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Terminal, StopCircle, CheckCircle, FileText, Download, AlertTriangle, Table as TableIcon, Star, X, Trash2, AlertCircle, MessageCircle, ExternalLink, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Custom Confirm Modal Component (replaces browser confirm())
function ConfirmModal({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function MonitorContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const jobId = searchParams.get('id');
  
  const [logs, setLogs] = useState<string[]>(["Conectando con el motor del servidor..."]);
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState(0);
  const [status, setStatus] = useState("running");
  
  const [activeTab, setActiveTab] = useState<"terminal" | "resultados">("terminal");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  // Custom confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: "", message: "", onConfirm: () => {}
  });
  const closeModal = useCallback(() => setConfirmModal(prev => ({ ...prev, open: false })), []);

  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      if (status !== "running") return;
      
      try {
        const res = await fetch(`/api/status?id=${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data.progress);
          setFound(data.found);
          setLogs(data.logs.length ? data.logs : ["Esperando logs..."]);
          if (data.status !== "running") {
            setStatus(data.status);
            clearInterval(interval);
          }
        }
      } catch (e) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, status]);

  useEffect(() => {
    if (status === "completed" && jobId) {
      fetch(`/api/jobs/preview?id=${jobId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setPreviewData(data.data);
        })
        .catch(console.error);
    }
  }, [status, jobId]);

  const handleCancel = () => {
    setConfirmModal({
      open: true,
      title: "Detener búsqueda",
      message: "¿Seguro que deseas pausar y cancelar esta búsqueda? Esta acción no se puede deshacer.",
      onConfirm: async () => {
        closeModal();
        setStatus("canceling");
        await fetch('/api/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId })
        });
        setStatus("error");
      }
    });
  };

  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!jobId) {
      fetch('/api/jobs')
        .then(res => res.json())
        .then(data => setRecentJobs(data.jobs))
        .catch(console.error);
    }
  }, [jobId]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    setConfirmModal({
      open: true,
      title: "Eliminar búsqueda",
      message: "¿Seguro que deseas borrar esta búsqueda y su Excel asociado? Los datos se perderán permanentemente.",
      onConfirm: async () => {
        closeModal();
        await fetch('/api/jobs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] })
        });
        setRecentJobs(prev => prev.filter(job => job.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      open: true,
      title: "Eliminar seleccionados",
      message: `¿Seguro que deseas borrar las ${selectedIds.size} búsquedas seleccionadas y sus archivos Excel? Esta acción es irreversible.`,
      onConfirm: async () => {
        closeModal();
        const idsToDelete = Array.from(selectedIds);
        await fetch('/api/jobs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete })
        });
        setRecentJobs(prev => prev.filter(job => !selectedIds.has(job.id)));
        setSelectedIds(new Set());
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === recentJobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recentJobs.map(job => job.id)));
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!jobId) {
    const isAllSelected = recentJobs.length > 0 && selectedIds.size === recentJobs.length;

    return (
      <div className="max-w-5xl">
        <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={closeModal} />
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Historial de Búsquedas</h1>
            <p className="text-gray-600">Selecciona una búsqueda reciente para ver su progreso o resultados.</p>
          </div>
          
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              Borrar Seleccionados ({selectedIds.size})
            </button>
          )}
        </div>
        
        {recentJobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No hay búsquedas recientes</h2>
            <Link href="/jobs" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Ir a Nueva Búsqueda</Link>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center gap-4 px-6 py-2">
              <input 
                type="checkbox" 
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-sm font-semibold text-gray-600 cursor-pointer" onClick={toggleSelectAll}>Seleccionar todos</span>
            </div>

            {recentJobs.map(job => (
              <a 
                key={job.id} 
                href={`/monitor?id=${encodeURIComponent(job.id)}&q=${encodeURIComponent(job.query)}`}
                className={`flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 gap-4 bg-white rounded-xl border transition-all group relative ${selectedIds.has(job.id) ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-400 hover:shadow-md'}`}
              >
                <div className="flex items-start md:items-center gap-4 md:gap-6 w-full">
                  <div className="flex items-center pt-1 md:pt-0" onClick={(e) => toggleSelect(e, job.id)}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(job.id)}
                      readOnly
                      className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 md:line-clamp-1 break-words" title={job.query}>
                      {job.query.length > 80 ? job.query.substring(0, 80) + '... (Lote)' : job.query}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-1.5 md:gap-3">
                      <span>{job.found} extraídos</span>
                      <span className="hidden md:inline">•</span>
                      <span className="bg-slate-100 md:bg-transparent px-2 py-0.5 md:p-0 rounded-md">{job.progress}%</span>
                      {job.updatedAt && (
                        <>
                          <span className="hidden md:inline">•</span>
                          <span className="text-slate-400">Hace {Math.max(1, Math.round((Date.now() - new Date(job.updatedAt).getTime()) / 60000))} min</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 md:gap-4 pl-9 md:pl-0 w-full md:w-auto mt-2 md:mt-0">
                  <span className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap ${
                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'running' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {job.status === 'completed' ? 'Completado' : job.status === 'running' ? 'En Progreso' : 'Error/Cancelado'}
                  </span>
                  
                  {job.status === 'completed' && (
                    <Link
                      href={`/api/download?id=${job.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 md:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0"
                      title="Descargar Excel"
                    >
                      <Download className="w-5 h-5" />
                    </Link>
                  )}

                  <button 
                    onClick={(e) => handleDelete(e, job.id)}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Borrar del historial"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isDone = status === "completed";
  const isError = status === "error";

  return (
    <div className="max-w-6xl mx-auto">
      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={closeModal} />
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
        <Link href="/monitor" className="hover:text-indigo-600 transition-colors">Historial</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium truncate max-w-xs">{query}</span>
      </nav>

      <div className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate" title={query || ""}>
            Extracción en vivo
          </h1>
          <p className="text-gray-600 mt-1 truncate" title={query || ""}>{query}</p>
        </div>
        <button 
          onClick={handleCancel}
          disabled={status !== "running"}
          className={`flex items-center px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
            status === "running" ? "text-red-700 bg-red-50 hover:bg-red-100" : "hidden"
          }`}
        >
          <StopCircle className="w-4 h-4 mr-2" />
          {status === "canceling" ? "Cancelando..." : "Detener"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* KPI & Status Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              {isError ? (
                <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
              ) : (
                <CheckCircle className={`w-5 h-5 mr-2 ${isDone ? 'text-green-500' : 'text-indigo-500 animate-pulse'}`} />
              )}
              {isError ? "Error/Cancelado" : (isDone ? "Finalizado" : "En Progreso")}
            </h2>
            
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 font-medium">Progreso</span>
                <span className="text-indigo-700 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${isDone ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-indigo-600'}`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex justify-between items-center">
              <span className="text-slate-600 font-semibold text-sm flex items-center">
                <FileText className="w-4 h-4 mr-2 text-slate-400"/>
                Negocios:
              </span>
              <span className="text-indigo-700 font-black text-xl">{found}</span>
            </div>

            {isDone && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <a href={`/api/download?id=${jobId}`} className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Excel
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Content */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button 
              onClick={() => setActiveTab("terminal")}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "terminal" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
            >
              <Terminal className="w-4 h-4 inline mr-2" /> Terminal en Vivo
            </button>
            <button 
              onClick={() => setActiveTab("resultados")}
              disabled={!isDone || previewData.length === 0}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "resultados" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"}`}
            >
              <TableIcon className="w-4 h-4 inline mr-2" /> Tabla de Resultados {previewData.length > 0 && `(${previewData.length})`}
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === "terminal" && (
              <div className="absolute inset-0 bg-slate-900 p-6 overflow-y-auto font-mono text-sm">
                {logs.map((log, i) => (
                  <div key={i} className={`mb-2 ${log.includes('ERROR') ? 'text-red-400' : log.includes('finalizado') || log.includes('Extraccion finalizada') ? 'text-green-400 font-bold' : log.includes('Bloqueo') ? 'text-yellow-400' : 'text-slate-300'}`}>
                    {log}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "resultados" && (
              <div className="absolute inset-0 overflow-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 font-semibold text-center">Score</th>
                      <th className="px-5 py-3 font-semibold">Negocio</th>
                      <th className="px-5 py-3 font-semibold">Contacto Directo</th>
                      <th className="px-5 py-3 font-semibold">Presencia Digital</th>
                      <th className="px-5 py-3 font-semibold">Calificación</th>
                      <th className="px-5 py-3 font-semibold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewData.map((row, i) => {
                      const score = Number(row["Lead_Score"] || 0);
                      const isGold = (row["Prioridad"] || "").includes("Oro") || score >= 70;
                      const isSilver = (row["Prioridad"] || "").includes("Plata") || (score >= 45 && score < 70);

                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          {/* Score Badge */}
                          <td className="px-5 py-3.5 text-center">
                            {row["Lead_Score"] !== undefined ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${
                                isGold 
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm' 
                                  : isSilver 
                                  ? 'bg-blue-100 text-blue-900 border-blue-300' 
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {isGold ? '🔥 ' : isSilver ? '⭐ ' : '⚡ '}
                                {score} pts
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Negocio */}
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 text-sm max-w-xs truncate" title={row["Nombre"]}>
                              {row["Nombre"]}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{row["Categoria"] || "Negocio"}</span>
                              {row["Ciudad"] && <span>• {row["Ciudad"]}</span>}
                            </div>
                          </td>

                          {/* Contacto Directo (WhatsApp / Teléfono / Email) */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col gap-1 items-start">
                              {row["WhatsApp_Link"] ? (
                                <a 
                                  href={row["WhatsApp_Link"]} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors shadow-2xs"
                                  title="Abrir chat en WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                                  <span>WhatsApp</span>
                                </a>
                              ) : null}

                              {row["Telefono"] && (
                                <span className="text-xs text-slate-700 font-medium font-mono">
                                  {row["Telefono"]}
                                </span>
                              )}

                              {row["Email"] && (
                                <span className="text-xs text-slate-500 truncate max-w-[150px]" title={row["Email"]}>
                                  ✉️ {row["Email"]}
                                </span>
                              )}

                              {!row["Telefono"] && !row["WhatsApp_Link"] && !row["Email"] && (
                                <span className="text-xs text-slate-400 italic">Sin datos directos</span>
                              )}
                            </div>
                          </td>

                          {/* Presencia Digital (Oportunidad Web / Redes) */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                              {row["Sitio_Web"] ? (
                                <a 
                                  href={row["Sitio_Web"].startsWith('http') ? row["Sitio_Web"] : `https://${row["Sitio_Web"]}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100"
                                >
                                  Web <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Oportunidad: No tiene sitio web propio">
                                  ⚠️ Sin Web
                                </span>
                              )}

                              {row["Instagram"] ? (
                                <a 
                                  href={row["Instagram"].startsWith('http') ? row["Instagram"] : `https://${row["Instagram"]}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200 hover:bg-pink-100"
                                >
                                  Instagram <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Oportunidad: No cuenta con Instagram">
                                  ⚠️ Sin IG
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Calificación y Reseñas */}
                          <td className="px-5 py-3.5">
                            {row["Calificacion"] ? (
                              <div className="flex items-center text-amber-700 font-bold text-xs">
                                <Star className="w-3.5 h-3.5 mr-1 fill-amber-500 text-amber-500" /> 
                                <span>{row["Calificacion"]}</span>
                                <span className="text-slate-400 font-normal ml-1">({row["Total_Resenas"] || 0})</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">Sin reseñas</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-3.5 text-center">
                            <button 
                              onClick={() => setSelectedRow(row)}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                            >
                              Ver Diagnóstico
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Detalles */}
      {selectedRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header Modal */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-slate-900">{selectedRow["Nombre"]}</h2>
                  {selectedRow["Lead_Score"] !== undefined && (
                    <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Score: {selectedRow["Lead_Score"]} pts
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm">
                  {selectedRow["Categoria"]} • {selectedRow["Ciudad"] || "Ciudad no especificada"}{selectedRow["Estado"] ? `, ${selectedRow["Estado"]}` : ""}
                </p>
              </div>
              <button onClick={() => setSelectedRow(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Tarjeta Diagnóstico Vission Solutions */}
              {selectedRow["Razon_Oportunidad"] && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 rounded-2xl shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Diagnóstico Comercial (Vission Solutions)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-amber-200/60 text-amber-900 rounded-md">
                      Prioridad: {selectedRow["Prioridad"] || "Estándar"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                    {selectedRow["Razon_Oportunidad"]}
                  </p>

                  {selectedRow["WhatsApp_Link"] && (
                    <div className="mt-4 pt-3 border-t border-amber-200/70 flex items-center justify-between">
                      <span className="text-xs text-slate-600">¿Listo para hacer contacto?</span>
                      <a 
                        href={selectedRow["WhatsApp_Link"]} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Abrir Chat de WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Canales y Datos de Contacto */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Teléfono</span>
                  <span className="font-bold text-sm text-slate-900">{selectedRow["Telefono"] || "-"}</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">WhatsApp</span>
                  {selectedRow["WhatsApp_Link"] ? (
                    <a 
                      href={selectedRow["WhatsApp_Link"]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-sm text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Abrir Link
                    </a>
                  ) : (
                    <span className="font-medium text-sm text-slate-400">-</span>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Instagram</span>
                  {selectedRow["Instagram"] ? (
                    <a 
                      href={selectedRow["Instagram"].startsWith('http') ? selectedRow["Instagram"] : `https://${selectedRow["Instagram"]}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-sm text-pink-600 hover:underline truncate block"
                      title={selectedRow["Instagram"]}
                    >
                      Ver Perfil
                    </a>
                  ) : (
                    <span className="font-bold text-xs text-amber-700">Sin Instagram</span>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Sitio Web</span>
                  {selectedRow["Sitio_Web"] ? (
                    <a 
                      href={selectedRow["Sitio_Web"].startsWith('http') ? selectedRow["Sitio_Web"] : `https://${selectedRow["Sitio_Web"]}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-sm text-blue-600 hover:underline truncate block"
                      title={selectedRow["Sitio_Web"]}
                    >
                      Visitar Web
                    </a>
                  ) : (
                    <span className="font-bold text-xs text-amber-700">Sin Sitio Web</span>
                  )}
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 col-span-2">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Email</span>
                  <span className="font-medium text-sm text-slate-800 truncate block" title={selectedRow["Email"]}>
                    {selectedRow["Email"] || "No detectado"}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Horario</span>
                  <span className="font-medium text-xs text-slate-800">
                    {selectedRow["Horario_Apertura"] ? `${selectedRow["Horario_Apertura"]} - ${selectedRow["Horario_Cierre"]}` : "-"}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Días Abierto</span>
                  <span className="font-medium text-xs text-slate-800">{selectedRow["Dias_Abierto"] || "-"}</span>
                </div>
              </div>

              {/* Dirección y Maps Link */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="block text-xs text-slate-500 uppercase font-semibold">Dirección</span>
                  <span className="text-xs text-slate-800">{selectedRow["Direccion_Completa"] || "-"}</span>
                </div>
                {selectedRow["URL_Google_Maps"] && (
                  <a 
                    href={selectedRow["URL_Google_Maps"]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 shrink-0 ml-4"
                  >
                    Google Maps <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Reseñas Destacadas */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center border-b pb-2">
                  <Star className="w-4 h-4 mr-1.5 text-amber-500 fill-amber-500" /> 
                  Reseñas Destacadas
                </h3>
                
                <div className="space-y-3">
                  {selectedRow["Resena_Positiva_Texto"] && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-xs text-emerald-900">{selectedRow["Resena_Positiva_Autor"] || "Cliente"}</span>
                        <div className="flex text-emerald-600">
                          {Array.from({length: Math.floor(Number(selectedRow["Resena_Positiva_Estrellas"] || 5))}).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-emerald-950 italic">"{selectedRow["Resena_Positiva_Texto"]}"</p>
                    </div>
                  )}

                  {selectedRow["Resena_Negativa_1_Texto"] && (
                    <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-xs text-rose-900">{selectedRow["Resena_Negativa_1_Autor"] || "Cliente"}</span>
                        <div className="flex text-rose-600">
                          {Array.from({length: Math.floor(Number(selectedRow["Resena_Negativa_1_Estrellas"] || 1))}).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-rose-950 italic">"{selectedRow["Resena_Negativa_1_Texto"]}"</p>
                    </div>
                  )}

                  {!selectedRow["Resena_Positiva_Texto"] && !selectedRow["Resena_Negativa_1_Texto"] && (
                    <p className="text-xs text-slate-400 italic">No se extrajeron reseñas específicas para este negocio.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="p-10 text-xl font-bold">Cargando monitor...</div>}>
      <MonitorContent />
    </Suspense>
  );
}
