# Sistema de Inventario — Subdirección de Mejora Regulatoria

Este es un sistema web completo de gestión de inventario y levantamiento físico para la **Subdirección de Mejora Regulatoria**, desarrollado en **Google Apps Script** y diseñado para desplegarse como **Web App**.

La aplicación es completamente responsiva (mobile-first), por lo que funciona de manera óptima en celulares, tablets y computadoras portátiles. Soporta la lectura de códigos de barras y QR en tiempo real mediante la cámara trasera del dispositivo, así como la carga masiva y normalizada de bases de datos de Patrimonio desde archivos de Excel (`.xlsx`).

---

## 🚀 Características Principales

1. **Base de Datos en Google Sheets**: Almacenamiento seguro en tiempo real en dos pestañas principales: `Inventario` y `Bitacora`.
2. **Escáner de Cámara Integrado**: Lector de códigos de barras y códigos QR usando la librería `html5-qrcode`. Solicita permisos de cámara de manera limpia y permite seleccionar la cámara activa.
3. **Carga Inicial desde Excel**: Importación local súper rápida utilizando `SheetJS` (xlsx) con mapeo de columnas inteligente y tolerante a acentos, mayúsculas, minúsculas y espacios. Cuenta con control de duplicados (omitir o sobrescribir).
4. **Buscador Avanzado**: Búsqueda parcial o exacta por número de inventario o número de serie.
5. **CRUD y Levantamiento**:
   - **Alta (Levantamiento)** de nuevos artículos con validación de no duplicidad de No. INV.
   - **Modificación / Actualización** de cualquier campo técnico o del estado/ubicación real del levantamiento.
   - **Baja Lógica** (Establece el estado a `"BAJA"`) y **Eliminación Física** (con confirmaciones de seguridad).
   - **Paginación Dinámica** con filtros rápidos.
6. **Exportaciones**: Descarga del listado filtrado de inventario a archivos de Excel (`.xlsx`) y CSV con codificación UTF-8 BOM.
7. **Seguridad y Concurrencia**: Control de transacciones simultáneas mediante `LockService` y registro detallado de cada operación en la bitácora histórica.

---

## 🛠️ Estructura del Proyecto

El proyecto consta de los siguientes archivos en Google Apps Script:

*   `Code.gs`: Lógica del servidor en JavaScript de Apps Script. Maneja la creación/inicialización de hojas, las búsquedas, escrituras, eliminaciones, control de concurrencia y registros de bitácora.
*   `Index.html`: Estructura principal de la interfaz web responsiva (Bootstrap 5).
*   `CSS.html`: Estilos personalizados de alto contraste, mobile-first y optimizaciones para el contenedor del escáner de cámara.
*   `JS.html`: Lógica del cliente que maneja la inicialización de la cámara, los formularios, la paginación, los filtros dinámicos, la lectura de archivos locales con SheetJS y las exportaciones a Excel/CSV.

---

## 📋 Pasos para el Despliegue en Google Apps Script

Sigue estos sencillos pasos para poner en marcha tu sistema en menos de 5 minutos:

### Paso 1: Crear la Hoja de Cálculo
1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva hoja de cálculo vacía.
2. Nómbrala como prefieras (por ejemplo: `Inventario - Mejora Regulatoria`).
3. *Nota*: No es necesario crear las pestañas ni escribir los encabezados manualmente; el sistema se encargará de inicializar las pestañas `"Inventario"` y `"Bitacora"` con sus respectivos encabezados en el primer arranque.

### Paso 2: Abrir el Editor de Apps Script
1. Dentro de la hoja de cálculo recién creada, haz clic en el menú superior **Extensiones** > **Apps Script**.
2. Se abrirá el entorno de desarrollo de Google Apps Script. Nombra el proyecto como `SMR-Inventario`.

