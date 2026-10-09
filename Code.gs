/**
 * ==============================================================================
 * CONTROL MACHETE - SISTEMA DE AUTOEVALUACIÓN DE CONTROL INTERNO
 * H. Ayuntamiento de Mérida, Yucatán
 *
 * Tech Stack: Google Apps Script (V8 Runtime), Google Sheets, Google Drive
 * ==============================================================================
 */

// Constantes globales
const SPREADSHEET_ID_PROP = 'CONTROL_MACHETE_SPREADSHEET_ID';
const ROOT_DRIVE_FOLDER_NAME = 'ControlMachete';

// Nombres de las pestañas de la Base de Datos
const SHEETS = {
  PREGUNTAS: 'Preguntas',
  USUARIOS: 'Usuarios',
  SUBDIRECCIONES: 'Subdirecciones',
  ASIGNACIONES: 'Asignaciones',
  RESPUESTAS: 'Respuestas',
  AUDIT: 'Audit',
  CONFIG: 'Config'
};

// Mapeo de Nivel de Riesgo Residual
const RIESGO_MAP = {
  'Sí': 'Alto',
  'Parcial': 'Bajo',
  'No': 'Medio',
  'No Aplica': 'No Aplica'
};

/**
 * Servicio Web App - Punto de entrada doGet
 */
function doGet(e) {
  try {
    const userEmail = getEffectiveUserEmail();
    const user = getUserByEmail(userEmail);

    const template = HtmlService.createTemplateFromFile('Index');
    template.userEmail = userEmail;
    template.userRole = user ? user.role : 'GUEST';
    template.userName = user ? user.name : 'Usuario no registrado';
    template.userSubdireccion = user ? user.subdireccion : '';
    template.isRegistered = !!(user && user.active);

    return template.evaluate()
      .setTitle('Control Machete - H. Ayuntamiento de Mérida')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>Error de inicio del sistema: ' + err.toString() + '</h3>');
  }
}

/**
 * Permite incluir archivos HTML modulares (CSS, JS, sub-plantillas)
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}

/**
 * Obtiene el correo del usuario activo de forma segura
 */
function getEffectiveUserEmail() {
  let email = Session.getActiveUser().getEmail();
  if (!email || email.trim() === '') {
    email = Session.getEffectiveUser().getEmail();
  }
  return email ? email.toLowerCase().trim() : '';
}

/**
 * Obtiene o crea el Spreadsheet asociado a la aplicación
 */
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(SPREADSHEET_ID_PROP);
  let ss = null;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        props.setProperty(SPREADSHEET_ID_PROP, ss.getId());
      }
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    // Si no hay spreadsheet activo o configurado, buscar o crear uno nuevo
    const files = DriveApp.getFilesByName('Control Machete - BD');
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
      props.setProperty(SPREADSHEET_ID_PROP, ss.getId());
    } else {
      ss = SpreadsheetApp.create('Control Machete - BD');
      props.setProperty(SPREADSHEET_ID_PROP, ss.getId());
      initDatabaseStructure(ss);
    }
  }

  return ss;
}

/**
 * Asegura la existencia de una hoja específica
 */
function getSheetSafe(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheetHeader(sheet, sheetName);
  }
  return sheet;
}

/**
 * Inicializa encabezados de las hojas
 */
function initSheetHeader(sheet, sheetName) {
  let headers = [];
  switch (sheetName) {
    case SHEETS.PREGUNTAS:
      headers = ['ID', 'Componente', 'Principio', 'Pregunta', 'FundamentoLegal', 'SubdireccionSugerida'];
      break;
    case SHEETS.USUARIOS:
      headers = ['Email', 'Nombre', 'Subdireccion', 'Rol', 'Estado'];
      break;
    case SHEETS.SUBDIRECCIONES:
      headers = ['Nombre', 'Activa'];
      break;
    case SHEETS.ASIGNACIONES:
      headers = ['QuestionID', 'SubdireccionAsignada', 'AsignadoPor', 'FechaAsignacion'];
      break;
    case SHEETS.RESPUESTAS:
      headers = ['QuestionID', 'Subdireccion', 'Respuesta', 'EvidenciaTextual', 'EvidenciaDocumental', 'Observaciones', 'NivelRiesgo', 'UsuarioQueRespondio', 'FechaCreacion', 'FechaUltimaModificacion'];
      break;
    case SHEETS.AUDIT:
      headers = ['Timestamp', 'Usuario', 'Entidad', 'QuestionID', 'ValorAnterior', 'ValorNuevo'];
      break;
    case SHEETS.CONFIG:
      headers = ['Clave', 'Valor'];
      break;
  }
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/**
 * Inicializa todas las hojas de la BD
 */
function initDatabaseStructure(ss) {
  Object.values(SHEETS).forEach(name => {
    let s = ss.getSheetByName(name);
    if (!s) {
      s = ss.insertSheet(name);
    }
    initSheetHeader(s, name);
  });
}

// ==============================================================================
// AUTENTICACIÓN Y ROLES
// ==============================================================================

/**
 * Obtiene el usuario actual y valida permisos
 */
function getCurrentUserInfo() {
  const email = getEffectiveUserEmail();
  const user = getUserByEmail(email);

  if (!user || !user.active) {
    return {
      authenticated: false,
      email: email,
      message: 'El correo ' + email + ' no está registrado o se encuentra inactivo. Contacte al Administrador del sistema.'
    };
  }

  return {
    authenticated: true,
    email: user.email,
    name: user.name,
    subdireccion: user.subdireccion,
    role: user.role,
    active: user.active
  };
}

/**
 * Busca un usuario por email en la hoja Usuarios
 */
function getUserByEmail(email) {
  if (!email) return null;
  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowEmail = String(data[i][0]).toLowerCase().trim();
    if (rowEmail === email.toLowerCase().trim()) {
      return {
        email: data[i][0],
        name: data[i][1],
        subdireccion: data[i][2],
        role: String(data[i][3]).toUpperCase(),
        active: String(data[i][4]).toUpperCase() === 'ACTIVO' || data[i][4] === true,
        rowIndex: i + 1
      };
    }
  }
  return null;
}

/**
 * Exige rol de Administrador. Dispara excepción si no cumple.
 */
function assertAdmin() {
  const user = getCurrentUserInfo();
  if (!user.authenticated || user.role !== 'ADMIN') {
    throw new Error('ACCESO DENEGADO (403): Se requieren permisos de Administrador.');
  }
  return user;
}

/**
 * Exige autenticación de usuario activo. Dispara excepción si no cumple.
 */
function assertAuthenticatedUser() {
  const user = getCurrentUserInfo();
  if (!user.authenticated) {
    throw new Error('ACCESO DENEGADO (401): Usuario no registrado o inactivo.');
  }
  return user;
}

// ==============================================================================
// GESTIÓN DE AUDITORÍA
// ==============================================================================

function logAudit(entity, questionId, oldValue, newValue) {
  try {
    const email = getEffectiveUserEmail() || 'SISTEMA';
    const sheet = getSheetSafe(SHEETS.AUDIT);
    sheet.appendRow([
      new Date(),
      email,
      entity,
      questionId || '',
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue || ''),
      typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue || '')
    ]);
  } catch (e) {
    Logger.log('Error logging audit: ' + e.toString());
  }
}

