# 📋 Sistema de Seguimiento de Tareas Derivadas de Reuniones de Trabajo

Aplicación Web completa desarrollada en **Google Apps Script (V8)**, utilizando **Google Sheets** como base de datos relational y **Gmail** para notificaciones automáticas y alertas por correo electrónico.

---

## 🚀 Características Principales

- **Control de Acceso basado en Roles (RBAC)**:
  - **Administrador**: Gestión completa de proyectos, minutas con secciones dinámicas, acuerdos individuales, administración de usuarios, asignación de subdirecciones y Dashboard con métricas visuales.
  - **Operador**: Vista filtrada exclusivamente con los acuerdos asignados a su subdirección, actualización de estatus, historial de comentarios y botón para solicitar seguimiento al Administrador por correo.
- **Folios Autogenerados**: Formato consecutivo anual (`MIN-YYYY-NNN`, ej. `MIN-2025-001`).
- **Formulario de Minutas Dinámico**:
  - Datos generales (Proyecto, Etapa, Dependencia, Subdirección, Fecha, Lugar, Objetivos).
  - Lista de Asistencia dinámica (`+ Agregar asistente`).
  - Orden del Día dinámico con numeración automática (`+ Agregar punto`).
  - Acciones y Acuerdos dinámicos con selectores múltiples de solicitantes y responsables vinculados a la lista de asistencia.
- **Notificaciones Automáticas vía Gmail**:
  - Correo institucional HTML enviado inmediatamente a los usuarios activos de la subdirección asignada.
  - Registro auditable de cada envío en la pestaña `Log_Notificaciones`.
  - Proceso de recordatorio diario instalable para acuerdos próximos a vencer o vencidos (`enviarRecordatorioAcuerdosVencidos`).
- **Dashboard e Indicadores Visuales**:
  - Tarjetas KPI (Total Acuerdos, Pendientes, En Proceso, Cumplidos, Vencidos, Proyectos).
  - Gráficas interactiva con Chart.js (Distribución por Subdirección y Prioridad).
  - Tabla filtrable por subdirección y estatus con reasignación y edición rápida en tiempo real.

---

## 🧱 Estructura de la Base de Datos (Google Sheets)

El sistema crea y gestiona automáticamente 9 pestañas en Google Sheets:

1. **`Proyectos`**: `ID_Proyecto`, `Nombre_Proyecto`, `Descripción`, `Estatus`, `Fecha_Creación`, `Creado_Por`.
2. **`Minutas`**: `Folio`, `ID_Proyecto`, `Etapa`, `Dependencia`, `Subdirección`, `Nombre_Reunión`, `Fecha`, `Lugar`, `Objetivos`, `Creado_Por`, `Fecha_Creación`.
3. **`Asistencia`**: `ID_Asistencia`, `Folio_Minuta`, `Nombre`, `Dependencia_Area`, `Cargo`.
4. **`OrdenDelDia`**: `ID_Punto`, `Folio_Minuta`, `Número_Punto`, `Descripción_Punto`.
5. **`Acuerdos`**: `ID_Acuerdo`, `Folio_Minuta`, `Tipo`, `Descripción_Acuerdo`, `Prioridad`, `Solicitantes`, `Responsables`, `Fecha_Límite`, `Subdirección_Asignada`, `Estatus`, `Origen`, `Creado_Por`, `Fecha_Creación`, `Fecha_Modificación`.
6. **`Usuarios`**: `Correo`, `Nombre`, `Rol`, `Subdirección`, `Activo`.
7. **`Catálogos`**: `Tipo`, `Valor` (Dependencia, Subdirección, Etapa, Prioridad, Estatus).
8. **`Log_Notificaciones`**: `ID_Log`, `ID_Acuerdo`, `Correo_Destino`, `Asunto`, `Fecha_Envío`, `Estatus_Envío`.
9. **`Comentarios_Seguimiento`**: `ID_Comentario`, `ID_Acuerdo`, `Usuario`, `Fecha_Hora`, `Comentario`.

---

## ⚙️ Instrucciones de Instalación y Despliegue

