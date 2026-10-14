/**
 * ==============================================================================
 * PLANNER GOOGLE APPS SCRIPT - BACKEND PRINCIPAL (Código.gs)
 * Sistema de Gestión de Tareas y Proyectos estilo Microsoft Planner
 * ==============================================================================
 */

// Global Constants & Sheet Names
const SHEETS = {
  PROYECTOS: 'Proyectos',
  BUCKETS: 'Buckets',
  TAREAS: 'Tareas',
  CHECKLIST: 'Checklist',
  COMENTARIOS: 'Comentarios',
  ADJUNTOS: 'Adjuntos',
  ETIQUETAS: 'Etiquetas',
  USUARIOS: 'Usuarios'
};

const ROLES = {
  ADMIN: 'administrador',
  EDITOR: 'editor',
  READER: 'lector'
};

/**
 * Punto de entrada para la aplicación web.
 */
function doGet(e) {
  try {
    verificarEstructuraBD();
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Planner - Gestión de Tareas y Proyectos')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('Error de inicialización: ' + err.toString());
  }
}

/**
 * Incluye un archivo HTML secundario dentro de la plantilla principal (Index.html).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtiene la Hoja de Cálculo activa o fallback por ID.
 */
function getSpreadsheetSafe() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const prop = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (prop) {
      ss = SpreadsheetApp.openById(prop);
    }
  }
  if (!ss) {
    throw new Error('No se pudo acceder a la Hoja de Cálculo. Configure SPREADSHEET_ID en Script Properties.');
  }
  return ss;
}

/**
 * Obtiene o crea una pestaña de forma segura.
 */
function getSheetSafe(sheetName) {
  const ss = getSpreadsheetSafe();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Verifica y crea las pestañas y encabezados requeridos si no existen.
 */
function verificarEstructuraBD() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    const estructuras = {
      [SHEETS.PROYECTOS]: ['ID', 'Nombre', 'Descripción', 'Miembros', 'FechaCreación', 'Estado'],
      [SHEETS.BUCKETS]: ['ID', 'ProyectoID', 'Nombre', 'Orden'],
      [SHEETS.TAREAS]: ['ID', 'ProyectoID', 'BucketID', 'Título', 'Descripción', 'Estado', 'Prioridad', 'FechaInicio', 'FechaVencimiento', 'Asignados', 'Etiquetas', 'Orden', 'CreadoPor', 'FechaCreación', 'FechaModificación'],
      [SHEETS.CHECKLIST]: ['ID', 'TareaID', 'Texto', 'Completado'],
      [SHEETS.COMENTARIOS]: ['ID', 'TareaID', 'Autor', 'Texto', 'Fecha'],
      [SHEETS.ADJUNTOS]: ['ID', 'TareaID', 'Nombre', 'URL', 'Tipo'],
      [SHEETS.ETIQUETAS]: ['ID', 'ProyectoID', 'Nombre', 'Color'],
      [SHEETS.USUARIOS]: ['Email', 'Nombre', 'Foto', 'Rol']
    };

    const ss = getSpreadsheetSafe();
    for (const sheetName in estructuras) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(estructuras[sheetName]);
      } else {
        if (sheet.getLastRow() === 0) {
          sheet.appendRow(estructuras[sheetName]);
        }
      }
    }

    // Registrar o actualizar al usuario actual
    const activeEmail = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'usuario@dominio.com';
    const sheetUsuarios = ss.getSheetByName(SHEETS.USUARIOS);
    const dataUsuarios = sheetUsuarios.getDataRange().getValues();
    let existe = false;
    for (let i = 1; i < dataUsuarios.length; i++) {
      if (dataUsuarios[i][0] && dataUsuarios[i][0].toString().toLowerCase() === activeEmail.toLowerCase()) {
        existe = true;
        break;
      }
    }
    if (!existe) {
      const isFirst = dataUsuarios.length <= 1;
      sheetUsuarios.appendRow([activeEmail, activeEmail.split('@')[0], '', isFirst ? ROLES.ADMIN : ROLES.EDITOR]);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Convierte un rango con encabezados en un arreglo de objetos JavaScript.
 */
function sheetToObjects(sheetName) {
  const sheet = getSheetSafe(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(h => h.toString().trim());
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Ignorar filas totalmente vacías
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const obj = {};
    headers.forEach((header, colIdx) => {
      let val = row[colIdx];
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      }
      obj[header] = val;
    });
    obj['_rowIndex'] = i + 1; // Índice base 1 para actualizaciones rápidas
    result.push(obj);
  }
  return result;
}

