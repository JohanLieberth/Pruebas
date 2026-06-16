# Guía de Instalación - GameService Pro

Sigue estos pasos para poner en marcha tu Sistema de Administración de Servicios Técnico.

## 1. Preparar el Google Sheet
1. Crea una nueva hoja de cálculo en Google Sheets.
2. Cambia el nombre de la hoja actual (pestaña inferior) a `Servicios`.
3. Crea una segunda pestaña llamada `Usuarios`.
4. En la hoja `Usuarios`, agrega los encabezados en la fila 1:
   - `Correo electrónico` | `Nombre` | `Teléfono` | `Contraseña` | `Rol`
5. Agrega un usuario administrador para poder entrar al panel:
   - Ejemplo: `admin@correo.com` | `Admin` | `1234567890` | `admin123` | `admin`

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

## Notas de Seguridad y Mejoras
- **Contraseñas**: Por simplicidad (MVP), las contraseñas se guardan en texto plano. Se recomienda en el futuro usar un sistema de hash.
- **Limpieza de Datos**: El sistema usa `getDisplayValues()` para asegurar que todas las fechas y números se lean como texto tal cual se ven en la hoja.
- **Folios**: El sistema usa `LockService` para evitar que dos registros simultáneos generen el mismo folio.
