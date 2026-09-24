import asyncio
import sys
import re
import urllib.parse
import os
import random
import pandas as pd
from playwright.async_api import async_playwright

# Compatibility shim for different versions of playwright-stealth
try:
    from playwright_stealth import stealth_async
except ImportError:
    try:
        from playwright_stealth import Stealth
        _stealth_instance = Stealth()
        async def stealth_async(page):
            await _stealth_instance.apply_stealth(page)
    except (ImportError, AttributeError):
        from playwright_stealth import stealth_sync
        async def stealth_async(page):
            stealth_sync(page)
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1280, "height": 720},
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
]

async def human_delay(page, min_ms=1500, max_ms=4000):
    """Espera aleatoria para simular comportamiento humano."""
    delay = random.randint(min_ms, max_ms)
    await page.wait_for_timeout(delay)

async def is_blocked(page):
    """Detecta si Google está mostrando CAPTCHA o página de bloqueo."""
    url = page.url.lower()
    if 'sorry' in url or 'captcha' in url or 'unusual traffic' in url:
        return True
    try:
        body_text = await page.locator('body').inner_text()
        if body_text and any(phrase in body_text.lower() for phrase in [
            'unusual traffic', 'automated queries', 'captcha',
            'not a robot', 'blocked', 'please try again'
        ]):
            return True
    except:
        pass
    return False

async def get_text(page, selector: str):
    try:
        loc = page.locator(selector).first
        if await loc.count() > 0:
            text = await loc.inner_text()
            return text.strip() if text else None
    except: pass
    return None

async def clean(t):
    if not t: return None
    t = re.sub(r'[\ue000-\uf8ff\u200b\u00a0]', '', t)
    t = t.replace('\n', ' ').strip()
    return t if t else None

async def get_email_from_website(context, url):
    """Abre la web en una nueva pestaña y busca correos electrónicos."""
    if not url or 'google.com' in url: return ""
    page = None
    try:
        page = await context.new_page()
        # Navegación muy rápida, máximo 10 segundos
        await page.goto(url, timeout=10000, wait_until="domcontentloaded")
        
        # 1. Buscar en links mailto:
        hrefs = await page.evaluate("Array.from(document.querySelectorAll('a[href^=\"mailto:\"]')).map(a => a.href)")
        emails = set()
        for h in hrefs:
            em = h.replace('mailto:', '').split('?')[0].strip()
            if '@' in em: emails.add(em)
            
        # 2. Buscar en texto si no encontramos en links
        if not emails:
            text = await page.evaluate("document.body.innerText")
            matches = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
            for m in matches:
                # Filtrar falsos positivos comunes
                ml = m.lower()
                if not any(x in ml for x in ['sentry', 'example', 'domain', '.png', '.jpg', '.gif', 'wix', 'square']):
                    emails.add(m)
        
        await page.close()
        return ", ".join(list(emails)[:2])  # Max 2 correos
    except:
        if page:
            try: await page.close()
            except: pass
        return ""

