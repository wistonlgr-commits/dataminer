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
      const cities = zoneInput.split('\n').map(c => c.trim()).filter(c => c.length > 0);
      if (cities.length === 0) {
        if (zoneState) return [`${businessType} en ${zoneState}`];
        return [];
      }
      return cities.map(c => `${businessType} en ${c}${zoneState ? `, ${zoneState}` : ''}`);
    }
    return [];
  }, [activeTab, query, businessType, zipsInput, zoneInput, zoneState]);

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
                placeholder={"Una búsqueda por línea. Ejemplo:\ndaycare in Miami FL\nlaundromat near 77060"}
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
                placeholder={"Pega un ZIP por línea:\n33101\n33109\n77060"}
                className="w-full h-48 p-4 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-sm leading-relaxed"
              />
            </div>
          )}

          {activeTab === "zona" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="col-span-1 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">País, Estado o Provincia (Opcional)</label>
                    <p className="text-xs text-slate-500 mb-2">Esto se añadirá al final de cada ciudad. Ej: "España", "Aragua, Venezuela", "FL".</p>
                    <input 
                      type="text" 
                      value={zoneState} 
                      onChange={e => setZoneState(e.target.value)}
                      placeholder="Ej: Aragua, Venezuela"
                      className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-indigo-800 mb-1">💡 ¿Cómo funciona?</h4>
                    <p className="text-xs text-indigo-700">
                      El sistema cruzará el <span className="font-bold">tipo de negocio</span> con cada una de las <span className="font-bold">ciudades</span> que escribas aquí, agregando la ubicación general al final de cada una.
                      <br/><br/>
                      Ejemplo generado:<br/>
                      <span className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-900">{businessType || "daycare"} en Maracay, {zoneState || "Aragua"}</span>
                    </p>
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Lista de Ciudades o Barrios</label>
                  <p className="text-xs text-slate-500 mb-2">Escribe una ciudad por línea.</p>
                  <textarea 
                    value={zoneInput}
                    onChange={e => setZoneInput(e.target.value)}
                    placeholder={"Maracay\nTurmero\nCagua\nValencia"}
                    className="w-full h-48 p-4 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Precisión */}
          <div className="pt-4 border-t border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-4">Profundidad de Extracción (Scroll)</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <p className="font-medium text-slate-800 mb-1">Identidad</p>
            <p>Nombre, Categoría, Dirección, Ciudad, Estado, Código Postal</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">Contacto</p>
            <p>Teléfono, Email (del sitio web), Sitio Web</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">Horarios</p>
            <p>Apertura, Cierre, Días Abierto</p>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-1">Reputación</p>
            <p>Calificación, Total Reseñas, 1 Reseña Positiva, 2 Reseñas Negativas</p>
          </div>
          <div className="md:col-span-2">
            <p className="font-medium text-slate-800 mb-1">Atributos Adicionales</p>
            <p>Accesibilidad, Identidad del negocio, Servicios, Métodos de pago, Reclamado, URL de Google Maps</p>
          </div>
        </div>
      </details>
      
    </div>
  );
}
