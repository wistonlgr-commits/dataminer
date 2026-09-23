"use client";

import { useState } from "react";
import { Save, CheckCircle2, ShieldAlert } from "lucide-react";

export default function SettingsPage() {
  const [rpm, setRpm] = useState(1500);
  const [concurrency, setConcurrency] = useState(12);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Protección Anti-Bloqueos</h1>
        <p className="text-gray-700 mt-2 text-lg">Configura las herramientas para evitar que Google Maps detecte y bloquee tu servidor.</p>
      </div>

      <div className="space-y-8">
        {/* Proxies */}
        <section className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center mb-4">
            <ShieldAlert className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2 flex-1">1. Red de Proxies (Identidades Falsas)</h2>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
            <p className="text-blue-900 text-sm font-medium">
              <strong>¿Qué es un Proxy?</strong> Si haces 10,000 búsquedas desde tu servidor, Google verá que todas vienen de la misma computadora (misma IP) y te bloqueará de inmediato. Un "Proxy" es un servidor intermedio prestado. La lista de abajo es una lista de servidores prestados. El sistema rotará entre ellos para que Google crea que son 10,000 personas distintas buscando desde sus casas.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-base font-bold text-gray-900">Pega tu Lista de Proxies Aquí</label>
              </div>
              <textarea 
                rows={8}
                defaultValue="192.168.1.1:8080:usuario1:contrasena1&#10;54.12.3.4:3128:usuario2:contrasena2"
                className="w-full px-4 py-3 font-mono text-base bg-gray-50 text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none" 
              />
              <p className="text-sm text-gray-600 mt-2 font-medium">Formato: IP:Puerto:Usuario:Contraseña (Un proxy por línea).</p>
            </div>

            <div className="flex items-center justify-between p-6 bg-gray-50 rounded-lg border border-gray-200 mt-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Activar Cambio Automático de Identidad (Rotación)</h3>
                <p className="text-sm text-gray-700 mt-1 font-medium">Cambia la IP automáticamente para cada nueva página que se extrae.</p>
              </div>
              <button 
                type="button" 
                className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none bg-blue-600 shadow-inner"
              >
                <span className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform translate-x-7 shadow-sm" />
              </button>
            </div>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="bg-white p-8 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6">2. Límite de Velocidad (Freno de Seguridad)</h2>
          <p className="text-sm text-gray-700 mb-6 font-medium">
            Incluso con proxies, ir demasiado rápido levanta sospechas. Estos controles frenan el sistema para que parezca comportamiento humano.
          </p>
          
          <div className="space-y-8">
            <div>
              <div className="flex justify-between text-base mb-4 font-bold text-gray-900">
                <span>Peticiones Máximas por Minuto</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md">{rpm} búsquedas/min</span>
              </div>
              <input 
                type="range" 
                min="10" max="5000" step="10"
                value={rpm} 
                onChange={(e) => setRpm(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-base mb-4 font-bold text-gray-900">
                <span>Páginas Simultáneas (Concurrencia)</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md">{concurrency} a la vez</span>
              </div>
              <input 
                type="range" 
                min="1" max="50" 
                value={concurrency} 
                onChange={(e) => setConcurrency(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button 
            onClick={handleSave}
            className="flex items-center px-8 py-3 text-base font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            {isSaved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            {isSaved ? "¡Guardado!" : "Guardar Configuración de Seguridad"}
          </button>
        </div>
      </div>
    </div>
  );
}