/**
 * Auxiliar para generar IDs unicos.
 */
function generateUniqueId(prefix) {
  return (prefix ? prefix + '-' : '') + Utilities.getUuid().substring(0, 8) + '-' + Date.now().toString(36);
}

// ==============================================================================
// GESTIÓN DE USUARIOS Y PERMISOS
// ==============================================================================

function getUsuarioActual() {
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'usuario@dominio.com';
  const usuarios = sheetToObjects(SHEETS.USUARIOS);
  const user = usuarios.find(u => u.Email.toLowerCase() === email.toLowerCase());
  if (user) {
    return { email: user.Email, nombre: user.Nombre || email.split('@')[0], foto: user.Foto || '', rol: user.Rol || ROLES.EDITOR };
  }
  return { email: email, nombre: email.split('@')[0], foto: '', rol: ROLES.EDITOR };
}

function obtenerTodosLosUsuarios() {
  return sheetToObjects(SHEETS.USUARIOS).map(u => ({
    email: u.Email,
    nombre: u.Nombre || u.Email,
    foto: u.Foto || ''
  }));
}

function validarAcceso() {
  const user = getUsuarioActual();
  const domainRestricted = PropertiesService.getScriptProperties().getProperty('ALLOWED_DOMAIN');
  if (domainRestricted && domainRestricted.trim() !== '') {
    const userDomain = user.email.split('@')[1];
    if (!userDomain || userDomain.toLowerCase() !== domainRestricted.toLowerCase()) {
      throw new Error(`Acceso denegado. Este sistema está restringido al dominio @${domainRestricted}`);
    }
  }
  return user;
}

// ==============================================================================
// GESTIÓN DE PROYECTOS Y BUCKETS
// ==============================================================================

function obtenerProyectos() {
  validarAcceso();
  const proyectos = sheetToObjects(SHEETS.PROYECTOS);
  const user = getUsuarioActual();

  return proyectos.filter(p => {
    if (user.rol === ROLES.ADMIN) return true;
    const miembros = p.Miembros ? p.Miembros.toString().toLowerCase().split(',').map(m => m.trim()) : [];
    return miembros.includes(user.email.toLowerCase()) || miembros.length === 0;
  });
}

function crearOActualizarProyecto(proyectoData) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado, intente de nuevo.');

  try {
    const sheet = getSheetSafe(SHEETS.PROYECTOS);
    const user = getUsuarioActual();
    const now = new Date().toISOString().split('T')[0];

    if (proyectoData.ID) {
      // Actualizar
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === proyectoData.ID.toString()) {
          sheet.getRange(i + 1, 2).setValue(proyectoData.Nombre);
          sheet.getRange(i + 1, 3).setValue(proyectoData.Descripción || '');
          sheet.getRange(i + 1, 4).setValue(proyectoData.Miembros || user.email);
          sheet.getRange(i + 1, 6).setValue(proyectoData.Estado || 'Activo');
          found = true;
          break;
        }
      }
      if (!found) throw new Error('Proyecto no encontrado para actualizar.');
      return proyectoData.ID;
    } else {
      // Crear nuevo
      const newId = generateUniqueId('PRJ');
      const miembros = proyectoData.Miembros || user.email;
      sheet.appendRow([newId, proyectoData.Nombre, proyectoData.Descripción || '', miembros, now, 'Activo']);

      // Crear buckets predeterminados
      crearBucketInterno(newId, 'Pendiente', 1);
      crearBucketInterno(newId, 'En Proceso', 2);
      crearBucketInterno(newId, 'Completado', 3);

      // Crear etiquetas predeterminadas
      crearEtiquetasPredeterminadas(newId);

      return newId;
    }
  } finally {
    lock.releaseLock();
  }
}

