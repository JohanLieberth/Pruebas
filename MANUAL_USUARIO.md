# 🎮 PixelFix - Manual de Usuario y Funcionamiento por Roles

Bienvenido al **Manual Integral de Funcionamiento de PixelFix**, la plataforma web basada en Google Apps Script y Google Sheets para la administración, reparación y control de órdenes de servicio de consolas de videojuegos y accesorios.

Este manual consolida en un solo documento las guías de uso, flujos operativos, permisos y reglas de negocio según cada perfil o tipo de usuario que interactúa con la aplicación.

---

## 📑 Tabla de Contenidos
1. [Arquitectura General y Tipos de Usuarios](#1-arquitectura-general-y-tipos-de-usuarios)
2. [Rol 1: Usuario Público / Consulta Rápida (Sin Registro)](#2-rol-1-usuario-público--consulta-rápida-sin-registro)
3. [Rol 2: Usuario Cliente (Cliente Normal y Taller Aliado)](#3-rol-2-usuario-cliente-cliente-normal-y-taller-aliado)
   - 3.1 [Registro de Cuenta y Bienvenida por Correo](#31-registro-de-cuenta-y-bienvenida-por-correo)
   - 3.2 [Inicio de Sesión](#32-inicio-de-sesión)
   - 3.3 [Monitoreo de Órdenes y Dispositivos](#33-monitoreo-de-órdenes-y-dispositivos)
   - 3.4 [Gestión de Responsables Solidarios](#34-gestión-de-responsables-solidarios)
   - 3.5 [Programa de Puntos de Cliente Frecuente y Catálogo de Canje](#35-programa-de-puntos-de-cliente-frecuente-y-catálogo-de-canje)
4. [Rol 3: Técnico de Taller](#4-rol-3-técnico-de-taller)
   - 4.1 [Inicio de Sesión Técnico](#41-inicio-de-sesión-técnico)
   - 4.2 [Bandeja de Dispositivos Asignados](#42-bandeja-de-dispositivos-asignados)
   - 4.3 [Buscador y Filtros Operativos](#43-buscador-y-filtros-operativos)
   - 4.4 [Actualización de Estatus y Registro de Diagnóstico](#44-actualización-de-estatus-y-registro-de-diagnóstico)
5. [Rol 4: Administrador del Taller](#5-rol-4-administrador-del-taller)
   - 5.1 [Acceso y Panel de Control](#51-acceso-y-panel-de-control)
   - 5.2 [Alta de Nuevas Órdenes Multi-Dispositivo](#52-alta-de-nuevas-órdenes-multi-dispositivo)
   - 5.3 [Gestión de Órdenes Registradas y Dispositivos](#53-gestión-de-órdenes-registradas-y-dispositivos)
   - 5.4 [Asignación y Modificación del Responsable Solidario](#54-asignación-y-modificación-del-responsable-solidario)
   - 5.5 [Gestión y Auditoría de Costos por Dispositivo](#55-gestión-y-auditoría-de-costos-por-dispositivo)
   - 5.6 [Flujo de Entrega Parcial](#56-flujo-de-entrega-parcial)
   - 5.7 [Administración de Personal (Técnicos y Administradores)](#57-administración-de-personal-técnicos-y-administradores)
   - 5.8 [Catálogo de Recompensas de Canje (CRUD Completo)](#58-catálogo-de-recompensas-de-canje-crud-completo)
   - 5.9 [Panel de Puntos de Fidelidad y Tarjetas NFC](#59-panel-de-puntos-de-fidelidad-y-tarjetas-nfc)
6. [Resumen de Permisos y Matriz de Roles](#6-resumen-de-permisos-y-matriz-de-roles)

---

## 1. Arquitectura General y Tipos de Usuarios

PixelFix opera con 4 perfiles de acceso bien diferenciados:

| Perfil / Rol | Requiere Login | Acceso Principal | Propósito Principal |
| :--- | :---: | :--- | :--- |
| **Público (Sin Registro)** | No | Landing / `?p=consulta` | Consulta rápida de avance de sus consolas sin exponer datos personales. |
| **Cliente Normal** | Sí | `?p=login` → `?p=portal` | Ver detalle de presupuestos, historial de sus consolas, puntos acumulados y autorizar a terceros para recoger. |
| **Cliente Taller Aliado** | Sí | `?p=login` → `?p=portal` | Mismo acceso que cliente normal, optimizado para lotes multi-consola y múltiples responsables solidarios (socios, repartidores). |
| **Técnico de Taller** | Sí | `?p=login-admin` → `?p=tecnico` | Diagnóstico y actualización técnica de los dispositivos que le han sido asignados explícitamente. |
| **Administrador** | Sí | `?p=login-admin` → `?p=admin` | Control operativo total: recepción, asignación, costos, entregas parciales, auditoría, staff, puntos NFC y catálogo de canjes. |

---

## 2. Rol 1: Usuario Público / Consulta Rápida (Sin Registro)

Este módulo está diseñado para cualquier cliente que desee saber si su equipo ya está listo sin necesidad de crear una cuenta o recordar contraseñas.

### ¿Cómo consultar el estatus?
1. Ingrese a la página de inicio o seleccione la pestaña **"Consultar Estatus"** (`?p=consulta`).
2. En la barra de búsqueda, escriba al menos 3 caracteres correspondientes a uno de los siguientes datos:
   - **Folio de la orden:** Ej. `OS-20250601-0001`
   - **Teléfono registrado:** Ej. `5512345678`
   - **Correo electrónico:** Ej. `cliente@correo.com`
   - **Número de serie del equipo:** Ej. `SN-PS5-987654`
3. Haga clic en el botón **"Buscar Estatus"** o presione `Enter`.

### Resultados mostrados:
Por motivos de privacidad y seguridad de datos personales, la consulta pública no expone costos, diagnósticos confidenciales ni nombres completos. Muestra:
- **Folio de Orden de Servicio**.
- **Tipo de dispositivo, Marca y Modelo** (Ej. *PlayStation 5 Slim*).
- **Número de Serie** (parcialmente ofuscado si aplica).
- **Estatus actual del equipo:**
  - 🟡 *Pendiente:* Recibido en taller en espera de revisión.
  - 🔵 *En reparación:* En proceso de intervención técnica o reemplazo de componentes.
  - 🟣 *Pruebas:* En pruebas de rendimiento, térmicas o de estabilidad.
  - 🟢 *Listo:* **¡Tu equipo está listo para entrega!** Puedes pasar por él a sucursal.
  - 📦 *Entregado:* Equipo devuelto al cliente.
  - ⚪ *Cancelado:* Servicio cancelado.
- **Fecha y hora** de la última actualización de estado.

---

## 3. Rol 2: Usuario Cliente (Cliente Normal y Taller Aliado)

### 3.1 Registro de Cuenta y Bienvenida por Correo
1. Acceda a **"Crear Cuenta"** (`?p=registro`).
2. Seleccione su perfil:
   - **Normal (Particular):** Para gamers y usuarios finales.
   - **Taller Aliado:** Para talleres y técnicos independientes que envían lotes de consolas.
3. Complete los campos obligatorios:
   - Nombre o Razón Social.
   - Correo electrónico (será su identificador único).
   - Teléfono de contacto.
   - Contraseña segura (mínimo 6 caracteres).
4. *(Opcional)* Registre de inmediato un **Responsable Solidario** (nombre, teléfono y parentesco) para autorizarlo a recoger sus equipos.
5. Presione **"Crear Cuenta y Comenzar"**.
6. **Seguridad y Notificación:**
   - El sistema almacena la contraseña cifrada mediante hash SHA-256 + salt criptográfico aleatorio.
   - El servidor despacha un **correo electrónico de bienvenida único** con sus datos de acceso.

### 3.2 Inicio de Sesión
1. Ingrese a **"Iniciar Sesión Cliente"** (`?p=login`).
2. Ingrese su correo electrónico y contraseña.
3. El sistema valida las credenciales y genera un token de sesión seguro con vigencia de 6 horas, redirigiéndolo a su **Portal de Cliente** (`?p=portal`).

### 3.3 Monitoreo de Órdenes y Dispositivos
En la pestaña **"Mis Órdenes de Servicio"**:
- Visualice todas sus órdenes históricas y activas ordenadas cronológicamente.
- Conozca el estado general de la orden (*Abierta, Parcial o Completada*).
- Revise el desglose individual de cada dispositivo asociado a la orden:
  - Consola/Mando, Modelo y Número de Serie.
  - Falla que reportó al ingresar.
  - Diagnóstico emitido por el taller.
  - Estatus técnico en tiempo real.
  - Costo autorizado y saldo pendiente.

### 3.4 Gestión de Responsables Solidarios
En la pestaña **"Responsables Solidarios"**:
- Puede dar de alta a personas de confianza (amigos, familiares, empleados o repartidores) indicando su nombre, teléfono, correo y parentesco.
- Al quedar registrados, el administrador podrá asignarlos directamente a cualquiera de sus órdenes para que ellos puedan identificarse en mostrador y retirar los equipos de manera legal y autorizada.

### 3.5 Programa de Puntos de Cliente Frecuente y Catálogo de Canje
En las pestañas **"Mis Puntos y Canjes"** y **"Catálogo de Beneficios"**:
- **Saldo Actual:** Tarjeta visual con sus puntos acumulados vigentes.
- **Historial de Movimientos:** Auditoría transparente de cada ingreso de puntos (por servicios pagados o promociones) y egresos (por canjes realizados), indicando fecha, motivo y saldo resultante.
- **Catálogo de Recompensas:** Lista de servicios y mantenimientos canjeables (ej. 1,000 pts = Mantenimiento preventivo, 1,500 pts = Reemplazo de palancas Hall Effect, etc.).

---

## 4. Rol 3: Técnico de Taller

El perfil de Técnico está orientado a la productividad operativa en banco de trabajo, protegiendo la información sensible del negocio y permitiendo que cada técnico se concentre exclusivamente en sus equipos asignados.

### 4.1 Inicio de Sesión Técnico
1. Ingrese a **"Acceso Administrativo y Técnico"** (`?p=login-admin`).
2. Introduzca sus credenciales institucionales otorgadas por el administrador.
3. El sistema detecta el rol `Tecnico` y lo envía automáticamente a su portal especializado (`?p=tecnico`).

### 4.2 Bandeja de Dispositivos Asignados
- El técnico **únicamente ve los dispositivos que el Administrador le ha asignado**.
- En la tabla se listan:
  - Folio de la Orden padre.
  - Dispositivo, Marca, Modelo y Número de Serie.
  - Falla reportada por el cliente.
  - Diagnóstico actual.
  - Estatus operativo.
  - Fecha y hora de recepción y última actualización.

### 4.3 Buscador y Filtros Operativos
- Barra de búsqueda rápida por:
  - Folio de orden (`OS-...`).
  - Nombre del cliente o teléfono.
  - Número de serie del equipo (`SN-...`).
- Filtro desplegable por Estatus: permite visualizar solo los pendientes, los que están en proceso de reparación o los que están en pruebas.

### 4.4 Actualización de Estatus y Registro de Diagnóstico
1. Al comenzar o finalizar una etapa técnica, haga clic en el botón **"✏️ Actualizar Diagnóstico / Estatus"** en la fila del dispositivo.
2. En el modal emergente podrá:
   - Redactar o complementar el **Diagnóstico Técnico** (piezas cambiadas, mediciones de placa, pastas térmicas aplicadas, etc.).
   - Seleccionar el **Nuevo Estatus Técnico**, restringido estrictamente a:
     - 🟡 **Pendiente:** En cola de banco.
     - 🔵 **En reparación:** Intervención en proceso.
     - 🟣 **Pruebas:** Monitoreo térmico / estrés de GPU / prueba de controles.
     - 🟢 **Listo:** Trabajo concluido con éxito.
     *(Nota: Los estados "Entregado" y "Cancelado" están reservados exclusivamente al Administrador en mostrador).*
   - Ingresar un comentario de bitácora.
3. Al presionar **"Guardar Cambios"**, el cambio se guarda en la base de datos y se registra automáticamente una entrada inmutable en `HistorialEstatus`.

---

## 5. Rol 4: Administrador del Taller

El Administrador tiene el control total sobre los flujos operativos, comerciales, de personal y de fidelización de la empresa.

### 5.1 Acceso y Panel de Control
- Acceda desde `?p=login-admin` con su cuenta administradora (ej. Administrador principal o delegados).
- La interfaz cuenta con pestañas de navegación rápida:
  - 📋 **Órdenes de Servicio:** Consulta, edición, responsables, costos y entregas.
  - ➕ **Nueva Orden Multi-Consola:** Recepción de clientes y registro de equipos.
  - 💳 **Puntos y Tarjetas NFC:** Asignación, lectura NFC y canjes en mostrador.
  - 👥 **Usuarios y Técnicos:** Altas y gestión de staff.
  - 🎁 **Catálogo de Recompensas:** Configuración del catálogo de canjes.

### 5.2 Alta de Nuevas Órdenes Multi-Dispositivo
1. Ingrese a la pestaña **"➕ Nueva Orden Multi-Consola"**.
2. **Identificación del Cliente:**
   - Puede buscar un cliente registrado por nombre, teléfono o correo mediante el buscador en tiempo real, o capturar manualmente los datos si es un cliente nuevo.
   - Seleccione el tipo de cliente (*Normal* o *Taller Aliado*).
   - Indique observaciones generales de recepción.
3. **Dispositivos a Ingresar (Multi-Consola):**
   - El sistema permite registrar una o múltiples consolas bajo el mismo folio.
   - Por cada dispositivo capture: Tipo (PS5, Xbox, Switch, Mando, etc.), Marca, Modelo, Número de Serie, Color, Accesorios dejados (cables, caja), Falla reportada, Costo estimado inicial y Técnico asignado preliminar.
   - Presione **"+ Agregar Otro Dispositivo"** si el cliente deja más equipos.
4. Presione **"💾 Registrar Orden de Servicio"**. El sistema genera un folio correlativo único e inviolable (`OS-YYYYMMDD-####`) protegido por `LockService`.

### 5.3 Gestión de Órdenes Registradas y Dispositivos
En la pestaña **"📋 Órdenes de Servicio"**:
- Tabla general con Folio, Cliente, Teléfono, **Responsable Solidario**, Estado general (*Abierta, Parcial, Completada, Cancelada*), Total a Cobrar, Monto Cobrado, Saldo pendiente y Cantidad de equipos.
- Al hacer clic en **"Ver Equipos"**:
  - Se despliega el panel inferior con la información completa de la orden.
  - Se visualiza la tarjeta del **Responsable Solidario Autorizado**.
  - Se listan todos los dispositivos asociados con su diagnóstico individual, estatus, técnico asignado, costo y botones de acción rápida (*Entregar, Editar, Historial*).

### 5.4 Asignación y Modificación del Responsable Solidario
Permite designar o corregir quién está legalmente facultado para recoger los equipos de una orden:
1. En la vista de detalle de la orden seleccionada, en el bloque **"👤 Responsable Solidario Autorizado"**, haga clic en **"✏️ Modificar Responsable"**.
2. En el modal emergente puede:
   - **Opción A (Existente):** Seleccionar del menú desplegable a cualquiera de los responsables solidarios que el cliente ya tiene registrados en su cuenta.
   - **Opción B (Nuevo):** Capturar los datos de un nuevo responsable (Nombre, Teléfono, Correo, Parentesco/Relación). El sistema lo asociará automáticamente a la cuenta del cliente para futuras órdenes.
   - **Opción C (Desvincular):** Seleccionar *"-- Sin responsable asignado --"* si el cliente retiró la autorización.
3. Presione **"Guardar Responsable"**. El cambio se almacena de forma persistente en la hoja `OrdenesServicio` y queda auditado con fecha y usuario en la bitácora de `Logs`. La tabla principal y el detalle se actualizan de inmediato.

### 5.5 Gestión y Auditoría de Costos por Dispositivo
En PixelFix, cada dispositivo tiene su propio presupuesto y costo final:
1. En la lista de dispositivos de la orden, haga clic en el botón **"Modificar Costo"**.
2. Puede ajustar:
   - **Costo Estimado:** Presupuesto inicial.
   - **Costo Final:** Monto definitivo tras completar la reparación.
   - **Motivo del cambio:** Justificación obligatoria para fines de auditoría (ej. *Se requirió cambio de IC de carga adicional*).
3. Al guardar, el cambio se registra en `HistorialCostos` y se recalculan automáticamente el `TotalEstimado`, `TotalCobrado` y `Saldo` de la orden de servicio.

### 5.6 Flujo de Entrega Parcial
Dado que los tiempos de reparación entre consolas de una misma orden suelen variar:
1. Cuando un dispositivo alcanza el estatus **"Listo"** y el cliente acude a recogerlo antes que los demás, haga clic en **"📦 Entregar"**.
2. Confirme la entrega e introduzca observaciones (ej. *Entregado a hermano con credencial de elector*).
3. **Comportamiento automático del sistema:**
   - El dispositivo pasa a estatus **"Entregado"** y se marca con `EntregadoParcial = SI`.
   - Se fija la fecha y hora de entrega.
   - El costo a cobrar del dispositivo se suma al `TotalCobrado` de la orden.
   - La orden pasa al estado **"Parcial"** (si aún quedan equipos pendientes) o a **"Completada"** (si todos los dispositivos de la orden han sido entregados o cancelados).

### 5.7 Administración de Personal (Técnicos y Administradores)
En la pestaña **"👥 Usuarios y Técnicos"**:
- Lista del personal activo e inactivo del taller.
- Botón **"+ Nuevo Usuario Staff"**: Permite dar de alta técnicos o administradores con nombre, correo, teléfono y contraseña inicial.
- Las contraseñas se almacenan mediante hash SHA-256 con salt.
- Botones para activar o desactivar personal con un solo clic.

### 5.8 Catálogo de Recompensas de Canje (CRUD Completo)
En la pestaña **"🎁 Catálogo de Recompensas"**:
- Administre los beneficios que los clientes pueden redimir con sus puntos:
  - **Alta:** Haga clic en **"+ Nueva Recompensa"** e indique Nombre, Puntos requeridos, Orden de visualización, Estado (Activo/Inactivo) y Descripción detallada.
  - **Edición:** El botón **"✏️ Editar"** abre el formulario modal cargando automáticamente todos los valores actuales del registro seleccionado para su modificación.
  - **Activación / Desactivación:** El botón **"Desactivar"** (o **"Activar"**) cambia el estado de visibilidad del beneficio en el catálogo público y de clientes con confirmación previa.

### 5.9 Panel de Puntos de Fidelidad y Tarjetas NFC
En la pestaña **"💳 Puntos y Tarjetas NFC"**:
- **Búsqueda del Cliente:** Localice al cliente por nombre, correo, teléfono o código UID de tarjeta física.
- **Lectura / Vinculación NFC:**
  - Si el dispositivo del taller cuenta con sensor NFC compatible con el estándar *Web NFC* en navegadores modernos (Chrome en Android o lectores USB compatibles), presione **"📲 Escanear Tarjeta NFC"**.
  - Si el sensor no está disponible o se usa lector USB en modo emulación teclado, ingrese manualmente el UID en el campo de texto.
  - Presione **"Asignar Tarjeta"** para ligar el chip físico a la cuenta del cliente.
- **Asignación Manual de Puntos:**
  - Capture la cantidad de puntos y el motivo (ej. *Bonificación por compra de accesorios o cortesía*).
  - El sistema actualiza el saldo de inmediato en `Usuarios` y registra la transacción en `PuntosMovimientos` bajo control de concurrencia `LockService`.
- **Canje de Recompensas en Mostrador:**
  - Seleccione el servicio o premio del catálogo desplegable.
  - El sistema valida en el servidor que la recompensa esté activa y que el saldo del cliente sea suficiente (impidiendo saldos negativos).
  - Al procesar el canje, se descuentan los puntos y se emite el comprobante en pantalla.

---

## 6. Resumen de Permisos y Matriz de Roles

| Función / Operación | Público | Cliente | Técnico | Administrador |
| :--- | :---: | :---: | :---: | :---: |
| Consultar estatus básico por Folio/Serie | ✅ | ✅ | ✅ | ✅ |
| Ver desglose de costos y presupuestos | ❌ | ✅ (Propios) | ❌ | ✅ (Todos) |
| Registrar y autorizar Responsables Solidarios | ❌ | ✅ (Propios) | ❌ | ✅ (Cualquier orden) |
| Consultar puntos acumulados y catálogo | ❌ | ✅ (Propios) | ❌ | ✅ (Todos) |
| Registrar nueva orden de servicio | ❌ | ❌ | ❌ | ✅ |
| Ver dispositivos de otros técnicos | ❌ | ❌ | ❌ | ✅ |
| Modificar estatus: Pendiente / Reparación / Pruebas / Listo | ❌ | ❌ | ✅ (Asignados) | ✅ (Todos) |
| Modificar estatus: Entregado / Cancelado | ❌ | ❌ | ❌ | ✅ |
| Ejecutar Entregas Parciales | ❌ | ❌ | ❌ | ✅ |
| Modificar y auditar costos de reparación | ❌ | ❌ | ❌ | ✅ |
| Asignar técnicos a equipos | ❌ | ❌ | ❌ | ✅ |
| Crear y gestionar staff (Técnicos/Admins) | ❌ | ❌ | ❌ | ✅ |
| Gestionar Catálogo de Recompensas (CRUD) | ❌ | ❌ | ❌ | ✅ |
| Asignar tarjetas NFC y canjear puntos en mostrador | ❌ | ❌ | ❌ | ✅ |

---

*Manual elaborado para el sistema **PixelFix** - Solución Web App con Google Apps Script y Google Sheets.*