### Paso 3: Pegar los Archivos del Código
1. En la columna izquierda, verás un archivo predeterminado llamado `Código.gs`. Reemplaza todo su contenido por el código de nuestro archivo **`Code.gs`** y renómbralo a `Code.gs` (o déjalo como `Código.gs`, funciona de igual manera).
2. Crea los siguientes archivos HTML haciendo clic en el botón **`+`** (Añadir un archivo) > **HTML**:
   *   Crea un archivo llamado **`Index`** (se guardará como `Index.html`) y pega en él todo el contenido de nuestro archivo **`Index.html`**.
   *   Crea un archivo llamado **`CSS`** (se guardará como `CSS.html`) y pega en él todo el contenido de nuestro archivo **`CSS.html`**.
   *   Crea un archivo llamado **`JS`** (se guardará como `JS.html`) y pega en él todo el contenido de nuestro archivo **`JS.html`**.

### Paso 4: Desplegar como Aplicación Web
1. En la esquina superior derecha del editor de Apps Script, haz clic en el botón azul **Implementar** (Deploy) > **Nueva implementación** (New deployment).
2. Haz clic en el icono de engranaje de configuración y selecciona **Aplicación web** (Web app).
3. Configura los siguientes parámetros obligatorios:
   *   **Descripción**: `Despliegue Inicial SMR Inventario`.
   *   **Ejecutar como** (Execute as): Selecciona **El usuario que accede a la aplicación web** (User accessing the web app) si deseas que cada quien firme con su cuenta de Google para registrar su email automático en la bitácora, o selecciona **Yo** (Me) si deseas un acceso público general.
   *   **Quién tiene acceso** (Who has access): Selecciona **Cualquier usuario con el enlace** (Anyone with link).
4. Haz clic en el botón **Implementar** (Deploy).
5. Si es la primera vez que despliegas, Google te solicitará otorgar permisos. Haz clic en **Autorizar acceso**, selecciona tu cuenta de Google, haz clic en **Avanzado** (en la esquina inferior izquierda del aviso) y luego en **Ir a SMR-Inventario (no seguro)**. Finalmente, pulsa **Permitir**.
6. El editor te proporcionará la **URL de la aplicación web**. Copia este enlace; este es el link que compartirás con el personal técnico y operadores para que lo abran desde cualquier dispositivo.

---

## 📋 Mapeo y Normalización de Columnas en la Carga de Excel

El Excel de Patrimonio puede contener encabezados con variaciones de nombre, acentos u orden. El sistema busca de manera inteligente los siguientes patrones para mapearlos a los encabezados oficiales de la base de datos:

| Encabezado Oficial Interno | Variaciones Soportadas en Excel de Patrimonio |
| :--- | :--- |
| **No.** | `No.`, `No`, `Número`, `Id` |
| **No. INV.** | `No. INV.`, `No. Inventario`, `Numero Inventario`, `Etiqueta`, `noinv` |
| **DESCRIPCION** | `DESCRIPCION`, `Descripción`, `Articulo`, `Concepto`, `Nombre` |
| **SERIE** | `SERIE`, `No. Serie`, `Serie`, `Numero de serie` |
| **MODELO** | `MODELO`, `Modelo` |
| **MARCA** | `MARCA`, `Marca` |
| **ESTADO** | `ESTADO`, `Estado`, `Estado Patrimonio` |
| **IMPORTE** | `IMPORTE`, `Importe`, `Valor`, `Costo`, `Precio` |
| **UBICACION** | `UBICACIÓN`, `Ubicacion`, `Ubicación` |
| **RESGUARDADO** | `RESGUARDADO`, `Resguardado`, `Resguardo`, `Resguardante` |
| **RESGUARDANTE_REAL** | `Resguardante real`, `Resguardante_real` |
| **UBICACION_REAL** | `Ubicación real`, `Ubicacion real`, `Ubicacion_real` |
| **ESTADO_REAL** | `Estado real`, `Estado_real` |

---

## 🛠️ Tecnologías Utilizadas

