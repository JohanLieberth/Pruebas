# Instrucciones de Configuración y Despliegue - Control Machete

**Sistema de Autoevaluación de Control Interno (Marco COSO - 61 Preguntas)**
*H. Ayuntamiento de Mérida, Yucatán*

---

## 1. Estructura de la Base de Datos (Google Sheets)

El sistema utiliza una única Hoja de Cálculo de Google Sheets. Al ejecutar la función de sembrado (`seedDatabase()`), el sistema creará automáticamente la estructura de pestañas y encabezados necesarios:

| Nombre de la Hoja | Encabezados de Columna |
| :--- | :--- |
| **Preguntas** | `ID`, `Componente`, `Principio`, `Pregunta`, `FundamentoLegal`, `SubdireccionSugerida` |
| **Usuarios** | `Email`, `Nombre`, `Subdireccion`, `Rol`, `Estado` |
| **Subdirecciones** | `Nombre`, `Activa` |
| **Asignaciones** | `QuestionID`, `SubdireccionAsignada`, `AsignadoPor`, `FechaAsignacion` |
| **Respuestas** | `QuestionID`, `Subdireccion`, `Respuesta`, `EvidenciaTextual`, `EvidenciaDocumental`, `Observaciones`, `NivelRiesgo`, `UsuarioQueRespondio`, `FechaCreacion`, `FechaUltimaModificacion` |
| **Audit** | `Timestamp`, `Usuario`, `Entidad`, `QuestionID`, `ValorAnterior`, `ValorNuevo` |
| **Config** | `Clave`, `Valor` |

---

## 2. Inicialización y Sembrado de Datos (`seedDatabase`)

1. Abra el editor de **Google Apps Script** asociado al proyecto.
2. Seleccione la función `seedDatabase` en la barra de herramientas superior.
3. Haga clic en **Ejecutar**.
4. La función realizará las siguientes acciones automáticamente:
   - Creará o abrirá el Spreadsheet `Control Machete - BD`.
   - Inicializará las 61 preguntas del cuestionario COSO.
   - Extraerá las Subdirecciones sugeridas e inicializará la hoja de `Subdirecciones`.
   - Llenará la hoja `Asignaciones` con las subdirecciones sugeridas por defecto (y `SIN_ASIGNAR` para preguntas sin sugerencia).
   - Registrará al usuario ejecutor como el primer **Administrador (ADMIN)** activo.

---

## 3. Alcance y Permisos OAuth Requeridos (`appsscript.json`)

Asegúrese de contar con los siguientes permisos en el archivo manifiesto `appsscript.json`:

```json
{
  "timeZone": "America/Merida",
  "dependencies": {},
  "webapp": {
    "access": "DOMAIN",
    "executeAs": "USER_DEPLOYING"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

---

## 4. Pasos para el Despliegue de la Aplicación Web

1. En el editor de Apps Script, haga clic en **Desplegar** > **Nuevo despliegue**.
2. Seleccione el tipo de despliegue: **Aplicación Web**.
3. Configure los campos con los siguientes valores:
   - **Descripción**: `Control Machete - Versión Producción 1.0`
   - **Ejecutar como**: `Usuario que accede a la aplicación web` (*USER_ACCESSING*) o `Usuario con sesión iniciada` / `Ejecutar como yo` (*USER_DEPLOYING* según requerimiento institucional).
   - **Quién tiene acceso**: `Cualquiera dentro del dominio` (*H. Ayuntamiento de Mérida*) o `Cualquier persona con cuenta de Google`.
4. Haga clic en **Desplegar**.
5. Copie la **URL de la aplicación web** generada para su difusión entre el personal y los titulares de las subdirecciones.

---

## 5. Modelo de Seguridad y Filtrado Server-Side

- **Aislamiento de Preguntas**: Cada consulta de preguntas (`getPreguntasParaUsuario`) y guardado de respuestas (`guardarRespuesta`) valida del lado del servidor (*Apps Script backend*) que la pregunta pertenezca estrictamente a la `Subdirección` asignada al usuario en la pestaña `Asignaciones`.
- **Intento de Modificación No Autorizada**: Retorna un error con código equivalente `403 Forbidden` si un usuario estándar intenta visualizar o editar preguntas asignadas a otra unidad o no asignadas.
- **Preguntas Sin Asignar**: Las preguntas marcadas como `SIN_ASIGNAR` son respondidas exclusivamente por el **Administrador** desde su vista dedicada *"Mis Preguntas (Sin Asignar)"*.
- **Almacenamiento de Evidencias en Google Drive**:
  - Usuarios: `/ControlMachete/{NombreSubdirección}/Pregunta_{ID}/`
  - Administrador: `/ControlMachete/ADMIN/Pregunta_{ID}/`

---

## 6. Soporte y Manejo de Errores

- Todos los métodos del servidor cuentan con bloques `try/catch` informativos en español (es-MX).
- Las fallas en subida de archivos o permisos despliegan notificaciones flotantes (*Toasts*) y mensajes amigables sin interrumpir el flujo de captura del usuario.
