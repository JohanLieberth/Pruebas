import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
import os
import sys
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
    """Procesa una URL individual y extrae la información requerida."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
        "Referer": "https://isla.merida.gob.mx/serviciosinternet/tramites/",
    }

    result = {
        "URL": url,
        "Estado": "Desconocido",
        "Tipo": "N/A",
        "Nombre": "N/A",
        "Área Responsable": "N/A",
        "Tiene Consulta en Línea": "No"
    }

    try:
        # Validación de URL (status 200)
        response = session.get(url, headers=headers, timeout=TIMEOUT)

        if response.status_code == 200:
            # Detectar bloqueo por Captcha
            if "captcha" in response.text.lower() or "activity and behavior on this site made us think that you are a bot" in response.text:
                result["Estado"] = "Bloqueado (Captcha)"
                return result

            result["Estado"] = "Válida"
            # Manejo de codificación UTF-8 para acentos
            response.encoding = 'utf-8'
            soup = BeautifulSoup(response.text, "html.parser")

            # Extraer texto plano con separador para evitar pegar palabras
            page_text = soup.get_text(separator=' ', strip=True)

            # 1. Clasificación (Trámite o Servicio) y Nombre
            # Buscamos patrones como "Trámite: [Nombre]" o "Servicio: [Nombre]"
            match_tramite = re.search(r"Trámite\s*:\s*(.+?)(?=Alias|Denominación|Homoclave|$)", page_text, re.I)
            match_servicio = re.search(r"Servicio\s*:\s*(.+?)(?=Alias|Denominación|Homoclave|$)", page_text, re.I)

            if match_tramite:
                result["Tipo"] = "Trámite"
                result["Nombre"] = match_tramite.group(1).strip()
            elif match_servicio:
                result["Tipo"] = "Servicio"
                result["Nombre"] = match_servicio.group(1).strip()

            # 2. Área Responsable
            # Buscamos "Denominación del área(s) responsables :"
            match_area = re.search(r"Denominación del área\(s\) responsables\s*:\s*(.+?)(?=Homoclave|Fecha|Acerca|$)", page_text, re.I)
            if match_area:
                result["Área Responsable"] = match_area.group(1).strip()

            # 3. Consulta en Línea
            # Verificamos si existe el indicador "Consulta en línea" o "Trámite en línea"
            # Se busca en el texto general y específicamente en elementos que podrían ser botones
            if re.search(r"(Consulta|Trámite) en línea", page_text, re.I):
                result["Tiene Consulta en Línea"] = "Sí"
            else:
                # Búsqueda más específica en etiquetas comunes de botones
                btn_keywords = ["Consulta en línea", "Trámite en línea", "Iniciar trámite"]
                found_btn = False
                for kw in btn_keywords:
                    if soup.find(lambda tag: tag.name in ["a", "button", "span"] and kw.lower() in tag.text.lower()):
                        found_btn = True
                        break
                if found_btn:
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
    # Se puede modificar para leer de un archivo si se desea:
    # if os.path.exists("urls.txt"): urls = open("urls.txt").read().splitlines()

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
    print("PROCESADOR DE TRÁMITES Y SERVICIOS - AYUNTAMIENTO DE MÉRIDA")
    print("="*50)
    print(f"Iniciando procesamiento de {len(urls)} URLs...")

    try:
        for i, url in enumerate(urls):
            print(f"[{i+1}/{len(urls)}] Procesando: {url}")
            res = process_url(url, session)
            results.append(res)

            # Feedback inmediato en consola
            status_print = res['Estado']
            if res['Estado'] == 'Válida':
                status_print += f" ({res['Tipo']}: {res['Nombre'][:30]}...)"
            print(f"    Resultado: {status_print}")

            # Delay para no saturar el servidor
            if i < len(urls) - 1:
                time.sleep(DELAY_BETWEEN_REQUESTS)

    except KeyboardInterrupt:
        print("\nProcesamiento cancelado por el usuario.")

    if not results:
        print("No se obtuvieron resultados.")
        return

    # Generación de Reporte en Excel
    print(f"\nGenerando reporte: {OUTPUT_FILE}...")
    df = pd.DataFrame(results)

    # Reordenar columnas para el reporte
    column_order = ["URL", "Estado", "Tipo", "Nombre", "Área Responsable", "Tiene Consulta en Línea"]
    df = df[column_order]

    try:
        df.to_excel(OUTPUT_FILE, index=False)
        print("Reporte generado exitosamente.")
    except Exception as e:
        print(f"Error al guardar el archivo Excel: {e}")

    # Resumen final en consola
    total_urls = len(results)
    validas = (df["Estado"] == "Válida").sum()
    total_en_linea = (df["Tiene Consulta en Línea"] == "Sí").sum()

    print("\n" + "-"*30)
    print("RESUMEN DE EJECUCIÓN")
    print("-"*30)
    print(f"Total de URLs analizadas: {total_urls}")
    print(f"URLs válidas:             {validas}")
    print(f"Con 'Consulta en línea':  {total_en_linea}")
    print("-"*30)
    print(f"Archivo de salida: {os.path.abspath(OUTPUT_FILE)}")
    print("="*50)

if __name__ == "__main__":
    main()
