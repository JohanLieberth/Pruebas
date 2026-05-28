# Quiniela Mundial 2026 - Google Apps Script

Este proyecto implementa un sistema completo de quiniela (pronósticos deportivos) para la Copa Mundial de la FIFA 2026 utilizando Google Sheets como base de datos y Google Apps Script como motor de backend y alojamiento de la Web App.

## 🚀 Instrucciones de Instalación

1.  **Crear un nuevo Google Sheet:** Ve a [sheets.new](https://sheets.new).
2.  **Abrir el editor de scripts:** Haz clic en `Extensiones` > `Apps Script`.
3.  **Copiar el código:**
    *   Crea un archivo llamado `Code.gs` y pega el contenido de `Code.gs` de este repositorio.
    *   Crea un archivo llamado `Index.html` y pega el contenido de `Index.html`.
4.  **Inicializar el sistema:**
    *   En el editor de Apps Script, selecciona la función `inicializarEstructura` y haz clic en `Ejecutar`.
    *   Concede los permisos necesarios (Google mostrará una advertencia de "App no verificada"; haz clic en `Configuración avanzada` > `Ir a Quiniela (no seguro)`).
5.  **Desplegar la Web App:**
    *   Haz clic en `Desplegar` > `Nueva implementación`.
    *   Tipo: `Aplicación web`.
    *   Descripción: `Quiniela V1`.
    *   Ejecutar como: `Yo` (tu email).
    *   Quién tiene acceso: `Cualquiera` (para permitir que los participantes entren).
    *   Copia la URL proporcionada.
6.  **Cargar datos iniciales:**
    *   En el Google Sheet, aparecerá un nuevo menú llamado `⚽ Quiniela Mundial 2026`.
    *   Haz clic en `Cargar Datos Iniciales (Seed)` para poblar los equipos y partidos iniciales.

## 🛠️ Características Principales

*   **Puntuación Automática:**
    *   **5 puntos:** Marcador exacto.
    *   **2 puntos:** Acierta ganador o empate (pero no marcador exacto).
    *   **-1 punto:** Error total.
    *   **+3 puntos:** Bono por acierto en fase eliminatoria.
*   **Seguridad:**
    *   Los pronósticos se bloquean automáticamente 1 hora antes de cada partido.
    *   Validación de usuario único por email.
    *   Panel de administración protegido para el propietario del script.
*   **Interfaz Moderna:**
    *   Diseño responsive para móviles.
    *   Tablas de ranking en tiempo real.
    *   Banderas con emojis Unicode para máxima compatibilidad.

## ⚙️ Configuración (Hoja 'Configuracion')

| Parámetro | Valor Recomendado | Descripción |
| :--- | :--- | :--- |
| PUNTOS_MARCADOR_EXACTO | 5 | Puntos por marcador exacto. |
| PUNTOS_ACIERTA_GANADOR | 2 | Puntos por tendencia (ganador/empate). |
| PUNTOS_ERROR | -1 | Penalización por error. |
| HORAS_CIERRE_PRONOSTICO | 1 | Horas antes del partido para bloquear edición. |
| API_FOOTBALL_KEY | (Opcional) | Key de football-data.org o api-football.com. |

## 📝 Notas para el Administrador

*   Puedes actualizar resultados manualmente en la hoja `Partidos` (cambia el Estado a "Jugado" y pon los goles reales) y luego ejecutar `Recalcular Puntos` desde el menú.
*   La Web App permite importar calendarios masivamente desde Excel copiando y pegando en formato TSV (Tab-Separated Values).
