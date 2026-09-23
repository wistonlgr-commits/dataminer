"use client";

import { useState, useEffect, useMemo } from "react";
import { Play, Upload, Save, AlertCircle, FileText, CheckCircle2, MapPin, List, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export default function JobsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"libre" | "zips" | "zona">("libre");
  const [query, setQuery] = useState("");
  const [precision, setPrecision] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Zips Mode
  const [businessType, setBusinessType] = useState("");
  const [zipsInput, setZipsInput] = useState("");

  // Zona Mode
  const [zoneInput, setZoneInput] = useState("");
  const [zoneType, setZoneType] = useState<"city" | "county" | "state">("city");
  const [zoneState, setZoneState] = useState("FL");
  const [zipData, setZipData] = useState<any[]>([]);
  const [foundZips, setFoundZips] = useState<any[]>([]);
  const [selectedZips, setSelectedZips] = useState<Set<number>>(new Set());
  const [filterCity, setFilterCity] = useState("");

  useEffect(() => {
    fetch('/us_zipcodes.json')
      .then(r => r.json())
      .then(data => setZipData(data))
      .catch(e => console.error("Error loading zips", e));
  }, []);

  const handleSearchZone = () => {
    if (!zoneInput && zoneType !== "state") return;
    const lowerInput = zoneInput.toLowerCase();
    
    let results = zipData;
    if (zoneType === "state") {
      results = zipData.filter(z => z.state === zoneState);
    } else if (zoneType === "city") {
      results = zipData.filter(z => z.state === zoneState && z.city?.toLowerCase().includes(lowerInput));
    } else if (zoneType === "county") {
      results = zipData.filter(z => z.state === zoneState && z.county?.toLowerCase().includes(lowerInput));
    }
    
    setFoundZips(results);
    setSelectedZips(new Set(results.map(z => z.zip_code)));
  };

  const handleToggleZip = (zip: number) => {
    const newSet = new Set(selectedZips);
    if (newSet.has(zip)) newSet.delete(zip);
    else newSet.add(zip);
    setSelectedZips(newSet);
  };

  const handleToggleAll = (select: boolean) => {
    if (select) setSelectedZips(new Set(foundZips.map(z => z.zip_code)));
    else setSelectedZips(new Set());
  };

  // Build final queries array based on active tab
  const finalQueries = useMemo(() => {
    if (activeTab === "libre") {
      return query.split('\n').map(q => q.trim()).filter(q => q.length > 0);
    } 
    if (activeTab === "zips") {
      if (!businessType) return [];
      const zips = zipsInput.split('\n').map(z => z.trim()).filter(z => z.length > 0);
      return zips.map(z => `${businessType} in ${z}`);
    }
    if (activeTab === "zona") {
      if (!businessType) return [];
      const selected = foundZips.filter(z => selectedZips.has(z.zip_code));
      return selected.map(z => `${businessType} in ${z.zip_code} ${z.city}, ${z.state}`);
    }
    return [];
  }, [activeTab, query, businessType, zipsInput, foundZips, selectedZips]);

  const timePerQuery = precision === 1 ? 30 : precision === 2 ? 60 : 120;
  const estimatedSeconds = finalQueries.length * timePerQuery;
  const estimatedTimeStr = estimatedSeconds > 3600 
    ? `~${(estimatedSeconds/3600).toFixed(1)} horas` 
    : `~${Math.ceil(estimatedSeconds/60)} min`;

  const handleSubmit = async () => {
    if (finalQueries.length === 0) {
      setError("No hay búsquedas para ejecutar.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const finalQueryString = finalQueries.join('\n');
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQueryString, precision }),
      });

      if (!res.ok) throw new Error("Error al iniciar extracción");
      router.push("/monitor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (activeTab === "libre") setQuery(text);
      if (activeTab === "zips") setZipsInput(text);
    };
    reader.readAsText(file);
  };

  // Agrupado por ciudad para tab zona
  const groupedZips = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const filtered = foundZips.filter(z => !filterCity || z.city.toLowerCase().includes(filterCity.toLowerCase()));
    filtered.forEach(z => {
      if (!groups[z.city]) groups[z.city] = [];
      groups[z.city].push(z);
    });
    return groups;
  }, [foundZips, filterCity]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva Búsqueda Masiva</h1>
        <p className="text-slate-500 mt-1">Configura y lanza extracciones automatizadas en Google Maps.</p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center text-red-700">
          <AlertCircle className="w-5 h-5 mr-3" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Header Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button 
            onClick={() => setActiveTab("libre")}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "libre" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
          >
            <FileText className="w-4 h-4 inline mr-2" /> Búsqueda Libre
          </button>
          <button 
            onClick={() => setActiveTab("zips")}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "zips" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
          >
            <List className="w-4 h-4 inline mr-2" /> Códigos Postales
          </button>
          <button 
            onClick={() => setActiveTab("zona")}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "zona" ? "border-indigo-600 text-indigo-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
          >
            <MapPin className="w-4 h-4 inline mr-2" /> Buscar por Zona
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {(activeTab === "zips" || activeTab === "zona") && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">¿Qué tipo de negocio buscas?</label>
              <input 
                type="text" 
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                placeholder="Ej: daycare, laundromat, restaurant..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          )}

          {activeTab === "libre" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-700">Tus consultas exactas</label>
                <label className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-800 flex items-center font-medium bg-indigo-50 px-3 py-1.5 rounded-md">
                  <Upload className="w-4 h-4 mr-2" /> Subir .txt
                  <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Una búsqueda por línea. Ejemplo:\ndaycare in Miami FL\nlaundromat near 77060"
                className="w-full h-48 p-4 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-sm leading-relaxed"
              />
            </div>
          )}

          {activeTab === "zips" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-700">Lista de Códigos Postales</label>
                <label className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-800 flex items-center font-medium bg-indigo-50 px-3 py-1.5 rounded-md">
                  <Upload className="w-4 h-4 mr-2" /> Subir .txt
                  <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <textarea
                value={zipsInput}
                onChange={(e) => setZipsInput(e.target.value)}
                placeholder="Pega un ZIP por línea:\n33101\n33109\n77060"
                className="w-full h-48 p-4 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-sm leading-relaxed"
              />
            </div>
          )}

          {activeTab === "zona" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Estado</label>
                  <select 
                    value={zoneState} 
                    onChange={e => setZoneState(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="FL">Florida (FL)</option>
                    <option value="TX">Texas (TX)</option>
                    <option value="CA">California (CA)</option>
                    <option value="NY">New York (NY)</option>
                    <option value="NJ">New Jersey (NJ)</option>
                    {/* Más estados podrían agregarse aquí */}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Buscar por</label>
                  <select 
                    value={zoneType} 
                    onChange={e => setZoneType(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="city">Ciudad</option>
                    <option value="county">Condado</option>
                    <option value="state">Todo el Estado</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Nombre</label>
                    <input 
                      type="text" 
                      value={zoneInput}
                      onChange={e => setZoneInput(e.target.value)}
                      disabled={zoneType === "state"}
                      placeholder={zoneType === "city" ? "Ej: Miami" : zoneType === "county" ? "Ej: Miami-Dade" : ""}
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  <button 
                    onClick={handleSearchZone}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors h-[46px] flex items-center"
                  >
                    <Search className="w-4 h-4 mr-2" /> Buscar
                  </button>
                </div>
              </div>

              {foundZips.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{foundZips.length} códigos postales encontrados</h3>
                        <p className="text-sm text-slate-500">Seleccionados: <span className="font-medium text-indigo-600">{selectedZips.size}</span></p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button onClick={() => handleToggleAll(true)} className="px-3 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md font-medium">Seleccionar todos</button>
                      <button onClick={() => handleToggleAll(false)} className="px-3 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-medium">Ninguno</button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-2 border-b border-slate-200">
                    <input 
                      type="text" 
                      placeholder="Filtrar resultados por ciudad..." 
                      value={filterCity}
                      onChange={e => setFilterCity(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded bg-white text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="h-64 overflow-y-auto bg-white p-4 space-y-6">
                    {Object.entries(groupedZips).map(([city, zips]) => (
                      <div key={city}>
                        <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1">
                          <h4 className="font-semibold text-slate-700 text-sm flex items-center">
                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                            {city} <span className="ml-2 text-xs font-normal text-slate-400">({zips.length} ZIPs)</span>
                          </h4>
                          <button 
                            className="text-xs text-indigo-600 hover:underline"
                            onClick={() => {
                              const allInCity = zips.map(z => z.zip_code);
                              const anyUnselected = allInCity.some(z => !selectedZips.has(z));
                              const newSet = new Set(selectedZips);
                              if (anyUnselected) {
                                allInCity.forEach(z => newSet.add(z));
                              } else {
                                allInCity.forEach(z => newSet.delete(z));
                              }
                              setSelectedZips(newSet);
                            }}
                          >
                            Toggle ciudad
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {zips.map((z) => {
                            // Fix string zips formatting if less than 5 chars
                            const zipStr = String(z.zip_code).padStart(5, '0');
                            return (
                              <label key={z.zip_code} className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${selectedZips.has(z.zip_code) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedZips.has(z.zip_code)}
                                  onChange={() => handleToggleZip(z.zip_code)}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <div className="ml-2">
                                  <span className="text-sm font-medium text-slate-900 block">{zipStr}</span>
                                  <span className="text-[10px] text-slate-500 block truncate" title={z.county}>{z.county}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {Object.keys(groupedZips).length === 0 && (
                      <p className="text-center text-slate-500 py-8">No hay resultados para este filtro.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Precisión */}
          <div className="pt-4 border-t border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-4">Profundidad de Extracción (Scroll)</label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { val: 1, label: "Rápida", desc: "~30s / zona" },
                { val: 2, label: "Equilibrada", desc: "~1m / zona" },
                { val: 3, label: "Profunda", desc: "~2m / zona" }
              ].map(p => (
                <button
                  key={p.val}
                  onClick={() => setPrecision(p.val)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    precision === p.val 
                      ? "border-indigo-600 bg-indigo-50/50" 
                      : "border-slate-200 hover:border-indigo-300 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold ${precision === p.val ? "text-indigo-700" : "text-slate-700"}`}>
                      {p.label}
                    </span>
                    {precision === p.val && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <span className="text-sm text-slate-500">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">
              {finalQueries.length} búsquedas generadas
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Tiempo estimado: <strong className="text-slate-700">{estimatedTimeStr}</strong>
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || finalQueries.length === 0}
            className={`flex items-center px-6 py-3 rounded-lg font-medium text-white transition-all shadow-sm ${
              loading || finalQueries.length === 0
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow"
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Iniciando...
              </span>
            ) : (
              <span className="flex items-center">
                <Play className="w-5 h-5 mr-2" />
                Comenzar Extracción
              </span>
            )}
          </button>
        </div>
      </div>

      <details className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm group">
        <summary className="font-semibold text-slate-800 cursor-pointer list-none flex items-center justify-between">
          <span className="flex items-center"><FileText className="w-5 h-5 mr-2 text-indigo-500" /> ¿Qué datos extraemos por cada negocio?</span>
          <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-medium text-slate-800 mb-1">🏢 Identidad</p>
            <p>Nombre, Categoría, Dirección, Ciudad, Estado, Código Postal</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">📞 Contacto</p>
            <p>Teléfono, Email (del sitio web), Sitio Web</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">🕐 Horarios</p>
            <p>Apertura, Cierre, Días Abierto</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">⭐ Reputación</p>
            <p>Calificación, Total Reseñas, 1 Reseña Positiva, 2 Reseñas Negativas</p>
          </div>
          <div className="md:col-span-2">
            <p className="font-medium text-slate-800 mb-1">🏷️ Atributos Adicionales</p>
            <p>Accesibilidad, Identidad del negocio, Servicios, Métodos de pago, Reclamado, URL de Google Maps</p>
          </div>
        </div>
      </details>
      
    </div>
  );
}