// ==============================================================================
// MÓDULO ADMINISTRADOR: GESTIÓN DE USUARIOS
// ==============================================================================

function getUsuariosAdmin() {
  assertAdmin();
  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  const usuarios = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      usuarios.push({
        email: data[i][0],
        name: data[i][1],
        subdireccion: data[i][2],
        role: data[i][3],
        active: String(data[i][4]).toUpperCase() === 'ACTIVO' || data[i][4] === true
      });
    }
  }
  return usuarios;
}

function saveUsuarioAdmin(userData) {
  const admin = assertAdmin();
  if (!userData.email || !userData.name) {
    throw new Error('El correo y el nombre son campos obligatorios.');
  }

  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  const targetEmail = userData.email.toLowerCase().trim();
  let foundIndex = -1;
  let oldVal = null;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === targetEmail) {
      foundIndex = i + 1;
      oldVal = { email: data[i][0], name: data[i][1], subdireccion: data[i][2], role: data[i][3], active: data[i][4] };
      break;
    }
  }

  const estadoStr = userData.active ? 'ACTIVO' : 'INACTIVO';
  const roleStr = userData.role === 'ADMIN' ? 'ADMIN' : 'USER';
  const subdireccionStr = userData.subdireccion || '';

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, 5).setValues([[
      userData.email.trim(),
      userData.name.trim(),
      subdireccionStr,
      roleStr,
      estadoStr
    ]]);
    logAudit('USUARIO_EDITAR', '', oldVal, userData);
  } else {
    sheet.appendRow([
      userData.email.trim(),
      userData.name.trim(),
      subdireccionStr,
      roleStr,
      estadoStr
    ]);
    logAudit('USUARIO_CREAR', '', null, userData);
  }

  return { success: true, message: 'Usuario guardado exitosamente.' };
}

function toggleUsuarioEstado(email, active) {
  assertAdmin();
  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === email.toLowerCase().trim()) {
      const nuevoEstado = active ? 'ACTIVO' : 'INACTIVO';
      sheet.getRange(i + 1, 5).setValue(nuevoEstado);
      logAudit('USUARIO_TOGGLE_ESTADO', '', email, nuevoEstado);
      return { success: true, message: 'Estado del usuario actualizado.' };
    }
  }
  throw new Error('Usuario no encontrado.');
}

// ==============================================================================
// MÓDULO ADMINISTRADOR: GESTIÓN DE SUBDIRECCIONES
// ==============================================================================

function getSubdireccionesList() {
  assertAuthenticatedUser();
  const sheet = getSheetSafe(SHEETS.SUBDIRECCIONES);
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      const activa = data[i][1] === '' || String(data[i][1]).toUpperCase() === 'ACTIVA' || data[i][1] === true;
      if (activa) {
        list.push(String(data[i][0]).trim());
      }
    }
  }
  return list;
}

function saveSubdireccionAdmin(nombre) {
  assertAdmin();
  if (!nombre || !nombre.trim()) throw new Error('El nombre de la Subdirección no puede estar vacío.');
  const sheet = getSheetSafe(SHEETS.SUBDIRECCIONES);
  const data = sheet.getDataRange().getValues();
  const cleanName = nombre.trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === cleanName.toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue('ACTIVA');
      return { success: true, message: 'Subdirección reactivada.' };
    }
  }
  sheet.appendRow([cleanName, 'ACTIVA']);
  logAudit('SUBDIRECCION_CREAR', '', null, cleanName);
  return { success: true, message: 'Subdirección agregada exitosamente.' };
}

// ==============================================================================
// ASIGNACIÓN DE PREGUNTAS (CORE FEATURE)
// ==============================================================================

/**
 * Obtiene mapa de asignaciones actuales de la hoja Asignaciones
 */
function getAsignacionesMap() {
  const sheet = getSheetSafe(SHEETS.ASIGNACIONES);
  const data = sheet.getDataRange().getValues();
  const map = {}; // questionId -> subdireccion

  for (let i = 1; i < data.length; i++) {
    const qId = Number(data[i][0]);
    if (qId) {
      const sub = String(data[i][1] || '').trim();
      map[qId] = sub;
    }
  }
  return map;
}

/**
 * Devuelve listado de las 61 preguntas con su asignación actual para la vista Admin
 */
function getPreguntasConAsignacionAdmin() {
  assertAdmin();
  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const data = preguntasSheet.getDataRange().getValues();
  const asignaciones = getAsignacionesMap();

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const qId = Number(data[i][0]);
    if (qId) {
      const subAsignada = asignaciones[qId] !== undefined ? asignaciones[qId] : 'SIN_ASIGNAR';
      result.push({
        id: qId,
        componente: data[i][1],
        principio: data[i][2],
        pregunta: data[i][3],
        fundamentoLegal: data[i][4],
        subdireccionSugerida: data[i][5] || '',
        subdireccionAsignada: subAsignada
      });
    }
  }
  return result;
}

/**
 * Asigna una lista de preguntas a una Subdirección específica (o SIN_ASIGNAR)
 */
function guardarAsignacionesPreguntas(questionIds, nuevaSubdireccion) {
  const admin = assertAdmin();
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error('Debe seleccionar al menos una pregunta.');
  }

  const subLimpia = (nuevaSubdireccion && nuevaSubdireccion.trim()) ? nuevaSubdireccion.trim() : 'SIN_ASIGNAR';
  const sheet = getSheetSafe(SHEETS.ASIGNACIONES);
  const data = sheet.getDataRange().getValues();

  // Indexar filas existentes por QuestionID
  const indexMap = {};
  for (let i = 1; i < data.length; i++) {
    const qId = Number(data[i][0]);
    if (qId) {
      indexMap[qId] = i + 1;
    }
  }

  const now = new Date();
  questionIds.forEach(qIdRaw => {
    const qId = Number(qIdRaw);
    if (!qId) return;

    const rowIndex = indexMap[qId];
    if (rowIndex) {
      const oldSub = data[rowIndex - 1][1];
      sheet.getRange(rowIndex, 2, 1, 3).setValues([[subLimpia, admin.email, now]]);
      logAudit('ASIGNACION_CAMBIO', qId, oldSub, subLimpia);
    } else {
      sheet.appendRow([qId, subLimpia, admin.email, now]);
      logAudit('ASIGNACION_CREAR', qId, null, subLimpia);
    }
  });

  return {
    success: true,
    message: 'Se actualizaron ' + questionIds.length + ' asignaciones correctamente.'
  };
}

// ==============================================================================
// MÓDULO DE RESPUESTAS (USER & ADMIN "MIS PREGUNTAS")
// ==============================================================================

/**
 * Obtiene las preguntas asignadas para el usuario actual.
 * REGLA DE SEGURIDAD CRÍTICA SERVER-SIDE:
 * - Si es ADMIN: Puede solicitar vista "ADMIN_MIS_PREGUNTAS" (sólo SIN_ASIGNAR) o todas.
 * - Si es USER: Retorna ÚNICAMENTE las preguntas explícitamente asignadas a su Subdirección.
 */
