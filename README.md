# Sistema de Acuerdos de Dirección - Google Apps Script

Aplicación Web desarrollada en Google Apps Script (V8 runtime + HTMLService) con base de datos en Google Sheets para la digitalización y seguimiento de Proyectos, Minutas, Asistencia, Orden del Día, Acuerdos, Comentarios de Seguimiento y Usuarios.

## 🚀 Características principales
- **Autenticación y Roles:** Inicio de sesión con correo y contraseña, contraseñas almacenadas con hash salado, sesiones aisladas por token y control de acceso por roles (`Administrador`, `Operador`, `Jefatura`, `Lector`).
- **Control de Visibilidad:** Filtrado automático de información en el backend según el rol y subdirección del usuario.
- **Gestión de Proyectos y Minutas:** Creación y seguimiento con folios secuenciales anuales (`MIN-YYYY-NNN`).
- **Gestión de Acuerdos:** Seguimiento de acuerdos derivados de minutas e individuales (`ACU-` / `ACU-IND-`), con semáforo de vencimiento y prioridades.
- **Notificaciones y Recordatorios Automáticos:** Envío de correo electrónico al asignar/actualizar acuerdos y ejecución diaria de recordatorios para acuerdos vencidos o próximos a vencer via trigger de Google Apps Script.
- **Comentarios de Seguimiento:** Línea de tiempo interactiva por acuerdo.
- **Catálogos Dinámicos:** Gestión centralizada de listas desplegables (Dependencias, Subdirecciones, Etapas, Prioridades, Estatus).

---

## 🛠️ Instrucciones de Despliegue

1. **Crear Proyecto en Google Apps Script:**
   - Abre [script.google.com](https://script.google.com/) y crea un nuevo proyecto.
   - Copia todo el contenido del repositorio en el proyecto (`Code.gs`, `appsscript.json` y todos los archivos `.html`).

2. **Vincular Base de Datos (Google Sheets):**
   - Crea un libro de Google Sheets vacío o utiliza uno existente.
   - Vincula el ID del Spreadsheet en el archivo `Code.gs` o ejecútalo dentro del contenedor de la hoja.

3. **Inicialización (`setup`):**
   - Ejecuta la función `setup()` desde el editor de código.
   - Esta función creará automáticamente las 10 pestañas requeridas con sus encabezados exactos, cargará los catálogos y usuarios iniciales, e instalará el activador diario (`procesarRecordatorios`).

4. **Publicación como Web App:**
   - En la parte superior derecha, haz clic en **Desplegar** > **Nuevo despliegue**.
   - Selecciona **Aplicación web**.
   - Configura las siguientes opciones:
     - **Ejecutar como:** `Yo` (`USER_DEPLOYING`)
     - **Quién tiene acceso:** `Cualquier usuario` o `Cualquier usuario con cuenta Google del dominio`.
   - Haz clic en **Desplegar** y copia el enlace de la aplicación.

---

## 📊 Estructura de la Base de Datos
1. **Hoja 1:** Reservada.
2. **Proyectos:** `ID_Proyecto`, `Nombre_Proyecto`, `Descripción`, `Estatus`, `Fecha_Creación`, `Creado_Por`.
3. **Minutas:** `Folio`, `ID_Proyecto`, `Etapa`, `Dependencia`, `Subdirección`, `Nombre_Reunión`, `Fecha`, `Lugar`, `Objetivos`, `Creado_Por`, `Fecha_Creación`.
4. **Asistencia:** `ID_Asistencia`, `Folio_Minuta`, `Nombre`, `Dependencia_Area`, `Cargo`.
5. **OrdenDelDia:** `ID_Punto`, `Folio_Minuta`, `Número_Punto`, `Descripción_Punto`.
6. **Acuerdos:** `ID_Acuerdo`, `Folio_Minuta`, `Tipo`, `Descripción_Acuerdo`, `Prioridad`, `Solicitantes`, `Responsables`, `Fecha_Límite`, `Subdirección_Asignada`, `Estatus`, `Origen`, `Creado_Por`, `Fecha_Creación`, `Fecha_Modificación`.
7. **Catálogos:** `Tipo`, `Valor`.
8. **Log_Notificaciones:** `ID_Log`, `ID_Acuerdo`, `Correo_Destino`, `Asunto`, `Fecha_Envío`, `Estatus_Envío`.
9. **Comentarios_Seguimiento:** `ID_Comentario`, `ID_Acuerdo`, `Usuario`, `Fecha_Hora`, `Comentario`.
10. **Usuarios:** `Correo`, `Nombre`, `Rol`, `Subdirección`, `Activo`, `Jefatura_Departamento`, `Contrasena_Hash`, `Contrasena_Actualizada`.

---

## 🔐 Seguridad y autenticación

- Las contraseñas **nunca** se almacenan en texto plano. Se guardan como `sha256$<iteraciones>$<salt>$<hash>` con salt aleatorio y derivación iterada (10 000 rondas).
- Cada inicio de sesión genera un token aleatorio de 256 bits. El servidor guarda la sesión en `PropertiesService.getScriptProperties()` bajo `AUTH_SESSION_<token>` y el navegador conserva únicamente el token en `sessionStorage`.
- Todas las llamadas del cliente pasan por `ejecutarAccion()`, que inyecta el token en un contexto de ejecución aislado. `validarSesion()` es la única fuente de verdad y revalida el usuario contra la hoja `Usuarios`.
- El cierre de sesión elimina el registro del servidor y el token del navegador. Un restablecimiento de contraseña, desactivación o eliminación de usuario invalida todas sus sesiones.
- Sólo los usuarios con rol **Administrador** pueden crear usuarios, restablecer contraseñas y generar credenciales. Las contraseñas temporales se generan con 16 caracteres (mayúsculas, minúsculas, números y caracteres especiales) y se muestran una sola vez.

### Arranque inicial y migración de usuarios existentes

1. Ejecute `setup()` desde el editor de Apps Script. Si la hoja `Usuarios` está vacía, se crea el Administrador principal `sakurazukamori21@gmail.com` con la contraseña de arranque configurada y se generan contraseñas temporales para el resto de usuarios iniciales, que aparecerán en el **registro de ejecución**. El setup también crea el secreto `AUTH_BOOTSTRAP_SECRET`.
2. Ejecute `ingresoInicialAdministrador_()` desde el editor. Esta función no recibe parámetros, garantiza que el Administrador principal exista, esté activo y tenga la contraseña de arranque, y genera las contraseñas de los usuarios que aún no tengan una. Las credenciales del resto de usuarios se muestran únicamente en el **registro de ejecución**.
3. Distribuya cada contraseña temporal por un canal seguro. Después, el Administrador puede restablecer contraseñas individuales desde **Usuarios → Restablecer contraseña**.
4. Si un usuario aparece con la credencial **Pendiente**, el Administrador puede usar **Generar Credenciales Pendientes** en la vista de Usuarios.

> El Administrador principal es siempre `sakurazukamori21@gmail.com`. Su contraseña de arranque se almacena únicamente como hash; cámbiela desde **Usuarios → Restablecer contraseña** después del primer ingreso. Si vuelve a ejecutar `ingresoInicialAdministrador_()`, se restablecerá esa contraseña de arranque.

> `ingresoInicialAdministrador_()` termina en guion bajo, por lo que es una función privada: el editor puede ejecutarla, pero `google.script.run` no puede invocarla desde la Web App. El secreto de arranque es necesario sólo la primera vez; una vez que un Administrador puede iniciar sesión, toda la gestión se realiza desde la interfaz web y el secreto puede eliminarse de las Propiedades del script.
