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
        from playwright_stealth import stealth_sync
        async def stealth_async(page):
            stealth_sync(page)
    except ImportError:
        async def stealth_async(page):
            pass

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

# Solo UAs de Chrome: el motor es Chromium, un UA de Firefox/Safari delata al bot.
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-dev-shm-usage",  # evita crashes por /dev/shm pequeño en Docker
    "--lang=en-US",
]

# Cookies de consentimiento de Google: evitan la pantalla consent.google.com
# que aparece en servidores (IPs europeas / datacenter) y rompe la búsqueda.
CONSENT_COOKIES = []
for _dom in [".google.com"]:
    CONSENT_COOKIES += [
        {"name": "CONSENT", "value": "YES+cb.20240101-00-p0.en+FX+000", "domain": _dom, "path": "/", "secure": True},
        {"name": "SOCS", "value": "CAESHAgBEhJnd3NfMjAyNDAxMDEtMF9SQzIaAmVuIAEaBgiA_LiuBg", "domain": _dom, "path": "/", "secure": True},
    ]

RESULT_SELECTOR = 'a[href*="/maps/place/"], a.hfpxzc'

async def new_context(browser):
    """Crea un contexto con identidad aleatoria, cookies de consentimiento y webdriver oculto."""
    ctx = await browser.new_context(
        locale="en-US",
        viewport=random.choice(VIEWPORTS),
        user_agent=random.choice(USER_AGENTS),
        timezone_id="America/New_York",
        extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
    )
    try:
        await ctx.add_cookies(CONSENT_COOKIES)
    except Exception as e:
        print(f"[LOG] ⚠️ No se pudieron fijar cookies de consentimiento: {e}")
    await ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
    page = await ctx.new_page()
    await stealth_async(page)
    return ctx, page

async def accept_consent(page):
    """Si aun así aparece la pantalla de consentimiento, la acepta y devuelve True."""
    try:
        if "consent." not in page.url and await page.locator('form[action*="consent"]').count() == 0:
            return False
        print("[LOG] 🛡️ Resolviendo pantalla de consentimiento/cookies...")
        sys.stdout.flush()
        btn = page.locator('button, input[type="submit"]').filter(
            has_text=re.compile(r'^\s*(accept all|aceptar todo|acepto|i agree|alle akzeptieren|tout accepter|accetta tutto)\s*$', re.IGNORECASE)
        ).first
        if await btn.count() == 0:
            btn = page.locator('form[action*="consent"] button').last
        if await btn.count() > 0:
            await btn.click()
            try:
                await page.wait_for_url(re.compile(r'google\.[a-z.]+/maps'), timeout=15000)
            except Exception:
                pass
            await human_delay(page, 1500, 3000)
        return True
    except Exception as e:
        print(f"[LOG] ⚠️ Error resolviendo consentimiento: {e}")
        return False

async def dump_page_state(page, q):
    """Imprime en el terminal del dashboard lo que realmente se ve en la página."""
    try:
        title = await page.title()
    except Exception:
        title = "?"
    print(f"[LOG] ⚠️ URL actual: {page.url[:200]} | Título: {title}")
    try:
        body = (await page.locator('body').inner_text())[:600]
        body = re.sub(r'\s+', ' ', body).strip()
        print(f"[LOG] 🔎 Texto visible: {body or '(vacío)'}")
    except Exception:
        pass
    try:
        debug_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".jobs")
        os.makedirs(debug_dir, exist_ok=True)
        await page.screenshot(path=os.path.join(debug_dir, "debug.png"), full_page=True)
        with open(os.path.join(debug_dir, "debug.html"), "w", encoding="utf-8") as f:
            f.write(await page.content())
        print("[LOG] 📸 Captura y HTML guardados en backend/.jobs/debug.png y debug.html")
    except Exception as ex:
        print(f"[LOG] ❌ Error guardando captura: {ex}")
    sys.stdout.flush()

