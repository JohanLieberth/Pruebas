# 📋 Sistema de Inventario Físico - Subdirección de Mejora Regulatoria

Aplicación web interna (SPA) basada en **Google Apps Script** diseñada para el levantamiento de inventario físico de bienes patrimoniales. Opera de forma directa y optimizada en lote sobre un Google Sheet con la estructura original heredada de patrimonio.

---

## ⚙️ Características Principales

*   **Dashboard Interactivo (RF1):** Resumen visual de total de artículos, levantados, pendientes y accesos directos rápidos con emojis nativos.
*   **Buscador y Escáner Inteligente (RF2):** Lectura local de cámara (html5-qrcode) y puente emergente (`about:blank`) para sortear la directiva de permisos de iframe (Permissions-Policy) en App Script. Búsqueda por número de serie para bienes sin etiqueta física.
*   **Levantamiento con Evidencias (RF2):** Selección dinámica de estados (`Bueno`, `Regular`, `Malo`, `Baja`), autocompletado inteligente de resguardantes y ubicaciones, y carga de hasta 3 fotos de evidencia directamente a Drive.
*   **Alta de Bienes (RF3):** Registro completo de nuevos artículos con validación de existencia única.
*   **Carga Masiva (RF4):** Importador tolerante de archivos de Excel (.xlsx) y CSV con mapeo automático inteligente de variantes de cabeceras de columnas e inserción/actualización selectiva en lote.
*   **Listado General (RF5):** Paginación responsiva (20 por página), filtros instantáneos en cliente y columna de acciones (Editar, Ver detalle, Trasladar con motivo, Gestionar Fotos y Generar QR imprimible offline).
*   **Auditoría Completa (RF6):** Bitácora automatizada de cambios guardados en Google Sheets.

---

## 🚀 Instrucciones de Despliegue en Google Apps Script

Siga estos sencillos pasos para implementar la aplicación en su cuenta o entorno institucional:

### Paso 1: Configurar la Base de Datos (Google Sheet)
1. Cree una hoja de cálculo de Google.
2. Cambie el nombre de la primera pestaña a `Inventario`.
3. Cambie el nombre de la segunda pestaña a `Bitacora`.
*(Nota: No se preocupe por las cabeceras exactas, la aplicación las autoconfigurará e inicializará automáticamente con auto-migración de esquema en su primer arranque).*

### Paso 2: Crear el Proyecto en Google Apps Script
1. En su Google Sheet configurado, vaya al menú superior **Extensiones > Apps Script**.
2. Borre cualquier código predeterminado que aparezca en el editor.
3. Cree los siguientes archivos dentro del editor de Apps Script haciendo clic en el botón `+` (Añadir un archivo):
   *   Un archivo de tipo **Script** llamado `Code.gs` y copie el contenido de `Code.gs`.
   *   Un archivo de tipo **HTML** llamado `Index.html` y copie el contenido de `Index.html`.
   *   Un archivo de tipo **HTML** llamado `Styles.html` y copie el contenido de `Styles.html`.
   *   Un archivo de tipo **HTML** llamado `JavaScript.html` y copie el contenido de `JavaScript.html`.

### Paso 3: Configurar Permisos de Google Drive para Fotos
1. La aplicación requiere acceso a Google Drive para crear y almacenar fotografías de evidencia de inventario.
2. En el primer uso o guardado de fotos, Google Apps Script le solicitará autorización para acceder a los servicios de Drive y Gmail/Sheets. Otorgue los permisos correspondientes.

### Paso 4: Desplegar como Aplicación Web (Web App)
1. En la esquina superior derecha del editor de Apps Script, haga clic en **Implementar > Nueva implementación**.
2. En el icono de engranaje (Seleccionar tipo), seleccione **Aplicación web**.
3. Configure los siguientes parámetros:
   *   **Descripción:** `Sistema de Inventario Físico SMR v1.0`
   *   **Ejecutar como:** `Usuario que accede a la aplicación web` (esto permite registrar la identidad exacta de cada operador de campo mediante `Session.getActiveUser().getEmail()`).
   *   **Quién tiene acceso:** `Cualquier persona con una cuenta de Google` o restringido a su dominio institucional.
4. Haga clic en **Implementar**.
5. Copie la **URL de la aplicación web** generada para que el personal de campo pueda acceder.

---

## 🛠️ Errores Conocidos y Troubleshooting

### 1. El escáner de cámara no abre o tiene fondo negro
*   **Causa:** Google Apps Script ejecuta la aplicación web dentro de un iframe con restricciones de seguridad de la política de permisos del navegador (Permissions-Policy).
*   **Solución:** Haga clic en el botón **"Escape Sandbox (Emergente)"** situado al costado de iniciar la cámara. Este abrirá una ventana limpia (`about:blank`) fuera de las restricciones del sandbox que cargará exitosamente la cámara de su dispositivo móvil o PC y devolverá el código detectado inmediatamente a la Web App principal.

### 2. Advertencias del Navegador en la Consola (Security Policy / iframe warnings)
*   *An iframe which has both allow-scripts and allow-same-origin...*
*   **Detalle:** Esta advertencia es un comportamiento de seguridad estándar de Google para su arquitectura de renderizado `HtmlService`. No afecta en absoluto la funcionalidad de la aplicación web y se puede omitir con seguridad.

---

## 🎨 Paleta de Colores Institucional (SMR)

*   **Verde Primario:** `#1B5E20`
*   **Gris Oscuro:** `#424242`
*   **Fondo Claro:** `#FAFAFA`
