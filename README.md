# 🚀 Proyecto FriendTravel — Sistema de Gestión Interna

Este proyecto es una aplicación web completa desarrollada en **Google Apps Script** para gestionar las ventas, pagos, reportes y dashboard de la agencia de viajes **FriendTravel**.

## 🛠️ Funcionalidades Principales

*   **Dashboard Ejecutivo:** Visualización de KPIs globales y gráficas de rendimiento por agente (Chart.js).
*   **Nueva Venta:** Registro de reservas con folio autogenerado, cálculo de saldos y sincronización con Calendario.
*   **Registrar Pago:** Búsqueda dinámica de ventas con saldo pendiente y registro de abonos mediante una interfaz modal segura.
*   **Reportes:** Tablas detalladas de ventas globales y filtradas por agente con indicadores de cumplimiento de meta.
*   **Automatización:** Generación de recibos PDF, envío de correos automáticos y recordatorios en Google Calendar.

## 📋 Instrucciones de Instalación

1.  **Crear el Proyecto:**
    *   Abra [script.google.com](https://script.google.com) y cree un nuevo proyecto llamado "FriendTravelVentas".
    *   Copie el contenido de todos los archivos `.gs` y `.html` del repositorio en el editor de Apps Script (respetando los mismos nombres).

2.  **Inicialización:**
    *   En el editor, seleccione la función `setup` en `Código.gs` y ejecútela.
    *   Esto creará automáticamente la carpeta `FriendTravel/Recibos` y el archivo de Google Sheets `FriendTravelVentas` en su Google Drive.

3.  **Configuración de Logo:**
    *   Abra el archivo de Sheets creado (`FriendTravelVentas`).
    *   Vaya a la hoja **Configuracion**.
    *   En la fila de "LOGO", pegue la URL de la imagen de su logo en la columna B.

4.  **Despliegue:**
    *   Haga clic en **Implementar** > **Nueva implementación**.
    *   Tipo: **Aplicación web**.
    *   Ejecutar como: **Usted**.
    *   Quién tiene acceso: **Cualquier persona** (o según su preferencia organizacional).
    *   Copie la URL proporcionada para acceder al sistema.

## 📁 Estructura de Archivos

*   `Código.gs`: Configuración global y ruteo.
*   `Ventas.gs`: Lógica de registro y consulta de ventas.
*   `Pagos.gs`: Gestión de abonos y actualización de saldos.
*   `Reportes.gs`: Agregación de datos para dashboard y tablas.
*   `Recibos.gs`: Generación de PDF y envío de correos.
*   `CalendarUtils.gs`: Sincronización de fechas límite con Google Calendar.
*   `DriveUtils.gs`: Aprovisionamiento de carpetas y hojas de cálculo.
*   `Index.html`: Estructura base de la Single Page Application (SPA).
*   `Styles.html`: Estilos CSS personalizados (basados en Bootstrap 5).
*   `Dashboard.html`, `NuevaVenta.html`, `RegistrarPago.html`, `Estadisticas.html`: Vistas modulares del sistema.

## ⚖️ Reglas de Negocio

*   **Meta Mensual:** $10,000 MXN por agente.
*   **Cálculo de Saldo:** Total - (Anticipo + Abonos).
*   **Agentes Soportados:** Arlette, Eduardo, Enrique, América.
*   **Restricciones:** No se permiten abonos que superen el saldo pendiente.
