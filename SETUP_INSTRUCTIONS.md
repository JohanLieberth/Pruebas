# Instrucciones de Configuración y Despliegue - Control Machete

**Sistema de Autoevaluación de Control Interno (Marco COSO - Múltiples Lotes y Módulo de Revisión)**
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

## 3. Flujo de Estados de Respuesta y Módulo "Seguimiento y Revisión"

Flujo del ciclo de vida de las respuestas:

```
[Borrador] (Autosave del Usuario)
    │
    ▼ (Usuario valida completeness y hace clic en "Enviar respuestas")
[Enviada] (Queda en modo SOLO LECTURA para el Usuario y pasa a revisión del Admin)
    │
    ├───► [Aceptada] (Aceptada por el Admin -> Estado Final)
    │
    └───► [Observada] (Observada por el Admin con comentario obligatorio)
            │
            ▼ (Reaparece editable en el Usuario con alerta destacada y botón "Reenviar")
          [Enviada]
```

- **Inmutabilidad y Visibilidad**: Las preguntas asignadas al usuario NUNCA desaparecen de su acordeón. Permanecen editables solo mientras estén en estado `Borrador` u `Observada`. Una vez `Enviadas` o `Aceptadas`, permanecen en modo de solo lectura.

---

## 4. Gestión de Lotes LEYENDO DIRECTAMENTE DE LA HOJA "LOTES"

- **Diagnóstico y Corrección de Lotes**:
  La función `getLotesListAdmin()` lee directamente la pestaña `Lotes` del Spreadsheet utilizando `getDataRange()`. Se eliminó cualquier dependencia de memoria o caché para garantizar que los lotes agregados manualmente o mediante carga masiva se reflejen de inmediato en la interfaz.

---

## 5. Resumen de Archivos Modificados

1. **`Code.gs`**:
   - Agregados endpoints de revisión de respuestas (`enviarRespuestasUsuario`, `reenviarRespuestaObservada`, `getRespuestasSeguimientoAdmin`, `revisarRespuestaAdmin`).
   - Corregido `getLotesListAdmin` para lectura directa de la hoja `Lotes`.
   - Modificado `getUsuariosAdmin` para no enviar hashes de contraseña.
   - Ajustada migración idempotente para las columnas `EstadoRevision` y `ObservacionAdmin`.
2. **`UserView.html`**:
   - Mantenimiento de preguntas visibles en el acordeón en todo momento.
   - Agregada barrera de envío global con botón "Enviar respuestas" e inspección de integridad (Respuesta + al menos 1 evidencia).
   - Renderizado de alertas para preguntas marcadas como `Observada` con botón individual de re-envío.
3. **`AdminView.html`**:
   - Nuevo módulo de **Seguimiento y Revisión** con tabla filtrable y modal de evaluación/observación obligatoria.
   - Actualizados indicadores KPI en Dashboard Global (Pendientes de revisión, Observadas, Aceptadas).
   - Exigencia de contraseña al crear nuevos usuarios.
4. **`Index.html`**:
   - Pestaña de navegación agregada para "Seguimiento y Revisión".
5. **`SETUP_INSTRUCTIONS.md`**:
   - Documentación actualizada de flujos y estructura.
