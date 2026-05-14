import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
import os
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

def process_url(url, session):
    """Procesa una URL individual: valida status 200 y busca 'Consulta en línea'."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Referer": "https://isla.merida.gob.mx/serviciosinternet/tramites/",
    }

    result = {
        "URL": url,
        "Estado": "Desconocido",
        "Tiene Consulta en Línea": "No"
    }

    try:
        # 1. Validación de URL (status 200)
        response = session.get(url, headers=headers, timeout=TIMEOUT)

        if response.status_code == 200:
            # Detectar bloqueo por Captcha
            if "captcha" in response.text.lower() or "activity and behavior on this site made us think that you are a bot" in response.text:
                result["Estado"] = "Bloqueado (Captcha)"
                return result

            result["Estado"] = "Válida"

            # 2. Verificar "Consulta en línea"
            # Se busca en el contenido HTML ignorando mayúsculas/minúsculas
            if re.search(r"Consulta en línea", response.text, re.I):
                result["Tiene Consulta en Línea"] = "Sí"
            else:
                # Búsqueda adicional en el texto renderizado si no se encontró en el crudo
                soup = BeautifulSoup(response.text, "html.parser")
                page_text = soup.get_text(separator=' ', strip=True)
                if re.search(r"Consulta en línea", page_text, re.I):
                    result["Tiene Consulta en Línea"] = "Sí"

        else:
            result["Estado"] = f"Caída (Error {response.status_code})"

    except requests.exceptions.Timeout:
        result["Estado"] = "Error: Timeout"
    except requests.exceptions.ConnectionError:
        result["Estado"] = "Error: Conexión"
    except Exception as e:
        result["Estado"] = f"Error: {type(e).__name__}"

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
    print("VALIDADOR DE TRÁMITES - AYUNTAMIENTO DE MÉRIDA")
    print("="*50)
    print(f"Iniciando procesamiento de {len(urls)} URLs...")

    try:
        for i, url in enumerate(urls):
            print(f"[{i+1}/{len(urls)}] Procesando: {url}")
            res = process_url(url, session)
            results.append(res)

            # Feedback inmediato
            print(f"    Estado: {res['Estado']} | En línea: {res['Tiene Consulta en Línea']}")

            # Delay para no saturar el servidor
            if i < len(urls) - 1:
                time.sleep(DELAY_BETWEEN_REQUESTS)

    except KeyboardInterrupt:
        print("\nProcesamiento cancelado.")

    if not results:
        print("No se obtuvieron resultados.")
        return

    # Generación de Reporte en Excel
    print(f"\nGenerando reporte: {OUTPUT_FILE}...")
    df = pd.DataFrame(results)

    try:
        df.to_excel(OUTPUT_FILE, index=False)
        print("Reporte generado exitosamente.")
    except Exception as e:
        print(f"Error al guardar el archivo Excel: {e}")

    # Resumen final en consola
    total_en_linea = (df["Tiene Consulta en Línea"] == "Sí").sum()
    print("\n" + "-"*30)
    print(f"Total con 'Consulta en línea': {total_en_linea}")
    print("-"*30)
    print(f"Archivo: {os.path.abspath(OUTPUT_FILE)}")
    print("="*50)

if __name__ == "__main__":
    main()