def format_excel(filepath):
    """Aplica colores, bordes y anchos de columna al Excel."""
    try:
        wb = load_workbook(filepath)
        ws = wb.active
        header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True, size=11)
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

        group_colors = {
            "Consulta_Busqueda": "2E75B6", "Ciudad": "2E75B6", "Estado": "2E75B6", "Codigo_Postal": "2E75B6", "Direccion_Completa": "2E75B6",
            "Nombre": "1F4E79", "Categoria": "1F4E79",
            "Telefono": "548235", "Email": "548235", "Sitio_Web": "548235",
            "Horario_Apertura": "BF8F00", "Horario_Cierre": "BF8F00", "Dias_Abierto": "BF8F00",
            "Reclamado": "C00000",
            "Calificacion": "7030A0", "Total_Resenas": "7030A0",
            "Accesibilidad": "00B0F0", "Identidad_Negocio": "00B0F0", "Servicios": "00B0F0", "Metodos_Pago": "00B0F0",
            "Resena_Positiva_Autor": "548235", "Resena_Positiva_Estrellas": "548235", "Resena_Positiva_Texto": "548235",
            "Resena_Negativa_1_Autor": "C00000", "Resena_Negativa_1_Estrellas": "C00000", "Resena_Negativa_1_Texto": "C00000",
            "Resena_Negativa_2_Autor": "C00000", "Resena_Negativa_2_Estrellas": "C00000", "Resena_Negativa_2_Texto": "C00000",
        }

        for cell in ws[1]:
            col_name = cell.value
            color = group_colors.get(col_name, "1F4E79")
            cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', wrap_text=True)
            cell.border = thin_border

        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.border = thin_border
                cell.alignment = Alignment(wrap_text=True, vertical='top')

        widths = {
            'A': 22, 'B': 35, 'C': 18, 'D': 40, 'E': 14, 'F': 12, 'G': 10,
            'H': 18, 'I': 28, 'J': 30, 'K': 14, 'L': 14, 'M': 12,
            'N': 10, 'O': 10, 'P': 12, 'Q': 35, 'R': 25, 'S': 30, 'T': 25,
            'U': 18, 'V': 10, 'W': 45, 'X': 18, 'Y': 10, 'Z': 45,
            'AA': 18, 'AB': 10, 'AC': 45, 'AD': 40,
        }
        for col, w in widths.items():
            try:
                ws.column_dimensions[col].width = w
            except: pass

        wb.save(filepath)
    except Exception as e:
        print(f"[LOG] Error al formatear Excel: {e}")