function crearEtiquetasPredeterminadas(proyectoId) {
  const sheet = getSheetSafe(SHEETS.ETIQUETAS);
  const predeterminadas = [
    { nombre: 'Urgente', color: '#d9534f' },
    { nombre: 'Diseño', color: '#5bc0de' },
    { nombre: 'Desarrollo', color: '#0275d8' },
    { nombre: 'Revisión', color: '#f0ad4e' }
  ];
  predeterminadas.forEach(e => {
    sheet.appendRow([generateUniqueId('TAG'), proyectoId, e.nombre, e.color]);
  });
}

function crearBucketInterno(proyectoId, nombre, orden) {
  const sheet = getSheetSafe(SHEETS.BUCKETS);
  const newId = generateUniqueId('BKT');
  sheet.appendRow([newId, proyectoId, nombre, orden]);
  return newId;
}

function crearBucket(proyectoId, nombre) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado.');

  try {
    const buckets = obtenerBucketsPorProyecto(proyectoId);
    const nuevoOrden = buckets.length + 1;
    return crearBucketInterno(proyectoId, nombre, nuevoOrden);
  } finally {
    lock.releaseLock();
  }
}

function actualizarNombreBucket(bucketId, nuevoNombre) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado.');

  try {
    const sheet = getSheetSafe(SHEETS.BUCKETS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === bucketId.toString()) {
        sheet.getRange(i + 1, 3).setValue(nuevoNombre);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function eliminarBucket(bucketId) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado.');

  try {
    // Verificar si el bucket tiene tareas
    const tareas = sheetToObjects(SHEETS.TAREAS);
    const tieneTareas = tareas.some(t => t.BucketID.toString() === bucketId.toString());
    if (tieneTareas) {
      throw new Error('No se puede eliminar un Bucket que contiene tareas. Mueva o elimine las tareas primero.');
    }

    const sheet = getSheetSafe(SHEETS.BUCKETS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === bucketId.toString()) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function reordenarBuckets(proyectoId, bucketIdsOrdenados) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado.');

  try {
    const sheet = getSheetSafe(SHEETS.BUCKETS);
    const data = sheet.getDataRange().getValues();

    bucketIdsOrdenados.forEach((id, index) => {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === id.toString() && data[i][1].toString() === proyectoId.toString()) {
          sheet.getRange(i + 1, 4).setValue(index + 1);
          break;
        }
      }
    });
    return true;
  } finally {
    lock.releaseLock();
  }
}

function obtenerBucketsPorProyecto(proyectoId) {
  validarAcceso();
  const buckets = sheetToObjects(SHEETS.BUCKETS);
  return buckets
    .filter(b => b.ProyectoID.toString() === proyectoId.toString())
    .sort((a, b) => (parseInt(a.Orden) || 0) - (parseInt(b.Orden) || 0));
}

// ==============================================================================
// GESTIÓN DE TAREAS Y DETALLES
// ==============================================================================

