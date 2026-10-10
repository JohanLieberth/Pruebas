# Instrucciones de Configuración y Despliegue - Control Machete

**Sistema de Autoevaluación de Control Interno (Marco COSO - Múltiples Lotes, Envío Individual Atómico y Módulo de Revisión)**
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

## 2. Autenticación y Control de Contraseñas (SHA-256)

- **Login Seguro**: Formulario interactivo en `Index.html` que valida correo y contraseña.
- **Seguridad Hash**: Las contraseñas se almacenan con algoritmo SHA-256. NUNCA se almacenan ni transmiten en texto plano.
- **Control Exclusivo Admin**:
  - Al crear un usuario, la contraseña es obligatoria.
  - Al editar, el Admin puede reemplazarla o dejar el campo vacío para conservar la existente.
  - El servidor NUNCA retorna el hash de contraseña al cliente; en las listas de usuarios se envía únicamente un indicador genérico ("Definida" / "Sin definir").
- **Tokens de Sesión (CacheService - 6 Horas)**: Al iniciar sesión exitosamente, se genera un token UUID guardado en `CacheService.getScriptCache()` con el límite máximo de 6 horas soportado por Apps Script (`TOKEN_TTL_SECONDS = 21600`).

---

## 3. Envío Individual Atómico por Pregunta

- **Suspensión de Autosave en Hoja**: Los cambios realizados en pantalla (respuesta seleccionada, evidencia textual, observaciones, selección de archivos) se mantienen en la memoria del formulario cliente.
- **Botón "Enviar" por Pregunta**: Cada tarjeta de pregunta tiene su propio botón "Enviar" (editable solo en estados `Borrador` u `Observada`).
- **Validación de Integridad**:
  - Requiere selección de **Respuesta** (Sí, Parcial, No, No Aplica).
  - Requiere al menos **una Evidencia** (Textual O Documental).
- **Operación Atómica en Backend (`enviarRespuestaIndividual`)**:
  - Procesa la subida de archivos a Google Drive (`/ControlMachete/{Subdirección}/{QuestionID}/`).
  - Si falla la subida de algún archivo, realiza **rollback** eliminando los archivos creados en Drive y cancela la escritura en la Hoja de Cálculo.
  - Al ser exitoso, guarda el registro en `Respuestas` con estado `Enviada` y bloquea la edición del formulario en el cliente (pasando a solo lectura con etiqueta "Enviada — en revisión").

---

## 4. Módulo "Seguimiento y Revisión" (ADMIN)

- **Carga Completa Preguntas × Respuestas**: Cruza directamente todas las preguntas existentes en la hoja `Preguntas` con las respuestas capturadas en `Respuestas`.
- **Estatus Incluidos**:
  - `Enviada`: Respuesta enviada por el usuario, pendiente de revisión por el Admin.
  - `Observada`: Devuelta por el Admin con observación obligatoria (reaparece editable en el cliente con banner de alerta).
  - `Aceptada`: Evaluada y aceptada por el Admin (estado final inmutable).
  - `Sin responder`: Preguntas asignadas que aún no han sido enviadas por los usuarios.
- **Acciones de Evaluación**: Botones "Aceptar" y "Observar" (modal obligatorio para detalle de correcciones). Refresco automático releendo directamente las hojas de cálculo.

---

## 5. Resumen de Archivos Modificados

1. **`Code.gs`**:
   - Implementada función atómica `enviarRespuestaIndividual` con rollback en Drive.
   - Refactorizada `getRespuestasSeguimientoAdmin` para cruzar la totalidad de preguntas de `Preguntas` con `Respuestas` (incluyendo estado "Sin responder").
   - Eliminados métodos obsoletos de envío masivo global.
2. **`UserView.html`**:
   - Eliminado botón y modal de envío global masivo.
   - Suspendido autosave contra la hoja de cálculo.
   - Agregados botones individuales "Enviar" por pregunta con modal de confirmación y advertencia `beforeunload`.
   - Indicador de avance recalculado para contar solo preguntas enviadas.
3. **`AdminView.html`**:
   - Actualizada tabla de Seguimiento y Revisión para desplegar el universo completo de preguntas con estatus real (incluyendo "Sin responder").
4. **`Index.html`**:
   - Ajuste de encabezados e indicativos de estado de usuario.
5. **`SETUP_INSTRUCTIONS.md`**:
   - Documentación completa actualizada.
