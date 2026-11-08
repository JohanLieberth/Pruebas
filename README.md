# 🎮 PixelFix - Sistema Web de Gestión para Taller de Reparación de Consolas de Videojuegos

Aplicación Web completa y lista para producción desarrollada en **Google Apps Script (V8)**, **Google Sheets** como base de datos relacional y **HtmlService**. Diseñada específicamente para talleres de reparación de videojuegos (PlayStation, Xbox, Nintendo Switch, Steam Deck, controles y periféricos).

---

## 🚀 Portales y Características del Sistema

1. **🔍 Portal Público de Consulta (Sin Registro)**:
   - Los clientes pueden rastrear en tiempo real el avance de sus equipos ingresando su **Folio de orden** (`OS-YYYYMMDD-####`), **Correo**, **Teléfono** o **Número de Serie**.
   - Muestra estatus técnico, fecha/hora de actualización y mensaje público seguro sin exponer datos confidenciales o costos internos.

2. **👤 Portal de Clientes (Normal y Taller Aliado)**:
   - Registro de usuarios con contraseña cifrada (Hash SHA-256 + Salt único, sin contraseñas en texto plano).
   - Envío automático de correo electrónico de bienvenida y credenciales por única vez al momento de registrarse.
   - Posibilidad de registrar **Responsables Solidarios** (familiares, socios o empleados autorizados para recoger equipos).
   - Consulta detallada de todas sus órdenes y consolas.
   - Visualización de saldo de **PixelPoints**, historial auditado de movimientos y **Catálogo de Recompensas** para canjes en taller.

3. **🛠️ Portal de Administrador**:
   - Acceso con credenciales administrativas verificadas en backend.
   - Creación de órdenes de servicio multi-dispositivo con generación atómica de folios únicos (`OS-YYYYMMDD-####`) mediante `LockService`.
   - Listado integral de órdenes con buscador universal (folio, cliente, teléfono, serie).
   - Visualización de todos los dispositivos de una orden con columnas mínimas obligatorias: *Orden de servicio, Dispositivo, Diagnóstico, Estatus, Fecha/hora, Técnico asignado y Total a cobrar*.
   - **Modificación y auditoría de costos** por dispositivo en la hoja `HistorialCostos`.
   - **Entrega parcial** por dispositivo: cada equipo puede entregarse individualmente según sus tiempos de reparación, pasando la orden a `Parcial` hasta que todos estén entregados o cancelados.
   - Gestión de usuarios del staff con roles `Administrador` y `Tecnico`.
   - **💳 Panel de Puntos y Tarjetas NFC**:
     - Lectura por **Web NFC** (`NDEFReader`) con fallback automático a captura manual.
     - Búsqueda de clientes por nombre, correo, teléfono o UID NFC.
     - Asignación de tarjetas NFC a clientes.
     - Asignación manual de puntos auditada en `PuntosMovimientos`.
     - Canje de recompensas del catálogo con validación de saldo suficiente y protección de saldo negativo.

4. **🔧 Portal de Técnico**:
   - Visualización restringida **únicamente a los dispositivos asignados** a su usuario.
   - Buscador por folio, nombre de cliente, teléfono y número de serie dentro de sus asignados.
   - Permiso exclusivo para modificar estatus entre: `Pendiente`, `En reparación`, `Pruebas` y `Listo`.
   - No puede realizar entregas ni cancelaciones definitivas (reservadas a administración).

---

## 🗄️ Esquema de la Base de Datos (Google Sheets)

El sistema inicializa automáticamente **13 pestañas** mediante la función `setup()`:

