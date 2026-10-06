import sys
import json
import time
import os
import pandas as pd
import requests
from concurrent.futures import ThreadPoolExecutor

JOB_DIR = os.path.join(os.path.dirname(__file__), ".jobs")
os.makedirs(JOB_DIR, exist_ok=True)

def update_progress(job_id, progress, total_results):
    file_path = os.path.join(JOB_DIR, f"{job_id}.json")
    try:
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"pid": 0, "logs": [], "progress": 0, "results": 0}
            
        data["progress"] = progress
        data["results"] = total_results
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception as e:
        print(f"[LOG] Error actualizando progreso: {e}")

def get_place_details(place_id, api_key):
    url = f"https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,website,url,rating,user_ratings_total,formatted_address",
        "key": api_key
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        return resp.json().get("result", {})
    except Exception as e:
        print(f"[LOG] Error en detalles para {place_id}: {e}")
        return {}

def scrape(query, job_id):
    API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not API_KEY:
        print("[LOG] ❌ ERROR CRÍTICO: No se encontró la variable de entorno GOOGLE_MAPS_API_KEY.")
        print("[LOG] Por favor genera una API Key en Google Cloud Console, añádela a Coolify y vuelve a intentarlo.")
        sys.exit(1)

    print(f"[LOG] 🚀 Iniciando extracción ultra-rápida usando Google Places API para: '{query}'")
    update_progress(job_id, 10, 0)
    
    places = []
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": API_KEY
    }
    
    page = 1
    while True:
        print(f"[LOG] 🔍 Buscando página {page} de resultados...")
        try:
            resp = requests.get(url, params=params, timeout=15)
            data = resp.json()
            
            if data.get("status") != "OK" and data.get("status") != "ZERO_RESULTS":
                print(f"[LOG] ⚠️ Error de la API de Google: {data.get('status')} - {data.get('error_message', '')}")
                break
                
            results = data.get("results", [])
            places.extend(results)
            print(f"[LOG] ✅ Se encontraron {len(results)} negocios en esta página (Total: {len(places)}).")
            update_progress(job_id, min(30 + page * 10, 80), len(places))
            
            next_token = data.get("next_page_token")
            if next_token and page < 3: # Google limita Text Search a 60 resultados max
                print("[LOG] ⏳ Esperando unos segundos para cargar la siguiente página (regla de Google)...")
                time.sleep(2) # Google requiere pausa antes de usar el next_page_token
                params = {"pagetoken": next_token, "key": API_KEY}
                page += 1
            else:
                break
        except Exception as e:
            print(f"[LOG] ❌ Error conectando a la API: {e}")
            break

    if not places:
        print("[LOG] ⚠️ No se encontraron resultados o hubo un problema.")
        update_progress(job_id, 100, 0)
        return

    print(f"[LOG] ⚡ Obteniendo teléfonos y sitios web para {len(places)} negocios...")
    final_data = []
    
    # Peticiones en paralelo para que sea súper rápido
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(get_place_details, p["place_id"], API_KEY): p for p in places}
        
        completed = 0
        for future in futures:
            p_basic = futures[future]
            try:
                details = future.result()
                item = {
                    "name": details.get("name") or p_basic.get("name") or "Sin Nombre",
                    "url": details.get("url") or "",
                    "website": details.get("website") or "",
                    "phone": details.get("formatted_phone_number") or "",
                    "address": details.get("formatted_address") or p_basic.get("formatted_address") or "",
                    "rating": str(details.get("rating", p_basic.get("rating", ""))),
                    "reviews": details.get("user_ratings_total", p_basic.get("user_ratings_total", 0)),
                }
                final_data.append(item)
            except Exception:
                pass
                
            completed += 1
            if completed % 10 == 0:
                print(f"[LOG] [PROGRESS] {completed}/{len(places)} detalles obtenidos...")
                update_progress(job_id, 80 + int((completed / len(places)) * 15), completed)

    print(f"[LOG] 💾 Guardando {len(final_data)} negocios en Excel y CSV...")
    df = pd.DataFrame(final_data)
    
    safe_query = "".join([c if c.isalnum() else "_" for c in query])
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "resultados"), exist_ok=True)
    base_filename = f"resultados/extraccion_{safe_query}_{timestamp}"
    
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", f"{base_filename}.csv"))
    excel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", f"{base_filename}.xlsx"))
    
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    df.to_excel(excel_path, index=False)
    
    update_progress(job_id, 100, len(final_data))
    print(f"[LOG] ✅ ¡Extracción completada con éxito usando Google API!")
    print(f"[LOG] Archivos listos para descargar.")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("[LOG] Faltan argumentos (query, precision, job_id)")
        sys.exit(1)
    
    query = sys.argv[1]
    job_id = sys.argv[3]
    
    try:
        scrape(query, job_id)
    except Exception as e:
        print(f"[LOG] Error fatal en scraper: {str(e)}")
        sys.exit(1)