*   **Google Apps Script (V8 Engine)**: Backend y Servidor de Datos.
*   **Google Sheets**: Base de datos de alta disponibilidad y edición directa complementaria.
*   **Bootstrap 5**: Maquetación y diseño responsivo, limpio e intuitivo.
*   **FontAwesome 6**: Biblioteca iconográfica de alta calidad visual.
*   **SheetJS (xlsx.js)**: Motor cliente de procesamiento y generación de archivos Excel.
*   **html5-qrcode**: Motor de captura de vídeo para decodificación de códigos de barras y QR.

---

## ⚠️ Errores conocidos y Troubleshooting

A continuación se detallan los errores reportados comunes en el entorno de consola del navegador y su diagnóstico de resolución:

### 1. Error de Cámara: `[Violation] Permissions policy violation: camera is not allowed in this document.`
*   **Causa**: Google Apps Script sirve SIEMPRE la Web App dentro de un iframe sandbox (`script.google.com` embebe `userCodeAppPanel` en `*.googleusercontent.com`), INCLUSO cuando se abre la URL `/exec` directamente en una pestaña nueva del navegador. Debido a las políticas de seguridad estrictas de los navegadores modernos, el acceso a la cámara mediante `getUserMedia` está completamente prohibido por la directiva `Permissions-Policy` de este iframe permanente, imposibilitando la activación del hardware de video en cualquier subpágina servida por la Web App.
*   **Solución Definitiva e Infalible (Opción A - Inyección en about:blank)**:
    1.  **Apertura de Ventana `about:blank`**: Al presionar "Iniciar Cámara Lector" (acción enlazada a un gesto real del usuario), el sistema abre una ventana emergente en blanco (`about:blank`) de nivel superior puro mediante `window.open`. Al ser un documento en blanco local del navegador, **NO hereda el iframe ni la Permissions-Policy restrictiva de Google**.
    2.  **Inyección Dinámica de Código**: El script del cliente inyecta dinámicamente todo el HTML, CSS (Bootstrap 5) y JS (`html5-qrcode`) autocontenido directamente en la ventana `about:blank` usando `popup.document.write()`.
    3.  **Autorización y Captura Directa**: Fuera de la restricción del iframe, el navegador solicita los permisos nativos de la cámara (`navigator.mediaDevices.getUserMedia`) con éxito, permitiendo un escaneo fluido de las etiquetas mediante la cámara trasera (`facingMode: "environment"`).
    4.  **Handoff Sincrónico del Resultado**: Cuando se lee un código, se devuelve inmediatamente a la pestaña principal en este orden de prioridad:
        *   **A)** Con llamada directa al hilo principal: `window.opener.procesarCodigoEtiquetaDesdePopup(noInv)`.
        *   **B)** Con el canal dedicado `BroadcastChannel('inventario-smr')`.
        *   **C)** Con el evento `'storage'` de `localStorage`.
        *   **D)** **Redirección de Fallback**: Si el navegador limita la comunicación cruzada, el botón **"Usar este número en Inventario"** redirige de inmediato la pestaña matriz del inventario a `/exec?noinv=XXXX`, cargando los datos al instante gracias al scriptlet dinámico de `Code.gs`.
*   **Recomendación**: Permita la apertura de ventanas emergentes (pop-ups) en su navegador para este sitio y otorgue el permiso nativo de cámara cuando lo solicite la ventana emergente.

### 2. Errores de `content.js` o Extensiones:
*   `Uncaught (in promise) TypeError: Cannot read properties of null (reading 'classList') at ... (content.js:2)`
*   `[Violation] Permissions policy violation: unload is not allowed in this document. (content.js:2)`
*   **Causa**: Estos avisos y errores provienen del script inyectado `content.js` que pertenece a extensiones del navegador activas en el dispositivo local (tales como traductores automáticos, gestores de contraseñas, bloqueadores de anuncios o antivirus). No son del proyecto ni afectan de ninguna forma la estabilidad, lógica o rendimiento del sistema de inventario.
*   **Cómo verificarlo**: Puede confirmar que se trata de ruido externo abriendo el enlace de la Web App en una pestaña en modo **Incógnito** de su navegador con todas las extensiones deshabilitadas. Verá que la consola se mantiene totalmente libre de estos dos avisos de `content.js`.