1. **`Config`**: `CLAVE`, `VALOR`, `DESCRIPCION`
2. **`Usuarios`**: `IDUsuario`, `TipoUsuario` (Normal/Taller), `NombreORazonSocial`, `Correo`, `Telefono`, `PasswordHash`, `PasswordSalt`, `PuntosActuales`, `Activo`, `FechaRegistro`, `UltimoAcceso`, `CorreoVerificado`, `Notas`
3. **`ResponsablesSolidarios`**: `IDResponsable`, `IDUsuario`, `Nombre`, `Telefono`, `Correo`, `Relacion`, `Activo`, `FechaRegistro`
4. **`UsuariosAdmin`**: `IDAdmin`, `Nombre`, `Correo`, `Telefono`, `PasswordHash`, `PasswordSalt`, `Rol` (Administrador/Tecnico), `Activo`, `FechaCreacion`, `CreadoPor`
5. **`OrdenesServicio`**: `IDOrden`, `Folio`, `IDUsuario`, `TipoUsuario`, `NombreCliente`, `CorreoContacto`, `TelefonoContacto`, `IDResponsable`, `EstadoOrden`, `Observaciones`, `TotalEstimado`, `TotalCobrado`, `Saldo`, `FechaCreacion`, `FechaActualizacion`, `CreadoPor`
6. **`Dispositivos`**: `IDDispositivo`, `IDOrden`, `FolioOrden`, `TipoDispositivo`, `Marca`, `Modelo`, `NumeroSerie`, `Color`, `Accesorios`, `FallaReportada`, `Diagnostico`, `Estatus`, `IDTecnicoAsignado`, `TecnicoAsignado`, `CostoEstimado`, `CostoFinal`, `FechaRecepcion`, `FechaHoraEstatus`, `FechaEntrega`, `EntregadoParcial`, `Observaciones`
7. **`HistorialEstatus`**: `IDHistorial`, `IDDispositivo`, `IDOrden`, `EstatusAnterior`, `EstatusNuevo`, `Comentario`, `UsuarioCambio`, `RolUsuario`, `FechaHora`
8. **`HistorialCostos`**: `IDHistorialCosto`, `IDDispositivo`, `CostoAnterior`, `CostoNuevo`, `Motivo`, `UsuarioCambio`, `FechaHora`
9. **`PuntosMovimientos`**: `IDMovimiento`, `IDUsuario`, `Correo`, `Telefono`, `TipoMovimiento`, `Puntos`, `SaldoAnterior`, `SaldoNuevo`, `Motivo`, `IDOrden`, `IDDispositivo`, `UsuarioAdmin`, `FechaHora`
10. **`RecompensasPuntos`**: `IDRecompensa`, `Nombre`, `PuntosRequeridos`, `Descripcion`, `Activo`, `Orden`
11. **`EtiquetasNFC`**: `IDNFC`, `CodigoNFC`, `IDUsuario`, `Activo`, `FechaAsignacion`, `AsignadoPor`
12. **`CorreosLog`**: `IDCorreo`, `Destinatario`, `Asunto`, `Estado`, `FechaHora`, `Error`
13. **`Logs`**: `IDLog`, `Accion`, `Detalle`, `Usuario`, `FechaHora`

---

## 🛠️ Instrucciones de Despliegue Paso a Paso