function getPreguntasParaUsuario(modoAdminMisPreguntas) {
  const user = assertAuthenticatedUser();
  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  let targetSubdireccion = '';
  if (user.role === 'ADMIN' && modoAdminMisPreguntas) {
    targetSubdireccion = 'SIN_ASIGNAR';
  } else if (user.role === 'USER') {
    targetSubdireccion = user.subdireccion;
    if (!targetSubdireccion) {
      return []; // Si el usuario no tiene subdirección asignada por el admin, no ve nada.
    }
  } else if (user.role === 'ADMIN' && !modoAdminMisPreguntas) {
    // Si es admin y pide ver global, se le devuelven todas las preguntas etiquetadas
    targetSubdireccion = 'ALL';
  }

  const preguntasFiltradas = [];

  for (let i = 1; i < pData.length; i++) {
    const qId = Number(pData[i][0]);
    if (!qId) continue;

    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

    // SERVER-SIDE SECURITY FILTERING
    let esVisible = false;
    if (targetSubdireccion === 'ALL' && user.role === 'ADMIN') {
      esVisible = true;
    } else if (targetSubdireccion === 'SIN_ASIGNAR' && user.role === 'ADMIN') {
      esVisible = (subAsignada === 'SIN_ASIGNAR' || subAsignada === '');
    } else if (user.role === 'USER') {
      esVisible = (subAsignada.toLowerCase().trim() === targetSubdireccion.toLowerCase().trim());
    }

    if (esVisible) {
      // Clave de respuesta: qId + "_" + subAsignada
      const respKey = qId + '_' + subAsignada;
      const respObj = respuestasMap[respKey] || {
        respuesta: '',
        evidenciaTextual: '',
        evidenciaDocumental: [],
        observaciones: '',
        nivelRiesgo: ''
      };

      preguntasFiltradas.push({
        id: qId,
        componente: pData[i][1],
        principio: pData[i][2],
        pregunta: pData[i][3],
        fundamentoLegal: pData[i][4],
        subdireccionSugerida: pData[i][5] || '',
        subdireccionAsignada: subAsignada,
        respuestaData: respObj
      });
    }
  }

  return preguntasFiltradas;
}

/**
 * Obtiene todas las respuestas indexadas por "QuestionID_Subdireccion"
 */
function getRespuestasMap() {
  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const qId = Number(data[i][0]);
    const sub = String(data[i][1] || '').trim();
    if (qId && sub) {
      let docs = [];
      try {
        if (data[i][4]) {
          docs = JSON.parse(data[i][4]);
          if (!Array.isArray(docs)) docs = [];
        }
      } catch (e) {
        docs = [];
      }

      map[qId + '_' + sub] = {
        questionId: qId,
        subdireccion: sub,
        respuesta: data[i][2] || '',
        evidenciaTextual: data[i][3] || '',
        evidenciaDocumental: docs,
        observaciones: data[i][5] || '',
        nivelRiesgo: data[i][6] || '',
        usuarioQueRespondio: data[i][7] || '',
        fechaCreacion: data[i][8] || '',
        fechaUltimaModificacion: data[i][9] || ''
      };
    }
  }
  return map;
}

/**
 * Guarda o actualiza la respuesta a una pregunta (con AUTOSAVE y cálculo automático de riesgo residual).
 * ENFORCES SERVER-SIDE SECURITY SCOPE CHECK.
 */
function guardarRespuesta(payload) {
  const user = assertAuthenticatedUser();
  const qId = Number(payload.questionId);
  if (!qId) throw new Error('ID de pregunta inválido.');

  // Validar permisos server-side
  const asignacionesMap = getAsignacionesMap();
  const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

  if (user.role === 'USER') {
    if (subAsignada.toLowerCase().trim() !== user.subdireccion.toLowerCase().trim()) {
      throw new Error('ACCESO DENEGADO (403): La pregunta No. ' + qId + ' no está asignada a su Subdirección.');
    }
  } else if (user.role === 'ADMIN') {
    // El admin puede responder si está en SIN_ASIGNAR o responder a nombre de la subdirección
  }

  const subdireccionFinal = subAsignada;
  const respuesta = payload.respuesta || '';
  const evidenciaTextual = payload.evidenciaTextual || '';
  const observaciones = payload.observaciones || '';

  // AUTO-CÁLCULO DEL NIVEL DE RIESGO RESIDUAL
  const nivelRiesgo = RIESGO_MAP[respuesta] || '';

  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;
  let oldObj = null;

  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === qId && String(data[i][1]).trim().toLowerCase() === subdireccionFinal.toLowerCase()) {
      foundIndex = i + 1;
      let existingDocs = [];
      try { existingDocs = JSON.parse(data[i][4]); } catch (e) {}
      oldObj = {
        respuesta: data[i][2],
        evidenciaTextual: data[i][3],
        evidenciaDocumental: existingDocs,
        observaciones: data[i][5],
        nivelRiesgo: data[i][6]
      };
      break;
    }
  }

  const now = new Date();
  let docsJson = '[]';
  if (foundIndex > 0 && oldObj && oldObj.evidenciaDocumental) {
    docsJson = JSON.stringify(oldObj.evidenciaDocumental);
  }

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 3, 1, 8).setValues([[
      respuesta,
      evidenciaTextual,
      docsJson,
      observaciones,
      nivelRiesgo,
      user.email,
      data[foundIndex - 1][8] || now, // Mantener fecha de creación
      now
    ]]);
    logAudit('RESPUESTA_GUARDAR', qId, oldObj, { respuesta, evidenciaTextual, observaciones, nivelRiesgo });
  } else {
    sheet.appendRow([
      qId,
      subdireccionFinal,
      respuesta,
      evidenciaTextual,
      docsJson,
      observaciones,
      nivelRiesgo,
      user.email,
      now,
      now
    ]);
    logAudit('RESPUESTA_CREAR', qId, null, { respuesta, evidenciaTextual, observaciones, nivelRiesgo });
  }

  return {
    success: true,
    nivelRiesgo: nivelRiesgo,
    message: 'Guardado ✓'
  };
}

// ==============================================================================
// SUBIDA Y GESTIÓN DE ARCHIVOS DE EVIDENCIA EN GOOGLE DRIVE
// ==============================================================================

/**
 * Sube un archivo en formato Base64 a la carpeta adecuada de Google Drive
 * USER: /ControlMachete/{Subdirección}/{QuestionID}/
 * ADMIN: /ControlMachete/ADMIN/{QuestionID}/
 */
