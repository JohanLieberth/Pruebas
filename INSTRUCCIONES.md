# Guía de Instalación - BitFix

Sigue estos pasos para poner en marcha tu Sistema de Administración de Servicios Técnico.

## 1. Preparar el Google Sheet
1. Crea una nueva hoja de cálculo en Google Sheets.
2. Crea las siguientes pestañas (si no se crean automáticamente al primer inicio):
   - `Servicios`: Historial de órdenes.
   - `Usuarios_Admin`: `Email` | `Contraseña` | `Rol` | `Nombre`.
   - `Usuarios_Clientes`: `Email` | `Contraseña` | `Nombre` | `Teléfono` | `Fecha de Registro`.
   - `Config`: `Parámetro` | `Valor`.
   - `Confirmaciones`: `Folio` | `Fecha de Confirmación` | `Cliente`.
   - `Notificaciones`: `Fecha` | `Tipo` | `Folio` | `Destinatario` | `Estatus`.
3. Agrega un usuario administrador en `Usuarios_Admin`:
   - Ejemplo: `admin@correo.com` | `admin123` | `Administrador` | `Super Admin`

## 2. Configurar el Script
1. En tu Google Sheet, ve a **Extensiones > Apps Script**.
2. Borra cualquier código que aparezca en el editor (usualmente `Code.gs`).
3. Copia y pega el contenido de los archivos proporcionados por Jules en el editor de Apps Script, respetando los nombres de los archivos:
   - `Código.gs`
   - `Index.html`
   - `Registro.html`
   - `Admin.html`
   - `Login.html`
   - `PanelCliente.html`
   - `Estatus.html`
   - `Imprimir.html`
   - `CSS.html`
   - `JS.html`
   - `Confirmar.html`

## 3. Despliegue
1. Haz clic en el botón azul **Implementar > Nueva implementación**.
2. Selecciona el tipo: **Aplicación web**.
3. Configuración:
   - **Descripción**: Versión 1.0
   - **Ejecutar como**: Tu cuenta (yo)
   - **Quién tiene acceso**: Cualquier persona (Anonymous/Anyone)
4. Haz clic en **Implementar**.
5. Copia la URL de la aplicación web generada. Esta es la URL que usarán técnicos y clientes.

## 4. Permisos de Correo
La primera vez que ejecutes una función que envíe correos (o al implementar), Google te pedirá "Autorizar acceso".
- Haz clic en **Revisar permisos**.
- Selecciona tu cuenta de Google.
- Si aparece un aviso de "Google no ha verificado esta aplicación", haz clic en **Configuración avanzada** y luego en **Ir a [Nombre del Proyecto] (no seguro)**.
- Haz clic en **Permitir**.

## Configuración de Logos
- **Logo Principal**: Tamaño recomendado 400x150 px. Se usa en el header principal y correos.
- **Logo Pequeño**: Tamaño recomendado 150x60 px. Se usa en tickets, etiquetas y barra de navegación.
- **Instrucciones**:
  1. Sube tu imagen a Google Drive.
  2. Haz clic derecho > Compartir > Cambiar a "Cualquier persona con el enlace".
  3. Copia el ID del enlace (ej: `1A2B3C...`).
  4. Usa el formato de enlace directo: `https://lh3.googleusercontent.com/d/TU_ID_AQUÍ`.
  5. Pega esta URL en el Panel de Configuración dentro de la App o directamente en la hoja `Config`.

## Video Promocional
- **Formato**: MP4 recomendado.
- **Tamaño**: Máximo 10MB sugerido para carga rápida.
- **Resolución**: 1280x720 (HD).
- **Instrucciones**: Al igual que los logos, sube a Drive, obtén el enlace directo al archivo MP4 y pégalo en la configuración. Solo los usuarios con rol "Cliente" verán este video en el inicio.

## Roles de Administración
- **Administrador**: Control total.
- **Supervisor**: Puede crear y editar, pero no tiene funciones de borrado (si se implementan en el futuro, estarán restringidas).

## Notas de Seguridad y Mejoras
- **Contraseñas**: Por simplicidad (MVP), las contraseñas se guardan en texto plano. Se recomienda en el futuro usar un sistema de hash.
- **Limpieza de Datos**: El sistema usa `getDisplayValues()` para asegurar que todas las fechas y números se lean como texto tal cual se ven en la hoja.
- **Folios**: El sistema usa `LockService` para evitar que dos registros simultáneos generen el mismo folio.
