# Guía de Instalación y Configuración - BitFix

Sigue estos pasos para poner en marcha tu Sistema de Administración de Servicios Técnico.

## 1. Preparar el Google Sheet
1. Crea una nueva hoja de cálculo en Google Sheets.
2. Crea las siguientes pestañas (si no se crean automáticamente al primer inicio):
   - `Servicios`: Historial de órdenes.
   - `Usuarios_Admin`: `Email` | `Contraseña` | `Rol` | `Nombre`.
   - `Usuarios_Clientes`: `Email` | `Contraseña` | `Nombre` | `Teléfono` | `Fecha de Registro`.
   - `Puntos_NFC`: `Email` | `UID_NFC` | `Saldo_Puntos` | `Historial_JSON` | `Ultima_Actualizacion`.
   - `Config`: `Parámetro` | `Valor`.
   - `Confirmaciones`: `Folio` | `Fecha de Confirmación` | `Cliente`.
   - `Notificaciones`: `Fecha` | `Tipo` | `Folio` | `Destinatario` | `Estatus`.
3. Agrega un usuario administrador en `Usuarios_Admin`:
   - Ejemplo: `admin@correo.com` | `admin123` | `Administrador` | `Super Admin`

## 2. Configurar el Lector USB NFC ACR122U (Modo Teclado HID)
Para que el lector USB NFC ACR122U funcione con la Web App (Google Apps Script), debe operar en modo **Emulación de Teclado (Keyboard Wedge / HID)**:
1. **Verificación en Sistema Operativo**:
   - Conecta el ACR122U vía USB a la computadora.
   - Verifica que la luz LED se encienda (rojo/verde).
   - Abre un editor de texto plano (Notepad, Bloc de Notas) y acerca una tarjeta NFC. Si el UID se escribe automáticamente como texto hexadecimal seguido de un Enter (`Enter`/CR), el modo teclado está activo.
2. **Formato de UID Aceptado**:
   - Tarjetas de 4 bytes (MIFARE Classic / 1K): UID de 8 caracteres hexadecimales (ej. `04A3B2C1`).
   - Tarjetas de 7 bytes (NTAG / Ultralight / DESFire): UID de 14 caracteres hexadecimales (ej. `04A3B2C1D2E3F4`).
   - Mayúsculas y minúsculas son aceptadas.
3. **Uso en la Web App**:
   - En el Admin Panel, presiona **Puntos NFC / Tarjeta**.
   - Presiona **Reverificar Lector** y acerca una tarjeta para completar el handshake de conectividad (🟢 Lector listo).

## 3. Configurar el Script
1. En tu Google Sheet, ve a **Extensiones > Apps Script**.
2. Borra cualquier código que aparezca en el editor (usualmente `Code.gs`).
3. Copia y pega el contenido de los archivos proporcionados en el editor de Apps Script, respetando los nombres de los archivos:
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

## 4. Despliegue
1. Haz clic en el botón azul **Implementar > Nueva implementación**.
2. Selecciona el tipo: **Aplicación web**.
3. Configuración:
   - **Descripción**: Versión 1.0
   - **Ejecutar como**: Tu cuenta (yo)
   - **Quién tiene acceso**: Cualquier persona (Anonymous/Anyone)
4. Haz clic en **Implementar**.
5. Copia la URL de la aplicación web generada. Esta es la URL que usarán técnicos y clientes.