function obtenerDatosCompletosProyecto(proyectoId) {
  validarAcceso();
  const proyecto = sheetToObjects(SHEETS.PROYECTOS).find(p => p.ID.toString() === proyectoId.toString());
  if (!proyecto) throw new Error('Proyecto no encontrado.');

  const buckets = obtenerBucketsPorProyecto(proyectoId);
  const todasTareas = sheetToObjects(SHEETS.TAREAS).filter(t => t.ProyectoID.toString() === proyectoId.toString());
  const etiquetas = sheetToObjects(SHEETS.ETIQUETAS).filter(e => e.ProyectoID.toString() === proyectoId.toString());

  const taskIds = new Set(todasTareas.map(t => t.ID.toString()));
  const checklistItems = sheetToObjects(SHEETS.CHECKLIST).filter(c => taskIds.has(c.TareaID.toString()));
  const comentarios = sheetToObjects(SHEETS.COMENTARIOS).filter(c => taskIds.has(c.TareaID.toString()));
  const adjuntos = sheetToObjects(SHEETS.ADJUNTOS).filter(a => taskIds.has(a.TareaID.toString()));

  // Mapear checklist, comentarios y adjuntos a cada tarea
  const tareasEstructuradas = todasTareas.map(tarea => {
    const tId = tarea.ID.toString();
    return {
      ...tarea,
      checklist: checklistItems.filter(c => c.TareaID.toString() === tId),
      comentarios: comentarios.filter(c => c.TareaID.toString() === tId),
      adjuntos: adjuntos.filter(a => a.TareaID.toString() === tId)
    };
  }).sort((a, b) => (parseInt(a.Orden) || 0) - (parseInt(b.Orden) || 0));

  return {
    proyecto: proyecto,
    buckets: buckets,
    tareas: tareasEstructuradas,
    etiquetas: etiquetas,
    usuarios: obtenerTodosLosUsuarios()
  };
}

function crearOActualizarTarea(tareaData) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado, intente de nuevo.');

  try {
    const sheet = getSheetSafe(SHEETS.TAREAS);
    const user = getUsuarioActual();
    const now = new Date().toISOString().split('T')[0];

    let tareaId = tareaData.ID;

    if (tareaId) {
      // Actualización
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === tareaId.toString()) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 3).setValue(tareaData.BucketID);
        sheet.getRange(rowIndex, 4).setValue(tareaData.Título);
        sheet.getRange(rowIndex, 5).setValue(tareaData.Descripción || '');
        sheet.getRange(rowIndex, 6).setValue(tareaData.Estado || 'No iniciada');
        sheet.getRange(rowIndex, 7).setValue(tareaData.Prioridad || 'Media');
        sheet.getRange(rowIndex, 8).setValue(tareaData.FechaInicio || '');
        sheet.getRange(rowIndex, 9).setValue(tareaData.FechaVencimiento || '');
        sheet.getRange(rowIndex, 10).setValue(tareaData.Asignados || '');
        sheet.getRange(rowIndex, 11).setValue(tareaData.Etiquetas || '');
        sheet.getRange(rowIndex, 15).setValue(now);
      }
    } else {
      // Creación
      tareaId = generateUniqueId('TSK');
      const tareasEnBucket = sheetToObjects(SHEETS.TAREAS).filter(t => t.BucketID.toString() === tareaData.BucketID.toString());
      const orden = tareasEnBucket.length + 1;

      sheet.appendRow([
        tareaId,
        tareaData.ProyectoID,
        tareaData.BucketID,
        tareaData.Título,
        tareaData.Descripción || '',
        tareaData.Estado || 'No iniciada',
        tareaData.Prioridad || 'Media',
        tareaData.FechaInicio || now,
        tareaData.FechaVencimiento || '',
        tareaData.Asignados || '',
        tareaData.Etiquetas || '',
        orden,
        user.email,
        now,
        now
      ]);

      // Sincronizar con Google Tasks si hay asignados
      if (tareaData.Asignados) {
        sincronizarGoogleTasks(tareaId, tareaData.Título, tareaData.FechaVencimiento, tareaData.Asignados);
      }
      // Sincronizar evento en Google Calendar si tiene fecha de vencimiento
      if (tareaData.FechaVencimiento) {
        sincronizarGoogleCalendar(tareaId, tareaData.Título, tareaData.FechaVencimiento, tareaData.Descripción);
      }
    }

    return tareaId;
  } finally {
    lock.releaseLock();
  }
}

