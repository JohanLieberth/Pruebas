# Sistema de Levantamiento de Inventarios Físicos - SMR

Este sistema ha sido diseñado y optimizado para la **Subdirección de Mejora Regulatoria** utilizando **Google Apps Script**, **Google Sheets**, y librerías modernas de parsing y escaneo en el cliente.

## 🚀 Instrucciones de Despliegue y Configuración

Siga los siguientes pasos exactos para configurar y desplegar la aplicación en su cuenta institucional de Google Workspace:

1. **Crear la Base de Datos (Google Sheet):**
   - Cree una nueva hoja de cálculo de Google.
   - Cámbiele el nombre a `InvetarioMR`, `InventarioMR` o `Inventario`.
   - No es necesario que cree las pestañas o columnas manualmente; la aplicación realiza una **auto-migración y creación de esquema en lote automática** en su primera ejecución.

2. **Crear el Proyecto de Google Apps Script:**
   - En la hoja de cálculo recién creada, vaya a la barra de menú superior, seleccione **Extensiones > Apps Script**.
   - Esto abrirá el editor de código del proyecto Apps Script.
   - Elimine cualquier código por defecto y cree los siguientes archivos en el editor:
     - `Code.gs` (Código del servidor)
     - `Index.html` (Estructura principal de la app)
     - `Styles.html` (Estilos responsivos e institucionales de la interfaz)
     - `JavaScript.html` (Lógica interactiva del cliente)
   - Copie y pegue los códigos correspondientes proporcionados en este repositorio en cada uno de sus archivos de Apps Script respectivos respetando las mayúsculas y minúsculas exactas del nombre de los archivos.

3. **Configurar Permisos e Identidad:**
   - La Web App se ejecuta bajo la identidad del usuario activo (`User accessing the web app`), permitiendo una auditoría y bitácora de movimientos precisa.
   - En la primera ejecución o despliegue, Google solicitará autorizar permisos para acceder a Google Sheets, Drive (para almacenamiento de evidencias fotográficas) y la sesión del usuario. Otorgue todos los permisos sin inconvenientes.

4. **Desplegar como Aplicación Web:**
   - En la esquina superior derecha del editor de Apps Script, haga clic en **Implementar > Nueva implementación**.
   - En el tipo de implementación, seleccione **Aplicación web**.
   - Configure las opciones exactas:
     - **Ejecutar como:** El usuario que accede a la aplicación web (`User accessing the web app`).
     - **Quién tiene acceso:** Cualquier persona con cuenta de Google dentro de su organización, o `Cualquiera` según los requerimientos de uso en campo.
   - Haga clic en **Implementar** y copie la URL de la Web App generada. ¡Esa es la URL que compartirá con los operadores de inventario!

---

## 🔧 Resoluciones Técnicas Implementadas (Módulos Críticos)

* **Módulo 1: Rendimiento Optimizado (Caché a 5 Minutos):**
  Las consultas repetitivas a `SpreadsheetApp` son la causa principal de lentitud en Apps Script. Esta implementación lee la base de datos completa con una sola llamada batch `getDataRange().getValues()` y la almacena en el caché seguro del `PropertiesService` con un tiempo de expiración (TTL) de 5 minutos. Cualquier escritura (alta, levantamiento, carga masiva, traslado) invalida inmediatamente el caché de manera inteligente para que los operadores siempre visualicen información actualizada en lote.

* **Módulo 2: Lector QR y Evidencias por Fotos en Sandbox:**
  Debido a las estrictas políticas de sandbox del iframe de Google Apps Script (`Permissions-Policy` y bloqueos de seguridad del navegador para el API de cámara `getUserMedia`), los flujos de escaneo de cámara tradicionales suelen fallar silenciosamente en Apps Script. El sistema soluciona esto de raíz integrando un lector de archivos e imágenes QR local robusto mediante la librería `Html5Qrcode.scanFile()`. El operador puede simplemente tomar una foto nítida de un código QR y la app lo decodificará e iniciará la búsqueda automáticamente en milisegundos.

* **Módulo 3: Mapeo Inteligente de Cabeceras en Carga Masiva:**
  El parseador de Excel (utilizando la librería `SheetJS`) busca coincidencias con sinonimos e indiferencia a acentos y mayúsculas en la fila de cabeceras de los archivos `.xlsx` y `.csv`. Esto le da al usuario la flexibilidad de cargar plantillas de patrimonio con columnas nombradas indistintamente como "Número de Inventario", "Etiqueta", "No INV", "Id", etc., asociándolos de forma automática con los campos destino de la base de datos.
