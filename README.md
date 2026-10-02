# Sistema de Control Documental - Ayuntamiento de Mérida

Aplicación web desarrollada en Google Apps Script con base de datos en Google Sheets para el control de documentos (políticas, procedimientos, instructivos, manuales y formatos) del Ayuntamiento de Mérida.

---

## 🛠️ Estructura del Proyecto

- `Code.gs`: Lógica de servidor de Google Apps Script.
  - Inicialización automática de las 5 hojas de Google Sheets (`Catalogos`, `Documentos`, `Formatos`, `Bitacora`, `Config`).
  - Carga semilla exacta de la jerarquía organizacional oficial y las siglas (Administración, Bienestar Humano, Central de Abastos, Comunicación Ciudadana, Contraloría Municipal, Cuxtal, DIF, Finanzas y Tesorería, Gobernación, Instituto de las Mujeres, Obras Públicas).
  - Generación de códigos concurrentes con `LockService` bajo la nomenclatura `{prefijo_tipo}-{SiglaDir}/{SiglaArea}-{correlativo}`.
  - Registro automático de auditoría en la `Bitacora` para altas, ediciones y bajas lógicas (`Obsoleto`).
  - Validación de campos inmodificables (código y estructura organizacional) y formatos de revisión (`^(NR)?\d{1,2}$`).
  - Función de migración masiva CSV/Excel (`importarDesdeExcel`) con detección de duplicados por código y reporte de errores.

- `Index.html`: Interfaz web única (Single Page Application) servida mediante `HtmlService`.
  - Estilo institucional limpio en CSS embebido (sin dependencias ni frameworks externos).
  - **Pestaña 1 (Dashboard):** Métricas de totales, gráficos visuales por dirección y tipo, y tabla semáforo (&gt; 12 meses sin actualización).
  - **Pestaña 2 (Alta de Documento):** Desplegables en cascada de 3 niveles (Dirección → Subdirección → Departamento), vista previa del código tentativo antes de guardar y captura inmediata de formatos hijos.
  - **Pestaña 3 (Consulta / Edición):** Buscador multicriterio, tabla paginada (50 filas), ordenación por columnas, edición en modal con bloqueo de código/jerarquía y baja lógica.
  - **Pestaña 4 (Gestión de Formatos):** Vista jerárquica de árbol ("Documento → Formatos") para agregar, editar y obsolecer formatos.
  - **Pestaña 5 (Reportes y Migración):** Inventario por dirección imprimible/PDF, revisiones pendientes, historial de cambios de Bitácora e importación masiva de datos.

---

## 🚀 Instrucciones Breves de Despliegue

### 1. Preparar el Proyecto en Google Apps Script
1. Ingrese a [script.google.com](https://script.google.com) o cree un nuevo Script desde un libro de Google Sheets.
2. Cree un archivo de código llamado `Code.gs` y copie todo el contenido de `Code.gs`.
3. Cree un archivo HTML llamado `Index.html` y copie todo el contenido de `Index.html`.

### 2. Configuración Inicial y Administrador
1. Al ejecutar por primera vez cualquier función (o mediante la primera petición web), el sistema creará automáticamente las hojas en Google Sheets (`Catalogos`, `Documentos`, `Formatos`, `Bitacora` y `Config`).
2. En la hoja `Config`, agregue en la columna A los correos institucionales que tendrán rol de **Administrador** (un correo por fila). Si está vacía, el primer usuario que acceda será reconocido como administrador por defecto.

### 3. Publicar como Web App
1. Haga clic en **Desplegar** > **Nuevo despliegue**.
2. Seleccione el tipo **Aplicación web**.
3. Configure los parámetros:
   - **Descripción:** Sistema de Control Documental v1.0
   - **Ejecutar como:** Yo (*su cuenta de correo*)
   - **Quién tiene acceso:** Solo usuarios del dominio (*Ayuntamiento de Mérida*) o Cualquier persona dentro de la organización.
4. Haga clic en **Desplegar** y autorice los permisos requeridos por Google Apps Script.
5. Copie la **URL de la aplicación web** distribuible.