async def load_search_results(page, q):
    """
    Intenta cargar la lista de resultados con varias estrategias.
    Devuelve 'list' (hay lista), 'place' (resultado único) o None.
    """
    safe_query = urllib.parse.quote_plus(q)
    urls = [
        f"https://www.google.com/maps/search/{safe_query}?hl=en",
        f"https://www.google.com/maps/search/{safe_query}/?hl=en&gl=us",
        f"https://www.google.com/maps?q={safe_query}&hl=en",
    ]
    for attempt, url in enumerate(urls):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"[LOG] ⚠️ Error de navegación (intento {attempt+1}): {type(e).__name__}")
            sys.stdout.flush()
        await human_delay(page, 2000, 3500)

        if await accept_consent(page):
            # Tras el consentimiento Google a veces no vuelve a la búsqueda: re-navegar
            if "/maps/search" not in page.url and "/maps/place" not in page.url:
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await human_delay(page, 2000, 3500)
                except Exception:
                    pass

        if await is_blocked(page):
            return "blocked"

        try:
            await page.wait_for_selector(f'{RESULT_SELECTOR}, div[role="feed"], h1', timeout=20000, state='attached')
        except Exception:
            pass

        if await page.locator(RESULT_SELECTOR).count() > 0:
            return "list"
        if "/maps/place/" in page.url:
            return "place"
        try:
            no_res = await page.get_by_text(re.compile(r"Google Maps can't find|No results found|no encuentra", re.IGNORECASE)).count()
            if no_res > 0:
                print(f"[LOG] ℹ️ Google Maps indica que no hay resultados para: {q}")
                sys.stdout.flush()
                return None
        except Exception:
            pass
        print(f"[LOG] ⚠️ Sin lista de resultados (intento {attempt+1}/{len(urls)}). Probando otra estrategia...")
        sys.stdout.flush()
        await human_delay(page, 3000, 6000)

    await dump_page_state(page, q)
    return None

async def scroll_results_feed(page, max_scrolls, progress_cb=None):
    """Hace scroll directamente sobre el panel de resultados (más fiable que mouse.wheel)."""
    feed = page.locator('div[role="feed"]').first
    if await feed.count() == 0:
        return
    last_count, stale = 0, 0
    for i in range(max_scrolls):
        if progress_cb: progress_cb(i)
        try:
            await feed.evaluate("e => e.scrollBy(0, e.scrollHeight)")
            await human_delay(page, 1200, 2500)
            count = await page.locator('a[href*="/maps/place/"]').count()
            end = page.locator('span.HlvSq')
            if await end.count() > 0 and await end.first.is_visible():
                break
            if count == last_count:
                stale += 1
                if stale >= 4: break
            else:
                stale = 0
            last_count = count
        except Exception:
            pass

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
            'unusual traffic', 'automated queries', 'not a robot',
            'tráfico inusual', 'no soy un robot'
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
    if not t: return ""
    t = re.sub(r'[\ue000-\uf8ff\u200b\u00a0]', '', t)
    t = t.replace('\n', ' ').strip()
    return t if t else ""

def format_whatsapp_link(phone: str, existing_wa: str = "") -> str:
    """Genera un enlace limpio y directo de WhatsApp a partir del teléfono."""
    if existing_wa and ('wa.me' in existing_wa or 'whatsapp' in existing_wa):
        return existing_wa
    if not phone:
        return ""
    digits = re.sub(r'\D', '', phone)
    if not digits:
        return ""
    # Formato Venezuela (0414, 0424, 0412, 0416, 0426) -> 584...
    if len(digits) == 11 and digits.startswith(('0414', '0424', '0412', '0416', '0426')):
        digits = '58' + digits[1:]
    elif len(digits) == 10 and digits.startswith(('414', '424', '412', '416', '426')):
        digits = '58' + digits
    elif len(digits) == 10 and not digits.startswith('58'):
        # 10 dígitos estilo USA/internacional
        digits = '1' + digits
    return f"https://wa.me/{digits}"