### Paso 1: Crear la Hoja de Google Sheets
1. Entra a [Google Drive](https://drive.google.com/) o [Google Sheets](https://sheets.new/).
2. Crea una nueva hoja de cálculo llamada **"PixelFix DB"**.
3. Copia el **ID del Spreadsheet** de la URL del navegador:
   `https://docs.google.com/spreadsheets/d/`**`1a2b3c4d5e6f7g8h9i...`**`/edit`

### Paso 2: Crear el Proyecto en Google Apps Script
1. En Google Drive, haz clic en **+ Nuevo > Más > Google Apps Script** (o dentro de la hoja en **Extensiones > Apps Script**).
2. Asigna un nombre al proyecto: **PixelFix - Taller de Consolas**.

### Paso 3: Copiar los Archivos al Proyecto
Crea los archivos con exactamente estos nombres y copia su contenido:

#### Archivos de Script (.gs):
- `Code.gs`
- `Config.gs`
- `Auth.gs`
- `Usuarios.gs`
- `Ordenes.gs`
- `Dispositivos.gs`
- `Puntos.gs`
- `Correos.gs`
- `Utils.gs`
- `Tests.gs`

#### Archivos HTML (.html):
- `styles.html`
- `app-common.html`
- `index.html`
- `consulta-publica.html`
- `login-usuario.html`
- `registro-usuario.html`
- `portal-usuario.html`
- `login-admin.html`
- `portal-admin.html`
- `portal-tecnico.html`

### Paso 4: Configurar ScriptProperties
1. En el editor de Apps Script, ve al menú lateral izquierdo: **⚙️ Configuración del proyecto**.
2. Desplázate hacia abajo hasta la sección **Propiedades de la secuencia de comandos**.
3. Agrega las siguientes propiedades:
   - `SHEET_ID`: *(Pega aquí el ID copiado en el Paso 1)*
   - `ADMIN_EMAIL`: `admin@pixelfix.com` (o tu correo deseado)
   - `ADMIN_NOMBRE`: `Administrador Principal`
   - `ADMIN_PASSWORD`: `Admin123!` (o la contraseña de tu preferencia)

### Paso 5: Ejecutar la Inicialización `setup()`
1. Regresa al editor de código (`< > Editor`).
2. Selecciona el archivo `Code.gs`.
3. En la barra superior, en el selector de funciones, elige **`setup`**.
4. Haz clic en **▶ Ejecutar**.
5. Google Apps Script solicitará autorización de permisos (Drive, Sheets y MailApp). Acepta los permisos.
6. En el registro de ejecución verás:
   ```text
   Iniciando inicialización de base de datos...
   Pestaña creada: Usuarios
   Pestaña creada: OrdenesServicio
   ...
   Catálogo de recompensas inicial sembrado
   Administrador sembrado con éxito: admin@pixelfix.com (Contraseña inicial: Admin123!)
   Setup completado exitosamente.
   ```
7. *(Opcional)*: Para poblar órdenes, clientes y técnicos de prueba, selecciona la función `Tests.sembrarDatosDeEjemplo` y ejecútala.

### Paso 6: Implementar como Aplicación Web
1. En la esquina superior derecha, haz clic en **Implementar > Nueva implementación**.
2. Selecciona el tipo: **Aplicación web** (ícono de engranaje).
3. Configuración de despliegue:
   - **Descripción**: Versión 1.0.0 PixelFix
   - **Ejecutar como**: **Yo (tu cuenta de Google)**
   - **Quién tiene acceso**: **Cualquier usuario** (para permitir la consulta pública y registro de clientes).
4. Haz clic en **Implementar**.
5. Copia la **URL de la aplicación web** generada.

---

## 🎮 Navegación por Parámetros de URL (`?p=...`)

La aplicación maneja enrutamiento amigable mediante el parámetro `p`:

| Vista | URL | Descripción |
|---|---|---|
| **Landing Page** | `?p=index` o raíz | Página de bienvenida y rastreo express |
| **Consulta Pública** | `?p=consulta` | Buscador de estatus sin login |
| **Login Cliente** | `?p=login` | Acceso a clientes Normales y Talleres |
| **Registro Cliente** | `?p=registro` | Registro con envío de correo y responsable solidario |
| **Portal Cliente** | `?p=portal-usuario` | Panel con órdenes, puntos, movimientos y canjes |
| **Login Staff** | `?p=login-admin` | Acceso exclusivo para administradores y técnicos |
| **Portal Admin** | `?p=portal-admin` | Gestión de órdenes, costos, técnicos y puntos NFC |
| **Portal Técnico** | `?p=portal-tecnico` | Mesa de trabajo con dispositivos asignados |

---

## 🧪 Datos de Prueba Iniciales (Sembrados con `Tests.sembrarDatosDeEjemplo`)

Si ejecutaste `Tests.sembrarDatosDeEjemplo`, puedes probar inmediatamente con estas cuentas:

### 1. Administrador:
- **Correo**: `admin@pixelfix.com`
- **Contraseña**: `Admin123!`
- **Portal**: `?p=login-admin`

### 2. Técnico:
- **Correo**: `tecnico@pixelfix.com`
- **Contraseña**: `Tecnico123!`
- **Portal**: `?p=login-admin`

### 3. Cliente Normal:
- **Correo**: `juan.perez@ejemplo.com`
- **Contraseña**: `Cliente123!`
- **Folio para consulta pública**: `OS-YYYYMMDD-0001`
- **Serie para consulta pública**: `XTW1002938475` o `AK58392019482`

### 4. Cliente Taller:
- **Correo**: `contacto@retroconsolas.mx`
- **Contraseña**: `Cliente123!`
- **Folio para consulta pública**: `OS-YYYYMMDD-0002`

---

## ✅ Criterios de Aceptación Verificables

| Requisito | Criterio de Verificación |
|---|---|
| **Consulta pública sin registro** | Se ingresa folio, correo, teléfono o serie en `?p=consulta` y se obtienen los equipos asociados, estatus actual y fecha/hora sin exponer datos sensibles. |
| **Registro con correo y sin texto plano** | Al registrar usuario en `?p=registro`, se genera hash SHA-256 + salt único en la hoja `Usuarios` y se envía un correo con sus datos de acceso por única vez. |
| **Responsables Solidarios** | Tanto usuarios Normal como Taller pueden registrar responsables solidarios desde el registro o desde su portal (`ResponsablesSolidarios`). |
| **Multi-dispositivo en órdenes** | Una sola orden en `OrdenesServicio` almacena 1 o N registros en `Dispositivos` con costos individuales y cálculos de orden automáticos. |
| **Modificación y auditoría de costos** | El admin puede cambiar costo estimado y costo final indicando motivo, registrando cada cambio en `HistorialCostos`. |
| **Entrega parcial** | Al marcar "Entregar" en un dispositivo individual, se actualiza `FechaEntrega`, `EntregadoParcial='SI'`, el total cobrado de la orden y el estado general pasa a `Parcial` hasta completarse todos. |
| **Técnico restringido a asignados** | El usuario Técnico solo visualiza los dispositivos donde está asignado y solo puede seleccionar los estatus `Pendiente`, `En reparación`, `Pruebas` y `Listo`. |
| **Buscador universal** | En admin y técnico, el buscador filtra en tiempo real por folio, cliente, teléfono y número de serie. |
| **Panel NFC completo** | Permite escanear tarjeta con Web NFC o ingresar UID manual, asignar a un cliente, sumar puntos con motivo y canjear recompensas del catálogo actualizando `PuntosMovimientos` y `Usuarios.PuntosActuales`. |
| **Concurrencia segura** | Creación de folios, cambios de estatus, costos y movimientos de puntos están blindados con `LockService`. |
| **Sesiones con expiración** | Tokens emitidos en `CacheService` y respaldados en `PropertiesService` con validación estricta de rol en backend en cada petición. |
| **Inicialización `setup()`** | Crea las 13 hojas con encabezados coloreados, filas congeladas, catálogo de recompensas y administrador principal sin errores. |
