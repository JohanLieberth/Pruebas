# ⚽ Manual de Instalación - Quiniela Mundial 2026

Este sistema permite gestionar una quiniela deportiva para el Mundial 2026 utilizando **Google Sheets** como base de datos y **Google Apps Script** para la lógica del servidor y la interfaz web.

## 🚀 Pasos para la Instalación

### 1. Preparar la Hoja de Google
1. Crea una nueva hoja de cálculo en [Google Sheets](https://sheets.new).
2. Ve a **Extensiones > Apps Script**.
3. Borra el código que aparezca por defecto en `Código.gs`.

### 2. Copiar el Código
1. Copia el contenido del archivo `Code.gs` de este repositorio y pégalo en el editor de Apps Script.
2. Crea un nuevo archivo HTML en el editor de Apps Script haciendo clic en el botón `+` (Añadir un archivo) > **HTML**.
3. Ponle de nombre `Index` (el editor añadirá automáticamente `.html`).
4. Borra el contenido por defecto de `Index.html` y pega el contenido del archivo `Index.html` de este repositorio.

### 3. Inicializar el Sistema
1. En la hoja de cálculo, recarga la página. Debería aparecer un nuevo menú llamado **⚽ Quiniela 2026**.
2. Haz clic en **⚽ Quiniela 2026 > Inicializar Sistema**.
   - Google te pedirá permisos. Acéptalos (es posible que debas hacer clic en "Configuración avanzada" e "Ir a [Nombre del Proyecto] (no seguro)").
3. La función creará automáticamente todas las pestañas necesarias (`Configuracion`, `Partidos`, `Participantes`, etc.) con sus encabezados.

### 4. Desplegar la Web App
1. En el editor de Apps Script, haz clic en el botón azul **Desplegar > Nueva implementación**.
2. Selecciona el tipo: **Aplicación web**.
3. Configuración recomendada:
   - **Descripción:** Quiniela 2026 v1
   - **Ejecutar como:** Yo (tu correo)
   - **Quién tiene acceso:** Cualquier persona (incluso anónima - para el dashboard público).
4. Haz clic en **Implementar**.
5. Copia la **URL de la aplicación web**. Esta es la dirección que compartirás con los participantes.

## ⚙️ Configuración Administrativa

- **Hoja `Configuracion`:**
  - Puedes ajustar los puntos por acierto.
  - Para resultados automáticos, obtén una API Key en [api-football.com](https://www.api-football.com/) y pégala en la fila correspondiente.
- **Hoja `Partidos`:**
  - Puedes añadir los 104 partidos manualmente o mediante la función de prueba.
  - El campo `ID_Partido` debe ser único.
- **Menú de la Hoja:**
  - **Insertar Datos de Prueba:** Úsalo para ver el sistema funcionando con datos ficticios.
  - **Recalcular Puntos:** Ejecútalo después de que los partidos se marquen como "Jugado" con goles reales.
  - **Respaldar Datos:** Crea una copia de seguridad en tu Drive.

## 🧪 Notas Técnicas
- **Cierre de Pronósticos:** Los usuarios no pueden guardar ni editar pronósticos si falta menos de 1 hora para el inicio del partido.
- **Seguridad:** Las funciones administrativas solo pueden ser ejecutadas por el propietario del script.
- **Rendimiento:** El sistema está optimizado para procesar grandes volúmenes de datos mediante operaciones por lotes (`setValues`).

## 🛠️ Pruebas Locales (Opcional)

Si deseas probar la interfaz (`Index.html`) en tu computadora sin depender de Google Apps Script, puedes usar el servidor de pruebas incluido:

1. **Requisitos:** Tener instalado Python 3.
2. **Ejecución:** Corre el comando `python3 mock_server.py` en tu terminal.
3. **Acceso:** Abre `http://localhost:8000` en tu navegador.
4. **Nota:** Este servidor usa datos "ficticios" (moteados) definidos dentro de `mock_server.py` para simular las respuestas de Google Sheets. Es ideal para ajustar el diseño CSS rápidamente.

---
*Desarrollado con ❤️ para el Mundial 2026.*
