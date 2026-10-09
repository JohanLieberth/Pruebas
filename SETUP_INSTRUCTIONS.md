# Instrucciones de Configuración y Despliegue - Control Machete

**Sistema de Autoevaluación de Control Interno (Marco COSO - Múltiples Lotes / Proyectos)**
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
| **Respuestas** | `QuestionID`, `Subdireccion`, `Respuesta`, `EvidenciaTextual`, `EvidenciaDocumental`, `Observaciones`, `NivelRiesgo`, `UsuarioQueRespondio`, `FechaCreacion`, `FechaUltimaModificacion` |
| **Lotes** | `LoteID`, `NombreLote`, `Descripcion`, `FechaCreacion`, `CreadoPor`, `Activo` |
| **Audit** | `Timestamp`, `Usuario`, `Entidad`, `QuestionID`, `ValorAnterior`, `ValorNuevo` |
| **Config** | `Clave`, `Valor` |

---

## 2. Autenticación y TokenService

- **Login con Correo y Contraseña**: Formulario dedicado en `Index.html` que valida credenciales contra la hoja `Usuarios`.
- **Hasheado de Contraseñas (SHA-256)**: Las contraseñas nunca se almacenan en texto plano; se utiliza `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ...)` para generar el hash.
- **Gestión de Sesiones (8 Horas)**: Al iniciar sesión exitosamente, se genera un token UUID aleatorio almacenado en `CacheService.getScriptCache()` con expiración automática de 8 horas (`TOKEN_TTL_SECONDS = 28800`).
- **Validación Backend**: Todas las funciones críticas del backend (`Code.gs`) solicitan `token` como primer parámetro y ejecutan `assertAuthenticatedUser(token)` o `assertAdmin(token)`.

---

## 3. Inicialización y Sembrado de Datos (`seedDatabase`)

1. Abra el editor de **Google Apps Script** asociado al proyecto.
2. Seleccione la función `seedDatabase` en la barra de herramientas superior.
3. Haga clic en **Ejecutar**.
4. La función realizará las siguientes acciones automáticamente:
   - Inicializará la hoja `Lotes` con el lote por defecto `LOTE_INICIAL` ("Lote Inicial").
   - Inicializará las 61 preguntas del cuestionario COSO vinculadas al `LOTE_INICIAL`.
   - Inicializará la hoja de `Subdirecciones` activas.
   - Pre-poblará `Asignaciones` con las sugerencias por defecto.
   - Registrará al usuario Administrador por defecto (`admin@merida.gob.mx` / Contraseña: `admin123`).

*Nota: Para bases de datos existentes, la función `migrateDatabaseStructure()` se ejecuta de forma transparente e idempotente al iniciar sesión, agregando las columnas `Contrasena` en Usuarios y `LoteID` en Preguntas, e iniciando el `LOTE_INICIAL` sin sobrescribir datos.*

---

## 4. Módulo de Lotes y Carga Masiva de Preguntas

- **Creación de Lotes**: Permite agregar nuevos conjuntos de preguntas (proyectos o evaluaciones periódicas).
- **Carga Masiva (ADMIN)**: Interfaz para pegar texto copiando celdas desde Excel/CSV con el formato exacto:
  `No.` | `Componente` | `Principio` | `Pregunta` | `Fundamento legal` | `Subdirección sugerida`
- **Vista Previa y Validaciones**: Resalta filas con errores (p. ej. campo de pregunta vacío) antes de confirmar. Evita colisiones de IDs numéricos con preguntas existentes anteponiendo el prefijo del Lote.
- **Mapeo Transparente**: Las preguntas de nuevos lotes funcionan de inmediato en la asignación por subdirección, autoevaluaciones, subida de evidencias en Google Drive y dashboard global.

---

## 5. Permisos OAuth Requeridos (`appsscript.json`)

```json
{
  "timeZone": "America/Merida",
  "dependencies": {},
  "webapp": {
    "access": "ANYONE",
    "executeAs": "USER_DEPLOYING"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

---

## 6. Resumen de Archivos Modificados

1. **`Code.gs`**: Servicio de tokens (`loginUsuario`, `logoutUsuario`, `assertAuthenticatedUser`), hashing SHA-256, migración idempotente de columnas, endpoints para gestión de Lotes (`cargarMasivaPreguntas`, `getLotesListAdmin`, `toggleLoteEstado`, `eliminarLoteAdmin`) y filtrado por lotes activos.
2. **`Index.html`**: Formulario de login interactivo con correo y contraseña, gestión del Token de sesión en `sessionStorage`, barra de usuario con botón de cerrar sesión.
3. **`UserView.html`**: Adaptado para enviar `currentSessionToken` en cada llamada backend y visualizar el `LoteID` de cada pregunta.
4. **`AdminView.html`**: Agregada pestaña de **Gestión de Lotes y Carga Masiva**, selector de Lotes en Dashboard Global, filtro por Lote en el Gestor de Asignaciones y campo de contraseña en el CRUD de Usuarios.
5. **`SETUP_INSTRUCTIONS.md`**: Actualizado con los detalles del nuevo esquema de seguridad, estructura de tablas y procedimientos de migración.
