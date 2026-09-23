---
name: nextjs-15-advanced-architecture
description: Reglas inquebrantables de arquitectura, estado, caché y seguridad para desarrollar en Next.js 15 (App Router).
---

# 🚀 Next.js 15 App Router - Arquitectura para Agentes de IA

Este documento contiene las reglas arquitectónicas inquebrantables (Context Engineering) que debes seguir SIEMPRE al escribir o refactorizar código en este proyecto de Next.js 15. Tu entrenamiento previo puede estar obsoleto respecto a los cambios introducidos en la versión 15. Aplica estas reglas rígidamente.

## 1. RSC (React Server Components) por Defecto
- **Regla Estricta:** Asume que TODOS los componentes son Server Components. 
- **Restricción 'use client':** Inyecta `'use client'` SOLAMENTE cuando el componente requiera:
  - Reactividad de estado (`useState`, `useReducer`).
  - Efectos del ciclo de vida (`useEffect`).
  - Eventos de usuario (`onClick`, `onChange`).
  - APIs del navegador (`window`, `localStorage`).
- **Paso de Props:** Cualquier dato proveniente de una base de datos u ORM que pase de un Server Component a un Client Component DEBE ser serializado a un Objeto JS Plano (POJO). No pases clases complejas.

## 2. Mutaciones Seguras con Server Actions
- **PROHIBIDO:** No escribas ni expongas Server Actions crudas o desnudas.
- **Patrón Obligatorio (`next-safe-action`):** 
  1. Define SIEMPRE un esquema estricto usando **Zod**.
  2. Implementa mutaciones a través de un cliente centralizado de `next-safe-action` (que maneje validación, auth y rate limits).
  3. En la interfaz gráfica (Client Component), usa el hook `useOptimisticAction` para reflejar el estado inmediatamente antes de que responda el servidor.

## 3. Estado de Interfaz y URL (nuqs)
- **PROHIBIDO:** No uses `useState` masivamente para manejar paginación, filtros de búsqueda, pestañas, u ordenamiento de tablas.
- **Patrón Obligatorio:** El estado que dicte la visibilidad o filtros DEBE residir en los parámetros de búsqueda de la URL (Search Parameters).
- **Herramienta:** Utiliza exclusivamente la librería **`nuqs`** para leer y mutar parámetros de búsqueda de forma sincrónica y tipada.
- **CAMBIO CRÍTICO (Next.js 15):** Las propiedades `params` y `searchParams` en Pages, Layouts y Route Handlers son **PROMESAS**. Debes resolverlas obligatoriamente antes de desestructurarlas: `const resolvedParams = await props.params;`

## 4. Estrategia de Fetching y Caché
- **Caché por defecto:** Recuerda que en Next.js 15 el `fetch` NO se almacena en caché por defecto.
- **Forzar Caché:** Si los datos son inmutables, añade explícitamente `cache: 'force-cache'`. Para regeneración periódica, exporta `export const revalidate = 3600`.
- **Anti-Patrón Prohibido:** NUNCA crees un Route Handler (`app/api/route.ts`) con el único propósito de hacerle fetch desde un Server Component (`fetch('http://localhost:3000/api/...')`). Aísla la lógica en un servicio (ej. `getUsers()`) e invócala directamente.
- **Límites de Suspense:** Eleva las etiquetas `<Suspense>` en la jerarquía del árbol. Nunca envuelvas el componente asíncrono sobre sí mismo.

## 5. Vercel AI SDK e IA Generativa
- **Streaming:** NUNCA uses Server Actions para respuestas en streaming largas (streamText, etc.). Tienen tiempos de espera muy cortos.
- **Patrón Obligatorio:** Delega el streaming del Vercel AI SDK SIEMPRE a Route Handlers (`app/api/chat/route.ts`).
- **Duración Máxima:** Inyecta explícitamente `export const maxDuration = 30;` al inicio del archivo del manejador de rutas para evitar colapsos por timeout.

## 6. Prevención de Errores y Seguridad (IA Safety)
- **Cero Marcadores de Posición (TODOs):** NUNCA generes bloques de código como `if (!data) { return null; /* TODO */ }` en rutas críticas de RSC. Esto causa fallos 500 y pantallas en blanco. Usa `notFound()` o delega a un `error.tsx` robusto.
- **XSS:** NO uses `dangerouslySetInnerHTML`.
- **Variables de Entorno:** JAMÁS añadas el prefijo `NEXT_PUBLIC_` a claves privadas, secretos o credenciales de base de datos en los `.env`. Mantenlas estrictamente en el entorno del servidor.
