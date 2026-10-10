# Instrucciones de Configuración y Despliegue - Control Machete

**Sistema de Autoevaluación de Control Interno (Marco COSO - Múltiples Lotes, Asignaciones e Inmutabilidad de Preguntas)**
*H. Ayuntamiento de Mérida, Yucatán*

---

## 1. Estructura de la Base de Datos (Google Sheets)

El sistema utiliza una única Hoja de Cálculo de Google Sheets. Al ejecutar la función de migración/sembrado (`seedDatabase()` o `migrateDatabaseStructure()`), la aplicación actualizará o creará las siguientes pestañas y encabezados:

| Nombre de la Hoja | Encabezados de Columna |
| :--- | :--- |
| **Preguntas** | `ID`, `Componente`, `Principio`, `Pregunta`, `FundamentoLegal`, `SubdireccionSugerida`, `LoteID` |
| **Usuarios** | `Email`, `Nombre`, `Subdireccion`, `Rol`, `Estado`, `Contrasena` |
| **Subdirecciones** | `Nombre`, `Activa` |
| **Asignaciones** | `QuestionID`, `SubdireccionAsignada`, `AsignadoPor`, `FechaAsignacion` |
| **Respuestas** | `QuestionID`, `Subdireccion`, `Respuesta`, `EvidenciaTextual`, `EvidenciaDocumental`, `Observaciones`, `NivelRiesgo`, `UsuarioQueRespondio`, `FechaCreacion`, `FechaUltimaModificacion`, `EstadoRevision`, `ObservacionAdmin` |
| **Lotes** | `LoteID`, `NombreLote`, `Descripcion`, `FechaCreacion`, `CreadoPor`, `Activo` |
| **Audit** | `Timestamp`, `Usuario`, `Entidad`, `QuestionID`, `ValorAnterior`, `ValorNuevo` |
| **Config** | `Clave`, `Valor` |

---

## 2. Modelo de Visibilidad en Interfaz de Usuario (Asignaciones)

- **Fuente de Verdad de Preguntas Asignadas**:
  Las preguntas presentadas a cada usuario se construyen leyendo de la hoja `Asignaciones` (QuestionID → SubdirecciónAsignada) cruzada con `Preguntas` y `Respuestas`.
- **Inmutabilidad en Pantalla**:
  Ninguna pregunta asignada desaparece de la vista del usuario al ser respondida o enviada.
- **Estados de Edición/Visualización (`EstadoRevision`)**:
  - `Borrador` o sin respuesta: Pregunta visible y editable.
  - `Enviada`: Visible en solo lectura con distintivo "Enviada — en revisión".
  - `Observada`: Visible y editable, destacada con la observación del Administrador y botón de re-envío individual.
  - `Aceptada`: Visible en solo lectura con distintivo "Aceptada".

---

## 3. Módulo "Seguimiento y Revisión" (ADMIN) — Lectura Directa de "Respuestas"

- **Lectura Directa de Hoja `Respuestas`**:
  `getRespuestasSeguimientoAdmin` lee directamente las filas registradas en la pestaña `Respuestas` usando `getDataRange()` y las enriquece cruzándolas con `Preguntas` por `QuestionID`.
- **Acciones de Revisión ("Aceptar" / "Observar")**:
  Escriben los cambios de `EstadoRevision` y `ObservacionAdmin` directamente en la pestaña `Respuestas`, forzando el refresco de la tabla con una re-lectura limpia desde el backend.

---

## 4. Resumen de Archivos Modificados

1. **`Code.gs`**:
   - `getPreguntasParaUsuario`: Construye el listado de preguntas basándose en `Asignaciones` sin omitir filas por estatus.
   - `getRespuestasSeguimientoAdmin`: Lee directamente de la pestaña `Respuestas` usando `getDataRange()`.
   - Incluida función backend `deleteEvidenceFile` para eliminación de adjuntos de soporte.
2. **`UserView.html`**:
   - Renderizado completo del acordeón de preguntas sin desvanecer elementos.
3. **`AdminView.html`**:
   - Módulo de Seguimiento y Revisión leyendo directamente la hoja `Respuestas`.
4. **`SETUP_INSTRUCTIONS.md`**:
   - Documentación actualizada.
