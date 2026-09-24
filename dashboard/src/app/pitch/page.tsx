"use client";

import { Target, Zap, TrendingUp, Users, Database, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function PitchPage() {
  return (
    <div className="min-h-full bg-[#0A0E1A] text-gray-200">
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-[#0A0E1A] to-[#0A0E1A] -z-10"></div>
        <div className="max-w-4xl mx-auto text-center px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            Sistema Operativo de Prospección B2B
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Transforma Directorios Públicos en <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Clientes de Alto Valor</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            ScrapeFlow es el motor de prospección diseñado para equipos de Growth y agencias. Genera bases de datos hiper-segmentadas y llena tu pipeline comercial sin depender de listas de terceros obsoletas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/jobs" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold rounded-lg shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all">
              Probar Extractor Ahora <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="inline-flex items-center justify-center px-8 py-4 bg-[#161B22] hover:bg-[#1E242E] text-white border border-gray-700 font-semibold rounded-lg transition-all">
              Agendar Demo Corporativa
            </button>
          </div>
        </div>
      </section>

      {/* Stats / Social Proof */}
      <section className="border-y border-gray-800/60 bg-[#0D1117]/50 py-10">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-white mb-1">+40 hrs</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Ahorradas a la semana</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">100%</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Datos Extraídos en Tiempo Real</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">-65%</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Costo de Adquisición (CAC)</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">CRM Ready</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Compatible con HubSpot & Pipedrive</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 md:py-32">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ingeniería de Ventas a Escala</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Olvídate de la prospección manual y el copy-paste. Nuestro motor recorre la web estructurando la información que tus ejecutivos necesitan para cerrar negocios.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#161B22] border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-colors group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Prospección Hiper-Localizada</h3>
              <p className="text-gray-400 leading-relaxed">
                Segmenta tu mercado por ciudad, estado, código postal o nicho específico. Extrae exactamente a tu Buyer Persona con precisión quirúrgica.
              </p>
            </div>

            <div className="bg-[#161B22] border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-colors group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Enriquecimiento de Leads</h3>
              <p className="text-gray-400 leading-relaxed">
                No solo traemos nombres. Capturamos teléfonos, correos corporativos, sitios web, horarios y el pulso de su reputación digital (Reviews).
              </p>
            </div>

            <div className="bg-[#161B22] border border-gray-800 p-8 rounded-2xl hover:border-blue-500/50 transition-colors group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Automatización Ininterrumpida</h3>
              <p className="text-gray-400 leading-relaxed">
                Ejecución en infraestructura Cloud 24/7. Lanza campañas de extracción masivas con rotación de identidades para eludir bloqueos y firewalls comerciales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison/Value Section */}
      <section className="py-10 pb-24">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-gradient-to-b from-[#161B22] to-[#0D1117] border border-gray-800 rounded-3xl p-8 md:p-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
            
            <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-6">El Problema de Comprar Bases de Datos</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">Tasas de rebote altísimas por correos y teléfonos obsoletos.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">Contactas a los mismos prospectos quemados por toda tu competencia.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">Riesgo de entrar en listas negras de SPAM.</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-[#0A0E1A] p-8 rounded-2xl border border-gray-800/50">
                <h3 className="text-xl font-bold text-white mb-6">La Solución: Extracción First-Party</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">Datos frescos extraídos en el momento de tu búsqueda.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">Oportunidades vírgenes no públicas.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">Formato estandarizado para inyectar directamente en tus campañas.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