function uploadEvidenceFile(payload) {
  const user = assertAuthenticatedUser();
  const qId = Number(payload.questionId);
  if (!qId) throw new Error('ID de pregunta inválido.');

  const userSub = (user.subdireccion || '').toLowerCase().trim();
  const asignacionesMap = getAsignacionesMap();
  const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

  // Validar permisos server-side
  if (user.role === 'USER') {
    if (subAsignada.toLowerCase().trim() !== userSub) {
      throw new Error('ACCESO DENEGADO (403): No tiene permiso para adjuntar archivos en esta pregunta.');
    }
  }

  const folderSubName = (subAsignada === 'SIN_ASIGNAR' || subAsignada === '') ? 'ADMIN' : cleanFolderName(subAsignada);

  // Obtener/Crear estructura en Drive
  const rootFolder = getOrCreateDriveFolder(ROOT_DRIVE_FOLDER_NAME);
  const subFolder = getOrCreateSubFolder(rootFolder, folderSubName);
  const qFolder = getOrCreateSubFolder(subFolder, 'Pregunta_' + qId);

  if (!payload.base64Data) {
    throw new Error('Archivo no recibido o contenido vacío.');
  }

  const bytes = Utilities.base64Decode(payload.base64Data);
  const fileName = payload.fileName || 'evidencia_' + qId;
  const mimeType = payload.mimeType || 'application/octet-stream';
  const fileBlob = Utilities.newBlob(bytes, mimeType, fileName);

  // Límite de tamaño: 10MB
  if (fileBlob.getBytes().length > 10 * 1024 * 1024) {
    throw new Error('El archivo excede el tamaño máximo permitido de 10 MB.');
  }

  const driveFile = qFolder.createFile(fileBlob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileInfo = {
    id: driveFile.getId(),
    name: driveFile.getName(),
    url: driveFile.getUrl(),
    size: fileBlob.getBytes().length,
    mimeType: driveFile.getMimeType(),
    uploadedBy: user.email,
    uploadedAt: new Date().toISOString()
  };

  // Actualizar en la hoja RESPUESTAS
  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === qId && String(data[i][1]).trim().toLowerCase() === subAsignada.toLowerCase()) {
      foundIndex = i + 1;
      break;
    }
  }

  let existingDocs = [];
  const now = new Date();

  if (foundIndex > 0) {
    try {
      if (data[foundIndex - 1][4]) {
        existingDocs = JSON.parse(data[foundIndex - 1][4]);
        if (!Array.isArray(existingDocs)) existingDocs = [];
      }
    } catch (e) {
      existingDocs = [];
    }
    existingDocs.push(fileInfo);
    sheet.getRange(foundIndex, 5).setValue(JSON.stringify(existingDocs));
    sheet.getRange(foundIndex, 10).setValue(now);
  } else {
    existingDocs.push(fileInfo);
    sheet.appendRow([
      qId,
      subAsignada,
      '', // Respuesta
      '', // EvidenciaTextual
      JSON.stringify(existingDocs),
      '', // Observaciones
      '', // NivelRiesgo
      user.email,
      now,
      now
    ]);
  }

  logAudit('ARCHIVO_SUBIR', qId, null, fileInfo);

  return {
    success: true,
    file: fileInfo,
    allFiles: existingDocs,
    message: 'Archivo subido correctamente.'
  };
}

/**
 * Elimina un archivo de evidencia
 */
function deleteEvidenceFile(qIdRaw, fileId) {
  const user = assertAuthenticatedUser();
  const qId = Number(qIdRaw);
  if (!qId || !fileId) throw new Error('Parámetros inválidos.');

  const asignacionesMap = getAsignacionesMap();
  const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

  if (user.role === 'USER') {
    if (subAsignada.toLowerCase().trim() !== user.subdireccion.toLowerCase().trim()) {
      throw new Error('ACCESO DENEGADO (403): No puede eliminar archivos de esta pregunta.');
    }
  }

  // Eliminar en Drive
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
  } catch (e) {
    Logger.log('Archivo no encontrado en Drive o ya eliminado: ' + e.toString());
  }

  // Eliminar de la hoja Respuestas
  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  let updatedList = [];

  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === qId && String(data[i][1]).trim().toLowerCase() === subAsignada.toLowerCase()) {
      let docs = [];
      try { docs = JSON.parse(data[i][4]); } catch (e) {}
      if (Array.isArray(docs)) {
        updatedList = docs.filter(f => f.id !== fileId);
        sheet.getRange(i + 1, 5).setValue(JSON.stringify(updatedList));
        sheet.getRange(i + 1, 10).setValue(new Date());
      }
      break;
    }
  }

  logAudit('ARCHIVO_ELIMINAR', qId, fileId, null);

  return {
    success: true,
    allFiles: updatedList,
    message: 'Archivo eliminado.'
  };
}

function cleanFolderName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim();
}

function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subFolderName);
}

// ==============================================================================
// INDICADORES Y DASHBOARD GLOBAL (ADMIN)
// ==============================================================================

/**
 * Genera todas las métricas para el Dashboard Global del Administrador
 */
function getDashboardIndicatorsAdmin() {
  assertAdmin();

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const totalPreguntas = pData.length - 1; // 61
  let totalRespondidasGlobal = 0;

  let unassignedTotal = 0;
  let unassignedRespondidas = 0;

  const subMap = {}; // subName -> { total: 0, respondidas: 0, respuestasRiesgo: {Alto:0, Medio:0, Bajo:0, NoAplica:0} }
  const componenteMap = {}; // compName -> { total: 0, respondidas: 0, distribucion: {Sí:0, Parcial:0, No:0, NoAplica:0} }

  for (let i = 1; i < pData.length; i++) {
    const qId = Number(pData[i][0]);
    if (!qId) continue;

    const componente = pData[i][1] || 'Sin Componente';
    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

    if (!componenteMap[componente]) {
      componenteMap[componente] = { total: 0, respondidas: 0, distribucion: { 'Sí': 0, 'Parcial': 0, 'No': 0, 'No Aplica': 0 } };
    }
    componenteMap[componente].total++;

    if (subAsignada === 'SIN_ASIGNAR' || subAsignada === '') {
      unassignedTotal++;
    } else {
      if (!subMap[subAsignada]) {
        subMap[subAsignada] = {
          total: 0,
          respondidas: 0,
          riesgo: { 'Alto': 0, 'Medio': 0, 'Bajo': 0, 'No Aplica': 0, 'Sin Responder': 0 }
        };
      }
      subMap[subAsignada].total++;
    }

    const respKey = qId + '_' + subAsignada;
    const resp = respuestasMap[respKey];

    if (resp && resp.respuesta && resp.respuesta.trim() !== '') {
      totalRespondidasGlobal++;
      componenteMap[componente].respondidas++;
      if (componenteMap[componente].distribucion[resp.respuesta] !== undefined) {
        componenteMap[componente].distribucion[resp.respuesta]++;
      }

      if (subAsignada === 'SIN_ASIGNAR' || subAsignada === '') {
        unassignedRespondidas++;
      } else {
        subMap[subAsignada].respondidas++;
        const rResidual = resp.nivelRiesgo || RIESGO_MAP[resp.respuesta] || 'Sin Responder';
        if (subMap[subAsignada].riesgo[rResidual] !== undefined) {
          subMap[subAsignada].riesgo[rResidual]++;
        }
      }
    } else {
      if (subAsignada !== 'SIN_ASIGNAR' && subAsignada !== '' && subMap[subAsignada]) {
        subMap[subAsignada].riesgo['Sin Responder']++;
      }
    }
  }

  const avanceGlobalPct = totalPreguntas > 0 ? Math.round((totalRespondidasGlobal / totalPreguntas) * 100) : 0;
  const unassignedPendientes = unassignedTotal - unassignedRespondidas;

  return {
    kpis: {
      totalPreguntas: totalPreguntas,
      totalRespondidas: totalRespondidasGlobal,
      avanceGlobalPct: avanceGlobalPct,
      unassignedTotal: unassignedTotal,
      unassignedRespondidas: unassignedRespondidas,
      unassignedPendientes: unassignedPendientes
    },
    subdireccionesProgreso: subMap,
    componentesProgreso: componenteMap
  };
}