function moverTareaBucket(tareaId, nuevoBucketId, nuevoOrden) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado.');

  try {
    const sheet = getSheetSafe(SHEETS.TAREAS);
    const data = sheet.getDataRange().getValues();
    const now = new Date().toISOString().split('T')[0];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === tareaId.toString()) {
        sheet.getRange(i + 1, 3).setValue(nuevoBucketId);
        sheet.getRange(i + 1, 12).setValue(nuevoOrden || 1);
        sheet.getRange(i + 1, 15).setValue(now);

        // Auto-actualizar estado si el bucket se llama Completado o similar
        const bucketObj = sheetToObjects(SHEETS.BUCKETS).find(b => b.ID.toString() === nuevoBucketId.toString());
        if (bucketObj) {
          const bNombre = bucketObj.Nombre.toLowerCase();
          if (bNombre.includes('completad') || bNombre.includes('finalizad') || bNombre.includes('hech')) {
            sheet.getRange(i + 1, 6).setValue('Completada');
          } else if (bNombre.includes('proceso') || bNombre.includes('curso')) {
            sheet.getRange(i + 1, 6).setValue('En curso');
          }
        }
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function eliminarTarea(tareaId) {
  validarAcceso();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Servidor ocupado.');

  try {
    const sheetTareas = getSheetSafe(SHEETS.TAREAS);
    const data = sheetTareas.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === tareaId.toString()) {
        sheetTareas.deleteRow(i + 1);
        break;
      }
    }

    // Eliminar checklist, comentarios y referencias de adjuntos asociados
    eliminarRelacionadosPorTarea(SHEETS.CHECKLIST, 'TareaID', tareaId);
    eliminarRelacionadosPorTarea(SHEETS.COMENTARIOS, 'TareaID', tareaId);
    eliminarRelacionadosPorTarea(SHEETS.ADJUNTOS, 'TareaID', tareaId);

    return true;
  } finally {
    lock.releaseLock();
  }
}

function eliminarRelacionadosPorTarea(sheetName, columnaLlave, tareaId) {
  const sheet = getSheetSafe(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const colIdx = data[0].indexOf(columnaLlave);
  if (colIdx === -1) return;

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][colIdx].toString() === tareaId.toString()) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ==============================================================================
// GESTIÓN DE CHECKLIST Y COMENTARIOS
// ==============================================================================

function agregarItemChecklist(tareaId, texto) {
  validarAcceso();
  const sheet = getSheetSafe(SHEETS.CHECKLIST);
  const newId = generateUniqueId('CHK');
  sheet.appendRow([newId, tareaId, texto, false]);
  return { ID: newId, TareaID: tareaId, Texto: texto, Completado: false };
}

function toggleItemChecklist(itemId, completado) {
  validarAcceso();
  const sheet = getSheetSafe(SHEETS.CHECKLIST);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === itemId.toString()) {
      sheet.getRange(i + 1, 4).setValue(completado);
      return true;
    }
  }
  return false;
}