### 1. Crear la Hoja de Cálculo y Copiar los Archivos
1. Crea una nueva Hoja de Cálculo en Google Sheets.
2. Ve al menú superior **Extensiones > Apps Script**.
3. Copia cada uno de los archivos del proyecto en el editor:
   - **Archivos `.gs`**:
     - `Code.gs`
     - `Config.gs`
     - `UsuariosBackend.gs`
     - `ProyectosBackend.gs`
     - `MinutasBackend.gs`
     - `MinutaBackend.gs`
     - `AcuerdosBackend.gs`
     - `Notificaciones.gs`
   - **Archivos `.html`**:
     - `Estilos.html`
     - `Scripts.html`
     - `Admin.html`
     - `Operador.html`
     - `Dashboard.html`
     - `Proyectos.html`
     - `Minuta.html`
     - `AcuerdoIndividual.html`
     - `Usuarios.html`
     - `AccesoDenegado.html`
   - **Manifiesto**:
     - `appsscript.json` (Asegúrate de tener activada la opción de ver el manifiesto en la configuración del proyecto de Apps Script).

### 2. Inicializar la Base de Datos
1. Recarga la Hoja de Cálculo de Google Sheets.
2. En la barra superior de Sheets aparecerá un menú personalizado titulado **"Seguimiento de Reuniones"**.
3. Haz clic en **Seguimiento de Reuniones > ⚙️ Configuración e Inicialización BD**.
4. Este proceso creará todas las pestañas requeridas, insertará los catálogos base y registrará automáticamente tu correo como el primer usuario **Administrador**.

### 3. Registrar Usuarios Iniciales
1. Abre el menú **Seguimiento de Reuniones > 👥 Gestión de Usuarios** o edita directamente la pestaña `Usuarios` en la Hoja de Cálculo.
2. Registra los correos electrónicos de los **Operadores**, asignando la **Subdirección** correspondiente a cada uno y marcando la columna `Activo` como `Sí`.

### 4. Configurar el Activador Diario para Recordatorios de Acuerdos Vencidos
1. En el editor de Google Apps Script, ve al menú lateral izquierdo **Activadores (Triggers / ícono de reloj)**.
2. Haz clic en **+ Añadir activador** (esquina inferior derecha).
3. Selecciona los siguientes parámetros:
   - **Seleccionar función que se ejecutará**: `enviarRecordatorioAcuerdosVencidos`
   - **Seleccionar fuente del evento**: `Según el tiempo`
   - **Seleccionar tipo de activador basado en la hora**: `Temporizador por días`
   - **Hora del día**: `De 8:00 a 9:00 a.m.` (o el horario deseado)
4. Guarda el activador y autoriza los permisos requeridos.

### 5. Desplegar como Aplicación Web
1. En la esquina superior derecha del editor de Apps Script, haz clic en **Desplegar > Nuevo despliegue**.
2. Selecciona **Aplicación web**.
3. Configura los siguientes campos:
   - **Descripción**: Versión inicial.
   - **Ejecutar como**: `Usuario que accede a la aplicación web` (o `Yo` según preferencia de dominio).
   - **Quién tiene acceso**: `Cualquier persona` o `Cualquier persona dentro de la organización`.
4. Haz clic en **Desplegar** y copia la URL proporcionada.

---

## 🛠️ Verificación y Uso

1. **Ingreso de Administrador**:
   - Accede a la URL web con el correo del Administrador. Se mostrará el dashboard interactivo, proyectos, creación de minutas, acuerdos individuales y administración de usuarios.
2. **Registro de Minuta**:
   - Al guardar una minuta con acuerdos asignados a una Subdirección, el sistema genera automáticamente el folio `MIN-2025-001` y envía un correo a todos los Operadores activos de dicha subdirección.
3. **Ingreso de Operador**:
   - Accede a la URL con un correo registrado como Operador. El sistema detectará su subdirección y mostrará únicamente sus tareas, permitiendo cambiar el estatus a `En Proceso` o `Cumplido`, adjuntar comentarios de seguimiento o solicitar atención del Administrador.
