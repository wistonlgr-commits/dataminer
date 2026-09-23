import asyncio
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from pydantic import BaseModel
from typing import Optional, List

class GoogleMapsPlace(BaseModel):
    name: str
    category: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    url: str

async def main():
    # Inicializamos el crawler
    crawler = PlaywrightCrawler(
        max_requests_per_crawl=50, # Limitado para la primera prueba
        headless=True,
        browser_type='chromium'
    )

    @crawler.router.default_handler
    async def request_handler(context: PlaywrightCrawlingContext) -> None:
        context.log.info(f"Procesando URL: {context.request.url}")
        page = context.page
        
        # Inyectar cookie de consentimiento y recargar si es necesario
        cookies = await page.context.cookies()
        has_consent = any(c['name'] == 'CONSENT' for c in cookies)
        if not has_consent:
            await page.context.add_cookies([{
                'name': 'CONSENT',
                'value': 'YES+cb.20230101-01-p0.es+FX+917',
                'domain': '.google.com',
                'path': '/'
            }])
            await page.reload()
        
        # Bypass del banner de cookies de la Unión Europea
        try:
            # Buscar el botón de rechazar cookies por su texto (español o inglés)
            consent_button = page.locator('button:has-text("Rechazar todo"), button:has-text("Reject all")').first
            if await consent_button.is_visible(timeout=3000):
                context.log.info("Banner de cookies detectado. Rechazando...")
                await consent_button.click()
                await page.wait_for_timeout(2000) # Esperar a que desaparezca
        except Exception:
            pass

        # Esperamos a que cargue el contenido principal
        try:
            await context.page.wait_for_selector('h1', timeout=5000)
            name_element = await page.locator('h1').first.text_content()
            name = name_element.strip() if name_element else await page.title()
        except Exception:
            context.log.warning("Timeout esperando h1, usando fallback...")
            name = await page.title()
            name = name.replace(" - Google Maps", "")

        # Función de ayuda para buscar texto por atributo aria-label o iconos
        async def get_text_by_selector(selector: str) -> Optional[str]:
            loc = page.locator(selector).first
            if await loc.count() > 0:
                text = await loc.text_content()
                return text.strip() if text else None
            return None

        # Google Maps usa clases ofuscadas, por lo que buscamos por atributos accesibles
        category = await get_text_by_selector('button[jsaction="pane.rating.category"]')
        address = await get_text_by_selector('button[data-item-id="address"]')
        phone = await get_text_by_selector('button[data-item-id^="phone:tel:"]')
        website = await get_text_by_selector('a[data-item-id="authority"]')
        
        # Extracción de calificación y reseñas
        rating_str = await get_text_by_selector('div[jsaction="pane.rating.moreReviews"] span[aria-hidden="true"]')
        rating = float(rating_str.replace(',', '.')) if rating_str else None
        
        reviews_str = await get_text_by_selector('button[jsaction="pane.rating.moreReviews"]')
        # Limpiar texto como "1.234 reseñas" -> 1234
        reviews_count = None
        if reviews_str:
            import re
            numbers = re.findall(r'\d+', reviews_str.replace('.', '').replace(',', ''))
            if numbers:
                reviews_count = int(numbers[0])

        # Guardamos el resultado (Crawlee lo exportará automáticamente a JSON)
        place = GoogleMapsPlace(
            name=name,
            category=category,
            address=address,
            phone=phone,
            website=website,
            rating=rating,
            reviews_count=reviews_count,
            url=context.request.url
        )
        
        await context.push_data(place.model_dump())
        context.log.info(f"✅ Extraído: {name}")

    # Encolamos algunos lugares de prueba directamente
    await crawler.run([
        'https://www.google.com/maps/place/Museo+Nacional+del+Prado/@40.4137818,-3.6921271,17z',
        'https://www.google.com/maps/place/El+Retiro+Park/@40.4152606,-3.6845003,17z'
    ])
    
    # Exportar a CSV y JSON
    await crawler.export_data('resultados.csv')
    await crawler.export_data('resultados.json')
    
    print("Extracción completada.")
    print("- Datos crudos en: 'storage/datasets/default'")
    print("- Exportados a: 'resultados.csv' y 'resultados.json'")

if __name__ == '__main__':
    asyncio.run(main())
