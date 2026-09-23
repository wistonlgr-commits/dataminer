import asyncio
from playwright.async_api import async_playwright
import csv
import json

async def main():
    async with async_playwright() as p:
        # Iniciamos el navegador (puede ser headless=False para depurar)
        browser = await p.chromium.launch(headless=True)
        
        # Inyectamos la cookie ANTES de crear páginas para evitar el desvío a consent.google.com
        context = await browser.new_context(
            locale="es-ES",
            timezone_id="Europe/Madrid"
        )
        await context.add_cookies([{
            'name': 'CONSENT',
            'value': 'YES+cb.20230101-01-p0.es+FX+917',
            'domain': '.google.com',
            'path': '/'
        }])
        
        page = await context.new_page()
        
        urls = [
            'https://www.google.com/maps/place/Museo+Nacional+del+Prado/@40.4137818,-3.6921271,17z',
            'https://www.google.com/maps/place/El+Retiro+Park/@40.4152606,-3.6845003,17z'
        ]
        
        resultados = []
        import re
        for url in urls:
            print(f"Procesando: {url}")
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            
            if "consent" in page.url:
                print("Detectado redireccionamiento a consent.google.com. Resolviendo...")
                try:
                    # Usamos get_by_role que es más robusto que los selectores CSS
                    btn = page.get_by_role("button").filter(has_text=re.compile(r'rechazar todo|aceptar todo|reject all|accept all', re.IGNORECASE)).first
                    if await btn.count() > 0:
                        await btn.click()
                        await page.wait_for_url('**google.com/maps**', timeout=15000)
                        await page.wait_for_load_state('networkidle')
                except Exception as e:
                    print(f"Error saltando consent: {e}")
            else:
                # Si está en un iframe (overlay)
                try:
                    iframe = page.frame_locator('iframe').first
                    btn = iframe.get_by_role("button").filter(has_text=re.compile(r'rechazar todo|aceptar todo|reject all|accept all', re.IGNORECASE)).first
                    if await btn.count() > 0:
                        await btn.click()
                        await page.wait_for_timeout(3000)
                except Exception:
                    pass
            
            # Esperar a que el título principal (h1) aparezca
            try:
                await page.wait_for_selector('h1', timeout=8000)
            except:
                print("Timeout esperando h1, intentando extraer de todos modos...")
                
            # Función auxiliar para extraer texto
            async def get_text(selector: str):
                loc = page.locator(selector).first
                if await loc.count() > 0:
                    text = await loc.text_content()
                    return text.strip() if text else None
                return None
                
            name = await get_text('h1') or await page.title()
            name = name.replace(" - Google Maps", "")
            
            category = await get_text('button[jsaction="pane.rating.category"]')
            address = await get_text('button[data-item-id="address"]')
            phone = await get_text('button[data-item-id^="phone:tel:"]')
            website = await get_text('a[data-item-id="authority"]')
            
            rating_str = await get_text('div[jsaction="pane.rating.moreReviews"] span[aria-hidden="true"]')
            rating = rating_str.replace(',', '.') if rating_str else None
            
            reviews_str = await get_text('button[jsaction="pane.rating.moreReviews"]')
            reviews_count = None
            if reviews_str:
                import re
                nums = re.findall(r'\d+', reviews_str.replace('.', '').replace(',', ''))
                if nums:
                    reviews_count = nums[0]

            data = {
                "Nombre": name,
                "Categoria": category,
                "Direccion": address,
                "Telefono": phone,
                "Sitio_Web": website,
                "Calificacion": rating,
                "Total_Resenas": reviews_count,
                "URL": url
            }
            
            print(f"Extraido: {name}")
            resultados.append(data)
            
        await browser.close()
        
        # Exportar a CSV
        keys = resultados[0].keys()
        with open('extraccion_final.csv', 'w', newline='', encoding='utf-8-sig') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(resultados)
            
        # Exportar a JSON
        with open('extraccion_final.json', 'w', encoding='utf-8') as f:
            json.dump(resultados, f, ensure_ascii=False, indent=4)
            
        print("¡Extracción 100% completada! Exportado a extraccion_final.csv y extraccion_final.json")

if __name__ == '__main__':
    asyncio.run(main())
