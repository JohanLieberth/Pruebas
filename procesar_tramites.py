import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

# Configuración
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

def check_consulta_en_linea(url, session):
    """Verifica si una URL contiene el dato 'Consulta en línea'."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Referer": "https://isla.merida.gob.mx/serviciosinternet/tramites/",
    }

    result = {
        "URL": url,
        "Tiene Consulta en Línea": "No"
    }

    try:
        response = session.get(url, headers=headers, timeout=TIMEOUT)

        if response.status_code == 200:
            # Detectar bloqueo por Captcha como "No" (ya que no podemos ver el dato)
            if "captcha" in response.text.lower() or "activity and behavior on this site made us think that you are a bot" in response.text:
                return result

            # Verificar "Consulta en línea" en el HTML
            if re.search(r"Consulta en línea", response.text, re.I):
                result["Tiene Consulta en Línea"] = "Sí"
            else:
                # Búsqueda en texto procesado por BeautifulSoup
                soup = BeautifulSoup(response.text, "html.parser")
                page_text = soup.get_text(separator=' ', strip=True)
                if re.search(r"Consulta en línea", page_text, re.I):
                    result["Tiene Consulta en Línea"] = "Sí"

    except Exception:
        # En caso de error, se mantiene como "No"
        pass

    return result

def main():
    # Lista de URLs de entrada
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
    print("ANALIZADOR: 'CONSULTA EN LÍNEA'")
    print("="*50)
    print(f"Procesando {len(urls)} URLs...")

    for i, url in enumerate(urls):
        print(f"[{i+1}/{len(urls)}] Analizando: {url}")
        res = check_consulta_en_linea(url, session)
        results.append(res)

        # Delay respetuoso
        if i < len(urls) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    # Generar DataFrame y Reporte
    df = pd.DataFrame(results)
    df.to_excel(OUTPUT_FILE, index=False)

    # Cálculos finales
    total_con = (df["Tiene Consulta en Línea"] == "Sí").sum()
    total_sin = (df["Tiene Consulta en Línea"] == "No").sum()

    print("\n" + "-"*30)
    print("RESULTADOS FINALES")
    print("-"*30)
    print(f"Total CON 'Consulta en línea': {total_con}")
    print(f"Total SIN 'Consulta en línea': {total_sin}")
    print("-"*30)
    print(f"Reporte guardado en: {OUTPUT_FILE}")
    print("="*50)

if __name__ == "__main__":
    main()
