# 🛠️ Manual de Usuario Administrador - Control Machete

Bienvenido a la guía completa de administración de la aplicación **Control Machete**. Este documento está diseñado para los usuarios con rol **Administrador**, proporcionando instrucciones paso a paso para la gestión integral de auditorías de control interno, catálogos, usuarios, asignaciones, revisiones y monitoreo de avances.

---

## 📌 Tabla de Contenidos
1. [Acceso e Inicio de Sesión](#1-acceso-e-inicio-de-sesión)
2. [Configuración Inicial y Base de Datos](#2-configuración-inicial-y-base-de-datos)
3. [Gestión de Usuarios y Permisos](#3-gestión-de-usuarios-y-permisos)
4. [Gestión del Catálogo de Subdirecciones](#4-gestión-del-catálogo-de-subdirecciones)
5. [Módulo de Lotes y Preguntas (Carga e Importación)](#5-módulo-de-lotes-y-preguntas-carga-e-importación)
6. [Módulo de Asignación de Preguntas](#6-módulo-de-asignación-de-preguntas)
7. [Módulo de Seguimiento y Revisión de Auditoría](#7-módulo-de-seguimiento-y-revisión-de-auditoría)
8. [Dashboard de Indicadores y Avance General](#8-dashboard-de-indicadores-y-avance-general)

---

## 🔑 1. Acceso e Inicio de Sesión

1. Ingrese a la **URL de la Aplicación Web** desplegada en Google Apps Script.
2. Introduzca sus credenciales de Administrador (por ejemplo: `sakurazukamori21@gmail.com` / `Admin123`).
3. Al iniciar sesión con rol **Administrador**, el menú lateral se desplegará mostrando todos los módulos de gestión del sistema:
   - **Dashboard**
   - **Lotes y Preguntas**
   - **Asignaciones**
   - **Subdirecciones**
   - **Usuarios**
   - **Seguimiento y Revisión**

---

## ⚙️ 2. Configuración Inicial y Base de Datos

La aplicación verifica automáticamente la estructura de la base de datos en Google Sheets cada vez que se carga la página. Sin embargo, si requiere inicializar una nueva hoja de cálculo:

1. Abra el proyecto en Google Apps Script y configure la propiedad `SPREADSHEET_ID` en la sección **Propiedades del Script**.
2. Ejecute la función `inicializarBD()` o `garantizarAdministradorPrincipal()`.
3. Esto garantizará la existencia de todas las pestañas requeridas (`Lotes`, `Preguntas`, `Subdirecciones`, `Usuarios`, `Asignaciones`, `Respuestas`, `Catalogos`, `Logs`) con sus encabezados oficiales y el usuario administrador principal activo.

---

## 👥 3. Gestión de Usuarios y Permisos

En el menú lateral, seleccione **Usuarios**:

### A. Crear Nuevo Usuario
1. Haga clic en el botón **+ Nuevo Usuario**.
2. Complete los datos requeridos:
   - **Nombre Completo**.
   - **Correo Electrónico** (debe ser único en el sistema).
   - **Contraseña** (el sistema generará automáticamente un Hash SHA-256 seguro con Salt).
   - **Rol**:
     - `Administrador`: Acceso total al sistema y control de auditoría.
     - `Operativo`: Acceso restringido exclusivamente a responder preguntas de su subdirección.
   - **Subdirección Asignada**: Requerida si el rol es *Operativo*.
3. Presione **Guardar Usuario**.

### B. Editar o Desactivar Usuarios
- En la tabla de usuarios, use el botón **Editar** (icono de lápiz) para cambiar rol, nombre, subdirección o restablecer la contraseña.
- Use el botón **Desactivar / Activar** para suspender o habilitar el acceso a la plataforma de forma inmediata.

---

## 🏢 4. Gestión del Catálogo de Subdirecciones

En el menú lateral, seleccione **Subdirecciones**:

1. **Crear Subdirección**: Presione **+ Agregar Subdirección**, ingrese el nombre (soporta nombres simples o compuestos como `Subdirección de Servicios Internos // Comité de Ética`) y guarde.
2. **Editar / Estado**: Modifique el nombre o active/desactive subdirecciones según la estructura orgánica vigente.

---

## 📦 5. Módulo de Lotes y Preguntas (Carga e Importación)

En el menú lateral, seleccione **Lotes y Preguntas**:

### A. Crear un Lote de Auditoría
1. Haga clic en **Crear Lote**.
2. Asigne un nombre descriptivo (ejemplo: *Auditoría Control Interno 2025*) y una descripción opcional.
3. El sistema asignará un identificador de lote (ejemplo: `LOTE-001`).

### B. Importar Preguntas con Validación y Limpieza Previa
1. Seleccione el lote de destino y haga clic en **Importar Preguntas (CSV/Excel)**.
2. Pegue las filas copiadas de su archivo tabulado o CSV en el cuadro de texto en el formato de columnas:
   `No. | Categoría (Componente) | Subcategoría (Principio) | Pregunta | Fundamento Legal`
3. Haga clic en **Validar e Inspeccionar Registros**.
4. **Inspección de Formato**:
   - El sistema analizará el texto buscando errores comunes: *espacios sobrantes al inicio/final, dobles espacios, saltos de línea dentro de celdas o tabuladores*.
   - Se mostrará una tabla de vista previa resaltando los registros con observaciones de formato.
5. **Limpieza**:
   - Puede hacer clic en **Aplicar Limpieza Automática** para corregir y normalizar todo el texto con un solo clic.
   - O bien, editar manualmente cualquier celda directamente en la tabla de vista previa.
6. Haga clic en **Confirmar y Guardar Preguntas** para insertar las preguntas en la base de datos con IDs secuenciales asignados automáticamente (ejemplo: `LOTE-001-001`).

---

## 🔀 6. Módulo de Asignación de Preguntas

En el menú lateral, seleccione **Asignaciones**:

1. **Seleccionar Lote**: Elija el lote de preguntas a trabajar.
2. **Seleccionar Subdirección(es) Destino**: Marque una o varias subdirecciones (soporta asignación múltiple simultánea).
3. **Seleccionar Preguntas**: Marque las preguntas individuales o use el selector **Seleccionar Todas**.
4. **Ver Columna de Asignación**: La tabla muestra en tiempo real las subdirecciones asignadas a cada pregunta (*Sin asignar*, el nombre de la subdirección o *Múltiples (...)*).
5. Haga clic en **Asignar Preguntas Seleccionadas**.

---

## 🔍 7. Módulo de Seguimiento y Revisión de Auditoría

En el menú lateral, seleccione **Seguimiento y Revisión**:

1. **Tabla de Seguimiento Individual**: La tabla despliega una fila por cada combinación **QuestionID + Subdirección Responsable**.
2. **Filtros**: Seleccione el lote deseado para enfocar el análisis.
3. **Revisión de Respuestas**:
   - **Aceptar Respuesta**: Cambia el estado a `Aceptada`, registrando la fecha de revisión y el correo del Administrador.
   - **Observar Respuesta**: Si la respuesta o evidencia documental es insuficiente, haga clic en **Observar**, escriba el comentario o requerimiento de corrección y confirme. El usuario operativo verá la observación en su panel para corregir y reenviar.

---

## 📊 8. Dashboard de Indicadores y Avance General

En el menú lateral, seleccione **Dashboard**:

1. **Métricas en Tiempo Real**: Visualice tarjetas con el total de preguntas, preguntas respondidas, pendientes y aceptadas.
2. **Barra de Avance Porcentual**: Monitoree el porcentaje global de cumplimiento del proyecto de auditoría.
3. **Avance por Subdirección**: Analice la tabla de desglose de avance porcentual y número de respuestas aceptadas por cada unidad administrativa.
4. **Distribución por Nivel de Riesgo Residual**: Analice el gráfico de rosca (Doughnut Chart) interactivo generado por Chart.js con la clasificación automática de riesgo (*Alto*, *Medio*, *Bajo*, *No Aplica*).
