"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check, Bot } from "lucide-react";

export default function KeysPage() {
  const [keys, setKeys] = useState([
    { id: 1, name: "Cliente: Agencia de Marketing X", created: "2023-11-15", lastUsed: "Hace 2 min" },
    { id: 2, name: "Conexión de Chatbot Inteligente", created: "2023-10-01", lastUsed: "Hace 6 horas" },
  ]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    setKeys([
      { id: Date.now(), name: "Nueva Contraseña (API Key)", created: "Justo ahora", lastUsed: "Nunca" },
      ...keys
    ]);
  };

  const handleDelete = (id: number) => {
    setKeys(keys.filter(k => k.id !== id));
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Accesos y Conexión Externa (API)</h1>
        <p className="text-gray-700 mt-2 text-lg">Crea contraseñas para que otros programas o clientes puedan solicitar extracciones automáticamente sin entrar a esta web.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Keys List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Contraseñas Activas (API Keys)</h2>
            <button onClick={handleGenerate} className="flex items-center px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="w-5 h-5 mr-2" />
              Generar Nuevo Acceso
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre del Cliente / Uso</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Creada</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Último Uso</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap text-base font-bold text-gray-900">{key.name}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600">{key.created}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600">{key.lastUsed}</td>
                    <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleDelete(key.id)} className="text-red-600 hover:text-red-800 flex items-center justify-end w-full font-bold">
                        <Trash2 className="w-4 h-4 mr-1" /> Revocar Acceso
                      </button>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-base font-medium text-gray-500">No hay accesos activos. Haz clic en "Generar Nuevo Acceso".</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MCP Connection Info */}
        <div className="bg-blue-900 rounded-xl shadow-lg border border-blue-800 p-8 text-white h-fit">
          <div className="flex items-center mb-4">
            <Bot className="w-8 h-8 text-blue-300 mr-3" />
            <h2 className="text-xl font-bold">Conectar Inteligencia Artificial</h2>
          </div>
          <p className="text-base text-blue-100 mb-6 font-medium">
            <strong>¿Qué es este enlace?</strong> Si tú o tus clientes usan Inteligencias Artificiales (como ChatGPT o Claude), pueden darles este enlace (Endpoint MCP). La IA usará este enlace para enviar trabajos de extracción a tu servidor y leer los resultados automáticamente.
          </p>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-300 uppercase tracking-wider">Enlace de Conexión (URL)</label>
            <div className="flex">
              <input 
                type="text" 
                readOnly 
                value="http://tu-servidor-vps.com/api/mcp" 
                className="w-full bg-blue-950 text-white border-2 border-blue-700 rounded-l-lg px-4 py-3 text-sm font-mono outline-none"
              />
              <button 
                onClick={handleCopy}
                className="bg-blue-600 hover:bg-blue-500 border-2 border-blue-600 text-white px-4 py-3 rounded-r-lg transition-colors"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
