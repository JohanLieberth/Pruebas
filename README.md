# Control Machete - App de Control para Responder Auditorías de Control Interno

Aplicación Web completa desarrollada en **Google Apps Script (V8)**, **HTML5**, **CSS3 (Bootstrap 5)** y **JavaScript** con almacenamiento de datos en **Google Sheets** y archivos adjuntos en **Google Drive**.

---

## 📚 Documentación y Manuales de Usuario

- [🛠️ Manual de Usuario Administrador](MANUAL_ADMINISTRADOR.md): Guía paso a paso para Administradores sobre gestión de usuarios, creación de lotes, importación y limpieza de preguntas, asignación múltiple, revisión individual de respuestas y monitoreo del dashboard.
- [📘 Manual de Usuario Operativo](MANUAL_OPERATIVO.md): Guía paso a paso para usuarios operativos para responder preguntas, adjuntar evidencias a Google Drive y corregir observaciones.

---

## 🚀 Características Principales

1. **Base de Datos Relacional en Google Sheets**:
   - `Lotes`: Control de proyectos/lotes de auditoría.
   - `Preguntas`: Banco de preguntas con ID secuencial (`LOTE-001-001`).
   - `Subdirecciones`: Subdirecciones responsables (simples y compuestas).
   - `Usuarios`: Gestión de cuentas, roles (`administrador` / `operativo`) y contraseñas encriptadas con **SHA-256 + Salt**.
   - `Asignaciones`: Asignación individual y masiva de preguntas a subdirecciones (soporta múltiples subdirecciones por pregunta).
   - `Respuestas`: Gestión de respuestas individuales por combinación de pregunta y subdirección, cálculo de riesgo residual automático, carpetas de Drive para evidencias textuales/documentales y flujo de observaciones.
   - `Catalogos`: Catálogos maestros de respuesta, riesgo y estado de revisión.
   - `Logs`: Auditoría completa de acciones del sistema.

2. **Roles y Seguridad**:
   - Sesiones seguras mediante tokens generados en `CacheService`.
   - Contraseñas almacenadas con Hash Digest SHA-256 y UUID Salt.
   - Restricción de permisos en servidor y vistas dinámicas en frontend.

3. **Cálculo de Riesgo Residual Automático**:
   - **Sí** ➔ Riesgo **Bajo**
   - **Parcial** ➔ Riesgo **Medio**
   - **No** ➔ Riesgo **Alto**
   - **No Aplica** ➔ **N/A**

4. **Dashboard Interactivo**:
   - Avance porcentual en tiempo real.
   - Tarjetas de indicadores (Total, Respondidas, Pendientes, Aceptadas).
   - Gráfico Doughnut con **Chart.js** para niveles de riesgo.
   - Desglose de cumplimiento por subdirección.

---

## 🛠️ Instrucciones de Instalación y Despliegue

### 1. Crear el Proyecto en Google Apps Script
1. Ingrese a [script.google.com](https://script.google.com) y cree un **Nuevo Proyecto**.
2. Nombre el proyecto como `Control Machete`.

### 2. Copiar los Archivos
Cree y pegue los contenidos de los siguientes archivos en el editor:
- **Archivos de Código (`.gs`)**:
  - `Code.gs`
  - `Auth.gs`
  - `Usuarios.gs`
  - `Subdirecciones.gs`
  - `Lotes.gs`
  - `Preguntas.gs`
  - `Asignaciones.gs`
  - `Respuestas.gs`
  - `Dashboard.gs`
- **Archivos HTML/CSS/JS (`.html`)**:
  - `Index.html`
  - `Styles.html`
  - `JavaScript.html`

### 3. Crear o Vincular Hoja de Cálculo
1. Cree un nuevo **Google Sheets** en su Google Drive titulado `Control Machete - BD`.
2. Copie el ID de la hoja de cálculo desde la URL (`https://docs.google.com/spreadsheets/d/ID_AQUI/edit`).
3. En Google Apps Script, diríjase a **Configuración del proyecto** ⚙️ ➔ **Propiedades del script** y agregue:
   - **Propiedad**: `SPREADSHEET_ID`
   - **Valor**: `[Su ID de Hoja de Cálculo]`

### 4. Inicializar la Base de Datos y Garantizar Administrador
1. En el editor de Apps Script, seleccione la función `inicializarBD` o `garantizarAdministradorPrincipal` en el archivo `Code.gs`.
2. Haga clic en **Ejecutar**.
3. Otorgue los permisos requeridos cuando Google los solicite.
4. Esto creará o actualizará automáticamente el usuario Administrador del Sistema con rol `administrador` y estado activo.

---

## 🔑 Credenciales del Administrador

- **Usuario Administrador**:
  - **Correo**: `sakurazukamori21@gmail.com`
  - **Contraseña**: `Admin123`
  - **Rol**: `administrador`
  - **Estado**: `Activo`

---

## 🌐 Publicar como Aplicación Web

1. Haga clic en **Desplegar** ➔ **Nuevo despliegue**.
2. Seleccione el tipo **Aplicación web**.
3. Configuración:
   - **Descripción**: `Versión 1.0 - Control Machete`
   - **Ejecutar como**: `Yo (tu correo electrónico)`
   - **Quién tiene acceso**: `Cualquier persona con una cuenta de Google` o `Cualquier persona`
4. Haga clic en **Desplegar** y copie la URL de la aplicación web generada.