function eliminarItemChecklist(itemId) {
  validarAcceso();
  const sheet = getSheetSafe(SHEETS.CHECKLIST);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === itemId.toString()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function agregarComentario(tareaId, texto) {
  validarAcceso();
  const sheet = getSheetSafe(SHEETS.COMENTARIOS);
  const user = getUsuarioActual();
  const now = new Date().toLocaleString();
  const newId = generateUniqueId('CMT');

  sheet.appendRow([newId, tareaId, user.nombre + ' (' + user.email + ')', texto, now]);
  return { ID: newId, TareaID: tareaId, Autor: user.nombre, Texto: texto, Fecha: now };
}

// ==============================================================================
// ETIQUETAS PERSONALIZADAS
// ==============================================================================

function crearEtiquetaProyecto(proyectoId, nombre, color) {
  validarAcceso();
  const sheet = getSheetSafe(SHEETS.ETIQUETAS);
  const newId = generateUniqueId('TAG');
  sheet.appendRow([newId, proyectoId, nombre, color]);
  return { ID: newId, ProyectoID: proyectoId, Nombre: nombre, Color: color };
}

// ==============================================================================
// INTEGRACIONES GOOGLE WORKSPACE
// ==============================================================================

/**
 * Adjuntar archivo subiéndolo a Google Drive dentro de la carpeta del proyecto.
 */
function adjuntarArchivoDrive(tareaId, fileData) {
  validarAcceso();
  const tarea = sheetToObjects(SHEETS.TAREAS).find(t => t.ID.toString() === tareaId.toString());
  if (!tarea) throw new Error('Tarea no encontrada');

  const proyecto = sheetToObjects(SHEETS.PROYECTOS).find(p => p.ID.toString() === tarea.ProyectoID.toString());
  const folderName = proyecto ? `Planner - ${proyecto.Nombre}` : 'Planner Adjuntos';

  // Buscar o crear carpeta de proyecto en Drive
  const folders = DriveApp.getFoldersByName(folderName);
  let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  // Crear archivo desde base64
  const bytes = Utilities.base64Decode(fileData.base64.split(',')[1]);
  const blob = Utilities.newBlob(bytes, fileData.mimeType, fileData.name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileUrl = file.getUrl();
  const newId = generateUniqueId('ATT');

  const sheet = getSheetSafe(SHEETS.ADJUNTOS);
  sheet.appendRow([newId, tareaId, fileData.name, fileUrl, fileData.mimeType]);

  return { ID: newId, TareaID: tareaId, Nombre: fileData.name, URL: fileUrl, Tipo: fileData.mimeType };
}

/**
 * Google Calendar Integration: Crea o actualiza evento de fecha de vencimiento.
 */
function sincronizarGoogleCalendar(tareaId, titulo, fechaVencimiento, descripcion) {
  try {
    if (!fechaVencimiento) return;
    const calendar = CalendarApp.getDefaultCalendar();
    const fecha = new Date(fechaVencimiento);

    // Búsqueda simple para evitar duplicados repetidos
    const eventos = calendar.getEventsForDay(fecha, { search: titulo });
    if (eventos.length === 0) {
      calendar.createAllDayEvent(`[Planner Task] ${titulo}`, fecha, {
        description: `Tarea ID: ${tareaId}\n\n${descripcion || ''}`
      });
    }
  } catch (e) {
    Logger.log('Error sincronizando con Google Calendar: ' + e.toString());
  }
}

/**
 * Google Tasks Integration: Crea tarea en Google Tasks si Tasks API está habilitado.
 */
function sincronizarGoogleTasks(tareaId, titulo, fechaVencimiento, asignados) {
  try {
    if (typeof Tasks !== 'undefined' && Tasks.Tasks) {
      const taskObj = {
        title: `[Planner] ${titulo}`,
        notes: `Tarea asignada en Planner. ID: ${tareaId}\nAsignados: ${asignados}`
      };
      if (fechaVencimiento) {
        taskObj.due = new Date(fechaVencimiento).toISOString();
      }
      Tasks.Tasks.insert(taskObj, '@default');
    }
  } catch (e) {
    Logger.log('Google Tasks API no disponible o deshabilitado: ' + e.toString());
  }
}

/**
 * Gmail Notifications: Envía correo electrónico de recordatorio.
 */
function enviarRecordatorioGmail(tareaId, destinatarioEmail, mensajePersonalizado) {
  validarAcceso();
  const tarea = sheetToObjects(SHEETS.TAREAS).find(t => t.ID.toString() === tareaId.toString());
  if (!tarea) throw new Error('Tarea no encontrada.');

  const asunto = `[Planner] Recordatorio de Tarea: ${tarea.Título}`;
  const cuerpo = `Hola,\n\nSe te ha enviado un recordatorio respecto a la siguiente tarea de Planner:\n\n` +
    `📌 Título: ${tarea.Título}\n` +
    `📅 Fecha Vencimiento: ${tarea.FechaVencimiento || 'Sin fecha'}\n` +
    `🔥 Prioridad: ${tarea.Prioridad}\n` +
    `📝 Mensaje: ${mensajePersonalizado || 'Por favor revisa el avance de esta tarea.'}\n\n` +
    `Accede al tablero de Planner para más detalles.`;

  GmailApp.sendEmail(destinatarioEmail, asunto, cuerpo);
  return true;
}

/**
 * Google Chat Webhook / Space Integration.
 */
function enviarNotificacionGoogleChat(webhookUrl, mensaje) {
  try {
    if (!webhookUrl || !webhookUrl.startsWith('https://')) return false;
    const payload = JSON.stringify({ text: mensaje });
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload
    };
    UrlFetchApp.fetch(webhookUrl, options);
    return true;
  } catch (e) {
    Logger.log('Error enviando notificación a Google Chat: ' + e.toString());
    return false;
  }
}

// ==============================================================================
// GEMINI API - IA ASSISTANT INTEGRATION
// ==============================================================================

/**
 * Asistente de IA usando Gemini API vía UrlFetchApp.
 */
function consultarAsistenteGemini(prompt, contextoProyectoId) {
  validarAcceso();
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('La API Key de Gemini no está configurada. Agregue GEMINI_API_KEY en los Script Properties.');
  }

  let contextoAdicional = '';
  if (contextoProyectoId) {
    try {
      const datosPrj = obtenerDatosCompletosProyecto(contextoProyectoId);
      contextoAdicional = `\nContexto del proyecto actual (${datosPrj.proyecto.Nombre}):\n` +
        `- Descripción: ${datosPrj.proyecto.Descripción}\n` +
        `- Total de tareas: ${datosPrj.tareas.length}\n` +
        `- Buckets: ${datosPrj.buckets.map(b => b.Nombre).join(', ')}\n` +
        `- Resumen de tareas: ${datosPrj.tareas.map(t => `${t.Título} (${t.Estado}, ${t.Prioridad})`).join('; ')}\n`;
    } catch (e) {
      Logger.log('No se pudo obtener el contexto del proyecto para Gemini: ' + e.toString());
    }
  }

  const systemInstruction = "Eres un asistente de gestión de proyectos experto y productivo integrado en un sistema estilo Microsoft Planner. Responde de forma clara, directa y estructurada en formato Markdown.";
  const fullPrompt = `${systemInstruction}\n${contextoAdicional}\nConsulta del usuario: ${prompt}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: fullPrompt }
        ]
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(`Error de Gemini API (${response.getResponseCode()}): ${json.error ? json.error.message : response.getContentText()}`);
  }

  if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts.length > 0) {
    return json.candidates[0].content.parts[0].text;
  } else {
    return 'No se pudo generar una respuesta de Gemini.';
  }
}

/**
 * Genera un plan de proyecto automático con Gemini e inserta Buckets y Tareas.
 */
function generarPlanDeProyectoConIA(proyectoId, objetivoProyecto) {
  validarAcceso();
  const prompt = `Genera un plan de proyecto detallado para el siguiente objetivo: "${objetivoProyecto}". ` +
    `Devuelve UNICAMENTE un JSON estricto sin bloques de texto explicativos, con la siguiente estructura exactas:\n` +
    `{\n` +
    `  "buckets": [\n` +
    `    {\n` +
    `      "nombre": "Nombre del Bucket",\n` +
    `      "tareas": [\n` +
    `        { "titulo": "Título Tarea", "descripcion": "Detalle tarea", "prioridad": "Alta|Media|Baja" }\n` +
    `      ]\n` +
    `    }\n` +
    `  ]\n` +
    `}`;

  const respuestaTexto = consultarAsistenteGemini(prompt, null);

  // Limpiar posibles etiquetas de código markdown ```json ... ```
  let jsonString = respuestaTexto.trim();
  if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }

  let planData;
  try {
    planData = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('No se pudo procesar la respuesta estructurada de Gemini: ' + e.toString() + '\nRespuesta: ' + respuestaTexto);
  }

  if (planData && planData.buckets) {
    let bOrden = 1;
    planData.buckets.forEach(b => {
      const bucketId = crearBucketInterno(proyectoId, b.nombre, bOrden++);
      if (b.tareas && Array.isArray(b.tareas)) {
        b.tareas.forEach(t => {
          crearOActualizarTarea({
            ProyectoID: proyectoId,
            BucketID: bucketId,
            Título: t.titulo,
            Descripción: t.descripcion,
            Prioridad: t.prioridad || 'Media',
            Estado: 'No iniciada'
          });
        });
      }
    });
    return true;
  }
  return false;
}