async def main():
    search_query = sys.argv[1] if len(sys.argv) > 1 else "daycare in new jersey"
    precision = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    job_id = sys.argv[3] if len(sys.argv) > 3 else None

    if job_id:
        file_prefix = job_id
    else:
        file_prefix = re.sub(r'[^a-zA-Z0-9_]', '_', search_query.lower())
        if len(file_prefix) > 50: file_prefix = file_prefix[:50] + "_batch"

    raw_queries = [line.strip() for line in search_query.splitlines() if line.strip()]
    queries = raw_queries
    total_queries = len(queries)

    MAX_SCROLLS = {1: 8, 2: 20, 3: 40}.get(precision, 20)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        vp = random.choice(VIEWPORTS)
        ua = random.choice(USER_AGENTS)
        context = await browser.new_context(
            locale="en-US",
            viewport=vp,
            user_agent=ua,
            timezone_id="America/New_York",
        )
        page = await context.new_page()
        await stealth_async(page)
        
        all_resultados = []
        
        for index, q in enumerate(queries):
            if index > 0:
                pause = random.randint(8, 15)
                print(f"[LOG] Pausa de {pause}s antes de la siguiente busqueda...")
                sys.stdout.flush()
                await page.wait_for_timeout(pause * 1000)
            
            safe_query = urllib.parse.quote_plus(q)
            search_url = f"https://www.google.com/maps/search/{safe_query}?hl=en"
            print(f"[LOG] Busqueda ({index+1}/{total_queries}): '{q}'...")
            sys.stdout.flush()
            
            try:
                await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                await human_delay(page, 2500, 5000)
            except:
                pass
            
            if await is_blocked(page):
                print("[LOG] ⚠️ Bloqueo detectado! Esperando 60s y rotando identidad...")
                sys.stdout.flush()
                await page.wait_for_timeout(60000)
                await page.close()
                await context.close()
                vp = random.choice(VIEWPORTS)
                ua = random.choice(USER_AGENTS)
                context = await browser.new_context(
                    locale="en-US", viewport=vp, user_agent=ua,
                    timezone_id="America/New_York",
                )
                page = await context.new_page()
                await stealth_async(page)
                try:
                    await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")
                    await human_delay(page, 3000, 5000)
                    if await is_blocked(page):
                        print("[LOG] ❌ Bloqueo persiste. Saltando este negocio.")
                        continue
                except:
                    continue
            
            # Consentimiento
            if "consent" in page.url:
                try:
                    btn = page.get_by_role("button").filter(has_text=re.compile(r'reject all|accept all', re.IGNORECASE)).first
                    if await btn.count() > 0:
                        await btn.click()
                        await human_delay(page, 2000, 4000)
                except: pass
            
            try: await page.wait_for_selector('a[href*="/maps/place/"]', timeout=10000)
            except: continue
            
            print("[LOG] Scroll profundo...")
            sys.stdout.flush()
            for i in range(MAX_SCROLLS):
                base_pct = int((index / total_queries) * 100)
                scroll_pct = int((i / MAX_SCROLLS) * (100 / total_queries) * 0.25)
                print(f"[PROGRESS] {base_pct + scroll_pct}")
                sys.stdout.flush()
                try:
                    for _ in range(random.randint(3, 5)):
                        delta = random.randint(300, 900)
                        await page.mouse.wheel(0, delta)
                        await page.wait_for_timeout(random.randint(200, 500))
                    await human_delay(page, 1000, 2500)
                    end = page.locator('span.HlvSq')
                    if await end.count() > 0 and await end.is_visible(): break
                except: pass

            links = await page.locator('a[href*="/maps/place/"]').evaluate_all("elements => elements.map(e => e.href)")
            unique_links = list(dict.fromkeys(links))
            print(f"[LOG] {len(unique_links)} negocios encontrados en '{q}'")
            sys.stdout.flush()
            
            for j, url in enumerate(unique_links):
                if j > 0 and j % random.randint(15, 20) == 0:
                    print(f"[LOG] Rotando identidad del navegador...")
                    sys.stdout.flush()
                    await page.close()
                    await context.close()
                    vp = random.choice(VIEWPORTS)
                    ua = random.choice(USER_AGENTS)
                    context = await browser.new_context(
                        locale="en-US",
                        viewport=vp,
                        user_agent=ua,
                        timezone_id="America/New_York",
                    )
                    page = await context.new_page()
                    await stealth_async(page)
                    await human_delay(page, 3000, 6000)
                    
                pct = int((index / total_queries) * 100) + int(((j+1) / max(len(unique_links),1)) * (100 / total_queries) * 0.75)
                print(f"[PROGRESS] {min(pct, 99)}")
                sys.stdout.flush()
                
                loaded = False
                for attempt in range(3):
                    try:
                        await page.goto(url, timeout=25000, wait_until="domcontentloaded")
                        await human_delay(page, 2000, 4500)
                        
                        if await is_blocked(page):
                            print("[LOG] ⚠️ Bloqueo detectado! Esperando 60s y rotando identidad...")
                            sys.stdout.flush()
                            await page.wait_for_timeout(60000)
                            await page.close()
                            await context.close()
                            vp = random.choice(VIEWPORTS)
                            ua = random.choice(USER_AGENTS)
                            context = await browser.new_context(
                                locale="en-US", viewport=vp, user_agent=ua,
                                timezone_id="America/New_York",
                            )
                            page = await context.new_page()
                            await stealth_async(page)
                            continue # reintentar

                        h1_count = await page.locator('h1').count()
                        h1 = await page.locator('h1').first.inner_text() if h1_count > 0 else None
                        if h1 and len(h1.strip()) > 1:
                            loaded = True
                            break
                        else:
                            await human_delay(page, 2000, 3000)
                    except:
                        if attempt < 2:
                            wait = (attempt + 1) * 3000
                            print(f"[LOG] Reintentando negocio ({attempt+2}/3)...")
                            await page.wait_for_timeout(wait)
                if not loaded:
                    continue
                
                # ============ NOMBRE ============
                name = await clean(await get_text(page, 'h1'))
                if not name: continue
                
                main_text = ""
                try: main_text = await page.locator('div[role="main"]').first.inner_text()
                except: pass
                main_lines = [l.strip() for l in main_text.split('\n') if l.strip()]
                
                # ============ CATEGORIA ============
                category = ""
                for sel in ['button[jsaction="pane.rating.category"]', 'button.DkEaL', 'span.DkEaL']:
                    category = await clean(await get_text(page, sel))
                    if category: break
                if not category and len(main_lines) > 3:
                    for l_idx, line in enumerate(main_lines[:8]):
                        if line == name and l_idx+2 < len(main_lines):
                            candidate = main_lines[l_idx+2] if re.match(r'^[\d.,]+$', main_lines[l_idx+1]) else main_lines[l_idx+1]
                            if candidate and not re.match(r'^[\d.,]+$', candidate) and candidate not in ['Overview', 'About']:
                                category = candidate
                                break
                
                # ============ DIRECCION DESGLOSADA ============
                address = (
                    await clean(await get_text(page, 'button[data-item-id="address"]'))
                    or await clean(await get_text(page, 'div[data-item-id="address"] .Io6YTe'))
                    or ""
                )
                if not address:
                    for line in main_lines[:15]:
                        if re.match(r'^\d+\s+\w+.*(St|Ave|Blvd|Dr|Rd|Way|Ln|Ct|Pl|Pkwy|Hwy)', line):
                            address = line.strip()
                            break

                ciudad, estado, codigo_postal = "", "", ""
                if address:
                    parts = [p.strip() for p in address.split(',')]
                    if len(parts) >= 3:
                        potential_city = parts[-3]
                        if '+' not in potential_city:
                            ciudad = potential_city
                            
                        sz = parts[-2].split()
                        if len(sz) >= 2:
                            estado = sz[0]
                            codigo_postal = sz[1]
                        else:
                            estado = parts[-2]
                            
                    if not codigo_postal:
                        mz = re.search(r'\b\d{4,5}\b', address)
                        if mz: codigo_postal = mz.group(0)
                
                # ============ CONTACTO ============
                phone = (
                    await clean(await get_text(page, 'button[data-item-id^="phone:tel:"]'))
                    or await clean(await get_text(page, 'a[data-item-id^="phone:tel:"]'))
                    or ""
                )
                if not phone:
                    for line in main_lines:
                        m = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', line)
                        if m:
                            phone = m.group(0)
                            break

                website = (
                    await clean(await get_text(page, 'a[data-item-id="authority"]'))
                    or await clean(await get_text(page, 'a[data-tooltip="Open website"]'))
                    or ""
                )
                
                # ============ EMAIL SCRAPER ============
                email = ""
                if website:
                    target_url = website if website.startswith('http') else 'https://' + website
                    email = await get_email_from_website(context, target_url)
                
                # ============ CALIFICACION ============
                rating, reviews_count = "", ""
                try:
                    star_span = page.locator('span[role="img"][aria-label*="star"]').first
                    if await star_span.count() > 0:
                        m = re.search(r'([\d.]+)', await star_span.get_attribute("aria-label"))
                        if m: rating = m.group(1)
                except: pass
                if not rating:
                    try:
                        f7 = page.locator('div.F7nice span').first
                        if await f7.count() > 0:
                            m = re.search(r'([\d.,]+)', await f7.inner_text())
                            if m: rating = m.group(1).replace(',', '.')
                    except: pass
                
                try:
                    tabs = page.locator('button[role="tab"]')
                    for ti in range(await tabs.count()):
                        tab_aria = await tabs.nth(ti).get_attribute("aria-label") or ""
                        if 'review' in tab_aria.lower():
                            m = re.search(r'(\d+)', tab_aria)
                            if m: reviews_count = m.group(1)
                            break
                except: pass
                if not reviews_count:
                    for line in main_lines[:10]:
                        m = re.match(r'^\((\d+)\)$', line)
                        if m:
                            reviews_count = m.group(1)
                            break
                
                # ============ HORARIO DESGLOSADO ============
                raw_hours = ""
                for line in main_lines:
                    if re.search(r'(Open|Closed|Abierto|Cerrado)', line, re.IGNORECASE):
                        cl = re.sub(r'[\ue000-\uf8ff\u202f]', ' ', line).strip()
                        if cl and len(cl) > 3 and ('am' in cl.lower() or 'pm' in cl.lower() or 'hour' in cl.lower() or 'open' in cl.lower()):
                            raw_hours = cl
                            break
                
                h_aria = ""
                if not raw_hours:
                    try:
                        hour_btn = page.locator('button[aria-label*="Monday"], button[aria-label*="Sunday"], div[aria-label*="Monday"]').first
                        if await hour_btn.count() > 0:
                            h_aria = await hour_btn.get_attribute("aria-label") or ""
                            if h_aria:
                                for part in h_aria.split(','):
                                    if re.search(r'\d+:\d+', part):
                                        raw_hours = re.sub(r'[\u202f]', ' ', part).strip()
                                        break
                                if not raw_hours: raw_hours = re.sub(r'[\u202f]', ' ', h_aria.split(',')[0]).strip()
                    except: pass
                
                apertura, cierre, dias_abierto = "", "", ""
                if raw_hours:
                    times = re.findall(r'(\d{1,2}:\d{2}\s*[APMamp]+|\d{1,2}\s*[APMamp]+|\d{1,2}:\d{2})', raw_hours)
                    if len(times) >= 2:
                        apertura = times[0].upper()
                        cierre = times[-1].upper()
                    elif len(times) == 1:
                        apertura = times[0].upper()
                        if "24 hours" in raw_hours.lower():
                            cierre = "24 Hours"
                            apertura = "24 Hours"

                dias_set = set()
                if not h_aria:
                    try:
                        hour_btn = page.locator('button[aria-label*="Monday"], button[aria-label*="Sunday"], div[aria-label*="Monday"]').first
                        if await hour_btn.count() > 0:
                            h_aria = await hour_btn.get_attribute("aria-label") or ""
                    except: pass
                
                if h_aria:
                    for day_name in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
                        if day_name in h_aria:
                            day_section = h_aria.split(day_name)
                            if len(day_section) > 1 and 'closed' not in day_section[1].split(';')[0].lower():
                                dias_set.add(day_name[:3])
                    if dias_set:
                        day_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                        dias_abierto = ", ".join(sorted(dias_set, key=lambda x: day_order.index(x)))
                
                # ============ RECLAMADO ============
                is_claimed = "Si"
                try:
                    claim = page.locator('[data-item-id="merchant"], a:has-text("Claim this business")').first
                    if await claim.count() > 0: is_claimed = "No"
                except: pass
                
                # ============ ATRIBUTOS CLASIFICADOS ============
                acc_l, iden_l, serv_l, pag_l = [], [], [], []
                try:
                    about_btn = page.locator('button[role="tab"][aria-label*="About"], button[role="tab"]:has-text("About")').first
                    if await about_btn.count() > 0:
                        await about_btn.click()
                        await human_delay(page, 800, 1800)
                        
                        abt_text = await page.locator('div[role="main"]').first.inner_text()
                        abt_lines = [l.strip() for l in abt_text.split('\n') if l.strip()]
                        
                        junk = {"about", "overview", "accessibility", "amenities", "planning", "payments", "crowd", "children", "offerings", "highlights", "popular for", "from the business", "service options", "health & safety", "getting here", "directions", "save", "nearby", "send to phone", "photos", "reviews"}
                        
                        for aline in abt_lines:
                            aline = re.sub(r'[\ue000-\uf8ff]', '', aline).strip()
                            if len(aline) < 4 or aline.lower() in junk or re.search(r'\d{4,}', aline): continue
                            if name and aline == name: continue
                            
                            al = aline.lower()
                            if any(k in al for k in ['wheelchair', 'accesible', 'accessible', 'blind', 'mobility']):
                                acc_l.append(aline)
                            elif any(k in al for k in ['owned', 'identifies as', 'se identifica']):
                                iden_l.append(aline)
                            elif any(k in al for k in ['credit card', 'debit card', 'cash', 'check', 'pago', 'tarjeta', 'nfc']):
                                pag_l.append(aline)
                            else:
                                if aline[0].isalpha(): serv_l.append(aline)
                        
                        try:
                            ov = page.locator('button[role="tab"][aria-label*="Overview"]').first
                            if await ov.count() > 0:
                                await ov.click()
                                await human_delay(page, 400, 1000)
                        except: pass
                except: pass
                
                try:
                    id_rows = page.locator('div.rogA2c')
                    for ri in range(await id_rows.count()):
                        rtxt = (await id_rows.nth(ri).inner_text()).strip()
                        if 'identifies as' in rtxt.lower() or 'se identifica' in rtxt.lower():
                            tag = re.sub(r'[\ue000-\uf8ff]', '', rtxt).strip()
                            if tag and tag not in iden_l: iden_l.append(tag)
                except: pass
                
                # ============ RESENAS (Top 3: 1 Positiva + 2 Negativas) ============
                resena_positiva = {"autor": "", "estrellas": "", "texto": ""}
                resenas_negativas = [{"autor": "", "estrellas": "", "texto": ""} for _ in range(2)]
                
                try:
                    tabs = page.locator('button[role="tab"]')
                    for ti in range(await tabs.count()):
                        tab_aria = await tabs.nth(ti).get_attribute("aria-label") or ""
                        if 'review' in tab_aria.lower():
                            await tabs.nth(ti).click()
                            await human_delay(page, 1500, 3000)
                            
                            cards = page.locator('.jJc9Ad, div[data-review-id]')
                            cc = await cards.count()
                            
                            if not reviews_count and cc > 0: reviews_count = str(cc)
                            
                            if cc > 0:
                                # Extraer 2 negativas (Lowest rating)
                                sort_menu = page.locator('button[aria-label*="Sort"], button[data-value="Sort"]')
                                if await sort_menu.count() > 0:
                                    await sort_menu.first.click()
                                    await human_delay(page, 500, 1000)
                                    lowest_btn = page.locator('div[role="menuitemradio"]:has-text("Lowest rating")')
                                    if await lowest_btn.count() > 0:
                                        await lowest_btn.first.click()
                                        await human_delay(page, 1500, 2500)
                                        
                                        cards_neg = page.locator('.jJc9Ad, div[data-review-id]')
                                        for c_idx in range(min(await cards_neg.count(), 2)):
                                            card = cards_neg.nth(c_idx)
                                            try:
                                                more = card.locator('button.w8nwRe, button:has-text("More")').first
                                                if await more.count() > 0 and await more.is_visible():
                                                    await more.click()
                                                    await human_delay(page, 200, 600)
                                            except: pass
                                            
                                            try:
                                                a_el = card.locator('.d4r55').first
                                                if await a_el.count() > 0: resenas_negativas[c_idx]["autor"] = (await a_el.inner_text()).strip()
                                            except: pass
                                            try:
                                                s_el = card.locator('span[role="img"][aria-label*="star"]').first
                                                if await s_el.count() > 0:
                                                    sm = re.search(r'([\d.]+)', await s_el.get_attribute("aria-label"))
                                                    if sm: resenas_negativas[c_idx]["estrellas"] = sm.group(1)
                                            except: pass
                                            try:
                                                t_el = card.locator('.wiI7pd').first
                                                if await t_el.count() > 0: resenas_negativas[c_idx]["texto"] = (await t_el.inner_text()).strip()
                                            except: pass
                                
                                # Extraer 1 positiva (Highest rating)
                                sort_menu = page.locator('button[aria-label*="Sort"], button[data-value="Sort"]')
                                if await sort_menu.count() > 0:
                                    await sort_menu.first.click()
                                    await human_delay(page, 500, 1000)
                                    highest_btn = page.locator('div[role="menuitemradio"]:has-text("Highest rating")')
                                    if await highest_btn.count() > 0:
                                        await highest_btn.first.click()
                                        await human_delay(page, 1500, 2500)
                                        
                                        cards_pos = page.locator('.jJc9Ad, div[data-review-id]')
                                        if await cards_pos.count() > 0:
                                            card = cards_pos.nth(0)
                                            try:
                                                more = card.locator('button.w8nwRe, button:has-text("More")').first
                                                if await more.count() > 0 and await more.is_visible():
                                                    await more.click()
                                                    await human_delay(page, 200, 600)
                                            except: pass
                                            
                                            try:
                                                a_el = card.locator('.d4r55').first
                                                if await a_el.count() > 0: resena_positiva["autor"] = (await a_el.inner_text()).strip()
                                            except: pass
                                            try:
                                                s_el = card.locator('span[role="img"][aria-label*="star"]').first
                                                if await s_el.count() > 0:
                                                    sm = re.search(r'([\d.]+)', await s_el.get_attribute("aria-label"))
                                                    if sm: resena_positiva["estrellas"] = sm.group(1)
                                            except: pass
                                            try:
                                                t_el = card.locator('.wiI7pd').first
                                                if await t_el.count() > 0: resena_positiva["texto"] = (await t_el.inner_text()).strip()
                                            except: pass
                            break
                except: pass

                data = {
                    "Consulta_Busqueda": q,
                    "Nombre": name,
                    "Categoria": category,
                    "Direccion_Completa": address,
                    "Ciudad": ciudad,
                    "Estado": estado,
                    "Codigo_Postal": codigo_postal,
                    "Telefono": phone,
                    "Email": email,
                    "Sitio_Web": website,
                    "Horario_Apertura": apertura,
                    "Horario_Cierre": cierre,
                    "Dias_Abierto": dias_abierto,
                    "Reclamado": is_claimed,
                    "Calificacion": rating,
                    "Total_Resenas": reviews_count,
                    "Accesibilidad": ", ".join(set(acc_l)),
                    "Identidad_Negocio": ", ".join(set(iden_l)),
                    "Servicios": ", ".join(set(serv_l)),
                    "Metodos_Pago": ", ".join(set(pag_l)),
                    "Resena_Positiva_Autor": resena_positiva["autor"],
                    "Resena_Positiva_Estrellas": resena_positiva["estrellas"],
                    "Resena_Positiva_Texto": resena_positiva["texto"],
                    "Resena_Negativa_1_Autor": resenas_negativas[0]["autor"],
                    "Resena_Negativa_1_Estrellas": resenas_negativas[0]["estrellas"],
                    "Resena_Negativa_1_Texto": resenas_negativas[0]["texto"],
                    "Resena_Negativa_2_Autor": resenas_negativas[1]["autor"],
                    "Resena_Negativa_2_Estrellas": resenas_negativas[1]["estrellas"],
                    "Resena_Negativa_2_Texto": resenas_negativas[1]["texto"],
                    "URL_Google_Maps": url
                }
                
                empty_fields = [k for k, v in data.items() if not v and k not in ['Email', 'Dias_Abierto', 'Accesibilidad', 'Identidad_Negocio']]
                if len(empty_fields) > 5:
                    print(f"[LOG] ⚠️ {name}: {len(empty_fields)} campos vacíos ({', '.join(empty_fields[:4])}...)")
                    sys.stdout.flush()
                    
                all_resultados.append(data)
                print(f"[FOUND] {len(all_resultados)}")
                sys.stdout.flush()

        await browser.close()
        
        print("[PROGRESS] 100")
        if all_resultados:
            df = pd.DataFrame(all_resultados)
            df = df.drop_duplicates(subset=['Nombre', 'Direccion_Completa'], keep='first')
            
            resultados_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "resultados"))
            if not os.path.exists(resultados_dir): os.makedirs(resultados_dir)
            excel_path = os.path.join(resultados_dir, f"{file_prefix}.xlsx")
            
            df.to_excel(excel_path, index=False, engine='openpyxl')
            format_excel(excel_path)
            
            print(f"[LOG] Extraccion finalizada! {len(df)} negocios guardados y formateados en {excel_path}")
        else:
            print("[LOG] No se extrajeron datos.")
        sys.stdout.flush()

if __name__ == '__main__':
    asyncio.run(main())