/**
 * Obtiene el listado completo de preguntas no respondidas o filtradas para la tabla de detalle Admin
 */
function getDetallePreguntasAdmin(filtroSubdireccion, filtroComponente) {
  assertAdmin();
  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const list = [];

  for (let i = 1; i < pData.length; i++) {
    const qId = Number(pData[i][0]);
    if (!qId) continue;

    const comp = pData[i][1];
    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

    if (filtroSubdireccion && filtroSubdireccion !== 'TODAS') {
      if (filtroSubdireccion === 'SIN_ASIGNAR' && (subAsignada !== 'SIN_ASIGNAR' && subAsignada !== '')) continue;
      if (filtroSubdireccion !== 'SIN_ASIGNAR' && subAsignada.toLowerCase().trim() !== filtroSubdireccion.toLowerCase().trim()) continue;
    }

    if (filtroComponente && filtroComponente !== 'TODOS' && comp !== filtroComponente) {
      continue;
    }

    const respKey = qId + '_' + subAsignada;
    const respObj = respuestasMap[respKey] || null;

    list.push({
      id: qId,
      componente: comp,
      principio: pData[i][2],
      pregunta: pData[i][3],
      fundamentoLegal: pData[i][4],
      subdireccionSugerida: pData[i][5] || '',
      subdireccionAsignada: subAsignada,
      respuesta: respObj ? respObj.respuesta : 'PENDIENTE',
      evidenciaTextual: respObj ? respObj.evidenciaTextual : '',
      evidenciaDocumental: respObj ? respObj.evidenciaDocumental : [],
      observaciones: respObj ? respObj.observaciones : '',
      nivelRiesgo: respObj ? respObj.nivelRiesgo : '',
      usuarioQueRespondio: respObj ? respObj.usuarioQueRespondio : '',
      fechaUltimaModificacion: respObj ? respObj.fechaUltimaModificacion : ''
    });
  }

  return list;
}

/**
 * Exporta la matriz completa de respuestas a una nueva Hoja de Google Sheets
 */
