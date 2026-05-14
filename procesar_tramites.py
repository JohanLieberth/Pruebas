import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
import os
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

# Configuración
INPUT_FILE = "urls_entrada.xlsx"
OUTPUT_FILE = "resultado_tramites.xlsx"
DELAY_BETWEEN_REQUESTS = 2  # Segundos
TIMEOUT = 15  # Segundos

def create_session():
    """Crea una sesión de requests con estrategia de reintentos."""
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"]
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

def check_online_availability(url, session):
    """Verifica si una URL contiene indicadores de servicios en línea."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Referer": "https://isla.merida.gob.mx/serviciosinternet/tramites/",
    }

    result = {
        "URL": url,
        "Estado": "Pendiente",
        "Tiene Consulta en Línea": "No"
    }

    try:
        response = session.get(url, headers=headers, timeout=TIMEOUT)

        if response.status_code == 200:
            html_content = response.text
            # Detectar bloqueo por Captcha
            if "captcha" in html_content.lower() or "activity and behavior on this site made us think that you are a bot" in html_content:
                result["Estado"] = "Bloqueado (Captcha)"
                return result

            result["Estado"] = "Válida"

            # Buscamos múltiples variantes que indican servicio en línea
            # "Consulta en línea" o "Trámite en línea"
            keywords = [r"Consulta en línea", r"Trámite en línea", r"Iniciar trámite"]
            pattern = "|".join(keywords)

            if re.search(pattern, html_content, re.I):
                result["Tiene Consulta en Línea"] = "Sí"
            else:
                # Búsqueda profunda en texto procesado
                soup = BeautifulSoup(html_content, "html.parser")
                page_text = soup.get_text(separator=' ', strip=True)
                if re.search(pattern, page_text, re.I):
                    result["Tiene Consulta en Línea"] = "Sí"
                else:
                    # Verificar si existe algún enlace que apunte a "Iniciar sesión" o "Registro"
                    # que suele ser parte del flujo "en línea"
                    if soup.find("a", href=re.compile(r"registro|iniciar", re.I)):
                        # Esta es una heurística más agresiva, podrías ajustarla
                        pass

        else:
            result["Estado"] = f"Error {response.status_code}"

    except Exception as e:
        result["Estado"] = f"Error: {type(e).__name__}"

    return result

def main():
    # Cargar URLs desde Excel si existe, si no usar lista interna
    urls = []
    if os.path.exists(INPUT_FILE):
        try:
            df_input = pd.read_excel(INPUT_FILE)
            # Asumimos que la primera columna contiene las URLs
            urls = df_input.iloc[:, 0].dropna().tolist()
            print(f"Cargadas {len(urls)} URLs desde {INPUT_FILE}")
        except Exception as e:
            print(f"Error al leer {INPUT_FILE}: {e}")

    if not urls:
        print("Usando lista de URLs predeterminada (no se encontró Excel de entrada)...")
        urls = [
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/348",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/518",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/568",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/781",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/325",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/534",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/508",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/565",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/327",
            "https://isla.merida.gob.mx/serviciosinternet/tramites/detalle/458"
        ]

    session = create_session()
    results = []

    print("="*50)
    print("ESCANER DE TRÁMITES EN LÍNEA")
    print("="*50)

    for i, url in enumerate(urls):
        print(f"[{i+1}/{len(urls)}] Analizando: {url}")
        res = check_online_availability(url, session)
        results.append(res)

        status_info = res["Estado"]
        if res["Tiene Consulta en Línea"] == "Sí":
            status_info += " [CON CONSULTA EN LÍNEA]"
        print(f"    -> {status_info}")

        if i < len(urls) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    df = pd.DataFrame(results)
    df.to_excel(OUTPUT_FILE, index=False)

    # Resumen
    total_con = (df["Tiene Consulta en Línea"] == "Sí").sum()
    total_sin = (df["Tiene Consulta en Línea"] == "No").sum()
    total_bloqueadas = (df["Estado"] == "Bloqueado (Captcha)").sum()

    print("\n" + "-"*30)
    print("RESUMEN DE RESULTADOS")
    print("-"*30)
    print(f"Total CON 'Consulta en línea': {total_con}")
    print(f"Total SIN 'Consulta en línea': {total_sin}")
    print(f"Total de páginas bloqueadas:  {total_bloqueadas}")
    print("-"*30)
    print(f"Reporte generado: {OUTPUT_FILE}")
    print("="*50)

if __name__ == "__main__":
    main()