async def get_socials_and_email_from_website(context, url: str) -> dict:
    """Abre la web en una nueva pestaña y extrae email, instagram, whatsapp y facebook."""
    res = {"email": "", "instagram": "", "whatsapp": "", "facebook": ""}
    if not url or 'google.com' in url or 'maps.google' in url:
        return res
    page = None
    try:
        page = await context.new_page()
        target = url if url.startswith('http') else 'https://' + url
        await page.goto(target, timeout=12000, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        
        links = await page.evaluate("Array.from(document.querySelectorAll('a[href]')).map(a => a.href)")
        emails = set()
        for href in links:
            hl = href.lower()
            if href.startswith('mailto:'):
                em = href.replace('mailto:', '').split('?')[0].strip()
                if '@' in em: emails.add(em)
            elif 'instagram.com/' in hl:
                if not any(x in hl for x in ['/p/', '/reel/', '/explore/', '/share', '/stories/', 'instagram.com/?']):
                    if not res["instagram"]: res["instagram"] = href.split('?')[0].strip()
            elif 'wa.me/' in hl or 'api.whatsapp.com/' in hl or 'whatsapp.com/send' in hl:
                if not res["whatsapp"]: res["whatsapp"] = href.strip()
            elif 'facebook.com/' in hl or 'fb.com/' in hl:
                if not any(x in hl for x in ['/sharer', '/share', '/events', '/plugins', 'facebook.com/?']):
                    if not res["facebook"]: res["facebook"] = href.split('?')[0].strip()
                    
        if not emails:
            text = await page.evaluate("document.body.innerText")
            matches = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
            for m in matches:
                ml = m.lower()
                if not any(x in ml for x in ['sentry', 'example', 'domain', '.png', '.jpg', '.gif', 'wix', 'square', 'cloudflare', 'bootstrap', 'webpack', '.webp']):
                    emails.add(m)
                    
        res["email"] = ", ".join(list(emails)[:2])
    except:
        pass
    finally:
        if page:
            try: await page.close()
            except: pass
    return res

def calculate_lead_score(data: dict) -> tuple:
    """
    Calcula el Lead Score (0 - 100) para Vission Solutions:
    Criterios de Oportunidad de Venta:
    - Negocio con clientela y dinero (muchas estrellas y reseñas)
    - Pero con brecha digital (sin web propia, sin instagram)
    - Con canal de contacto directo disponible (WhatsApp / Teléfono / Email)
    """
    score = 0
    try:
        rating = float(data.get("Calificacion") or 0)
    except:
        rating = 0.0

    if rating >= 4.7:
        score += 15
    elif rating >= 4.0:
        score += 10
    elif rating > 0:
        score += 5

    try:
        reviews = int(re.sub(r'\D', '', str(data.get("Total_Resenas") or "0")))
    except:
        reviews = 0

    if reviews >= 50:
        score += 25
    elif reviews >= 20:
        score += 20
    elif reviews >= 5:
        score += 15
    elif reviews >= 1:
        score += 5

    website = str(data.get("Sitio_Web") or "").strip().lower()
    instagram = str(data.get("Instagram") or "").strip()

    # ¿Tiene web?
    if not website:
        score += 25
    elif any(free in website for free in ['wixsite', 'wordpress.com', 'blogspot', 'linktr.ee', 'beacons.ai', 'carrd.co']):
        score += 15

    # ¿Tiene Instagram?
    if not instagram:
        score += 20

    # ¿Ficha no reclamada?
    if str(data.get("Reclamado") or "").lower() == "no":
        score += 5

    # Contactabilidad directa
    whatsapp = data.get("WhatsApp_Link") or ""
    phone = data.get("Telefono") or ""
    email = data.get("Email") or ""

    if whatsapp:
        score += 10
    elif phone:
        score += 5

    if email:
        score += 5

    score = min(score, 100)

    # Nivel de prioridad
    if score >= 70:
        prioridad = "Alta (Oro)"
    elif score >= 45:
        prioridad = "Media (Plata)"
    else:
        prioridad = "Estandar (Bronce)"

    # Diagnóstico sintetizado para el pitch
    if not website and not instagram:
        diagnostico = f"¡Candidato Ideal! {rating}★ ({reviews} reseñas) pero SIN Sitio Web ni Instagram. Contactable vía WhatsApp."
    elif not website:
        diagnostico = f"Clientela activa ({reviews} reseñas, {rating}★) pero SIN Sitio Web. Ofrecer desarrollo web profesional."
    elif not instagram:
        diagnostico = f"Cuenta con web pero SIN Instagram ({rating}★). Ofrecer gestión y crecimiento de redes sociales."
    else:
        diagnostico = f"Presencia digital activa ({rating}★, {reviews} reseñas). Oportunidad de marketing y optimización."

    return score, prioridad, diagnostico

def format_excel_workbook(filepath):
    """Aplica formato profesional con estilos corporativos y enlaces de WhatsApp."""
    try:
        wb = load_workbook(filepath)
        header_fill_top = PatternFill(start_color="0F2027", end_color="0F2027", fill_type="solid")
        header_fill_all = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True, size=11, name="Segoe UI")
        thin_border = Border(
            left=Side(style='thin', color="D9D9D9"),
            right=Side(style='thin', color="D9D9D9"),
            top=Side(style='thin', color="D9D9D9"),
            bottom=Side(style='thin', color="D9D9D9")
        )

        for ws in wb.worksheets:
            is_top = (ws.title == "Top Oportunidades")
            h_fill = header_fill_top if is_top else header_fill_all

            for cell in ws[1]:
                cell.fill = h_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                cell.border = thin_border
            ws.row_dimensions[1].height = 28

            whatsapp_col = None
            score_col = None
            prioridad_col = None

            for idx, cell in enumerate(ws[1], start=1):
                if cell.value == "WhatsApp_Link": whatsapp_col = idx
                elif cell.value == "Lead_Score": score_col = idx
                elif cell.value == "Prioridad": prioridad_col = idx

            for row in ws.iter_rows(min_row=2):
                ws.row_dimensions[row[0].row].height = 22
                is_gold = False
                is_silver = False
                if prioridad_col:
                    pval = str(row[prioridad_col - 1].value or "")
                    if "Oro" in pval: is_gold = True
                    elif "Plata" in pval: is_silver = True

                for c_idx, cell in enumerate(row, start=1):
                    cell.border = thin_border
                    cell.font = Font(name="Segoe UI", size=10)
                    cell.alignment = Alignment(vertical='center', wrap_text=True)

                    if c_idx == whatsapp_col and cell.value and str(cell.value).startswith('http'):
                        url = str(cell.value)
                        cell.hyperlink = url
                        cell.value = url
                        cell.font = Font(name="Segoe UI", size=10, color="008000", bold=True, underline="single")
                        cell.alignment = Alignment(horizontal='center', vertical='center')

                    if c_idx == score_col and cell.value is not None:
                        cell.alignment = Alignment(horizontal='center', vertical='center')
                        cell.font = Font(name="Segoe UI", size=11, bold=True)
                        if is_gold:
                            cell.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
                        elif is_silver:
                            cell.fill = PatternFill(start_color="DDEBF7", end_color="DDEBF7", fill_type="solid")

                    if c_idx == prioridad_col and cell.value:
                        cell.alignment = Alignment(horizontal='center', vertical='center')
                        cell.font = Font(name="Segoe UI", size=10, bold=True)
                        if is_gold:
                            cell.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
                        elif is_silver:
                            cell.fill = PatternFill(start_color="DDEBF7", end_color="DDEBF7", fill_type="solid")

            for col in ws.columns:
                header_val = col[0].value
                max_len = len(str(header_val or ""))
                for cell in col[1:25]:
                    if cell.value:
                        vstr = str(cell.value)
                        if not vstr.startswith("http"):
                            max_len = max(max_len, min(len(vstr), 45))
                col_letter = col[0].column_letter
                ws.column_dimensions[col_letter].width = max(max_len + 4, 13)

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
        browser = await p.chromium.launch(headless=True, args=LAUNCH_ARGS)
        context, page = await new_context(browser)
        
        all_resultados = []
        
        for index, q in enumerate(queries):
            if index > 0:
                pause = random.randint(8, 15)
                print(f"[LOG] Pausa de {pause}s antes de la siguiente busqueda...")
                sys.stdout.flush()
                await page.wait_for_timeout(pause * 1000)
            
            print(f"[LOG] Busqueda ({index+1}/{total_queries}): '{q}'...")
            sys.stdout.flush()
            
            status = await load_search_results(page, q)
            if status == "blocked":
                print("[LOG] 🚫 Bloqueo detectado! Esperando 60s y rotando identidad...")
                sys.stdout.flush()
                await page.wait_for_timeout(60000)
                await context.close()
                context, page = await new_context(browser)
                status = await load_search_results(page, q)
                if status == "blocked":
                    print("[LOG] ❌ Bloqueo persiste (la IP del servidor está marcada por Google). Saltando esta búsqueda.")
                    sys.stdout.flush()
                    await dump_page_state(page, q)
                    continue
            if status is None:
                print(f"[LOG] ⚠️ No se encontraron resultados para: {q}")
                sys.stdout.flush()
                continue
            
            if status == "place":
                # Google saltó directo a una ficha (resultado único)
                unique_links = [page.url]
            else:
                print("[LOG] Scroll profundo en la lista de resultados...")
                sys.stdout.flush()
                
                def _progress(i):
                    base_pct = int((index / total_queries) * 100)
                    scroll_pct = int((i / MAX_SCROLLS) * (100 / total_queries) * 0.25)
                    print(f"[PROGRESS] {base_pct + scroll_pct}")
                    sys.stdout.flush()
                
                await scroll_results_feed(page, MAX_SCROLLS, _progress)
                
                links = await page.locator('a[href*="/maps/place/"]').evaluate_all("elements => elements.map(e => e.href)")
                unique_links = list(dict.fromkeys(links))
            print(f"[LOG] {len(unique_links)} negocios encontrados en '{q}'")
            sys.stdout.flush()
            
            for j, url in enumerate(unique_links):
                if j > 0 and j % random.randint(15, 20) == 0:
                    print(f"[LOG] Rotando identidad del navegador...")
                    sys.stdout.flush()
                    await context.close()
                    context, page = await new_context(browser)
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
                            await context.close()
                            context, page = await new_context(browser)
                            continue
                        
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
                            if candidate and not re.match(r'^[\d.,]+$', candidate) and candidate not in ['Overview', 'About', 'Información', 'Resumen']:
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
                        if re.match(r'^\d+\s+\w+.*(St|Ave|Blvd|Dr|Rd|Way|Ln|Ct|Pl|Pkwy|Hwy|Av\.|Calle|Carrera)', line, re.IGNORECASE):
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
                    elif len(parts) == 2:
                        ciudad = parts[0]
                        estado = parts[1]
                            
                    if not codigo_postal:
                        mz = re.search(r'\b\d{4,5}\b', address)
                        if mz: codigo_postal = mz.group(0)
                
                # ============ CONTACTO (TELEFONO / WHATSAPP / WEB / REDES) ============
                phone = (
                    await clean(await get_text(page, 'button[data-item-id^="phone:tel:"]'))
                    or await clean(await get_text(page, 'a[data-item-id^="phone:tel:"]'))
                    or await clean(await get_text(page, 'button[data-tooltip*="tel" i]'))
                    or ""
                )
                if not phone:
                    try:
                        tel_a = page.locator('a[href^="tel:"]').first
                        if await tel_a.count() > 0:
                            thref = await tel_a.get_attribute('href')
                            if thref: phone = thref.replace('tel:', '').strip()
                    except: pass

                if not phone:
                    for line in main_lines:
                        m = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}', line)
                        if m and len(re.sub(r'\D', '', m.group(0))) >= 7:
                            phone = m.group(0).strip()
                            break

                # Website y Enlaces Externos
                website = ""
                raw_website = (
                    await clean(await get_text(page, 'a[data-item-id="authority"]'))
                    or await clean(await get_text(page, 'a[data-tooltip*="website" i]'))
                    or ""
                )
                website_href = ""
                try:
                    wloc = page.locator('a[data-item-id="authority"], a[data-tooltip*="website" i], a[aria-label*="Sitio web" i]').first
                    if await wloc.count() > 0:
                        website_href = await wloc.get_attribute("href") or ""
                except: pass

                whatsapp_link = ""
                instagram = ""
                facebook = ""

                # Comprobar si el botón de sitio web es en realidad WhatsApp o Redes
                wh_check = website_href.lower() if website_href else raw_website.lower()
                if 'wa.me/' in wh_check or 'api.whatsapp.com' in wh_check or 'whatsapp.com' in wh_check:
                    whatsapp_link = website_href or raw_website
                elif 'instagram.com/' in wh_check:
                    instagram = (website_href or raw_website).split('?')[0].strip()
                elif 'facebook.com/' in wh_check:
                    facebook = (website_href or raw_website).split('?')[0].strip()
                elif raw_website or website_href:
                    website = website_href if website_href.startswith('http') else raw_website

                # Extraer enlaces de redes sociales presentes directamente en la ficha de Google Maps
                try:
                    gmaps_socials = await page.evaluate("""
                        Array.from(document.querySelectorAll('a[href]'))
                            .map(a => a.href)
                            .filter(h => h.includes('instagram.com/') || h.includes('facebook.com/') || h.includes('wa.me/'))
                    """)
                    for sl in gmaps_socials:
                        sll = sl.lower()
                        if 'instagram.com/' in sll and not instagram:
                            if not any(x in sll for x in ['/p/', '/reel/', '/explore/']):
                                instagram = sl.split('?')[0].strip()
                        elif ('wa.me/' in sll or 'api.whatsapp.com' in sll) and not whatsapp_link:
                            whatsapp_link = sl.strip()
                        elif 'facebook.com/' in sll and not facebook:
                            facebook = sl.split('?')[0].strip()
                except: pass

                # Extraer emails y redes desde el sitio web si existe
                email = ""
                if website and not any(x in website.lower() for x in ['google.com', 'wa.me', 'instagram.com', 'facebook.com']):
                    social_data = await get_socials_and_email_from_website(context, website)
                    if social_data["email"]: email = social_data["email"]
                    if not instagram and social_data["instagram"]: instagram = social_data["instagram"]
                    if not whatsapp_link and social_data["whatsapp"]: whatsapp_link = social_data["whatsapp"]
                    if not facebook and social_data["facebook"]: facebook = social_data["facebook"]

                # Si tenemos teléfono pero no link de WhatsApp, generarlo automáticamente
                if not whatsapp_link and phone:
                    whatsapp_link = format_whatsapp_link(phone)

                # ============ FILTRO ESTRICTO DE CONTACTABILIDAD ============
                # Descartar negocios sin NINGÚN método de contacto (Teléfono, WhatsApp, Email, Instagram)
                has_contact = bool(phone or whatsapp_link or email or instagram)
                if not has_contact:
                    print(f"[LOG] ⏩ Descartando '{name}' (Sin teléfono, WhatsApp, Email ni Instagram)")
                    sys.stdout.flush()
                    continue

                # ============ CALIFICACION Y RESEÑAS ============
                rating, reviews_count = "", ""
                try:
                    star_span = page.locator('span[role="img"][aria-label*="star"], span[role="img"][aria-label*="estrella"]').first
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
                        if any(k in tab_aria.lower() for k in ['review', 'reseña', 'opinione']):
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
                        if cl and len(cl) > 3 and ('am' in cl.lower() or 'pm' in cl.lower() or 'hour' in cl.lower() or 'open' in cl.lower() or 'abierto' in cl.lower()):
                            raw_hours = cl
                            break
                
                h_aria = ""
                if not raw_hours:
                    try:
                        hour_btn = page.locator('button[aria-label*="Monday"], button[aria-label*="Lunes"], div[aria-label*="Monday"]').first
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
                        if "24 hours" in raw_hours.lower() or "24 horas" in raw_hours.lower():
                            cierre = "24 Horas"
                            apertura = "24 Horas"

                dias_set = set()
                if not h_aria:
                    try:
                        hour_btn = page.locator('button[aria-label*="Monday"], button[aria-label*="Lunes"]').first
                        if await hour_btn.count() > 0:
                            h_aria = await hour_btn.get_attribute("aria-label") or ""
                    except: pass
                
                if h_aria:
                    for day_name in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']:
                        if day_name in h_aria:
                            day_section = h_aria.split(day_name)
                            if len(day_section) > 1 and not any(c in day_section[1].split(';')[0].lower() for c in ['closed', 'cerrado']):
                                dias_set.add(day_name[:3])
                    if dias_set:
                        dias_abierto = ", ".join(sorted(list(dias_set)))
                
                # ============ RECLAMADO ============
                is_claimed = "Si"
                try:
                    claim = page.locator('[data-item-id="merchant"], a:has-text("Claim this business"), a:has-text("Reclamar esta empresa")').first
                    if await claim.count() > 0: is_claimed = "No"
                except: pass
                
                # ============ ATRIBUTOS CLASIFICADOS (BILINGÜE) ============
                acc_l, iden_l, serv_l, pag_l = [], [], [], []
                try:
                    about_btn = page.locator('button[role="tab"]').filter(has_text=re.compile(r'about|informaci[oó]n|acerca de', re.IGNORECASE)).first
                    if await about_btn.count() > 0:
                        await about_btn.click()
                        await human_delay(page, 800, 1800)
                        
                        abt_text = await page.locator('div[role="main"]').first.inner_text()
                        abt_lines = [l.strip() for l in abt_text.split('\n') if l.strip()]
                        
                        junk = {"about", "overview", "accessibility", "amenities", "planning", "payments", "crowd", "children", "offerings", "highlights", "popular for", "from the business", "service options", "health & safety", "getting here", "directions", "save", "nearby", "send to phone", "photos", "reviews", "información", "resumen", "accesibilidad", "pagos", "servicios"}
                        
                        for aline in abt_lines:
                            aline = re.sub(r'[\ue000-\uf8ff]', '', aline).strip()
                            if len(aline) < 4 or aline.lower() in junk or re.search(r'\d{4,}', aline): continue
                            if name and aline == name: continue
                            
                            al = aline.lower()
                            if any(k in al for k in ['wheelchair', 'accesible', 'accessible', 'blind', 'mobility', 'silla de ruedas']):
                                acc_l.append(aline)
                            elif any(k in al for k in ['owned', 'identifies as', 'se identifica', 'mujeres', 'propietari']):
                                iden_l.append(aline)
                            elif any(k in al for k in ['credit card', 'debit card', 'cash', 'check', 'pago', 'tarjeta', 'nfc', 'efectivo']):
                                pag_l.append(aline)
                            else:
                                if aline[0].isalpha(): serv_l.append(aline)
                        
                        try:
                            ov = page.locator('button[role="tab"]').filter(has_text=re.compile(r'overview|resumen|general', re.IGNORECASE)).first
                            if await ov.count() > 0:
                                await ov.click()
                                await human_delay(page, 400, 1000)
                        except: pass
                except: pass
                
                # ============ RESEÑAS DESTACADAS (BILINGÜE) ============
                resena_positiva = {"autor": "", "estrellas": "", "texto": ""}
                resenas_negativas = [{"autor": "", "estrellas": "", "texto": ""} for _ in range(2)]
                
                try:
                    tabs = page.locator('button[role="tab"]')
                    for ti in range(await tabs.count()):
                        tab_aria = await tabs.nth(ti).get_attribute("aria-label") or ""
                        if any(k in tab_aria.lower() for k in ['review', 'reseña', 'opinione']):
                            await tabs.nth(ti).click()
                            await human_delay(page, 1500, 3000)
                            
                            cards = page.locator('.jJc9Ad, div[data-review-id]')
                            cc = await cards.count()
                            if not reviews_count and cc > 0: reviews_count = str(cc)
                            
                            if cc > 0:
                                # Menor calificación (Negativas)
                                sort_menu = page.locator('button[aria-label*="Sort"], button[data-value="Sort"], button[aria-label*="Ordenar"]')
                                if await sort_menu.count() > 0:
                                    await sort_menu.first.click()
                                    await human_delay(page, 500, 1000)
                                    lowest_btn = page.locator('div[role="menuitemradio"]').filter(has_text=re.compile(r'lowest|menor|m[aá]s baja', re.IGNORECASE)).first
                                    if await lowest_btn.count() > 0:
                                        await lowest_btn.click()
                                        await human_delay(page, 1500, 2500)
                                        cards_neg = page.locator('.jJc9Ad, div[data-review-id]')
                                        for c_idx in range(min(await cards_neg.count(), 2)):
                                            card = cards_neg.nth(c_idx)
                                            try:
                                                more = card.locator('button.w8nwRe, button:has-text("More"), button:has-text("Más")').first
                                                if await more.count() > 0 and await more.is_visible():
                                                    await more.click()
                                                    await human_delay(page, 200, 500)
                                            except: pass
                                            try:
                                                a_el = card.locator('.d4r55').first
                                                if await a_el.count() > 0: resenas_negativas[c_idx]["autor"] = (await a_el.inner_text()).strip()
                                            except: pass
                                            try:
                                                s_el = card.locator('span[role="img"][aria-label*="star"], span[role="img"][aria-label*="estrella"]').first
                                                if await s_el.count() > 0:
                                                    sm = re.search(r'([\d.]+)', await s_el.get_attribute("aria-label"))
                                                    if sm: resenas_negativas[c_idx]["estrellas"] = sm.group(1)
                                            except: pass
                                            try:
                                                t_el = card.locator('.wiI7pd').first
                                                if await t_el.count() > 0: resenas_negativas[c_idx]["texto"] = (await t_el.inner_text()).strip()
                                            except: pass
                                
                                # Mayor calificación (Positivas)
                                sort_menu = page.locator('button[aria-label*="Sort"], button[data-value="Sort"], button[aria-label*="Ordenar"]')
                                if await sort_menu.count() > 0:
                                    await sort_menu.first.click()
                                    await human_delay(page, 500, 1000)
                                    highest_btn = page.locator('div[role="menuitemradio"]').filter(has_text=re.compile(r'highest|mayor|m[aá]s alta', re.IGNORECASE)).first
                                    if await highest_btn.count() > 0:
                                        await highest_btn.click()
                                        await human_delay(page, 1500, 2500)
                                        cards_pos = page.locator('.jJc9Ad, div[data-review-id]')
                                        if await cards_pos.count() > 0:
                                            card = cards_pos.nth(0)
                                            try:
                                                more = card.locator('button.w8nwRe, button:has-text("More"), button:has-text("Más")').first
                                                if await more.count() > 0 and await more.is_visible():
                                                    await more.click()
                                                    await human_delay(page, 200, 500)
                                            except: pass
                                            try:
                                                a_el = card.locator('.d4r55').first
                                                if await a_el.count() > 0: resena_positiva["autor"] = (await a_el.inner_text()).strip()
                                            except: pass
                                            try:
                                                s_el = card.locator('span[role="img"][aria-label*="star"], span[role="img"][aria-label*="estrella"]').first
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

                # ============ LEAD SCORING (VISSION SOLUTIONS) ============
                score, prioridad, diagnostico = calculate_lead_score({
                    "Calificacion": rating,
                    "Total_Resenas": reviews_count,
                    "Sitio_Web": website,
                    "Instagram": instagram,
                    "WhatsApp_Link": whatsapp_link,
                    "Telefono": phone,
                    "Email": email,
                    "Reclamado": is_claimed
                })

                data = {
                    # Indicadores Comerciales
                    "Lead_Score": score,
                    "Prioridad": prioridad,
                    "Razon_Oportunidad": diagnostico,
                    "WhatsApp_Link": whatsapp_link,
                    
                    # Identificación
                    "Nombre": name,
                    "Categoria": category,
                    
                    # Contacto Directo
                    "Telefono": phone,
                    "Email": email,
                    "Instagram": instagram,
                    "Sitio_Web": website,
                    
                    # Reputación
                    "Calificacion": rating,
                    "Total_Resenas": reviews_count,
                    "Reclamado": is_claimed,
                    
                    # Ubicación
                    "Direccion_Completa": address,
                    "Ciudad": ciudad,
                    "Estado": estado,
                    "Codigo_Postal": codigo_postal,
                    
                    # Horarios
                    "Horario_Apertura": apertura,
                    "Horario_Cierre": cierre,
                    "Dias_Abierto": dias_abierto,
                    
                    # Atributos adicionales
                    "Accesibilidad": ", ".join(set(acc_l)),
                    "Identidad_Negocio": ", ".join(set(iden_l)),
                    "Servicios": ", ".join(set(serv_l)),
                    "Metodos_Pago": ", ".join(set(pag_l)),
                    
                    # Reseñas
                    "Resena_Positiva_Autor": resena_positiva["autor"],
                    "Resena_Positiva_Estrellas": resena_positiva["estrellas"],
                    "Resena_Positiva_Texto": resena_positiva["texto"],
                    "Resena_Negativa_1_Autor": resenas_negativas[0]["autor"],
                    "Resena_Negativa_1_Estrellas": resenas_negativas[0]["estrellas"],
                    "Resena_Negativa_1_Texto": resenas_negativas[0]["texto"],
                    
                    # Origen
                    "URL_Google_Maps": url,
                    "Consulta_Busqueda": q
                }
                
                all_resultados.append(data)
                print(f"[FOUND] {len(all_resultados)}")
                sys.stdout.flush()

        await browser.close()
        
        print("[PROGRESS] 100")
        if all_resultados:
            df_all = pd.DataFrame(all_resultados)
            df_all = df_all.drop_duplicates(subset=['Nombre', 'Direccion_Completa'], keep='first')
            
            # Ordenar por Score descendente y total de reseñas numéricamente
            df_all['__reviews_num'] = pd.to_numeric(df_all['Total_Resenas'].astype(str).str.replace(r'\D', '', regex=True), errors='coerce').fillna(0)
            df_all = df_all.sort_values(by=['Lead_Score', '__reviews_num'], ascending=[False, False])
            df_all = df_all.drop(columns=['__reviews_num'])
            
            # Hoja 1: Top Oportunidades (enfocada 100% en ventas / prospección)
            top_cols = [
                "Lead_Score",
                "Prioridad",
                "Razon_Oportunidad",
                "WhatsApp_Link",
                "Telefono",
                "Email",
                "Instagram",
                "Sitio_Web",
                "Nombre",
                "Calificacion",
                "Total_Resenas",
                "Categoria",
                "Ciudad",
                "Direccion_Completa",
                "URL_Google_Maps"
            ]
            valid_top_cols = [c for c in top_cols if c in df_all.columns]
            df_top = df_all[valid_top_cols].copy()
            
            resultados_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "resultados"))
            if not os.path.exists(resultados_dir): os.makedirs(resultados_dir)
            excel_path = os.path.join(resultados_dir, f"{file_prefix}.xlsx")
            
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df_top.to_excel(writer, sheet_name="Top Oportunidades", index=False)
                df_all.to_excel(writer, sheet_name="Todos los Contactos", index=False)
                
            format_excel_workbook(excel_path)
            
            print(f"[LOG] Extraccion finalizada! {len(df_all)} negocios guardados y formateados en {excel_path}")
        else:
            print("[LOG] No se extrajeron datos.")
        sys.stdout.flush()

if __name__ == '__main__':
    asyncio.run(main())