function exportarMatrizRespuestasSheet() {
  assertAdmin();

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const newSs = SpreadsheetApp.create('Control Machete - Matriz de Respuestas (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + ')');
  const sheet = newSs.getActiveSheet();

  const headers = [
    'No. ID',
    'Componente',
    'Principio',
    'Pregunta',
    'Fundamento Legal / Normativo',
    'Subdirección Asignada',
    'Respuesta (Sí/Parcial/No/No Aplica)',
    'Nivel Riesgo Residual',
    'Evidencia Textual',
    'Archivos de Evidencia Documental (URLs)',
    'Observaciones',
    'Usuario Responsable',
    'Última Modificación'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4A148C').setFontColor('#FFFFFF');

  const rows = [];
  for (let i = 1; i < pData.length; i++) {
    const qId = Number(pData[i][0]);
    if (!qId) continue;

    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';
    const respKey = qId + '_' + subAsignada;
    const resp = respuestasMap[respKey] || {};

    let driveUrls = '';
    if (resp.evidenciaDocumental && Array.isArray(resp.evidenciaDocumental)) {
      driveUrls = resp.evidenciaDocumental.map(f => f.name + ': ' + f.url).join(' | ');
    }

    rows.push([
      qId,
      pData[i][1],
      pData[i][2],
      pData[i][3],
      pData[i][4],
      subAsignada,
      resp.respuesta || 'SIN RESPONDER',
      resp.nivelRiesgo || '',
      resp.evidenciaTextual || '',
      driveUrls,
      resp.observaciones || '',
      resp.usuarioQueRespondio || '',
      resp.fechaUltimaModificacion ? Utilities.formatDate(new Date(resp.fechaUltimaModificacion), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : ''
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.autoResizeColumns(1, headers.length);
  }

  // Permitir lectura a cualquier persona con el enlace
  DriveApp.getFileById(newSs.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    url: newSs.getUrl(),
    name: newSs.getName()
  };
}

// ==============================================================================
// FUNCIÓN DE INICIALIZACIÓN / POBLADO DE LA BASE DE DATOS (SEEDING)
// ==============================================================================

/**
 * Función de configuración inicial y sembrado de las 61 preguntas COSO y Subdirecciones.
 * Se puede ejecutar directamente desde la consola de Apps Script.
 */
function seedDatabase() {
  const ss = getSpreadsheet();
  initDatabaseStructure(ss);

  // 1. Sembrar Preguntas (61 preguntas COSO)
  const pSheet = getSheetSafe(SHEETS.PREGUNTAS);
  pSheet.clear();
  initSheetHeader(pSheet, SHEETS.PREGUNTAS);

  const rawQuestions = get61CosoQuestionsData();
  const pRows = rawQuestions.map(q => [
    q.id,
    q.componente,
    q.principio,
    q.pregunta,
    q.fundamento,
    q.subdireccionSugerida || ''
  ]);
  pSheet.getRange(2, 1, pRows.length, 6).setValues(pRows);

  // 2. Sembrar Subdirecciones Únicas extraídas de la columna sugerida
  const subSet = new Set();
  rawQuestions.forEach(q => {
    if (q.subdireccionSugerida && q.subdireccionSugerida.trim()) {
      subSet.add(q.subdireccionSugerida.trim());
    }
  });

  const subSheet = getSheetSafe(SHEETS.SUBDIRECCIONES);
  subSheet.clear();
  initSheetHeader(subSheet, SHEETS.SUBDIRECCIONES);

  const subRows = Array.from(subSet).map(subName => [subName, 'ACTIVA']);
  if (subRows.length > 0) {
    subSheet.getRange(2, 1, subRows.length, 2).setValues(subRows);
  }

  // 3. Pre-poblar Asignaciones basadas en la sugerencia por defecto
  const asigSheet = getSheetSafe(SHEETS.ASIGNACIONES);
  asigSheet.clear();
  initSheetHeader(asigSheet, SHEETS.ASIGNACIONES);

  const now = new Date();
  const adminEmail = getEffectiveUserEmail() || 'ADMIN_SEED';
  const asigRows = rawQuestions.map(q => [
    q.id,
    (q.subdireccionSugerida && q.subdireccionSugerida.trim()) ? q.subdireccionSugerida.trim() : 'SIN_ASIGNAR',
    adminEmail,
    now
  ]);
  asigSheet.getRange(2, 1, asigRows.length, 4).setValues(asigRows);

  // 4. Asegurar usuario Admin actual
  const userSheet = getSheetSafe(SHEETS.USUARIOS);
  if (userSheet.getLastRow() <= 1) {
    userSheet.appendRow([adminEmail, 'Administrador Inicial', '', 'ADMIN', 'ACTIVO']);
  }

  return 'Base de datos de Control Machete sembrada e inicializada exitosamente con 61 preguntas COSO.';
}

/**
 * Catálogo completo de las 61 preguntas COSO - Control Machete
 */
function get61CosoQuestionsData() {
  return [
    // Componente 1: Ambiente de Control (Preguntas 1 a 12)
    { id: 1, componente: '1. Ambiente de Control', principio: 'Principio 1: Demuestra compromiso con la integridad y valores éticos', pregunta: '¿Se cuenta con un Código de Ética y/o Conducta actualizado y difundido a todo el personal?', fundamento: 'Reglamento Interior del H. Ayuntamiento de Mérida, Lineamientos de Ética', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 2, componente: '1. Ambiente de Control', principio: 'Principio 1: Demuestra compromiso con la integridad y valores éticos', pregunta: '¿Existen mecanismos institucionales para denunciar violaciones al Código de Ética o actos de corrupción?', fundamento: 'Lineamientos de Control Interno Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría // Comité de Ética' },
    { id: 3, componente: '1. Ambiente de Control', principio: 'Principio 1: Demuestra compromiso con la integridad y valores éticos', pregunta: '¿Se llevan a cabo capacitaciones periódicas en materia de ética, integridad y prevención de conflictos de interés?', fundamento: 'Programa Anual de Capacitación Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 4, componente: '1. Ambiente de Control', principio: 'Principio 2: Ejerce responsabilidad de supervisión del control interno', pregunta: '¿La titularidad de la unidad administrativa supervisa periódicamente la efectividad del control interno?', fundamento: 'Manual General de Organización', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 5, componente: '1. Ambiente de Control', principio: 'Principio 2: Ejerce responsabilidad de supervisión del control interno', pregunta: '¿Se rinden informes periódicos sobre el estado general del control interno a las instancias de evaluación superior?', fundamento: 'Ley de Gobierno de los Municipios del Estado de Yucatán', subdireccionSugerida: '' },
    { id: 6, componente: '1. Ambiente de Control', principio: 'Principio 3: Establece estructura, autoridad y responsabilidad', pregunta: '¿Se cuenta con Manual de Organización actualizado, formalizado y acorde con las atribuciones reglamentarias?', fundamento: 'Reglamento de la Administración Pública Municipal de Mérida', subdireccionSugerida: '' },
    { id: 7, componente: '1. Ambiente de Control', principio: 'Principio 3: Establece estructura, autoridad y responsabilidad', pregunta: '¿Están claramente delimitadas las funciones, tramos de control y responsabilidades del personal en manuales o perfiles de puesto?', fundamento: 'Manuales de Procedimientos Específicos', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 8, componente: '1. Ambiente de Control', principio: 'Principio 4: Demuestra compromiso con la competencia profesional', pregunta: '¿Existen perfiles de puesto definidos con los requisitos de experiencia, conocimientos y habilidades necesarias para cada cargo?', fundamento: 'Servicio Profesional de Carrera Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 9, componente: '1. Ambiente de Control', principio: 'Principio 4: Demuestra compromiso con la competencia profesional', pregunta: '¿Se aplican evaluaciones de desempeño periódicas al personal operante y mandos medios?', fundamento: 'Lineamientos de Evaluación del Desempeño Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 10, componente: '1. Ambiente de Control', principio: 'Principio 5: Enfoca la rendición de cuentas', pregunta: '¿Existen mecanismos formalizados para evaluar y sancionar el incumplimiento de metas o controles internos?', fundamento: 'Ley de Responsabilidades Administrativas', subdireccionSugerida: 'Subdirección de Jurídico' },
    { id: 11, componente: '1. Ambiente de Control', principio: 'Principio 5: Enfoca la rendición de cuentas', pregunta: '¿Se comunican formalmente al personal las consecuencias del incumplimiento de políticas e instrucciones de trabajo?', fundamento: 'Condiciones Generales de Trabajo', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 12, componente: '1. Ambiente de Control', principio: 'Principio 5: Enfoca la rendición de cuentas', pregunta: '¿Se realiza seguimiento puntual a los hallazgos y recomendaciones de auditorías internas y externas?', fundamento: 'Lineamientos de Seguimiento de Auditoría Municipal', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },

    // Componente 2: Evaluación de Riesgos (Preguntas 13 a 25)
    { id: 13, componente: '2. Evaluación de Riesgos', principio: 'Principio 6: Especifica objetivos idóneos y claros', pregunta: '¿La unidad administrativa cuenta con un Plan Operativo Anual (POA) alineado al Plan Municipal de Desarrollo?', fundamento: 'Ley de Planeación del Estado de Yucatán', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 14, componente: '2. Evaluación de Riesgos', principio: 'Principio 6: Especifica objetivos idóneos y claros', pregunta: '¿Los objetivos operativos y metas cuentan con indicadores clave de desempeño (KPI) medibles y verificables?', fundamento: 'Lineamientos del Presupuesto basado en Resultados (PbR)', subdireccionSugerida: '' },
    { id: 15, componente: '2. Evaluación de Riesgos', principio: 'Principio 6: Especifica objetivos idóneos y claros', pregunta: '¿Se revisan y actualizan periódicamente los objetivos institucionales ante cambios normativos o de entorno?', fundamento: 'Manual de Planeación Municipal', subdireccionSugerida: '' },
    { id: 16, componente: '2. Evaluación de Riesgos', principio: 'Principio 7: Identifica y analiza los riesgos', pregunta: '¿Se elabora y actualiza anualmente una Matriz de Administración de Riesgos (MAR)?', fundamento: 'Metodología de Administración de Riesgos de Mérida', subdireccionSugerida: '' },
    { id: 17, componente: '2. Evaluación de Riesgos', principio: 'Principio 7: Identifica y analiza los riesgos', pregunta: '¿La identificación de riesgos incluye factores internos (operativos, humanos) y externos (legales, presupuestales)?', fundamento: 'Guía General de Control Interno y Riesgos', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 18, componente: '2. Evaluación de Riesgos', principio: 'Principio 7: Identifica y analiza los riesgos', pregunta: '¿Se evalúa el impacto y la probabilidad de ocurrencia para jerarquizar los riesgos identificados?', fundamento: 'Metodología de Administración de Riesgos de Mérida', subdireccionSugerida: '' },
    { id: 19, componente: '2. Evaluación de Riesgos', principio: 'Principio 8: Evalúa el riesgo de corrupción', pregunta: '¿Se identifican específicamente los procesos susceptibles a actos de corrupción, soborno o desvío de recursos?', fundamento: 'Sistema Municipal Anticorrupción', subdireccionSugerida: '' },
    { id: 20, componente: '2. Evaluación de Riesgos', principio: 'Principio 8: Evalúa el riesgo de corrupción', pregunta: '¿Se evalúan los incentivos, presiones y oportunidades que podrían propiciar conductas irregulares o fraudulentas?', fundamento: 'Código de Ética y Lineamientos de Conflicto de Interés', subdireccionSugerida: '' },
    { id: 21, componente: '2. Evaluación de Riesgos', principio: 'Principio 8: Evalúa el riesgo de corrupción', pregunta: '¿Existen controles reforzados en los procesos de manejo de efectivo, compras, contrataciones y trámites ciudadanos?', fundamento: 'Reglamento de Adquisiciones, Arrendamientos y Servicios del Municipio', subdireccionSugerida: '' },
    { id: 22, componente: '2. Evaluación de Riesgos', principio: 'Principio 9: Identifica y analiza cambios significativos', pregunta: '¿Se evalúa el impacto en los controles ante cambios en la estructura orgánica, titulares o personal clave?', fundamento: 'Lineamientos de Entrega-Recepción Municipal', subdireccionSugerida: '' },
    { id: 23, componente: '2. Evaluación de Riesgos', principio: 'Principio 9: Identifica y analiza cambios significativos', pregunta: '¿Se analizan y prevén los riesgos derivados de modificaciones en leyes, reglamentos o lineamientos aplicables?', fundamento: 'Reglamento de la Administración Pública Municipal', subdireccionSugerida: '' },
    { id: 24, componente: '2. Evaluación de Riesgos', principio: 'Principio 9: Identifica y analiza cambios significativos', pregunta: '¿Se evalúan los riesgos de seguridad y continuidad operativa al implementar nuevas tecnologías o sistemas digitales?', fundamento: 'Políticas de Tecnologías de Información y Comunicaciones', subdireccionSugerida: '' },
    { id: 25, componente: '2. Evaluación de Riesgos', principio: 'Principio 9: Identifica y analiza cambios significativos', pregunta: '¿Existen planes de contingencia para asegurar la operación operativa crítica ante emergencias o desastres?', fundamento: 'Programa Municipal de Protección Civil', subdireccionSugerida: '' },

    // Componente 3: Actividades de Control (Preguntas 26 a 40)
    { id: 26, componente: '3. Actividades de Control', principio: 'Principio 10: Selecciona e implementa actividades de control', pregunta: '¿Se cuenta con Manuales de Procedimientos formalizados y vigentes para todos los trámites y servicios operados?', fundamento: 'Lineamientos para la Elaboración de Manuales de Procedimientos', subdireccionSugerida: 'Subdirección de Operaciones y Servicios' },
    { id: 27, componente: '3. Actividades de Control', principio: 'Principio 10: Selecciona e implementa actividades de control', pregunta: '¿Están segregadas adecuadamente las funciones incompatibles (autorización, registro, custodia y revisión)?', fundamento: 'Normas Generales de Control Interno', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 28, componente: '3. Actividades de Control', principio: 'Principio 10: Selecciona e implementa actividades de control', pregunta: '¿Las autorizaciones de trámites, pagos o documentos oficiales son realizadas exclusivamente por servidores públicos facultados?', fundamento: 'Reglamento Interior y Catálogo de Firmas Autorizadas', subdireccionSugerida: 'Subdirección de Jurídico' },
    { id: 29, componente: '3. Actividades de Control', principio: 'Principio 10: Selecciona e implementa actividades de control', pregunta: '¿Se realizan conciliaciones y verificaciones periódicas entre los registros operativos y los saldos contables/presupuestales?', fundamento: 'Ley General de Contabilidad Gubernamental', subdireccionSugerida: 'Subdirección de Finanzas y Presupuesto' },
    { id: 30, componente: '3. Actividades de Control', principio: 'Principio 10: Selecciona e implementa actividades de control', pregunta: '¿Se mantienen inventarios actualizados y resguardados físicamente para los bienes muebles, vehículos y equipos asignados?', fundamento: 'Lineamientos de Control del Patrimonio Municipal', subdireccionSugerida: 'Subdirección de Servicios Internos // Bienes Patrimoniales' },
    { id: 31, componente: '3. Actividades de Control', principio: 'Principio 11: Selecciona e implementa controles sobre tecnologías de información', pregunta: '¿Se aplican controles de acceso físico y lógico (usuarios, contraseñas, perfiles) a los sistemas de información institucionales?', fundamento: 'Políticas de Seguridad de la Información Municipal', subdireccionSugerida: 'Subdirección de Tecnologías de la Información' },
    { id: 32, componente: '3. Actividades de Control', principio: 'Principio 11: Selecciona e implementa controles sobre tecnologías de información', pregunta: '¿Se realizan respaldos periódicos (backups) de las bases de datos y expedientes digitales críticos de la unidad?', fundamento: 'Lineamientos de Respaldos y Seguridad TIC', subdireccionSugerida: 'Subdirección de Tecnologías de la Información' },
    { id: 33, componente: '3. Actividades de Control', principio: 'Principio 11: Selecciona e implementa controles sobre tecnologías de información', pregunta: '¿Se restringe la instalación de software no autorizado en los equipos de cómputo institucionales?', fundamento: 'Políticas de Uso de Recursos Informáticos', subdireccionSugerida: 'Subdirección de Tecnologías de la Información' },
    { id: 34, componente: '3. Actividades de Control', principio: 'Principio 11: Selecciona e implementa controles sobre tecnologías de información', pregunta: '¿Los desarrollos o modificaciones en sistemas informáticos cuentan con pruebas de validación y autorización previa?', fundamento: 'Estándar de Desarrollo de Sistemas Digitales', subdireccionSugerida: 'Subdirección de Tecnologías de la Información' },
    { id: 35, componente: '3. Actividades de Control', principio: 'Principio 12: Despliega actividades de control a través de políticas y procedimientos', pregunta: '¿Las políticas y procedimientos son revisados y actualizados al menos una vez al año o ante cambios normativos?', fundamento: 'Guía Metodológica de Manuales de Organización y Procedimientos', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 36, componente: '3. Actividades de Control', principio: 'Principio 12: Despliega actividades de control a través de políticas y procedimientos', pregunta: '¿Se difunden oportunamente entre el personal de la unidad los manuales, políticas y criterios operativos vigentes?', fundamento: 'Estrategia de Comunicación Interna Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 37, componente: '3. Actividades de Control', principio: 'Principio 12: Despliega actividades de control a través de políticas y procedimientos', pregunta: '¿Se efectúan supervisiones continuas en campo o gabinetes para comprobar el cumplimiento estricto de las políticas?', fundamento: 'Lineamientos de Supervisión Operativa', subdireccionSugerida: 'Subdirección de Operaciones y Servicios' },
    { id: 38, componente: '3. Actividades de Control', principio: 'Principio 12: Despliega actividades de control a través de políticas y procedimientos', pregunta: '¿Existen evidencias documentales o digitales que soporten la ejecución de cada punto de control clave?', fundamento: 'Ley de Archivos del Estado de Yucatán', subdireccionSugerida: 'Subdireccion de Administración y Proveeduría' },
    { id: 39, componente: '3. Actividades de Control', principio: 'Principio 12: Despliega actividades de control a través de políticas y procedimientos', pregunta: '¿Se cuenta con expedientes administrativos debidamente integrados y foliados para cada asunto o procedimiento?', fundamento: 'Lineamientos de Gestión Documental y Archivo Municipal', subdireccionSugerida: 'Subdirección de Jurídico' },
    { id: 40, componente: '3. Actividades de Control', principio: 'Principio 12: Despliega actividades de control a través de políticas y procedimientos', pregunta: '¿Se exige la comprobación documental de todos los viáticos, fondos fijos o gastos a comprobar otorgados al personal?', fundamento: 'Reglamento para el Control del Presupuesto y Gasto Público Municipal', subdireccionSugerida: 'Subdirección de Finanzas y Presupuesto' },

    // Componente 4: Información y Comunicación (Preguntas 41 a 50)
    { id: 41, componente: '4. Información y Comunicación', principio: 'Principio 13: Utiliza información relevante y de calidad', pregunta: '¿La información utilizada para la toma de decisiones operativas es veraz, oportuna, suficiente y actualizada?', fundamento: 'Normas Generales de Control Interno', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 42, componente: '4. Información y Comunicación', principio: 'Principio 13: Utiliza información relevante y de calidad', pregunta: '¿Se tienen definidos controles para verificar la precisión y exactitud de las cifras presentadas en informes oficiales?', fundamento: 'Ley de Contabilidad Gubernamental y Disciplina Financiera', subdireccionSugerida: 'Subdirección de Finanzas y Presupuesto' },
    { id: 43, componente: '4. Información y Comunicación', principio: 'Principio 13: Utiliza información relevante y de calidad', pregunta: '¿Se aplican medidas para resguardar la confidencialidad, integridad y disponibilidad de la información sensible?', fundamento: 'Ley de Protección de Datos Personales en Posesión de Sujetos Obligados', subdireccionSugerida: 'Subdirección de Tecnologías de la Información' },
    { id: 44, componente: '4. Información y Comunicación', principio: 'Principio 14: Comunica internamente', pregunta: '¿Existen canales de comunicación interna efectivos (reuniones, circulares, correo institucional) en toda la estructura?', fundamento: 'Manual de Comunicación Organizacional', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 45, componente: '4. Información y Comunicación', principio: 'Principio 14: Comunica internamente', pregunta: '¿Se comunican a todo el personal las metas institucionales, sus funciones específicas y la importancia de sus controles?', fundamento: 'Programa de Inducción e Integración Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría' },
    { id: 46, componente: '4. Información y Comunicación', principio: 'Principio 14: Comunica internamente', pregunta: '¿Existen canales abiertos para que el personal reporte deficiencias de control o sugiera mejoras sin temor a represalias?', fundamento: 'Lineamientos del Sistema de Control Interno Municipal', subdireccionSugerida: 'Subdirección de Administración y Proveeduría // Comité de Ética' },
    { id: 47, componente: '4. Información y Comunicación', principio: 'Principio 15: Comunica externamente', pregunta: '¿Se cumple en tiempo y forma con la publicación de las obligaciones de transparencia en el portal institucional?', fundamento: 'Ley de Transparencia y Acceso a la Información Pública del Estado de Yucatán', subdireccionSugerida: 'Subdirección de Transparencia y Gobierno Abierto' },
    { id: 48, componente: '4. Información y Comunicación', principio: 'Principio 15: Comunica externamente', pregunta: '¿Existen procedimientos estandarizados para atender solicitudes de acceso a la información pública dentro de los plazos legales?', fundamento: 'Reglamento de Transparencia Municipal de Mérida', subdireccionSugerida: 'Subdirección de Transparencia y Gobierno Abierto' },
    { id: 49, componente: '4. Información y Comunicación', principio: 'Principio 15: Comunica externamente', pregunta: '¿Se registran y atienden oportunamente las quejas, denuncias y sugerencias presentadas por la ciudadanía?', fundamento: 'Lineamientos de Atención Ciudadana del Ayuntamiento de Mérida', subdireccionSugerida: 'Subdirección de Atención Ciudadana' },
    { id: 50, componente: '4. Información y Comunicación', principio: 'Principio 15: Comunica externamente', pregunta: '¿Se establecen mecanismos formales de comunicación y coordinación con entes fiscalizadores externos?', fundamento: 'Ley de Fiscalización Cuenta Pública del Estado de Yucatán', subdireccionSugerida: 'Subdirección de Jurídico' },

    // Componente 5: Supervisión y Mejora Continua (Preguntas 51 a 61)
    { id: 51, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 16: Conduce evaluaciones continuas y/o independientes', pregunta: '¿Se ejecutan autoevaluaciones continuas sobre la efectividad de las operaciones y controles aplicados en la unidad?', fundamento: 'Modelo General de Autoevaluación del Control Interno', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 52, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 16: Conduce evaluaciones continuas y/o independientes', pregunta: '¿Se atiende de manera oportuna la autoevaluación anual del Programa Control Machete conforme a los calendarios fijados?', fundamento: 'Lineamientos del Sistema de Control Machete Municipal', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 53, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 16: Conduce evaluaciones continuas y/o independientes', pregunta: '¿Se facilita el acceso a la documentación y personal durante las auditorías realizadas por la Contraloría Municipal?', fundamento: 'Reglamento de la Contraloría Municipal de Mérida', subdireccionSugerida: 'Subdirección de Jurídico' },
    { id: 54, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 16: Conduce evaluaciones continuas y/o independientes', pregunta: '¿Se revisa que el personal operativo aplique correctamente los procedimientos sin omitir los pasos de control asignados?', fundamento: 'Manual de Supervisión y Control Operativo', subdireccionSugerida: 'Subdirección de Operaciones y Servicios' },
    { id: 55, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿Se informan de inmediato al superior jerárquico las deficiencias críticas detectadas en la operación diaria?', fundamento: 'Lineamientos de Control Interno Municipal', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 56, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿Se elaboran Programas de Trabajo de Control Interno (PTCI) o de Mejora Continua para subsanar deficiencias?', fundamento: 'Guía de Elaboración de Programas de Trabajo de Control Interno', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 57, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿Los programas de mejora establecen acciones concretas, responsables específicos y fechas compromiso de cumplimiento?', fundamento: 'Lineamientos de Control Interno y PTAR', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 58, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿Se evalúa periódicamente el avance físico y cualitativo de las acciones comprometidas en el PTCI?', fundamento: 'Lineamientos de Control Interno Municipal', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 59, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿Se solventan en su totalidad las observaciones o hallazgos notificados en los plazos legales o administrativos acordados?', fundamento: 'Ley de Fiscalización y Rendición de Cuentas', subdireccionSugerida: 'Subdirección de Jurídico' },
    { id: 60, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿Se documentan y comparten las buenas prácticas operativas derivadas de la atención a las recomendaciones de mejora?', fundamento: 'Lineamientos de Gestión del Conocimiento e Innovación', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' },
    { id: 61, componente: '5. Supervisión y Mejora Continua', principio: 'Principio 17: Evalúa y comunica las deficiencias de control interno', pregunta: '¿El titular de la unidad valida y suscribe el reporte final del ejercicio de autoevaluación Control Machete?', fundamento: 'Lineamientos de Autoevaluación de Control Machete', subdireccionSugerida: 'Subdirección de Planeación y Evaluación' }
  ];
}
