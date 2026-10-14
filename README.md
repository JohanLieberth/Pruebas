# Planner - Aplicación Web de Gestión de Tareas y Proyectos estilo Microsoft Planner

Aplicación web completa construida sobre **Google Apps Script (V8)** y el ecosistema de **Google Workspace**, diseñada para replicar las funciones principales de **Microsoft Planner** (Kanban, Vistas múltiples, Seguimiento, Integraciones y Asistente IA).

---

## 🚀 Características Principales

1. **Tablero Kanban Interactivo (Panel):**
   - Creación, renombramiento y eliminación de **Buckets** por proyecto.
   - Arrastrar y soltar (Drag & Drop con SortableJS) para mover tarjetas de tareas entre buckets con sincronización automática en backend.
   - Tarjetas de tarea con título, descripción, prioridad (Urgente, Alta, Media, Baja), fechas de inicio y vencimiento, checklist, asignaciones por correo y archivos adjuntos.

2. **Múltiples Vistas de Trabajo:**
   - **Panel (Kanban):** Trabajo visual por columnas.
   - **Lista / Cuadrícula:** Tabla con filtrado por búsqueda de texto y prioridad.
   - **Calendario:** Vista mensual interactiva de vencimientos.
   - **Gantt (Línea de tiempo):** Barras de progreso de tareas usando Frappe Gantt.
   - **Dashboard:** Indicadores KPI (Total, Completadas, En curso, Atrasadas) y gráficos con Chart.js.

3. **Integraciones con Google Workspace:**
   - **Google Sheets:** Base de datos relacional dividida en 8 pestañas (`Proyectos`, `Buckets`, `Tareas`, `Checklist`, `Comentarios`, `Adjuntos`, `Etiquetas`, `Usuarios`).
   - **Google Calendar:** Eventos automáticos en el calendario predeterminado para tareas con fecha límite.
   - **Google Drive:** Almacenamiento organizado de archivos adjuntos en carpetas `/Planner - [Proyecto]`.
   - **Google Tasks:** Sincronización automática de tareas creadas.
   - **Gmail:** Envío de recordatorios y notificaciones por correo electrónico.
   - **Google Chat:** Webhook/Espacios para notificaciones de avance.
   - **Gemini API:** Asistente IA integrado para responder consultas sobre proyectos y generar automáticamente planes estructurados con Buckets y Tareas.

4. **Usuarios y Seguridad:**
   - Control de acceso por dominio institucional.
   - Roles de usuario (`administrador`, `editor`, `lector`).
   - Concurrencia garantizada mediante `LockService` y lectura/escritura segura.

---

## 🛠️ Estructura del Proyecto

- `Código.gs`: Backend principal en Google Apps Script V8 (Estructura BD, CRUD, Integraciones Workspace, Gemini API).
- `Index.html`: Layout principal, barra de navegación, contenedores de vistas y ventanas modales.
- `Estilos.html`: Estilos CSS modernos estilo Microsoft Planner + Google Material Design.
- `JavaScript.html`: Controlador frontend (SortableJS, Chart.js, Frappe Gantt, modales y comunicación con servidor).
- `appsscript.json`: Manifiesto con configuración de tiempo de ejecución V8, Web App y Scopes OAuth.

---

## 📋 Instrucciones de Instalación y Despliegue

### Step 1: Crear la Hoja de Cálculo (Google Sheets)
1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva hoja de cálculo llamada **`Planner Database`**.
2. Copia el **ID de la Hoja de Cálculo** desde la URL (`https://docs.google.com/spreadsheets/d/TU_SPREADSHEET_ID/edit`).

### Step 2: Configurar Google Apps Script
1. En la hoja de cálculo, ve al menú superior: **Extensiones > Apps Script**.
2. Borra el archivo `Código.gs` por defecto y copia los archivos del proyecto:
   - `Código.gs`
   - `Index.html`
   - `Estilos.html`
   - `JavaScript.html`
3. En la configuración del proyecto (ícono de engranaje ⚙️), activa la casilla **"Mostrar el archivo de manifiesto appsscript.json en el editor"**.
4. Reemplaza el contenido de `appsscript.json` con el contenido proporcionado en este repositorio.

### Step 3: Configurar Propiedades del Proyecto (Script Properties)
1. En la configuración del proyecto ⚙️, ve a la sección **Propiedades del script (Script Properties)**.
2. Agrega las siguientes propiedades:
   - `SPREADSHEET_ID`: El ID de tu hoja de cálculo creada en el Paso 1.
   - `GEMINI_API_KEY`: Tu clave API de Google AI Studio (Obtenla en [Google AI Studio](https://aistudio.google.com/)).
   - `ALLOWED_DOMAIN` *(Opcional)*: Tu dominio institucional (ej. `midominio.com`) para restringir el acceso.

### Step 4: Activar Servicios Avanzados de Google
1. En el panel izquierdo de Apps Script, haz clic en **Servicios (+)**.
2. Busca y añade el servicio **Google Tasks API** (`Tasks`).

### Step 5: Desplegar como Aplicación Web (Web App)
1. En la esquina superior derecha, haz clic en **Desplegar > Nuevo despliegue**.
2. Selecciona tipo: **Aplicación web**.
3. Configuración:
   - **Descripción:** `Planner v1.0`
   - **Ejecutar como:** `Usuario que implementa la aplicación web` (User deploying) o `Usuario que accede` según tus requerimientos.
   - **Quién tiene acceso:** `Cualquier persona dentro de [Tu Dominio]` o `Cualquier usuario con cuenta de Google`.
4. Haz clic en **Desplegar** y otorga los permisos/scopes de OAuth solicitados.

---

## 🔐 Scopes OAuth Requeridos (`appsscript.json`)

- `https://www.googleapis.com/auth/spreadsheets`: Acceso a la base de datos en Google Sheets.
- `https://www.googleapis.com/auth/drive`: Creación y almacenamiento de adjuntos en Google Drive.
- `https://www.googleapis.com/auth/calendar`: Registro de vencimientos en Google Calendar.
- `https://www.googleapis.com/auth/tasks`: Sincronización de tareas en Google Tasks.
- `https://www.googleapis.com/auth/gmail.send`: Envío de recordatorios vía Gmail.
- `https://www.googleapis.com/auth/script.external_request`: Llamadas a Gemini API.
- `https://www.googleapis.com/auth/userinfo.email`: Identificación de usuarios.

---

## ⚠️ Limitaciones y Posibles Mejoras

1. **Límites de Google Apps Script:**
   - La ejecución de scripts tiene un límite de 6 minutos por llamada.
   - Para proyectos masivos (+5,000 tareas), se recomienda paginación en la carga de tareas.
2. **Mejoras Futuras Propuestas:**
   - Notificaciones Push en tiempo real mediante Firebase / WebSockets.
   - Filtros avanzados por etiquetas y asignados múltiples.
   - Exportación de tableros e informes a PDF o Google Docs.
