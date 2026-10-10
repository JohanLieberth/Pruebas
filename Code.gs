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
const TOKEN_TTL_SECONDS = 6 * 3600; // 6 Horas (Límite máximo permitido por Google Apps Script CacheService)

// Nombres de las pestañas de la Base de Datos
const SHEETS = {
  PREGUNTAS: 'Preguntas',
  USUARIOS: 'Usuarios',
  SUBDIRECCIONES: 'Subdirecciones',
  ASIGNACIONES: 'Asignaciones',
  RESPUESTAS: 'Respuestas',
  LOTES: 'Lotes',
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
 * Helper para normalización robusta de cadenas antes de filtrar/comparar
 */
function cleanStr(val) {
  return String(val || '').toLowerCase().trim();
}

/**
 * Servicio Web App - Punto de entrada doGet
 */
function doGet(e) {
  try {
    const template = HtmlService.createTemplateFromFile('Index');
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
 * Genera hash SHA-256 seguro para contraseñas
 */
function hashPassword(plainText) {
  if (!plainText) return '';
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plainText, Utilities.Charset.UTF_8);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteStr = byteVal.toString(16);
    if (byteStr.length == 1) byteStr = '0' + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

// ==============================================================================
// SERVICIO DE TOKENS (TokenService) Y AUTENTICACIÓN
// ==============================================================================

function loginUsuario(email, password) {
  if (!email || !password) {
    throw new Error('Debe proporcionar correo electrónico y contraseña.');
  }

  migrateDatabaseStructure();

  const cleanEmail = cleanStr(email);
  const user = getUserByEmail(cleanEmail);

  if (!user) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  if (!user.active) {
    throw new Error('Usuario inactivo, contacte al administrador.');
  }

  const passHash = hashPassword(password);
  if (user.passwordHash !== passHash) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  const token = Utilities.getUuid();
  const sessionData = {
    email: user.email,
    name: user.name,
    subdireccion: user.subdireccion,
    role: user.role,
    active: user.active,
    createdAt: new Date().getTime()
  };

  const cache = CacheService.getScriptCache();
  cache.put('SESSION_' + token, JSON.stringify(sessionData), TOKEN_TTL_SECONDS);

  logAudit('LOGIN_SUCCESS', '', null, cleanEmail, cleanEmail);

  return {
    success: true,
    token: token,
    user: sessionData
  };
}

function logoutUsuario(token) {
  if (token) {
    const cache = CacheService.getScriptCache();
    cache.remove('SESSION_' + token);
  }
  return { success: true, message: 'Sesión cerrada correctamente.' };
}

function getSessionByToken(token) {
  if (!token) {
    throw new Error('Sesión expirada, inicie sesión nuevamente.');
  }

  const cache = CacheService.getScriptCache();
  const cachedStr = cache.get('SESSION_' + token);

  if (!cachedStr) {
    throw new Error('Sesión expirada, inicie sesión nuevamente.');
  }

  try {
    const session = JSON.parse(cachedStr);
    const latestUser = getUserByEmail(session.email);
    if (!latestUser || !latestUser.active) {
      cache.remove('SESSION_' + token);
      throw new Error('Usuario inactivo, contacte al administrador.');
    }
    session.subdireccion = latestUser.subdireccion;
    session.role = latestUser.role;
    return session;
  } catch (e) {
    throw new Error('Sesión expirada, inicie sesión nuevamente.');
  }
}

function assertAuthenticatedUser(token) {
  return getSessionByToken(token);
}

function assertAdmin(token) {
  const session = getSessionByToken(token);
  if (session.role !== 'ADMIN') {
    throw new Error('ACCESO DENEGADO (403): Se requieren permisos de Administrador.');
  }
  return session;
}

// ==============================================================================
// BASE DE DATOS Y MIGRACIÓN IDEMPOTENTE
// ==============================================================================

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(SPREADSHEET_ID_PROP);
  let ss = null;

  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; }
  }

  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) props.setProperty(SPREADSHEET_ID_PROP, ss.getId());
    } catch (e) { ss = null; }
  }

  if (!ss) {
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

function getSheetSafe(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initSheetHeader(sheet, sheetName);
  }
  return sheet;
}

function initSheetHeader(sheet, sheetName) {
  let headers = [];
  switch (sheetName) {
    case SHEETS.PREGUNTAS:
      headers = ['ID', 'Componente', 'Principio', 'Pregunta', 'FundamentoLegal', 'SubdireccionSugerida', 'LoteID'];
      break;
    case SHEETS.USUARIOS:
      headers = ['Email', 'Nombre', 'Subdireccion', 'Rol', 'Estado', 'Contrasena'];
      break;
    case SHEETS.SUBDIRECCIONES:
      headers = ['Nombre', 'Activa'];
      break;
    case SHEETS.ASIGNACIONES:
      headers = ['QuestionID', 'SubdireccionAsignada', 'AsignadoPor', 'FechaAsignacion'];
      break;
    case SHEETS.RESPUESTAS:
      headers = ['QuestionID', 'Subdireccion', 'Respuesta', 'EvidenciaTextual', 'EvidenciaDocumental', 'Observaciones', 'NivelRiesgo', 'UsuarioQueRespondio', 'FechaCreacion', 'FechaUltimaModificacion', 'EstadoRevision', 'ObservacionAdmin'];
      break;
    case SHEETS.LOTES:
      headers = ['LoteID', 'NombreLote', 'Descripcion', 'FechaCreacion', 'CreadoPor', 'Activo'];
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

function initDatabaseStructure(ss) {
  Object.values(SHEETS).forEach(name => {
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    initSheetHeader(s, name);
  });
}

function migrateDatabaseStructure() {
  const ss = getSpreadsheet();
  initDatabaseStructure(ss);

  // 1. Usuarios -> Contrasena
  const uSheet = getSheetSafe(SHEETS.USUARIOS);
  const uData = uSheet.getDataRange().getValues();
  if (uData.length > 0 && uData[0].length < 6) {
    uSheet.getRange(1, 6).setValue('Contrasena').setFontWeight('bold');
  }

  if (uData.length > 1) {
    for (let i = 1; i < uData.length; i++) {
      let passVal = cleanStr(uData[i][5]);
      if (!passVal) {
        passVal = hashPassword('admin123');
        uSheet.getRange(i + 1, 6).setValue(passVal);
      } else if (passVal.length < 64) {
        passVal = hashPassword(passVal);
        uSheet.getRange(i + 1, 6).setValue(passVal);
      }
    }
  }

  // 2. Lotes -> LOTE_INICIAL
  const lotesSheet = getSheetSafe(SHEETS.LOTES);
  const lotesData = lotesSheet.getDataRange().getValues();
  let loteInicialExiste = false;

  for (let i = 1; i < lotesData.length; i++) {
    if (cleanStr(lotesData[i][0]) === 'lote_inicial' || cleanStr(lotesData[i][1]) === 'lote inicial') {
      loteInicialExiste = true;
      break;
    }
  }

  if (!loteInicialExiste) {
    lotesSheet.appendRow(['LOTE_INICIAL', 'Lote Inicial', 'Evaluación COSO 61 preguntas inicial', new Date(), 'SISTEMA', true]);
  }

  // 3. Preguntas -> LoteID
  const pSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = pSheet.getDataRange().getValues();
  if (pData.length > 0 && pData[0].length < 7) {
    pSheet.getRange(1, 7).setValue('LoteID').setFontWeight('bold');
  }

  if (pData.length > 1) {
    for (let i = 1; i < pData.length; i++) {
      const currentLote = cleanStr(pData[i][6]);
      if (!currentLote) {
        pSheet.getRange(i + 1, 7).setValue('LOTE_INICIAL');
      }
    }
  }

  // 4. Respuestas -> EstadoRevision y ObservacionAdmin
  const rSheet = getSheetSafe(SHEETS.RESPUESTAS);
  const rData = rSheet.getDataRange().getValues();
  if (rData.length > 0) {
    if (rData[0].length < 11) rSheet.getRange(1, 11).setValue('EstadoRevision').setFontWeight('bold');
    if (rData[0].length < 12) rSheet.getRange(1, 12).setValue('ObservacionAdmin').setFontWeight('bold');
  }

  if (rData.length > 1) {
    for (let i = 1; i < rData.length; i++) {
      const respVal = cleanStr(rData[i][2]);
      let estRev = cleanStr(rData[i][10]);
      if (!estRev) {
        estRev = respVal ? 'Enviada' : 'Borrador';
        rSheet.getRange(i + 1, 11).setValue(estRev);
      }
    }
  }
}

// ==============================================================================
// AUDITORÍA
// ==============================================================================

function logAudit(entity, questionId, oldValue, newValue, userEmail) {
  try {
    const email = userEmail || 'SISTEMA';
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
// USUARIOS
// ==============================================================================

function getUserByEmail(email) {
  if (!email) return null;
  const target = cleanStr(email);
  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowEmail = cleanStr(data[i][0]);
    if (rowEmail === target) {
      return {
        email: data[i][0],
        name: data[i][1],
        subdireccion: data[i][2],
        role: String(data[i][3]).toUpperCase(),
        active: String(data[i][4]).toUpperCase() === 'ACTIVO' || data[i][4] === true,
        passwordHash: data[i][5] || '',
        rowIndex: i + 1
      };
    }
  }
  return null;
}

function getUsuariosAdmin(token) {
  assertAdmin(token);
  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  const usuarios = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      const hasPass = !!(data[i][5] && cleanStr(data[i][5]) !== '');
      usuarios.push({
        email: data[i][0],
        name: data[i][1],
        subdireccion: data[i][2],
        role: data[i][3],
        active: String(data[i][4]).toUpperCase() === 'ACTIVO' || data[i][4] === true,
        passwordEstado: hasPass ? 'Definida' : 'Sin definir'
      });
    }
  }
  return usuarios;
}

function saveUsuarioAdmin(token, userData) {
  const adminSession = assertAdmin(token);
  if (!userData.email || !userData.name) {
    throw new Error('El correo y el nombre son campos obligatorios.');
  }

  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  const targetEmail = cleanStr(userData.email);
  let foundIndex = -1;
  let oldVal = null;
  let existingHash = '';

  for (let i = 1; i < data.length; i++) {
    if (cleanStr(data[i][0]) === targetEmail) {
      foundIndex = i + 1;
      existingHash = data[i][5] || '';
      oldVal = { email: data[i][0], name: data[i][1], subdireccion: data[i][2], role: data[i][3], active: data[i][4] };
      break;
    }
  }

  const estadoStr = userData.active ? 'ACTIVO' : 'INACTIVO';
  const roleStr = userData.role === 'ADMIN' ? 'ADMIN' : 'USER';
  const subdireccionStr = userData.subdireccion || '';

  let finalHash = existingHash;
  if (userData.password && userData.password.trim() !== '') {
    finalHash = hashPassword(userData.password.trim());
  } else if (foundIndex <= 0) {
    throw new Error('La contraseña es obligatoria para nuevos usuarios.');
  }

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 1, 1, 6).setValues([[
      userData.email.trim(),
      userData.name.trim(),
      subdireccionStr,
      roleStr,
      estadoStr,
      finalHash
    ]]);
    logAudit('USUARIO_EDITAR', '', oldVal, { email: userData.email, role: roleStr, active: estadoStr }, adminSession.email);
  } else {
    sheet.appendRow([
      userData.email.trim(),
      userData.name.trim(),
      subdireccionStr,
      roleStr,
      estadoStr,
      finalHash
    ]);
    logAudit('USUARIO_CREAR', '', null, { email: userData.email, role: roleStr, active: estadoStr }, adminSession.email);
  }

  return { success: true, message: 'Usuario guardado exitosamente.' };
}

function toggleUsuarioEstado(token, email, active) {
  const adminSession = assertAdmin(token);
  const targetEmail = cleanStr(email);
  const sheet = getSheetSafe(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (cleanStr(data[i][0]) === targetEmail) {
      const nuevoEstado = active ? 'ACTIVO' : 'INACTIVO';
      sheet.getRange(i + 1, 5).setValue(nuevoEstado);
      logAudit('USUARIO_TOGGLE_ESTADO', '', email, nuevoEstado, adminSession.email);
      return { success: true, message: 'Estado del usuario actualizado.' };
    }
  }
  throw new Error('Usuario no encontrado.');
}

// ==============================================================================
// SUBDIRECCIONES
// ==============================================================================

function getSubdireccionesList(token) {
  if (token) assertAuthenticatedUser(token);
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

function saveSubdireccionAdmin(token, nombre) {
  const adminSession = assertAdmin(token);
  if (!nombre || !nombre.trim()) throw new Error('El nombre de la Subdirección no puede estar vacío.');
  const sheet = getSheetSafe(SHEETS.SUBDIRECCIONES);
  const data = sheet.getDataRange().getValues();
  const cleanName = nombre.trim();
  const cleanTarget = cleanStr(cleanName);

  for (let i = 1; i < data.length; i++) {
    if (cleanStr(data[i][0]) === cleanTarget) {
      sheet.getRange(i + 1, 2).setValue('ACTIVA');
      return { success: true, message: 'Subdirección reactivada.' };
    }
  }
  sheet.appendRow([cleanName, 'ACTIVA']);
  logAudit('SUBDIRECCION_CREAR', '', null, cleanName, adminSession.email);
  return { success: true, message: 'Subdirección agregada exitosamente.' };
}

// ==============================================================================
// GESTIÓN DE LOTES — LECTURA DIRECTA
// ==============================================================================

function getLotesActivosMap() {
  const sheet = getSheetSafe(SHEETS.LOTES);
  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const loteId = String(data[i][0]).trim();
    if (loteId) {
      const activo = data[i][5] === true || String(data[i][5]).toUpperCase() === 'TRUE' || String(data[i][5]).toUpperCase() === 'ACTIVO';
      map[loteId] = activo;
    }
  }
  return map;
}

function getLotesListAdmin(token) {
  assertAdmin(token);
  const lotesSheet = getSheetSafe(SHEETS.LOTES);
  const lData = lotesSheet.getDataRange().getValues();

  if (!lData || lData.length <= 1) {
    return [];
  }

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const loteStats = {};

  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]).trim();
    if (!qId) continue;
    const loteId = String(pData[i][6] || 'LOTE_INICIAL').trim();

    if (!loteStats[loteId]) {
      loteStats[loteId] = { totalPreguntas: 0, respondidas: 0 };
    }
    loteStats[loteId].totalPreguntas++;

    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';
    const respKey = qId + '_' + subAsignada;
    const resp = respuestasMap[respKey];

    if (resp && resp.respuesta && resp.respuesta.trim() !== '' && (resp.estadoRevision === 'Enviada' || resp.estadoRevision === 'Aceptada')) {
      loteStats[loteId].respondidas++;
    }
  }

  const result = [];
  for (let i = 1; i < lData.length; i++) {
    const loteId = String(lData[i][0]).trim();
    if (loteId) {
      const stats = loteStats[loteId] || { totalPreguntas: 0, respondidas: 0 };
      const pct = stats.totalPreguntas > 0 ? Math.round((stats.respondidas / stats.totalPreguntas) * 100) : 0;
      const activo = lData[i][5] === true || String(lData[i][5]).toUpperCase() === 'TRUE' || String(lData[i][5]).toUpperCase() === 'ACTIVO';

      result.push({
        loteId: loteId,
        nombreLote: lData[i][1] || loteId,
        descripcion: lData[i][2] || '',
        fechaCreacion: lData[i][3] ? new Date(lData[i][3]).toISOString() : '',
        creadoPor: lData[i][4] || '',
        activo: activo,
        totalPreguntas: stats.totalPreguntas,
        respondidas: stats.respondidas,
        avancePct: pct
      });
    }
  }

  return result;
}

function toggleLoteEstado(token, loteId, active) {
  const admin = assertAdmin(token);
  const targetLote = cleanStr(loteId);
  const sheet = getSheetSafe(SHEETS.LOTES);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (cleanStr(data[i][0]) === targetLote) {
      sheet.getRange(i + 1, 6).setValue(active);
      logAudit('LOTE_TOGGLE_ESTADO', loteId, data[i][5], active, admin.email);
      return { success: true, message: 'Estado del lote actualizado.' };
    }
  }
  throw new Error('Lote no encontrado.');
}

function eliminarLoteAdmin(token, loteId) {
  const admin = assertAdmin(token);
  const targetLote = cleanStr(loteId);
  if (targetLote === 'lote_inicial') {
    throw new Error('El Lote Inicial no puede ser eliminado.');
  }

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const qIdsLote = [];
  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]);
    const qLote = cleanStr(pData[i][6] || 'LOTE_INICIAL');
    if (qLote === targetLote) {
      qIdsLote.push(qId);
    }
  }

  for (let idx = 0; idx < qIdsLote.length; idx++) {
    const qId = qIdsLote[idx];
    const sub = asignacionesMap[qId] || 'SIN_ASIGNAR';
    const resp = respuestasMap[qId + '_' + sub];
    if (resp && resp.respuesta && resp.respuesta.trim() !== '') {
      throw new Error('No se puede eliminar el lote porque ya cuenta con respuestas registradas.');
    }
  }

  for (let i = pData.length - 1; i >= 1; i--) {
    const qLote = cleanStr(pData[i][6] || 'LOTE_INICIAL');
    if (qLote === targetLote) {
      preguntasSheet.deleteRow(i + 1);
    }
  }

  const lotesSheet = getSheetSafe(SHEETS.LOTES);
  const lData = lotesSheet.getDataRange().getValues();
  for (let i = lData.length - 1; i >= 1; i--) {
    if (cleanStr(lData[i][0]) === targetLote) {
      lotesSheet.deleteRow(i + 1);
      break;
    }
  }

  logAudit('LOTE_ELIMINAR', loteId, null, null, admin.email);
  return { success: true, message: 'Lote eliminado exitosamente.' };
}

function cargarMasivaPreguntas(token, payload) {
  const admin = assertAdmin(token);
  const nombreLote = payload.nombreLote ? payload.nombreLote.trim() : '';
  const descripcionLote = payload.descripcionLote ? payload.descripcionLote.trim() : '';
  const preguntasNuevas = payload.preguntas || [];

  if (!nombreLote) {
    throw new Error('Debe proporcionar un nombre para el Lote/Proyecto.');
  }

  if (!Array.isArray(preguntasNuevas) || preguntasNuevas.length === 0) {
    throw new Error('No se recibieron preguntas para guardar.');
  }

  const lotesSheet = getSheetSafe(SHEETS.LOTES);

  let loteId = 'LOTE_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  if (payload.loteIdExistente) {
    loteId = payload.loteIdExistente.trim();
  } else {
    lotesSheet.appendRow([loteId, nombreLote, descripcionLote, new Date(), admin.email, true]);
    logAudit('LOTE_CREAR', loteId, null, nombreLote, admin.email);
  }

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();

  const existingIds = new Set();
  for (let i = 1; i < pData.length; i++) {
    existingIds.add(String(pData[i][0]).trim());
  }

  const pRowsToInsert = [];
  const asigRowsToInsert = [];
  const now = new Date();

  preguntasNuevas.forEach((q, idx) => {
    let qId = String(q.no || (idx + 1)).trim();
    if (existingIds.has(qId)) {
      qId = loteId + '-' + qId;
    }
    existingIds.add(qId);

    pRowsToInsert.push([
      qId,
      q.componente || 'Sin Componente',
      q.principio || 'Sin Principio',
      q.pregunta || '',
      q.fundamento || '',
      q.subdireccionSugerida || '',
      loteId
    ]);

    const subSugerida = (q.subdireccionSugerida && q.subdireccionSugerida.trim()) ? q.subdireccionSugerida.trim() : 'SIN_ASIGNAR';
    asigRowsToInsert.push([
      qId,
      subSugerida,
      admin.email,
      now
    ]);
  });

  if (pRowsToInsert.length > 0) {
    const startRow = preguntasSheet.getLastRow() + 1;
    preguntasSheet.getRange(startRow, 1, pRowsToInsert.length, 7).setValues(pRowsToInsert);
  }

  if (asigRowsToInsert.length > 0) {
    const asigSheet = getSheetSafe(SHEETS.ASIGNACIONES);
    const startRowAsig = asigSheet.getLastRow() + 1;
    asigSheet.getRange(startRowAsig, 1, asigRowsToInsert.length, 4).setValues(asigRowsToInsert);
  }

  logAudit('PREGUNTAS_CARGA_MASIVA', loteId, null, pRowsToInsert.length + ' preguntas', admin.email);

  return {
    success: true,
    loteId: loteId,
    message: `Se registraron ${pRowsToInsert.length} preguntas en el lote "${nombreLote}" exitosamente.`
  };
}

// ==============================================================================
// ASIGNACIÓN DE PREGUNTAS
// ==============================================================================

function getAsignacionesMap() {
  const sheet = getSheetSafe(SHEETS.ASIGNACIONES);
  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const qId = String(data[i][0]).trim();
    if (qId) {
      const sub = String(data[i][1] || '').trim();
      map[qId] = sub;
    }
  }
  return map;
}

function getPreguntasConAsignacionAdmin(token, filtroLote) {
  assertAdmin(token);
  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const data = preguntasSheet.getDataRange().getValues();
  const asignaciones = getAsignacionesMap();

  const targetLote = cleanStr(filtroLote);

  const result = [];
  for (let i = 1; i < data.length; i++) {
    const qId = String(data[i][0]).trim();
    if (qId) {
      const loteId = String(data[i][6] || 'LOTE_INICIAL').trim();

      if (targetLote && targetLote !== 'todos' && cleanStr(loteId) !== targetLote) {
        continue;
      }

      const subAsignada = asignaciones[qId] !== undefined ? asignaciones[qId] : 'SIN_ASIGNAR';
      result.push({
        id: qId,
        componente: data[i][1],
        principio: data[i][2],
        pregunta: data[i][3],
        fundamentoLegal: data[i][4],
        subdireccionSugerida: data[i][5] || '',
        loteId: loteId,
        subdireccionAsignada: subAsignada
      });
    }
  }
  return result;
}

function guardarAsignacionesPreguntas(token, questionIds, nuevaSubdireccion) {
  const admin = assertAdmin(token);
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error('Debe seleccionar al menos una pregunta.');
  }

  const subLimpia = (nuevaSubdireccion && nuevaSubdireccion.trim()) ? nuevaSubdireccion.trim() : 'SIN_ASIGNAR';
  const sheet = getSheetSafe(SHEETS.ASIGNACIONES);
  const data = sheet.getDataRange().getValues();

  const indexMap = {};
  for (let i = 1; i < data.length; i++) {
    const qId = String(data[i][0]).trim();
    if (qId) {
      indexMap[qId] = i + 1;
    }
  }

  const now = new Date();
  questionIds.forEach(qIdRaw => {
    const qId = String(qIdRaw).trim();
    if (!qId) return;

    const rowIndex = indexMap[qId];
    if (rowIndex) {
      const oldSub = data[rowIndex - 1][1];
      sheet.getRange(rowIndex, 2, 1, 3).setValues([[subLimpia, admin.email, now]]);
      logAudit('ASIGNACION_CAMBIO', qId, oldSub, subLimpia, admin.email);
    } else {
      sheet.appendRow([qId, subLimpia, admin.email, now]);
      logAudit('ASIGNACION_CREAR', qId, null, subLimpia, admin.email);
    }
  });

  return {
    success: true,
    message: 'Se actualizaron ' + questionIds.length + ' asignaciones correctamente.'
  };
}

// ==============================================================================
// CAMBIO 1: INTERFAZ DEL USUARIO — FUENTE DE VERDAD: ASIGNACIONES (NUNCA OMITIR FILAS)
// ==============================================================================

function getPreguntasParaUsuario(token, modoAdminMisPreguntas) {
  const user = assertAuthenticatedUser(token);
  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();

  const preguntasMap = {};
  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]).trim();
    if (qId) {
      preguntasMap[qId] = {
        id: qId,
        componente: pData[i][1],
        principio: pData[i][2],
        pregunta: pData[i][3],
        fundamentoLegal: pData[i][4],
        subdireccionSugerida: pData[i][5] || '',
        loteId: String(pData[i][6] || 'LOTE_INICIAL').trim()
      };
    }
  }

  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();
  const lotesActivosMap = getLotesActivosMap();

  let targetSubdireccion = '';
  if (user.role === 'ADMIN' && modoAdminMisPreguntas) {
    targetSubdireccion = 'sin_asignar';
  } else if (user.role === 'USER') {
    targetSubdireccion = cleanStr(user.subdireccion);
    if (!targetSubdireccion) {
      return [];
    }
  } else if (user.role === 'ADMIN' && !modoAdminMisPreguntas) {
    targetSubdireccion = 'all';
  }

  const result = [];
  const qIdsList = Object.keys(preguntasMap);

  for (let i = 0; i < qIdsList.length; i++) {
    const qId = qIdsList[i];
    const qInfo = preguntasMap[qId];
    if (!qInfo) continue;

    if (lotesActivosMap[qInfo.loteId] === false) {
      continue;
    }

    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';
    const subClean = cleanStr(subAsignada);

    let esVisible = false;
    if (targetSubdireccion === 'all' && user.role === 'ADMIN') {
      esVisible = true;
    } else if (targetSubdireccion === 'sin_asignar' && user.role === 'ADMIN') {
      esVisible = (subClean === 'sin_asignar' || subClean === '');
    } else if (user.role === 'USER') {
      esVisible = (subClean === targetSubdireccion);
    }

    if (esVisible) {
      const respKey = qId + '_' + subAsignada;
      const respObj = respuestasMap[respKey] || {
        respuesta: '',
        evidenciaTextual: '',
        evidenciaDocumental: [],
        observaciones: '',
        nivelRiesgo: '',
        estadoRevision: 'Borrador',
        observacionAdmin: ''
      };

      const estRev = respObj.estadoRevision || 'Borrador';
      const esEditable = (estRev === 'Borrador' || estRev === 'Observada');

      result.push({
        id: qId,
        componente: qInfo.componente,
        principio: qInfo.principio,
        pregunta: qInfo.pregunta,
        fundamentoLegal: qInfo.fundamentoLegal,
        subdireccionSugerida: qInfo.subdireccionSugerida,
        loteId: qInfo.loteId,
        subdireccionAsignada: subAsignada,
        respuestaData: respObj,
        esEditable: esEditable
      });
    }
  }

  return result;
}

function getRespuestasMap() {
  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < data.length; i++) {
    const qId = String(data[i][0]).trim();
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
        fechaUltimaModificacion: data[i][9] || '',
        estadoRevision: data[i][10] || 'Borrador',
        observacionAdmin: data[i][11] || ''
      };
    }
  }
  return map;
}

function enviarRespuestaIndividual(token, payload) {
  const user = assertAuthenticatedUser(token);
  const qId = String(payload.questionId).trim();
  if (!qId) throw new Error('ID de pregunta inválido.');

  const asignacionesMap = getAsignacionesMap();
  const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

  if (user.role === 'USER') {
    const userSub = cleanStr(user.subdireccion);
    if (cleanStr(subAsignada) !== userSub) {
      throw new Error('ACCESO DENEGADO (403): La pregunta No. ' + qId + ' no está asignada a su Subdirección.');
    }
  }

  const respuesta = payload.respuesta || '';
  const evidenciaTextual = payload.evidenciaTextual || '';
  const observaciones = payload.observaciones || '';
  const archivosNuevos = payload.archivosNuevos || [];

  if (!respuesta || respuesta.trim() === '') {
    throw new Error('Debe seleccionar una Respuesta (Sí, Parcial, No, No Aplica).');
  }

  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  let foundIndex = -1;
  let existingDocs = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === qId && cleanStr(data[i][1]) === cleanStr(subAsignada)) {
      foundIndex = i + 1;
      const currentEstado = data[i][10] || 'Borrador';
      if (user.role === 'USER' && (currentEstado === 'Enviada' || currentEstado === 'Aceptada')) {
        throw new Error('La pregunta ya se encuentra enviada o aceptada y no puede modificarse.');
      }
      try { existingDocs = JSON.parse(data[i][4]); } catch (e) { existingDocs = []; }
      if (!Array.isArray(existingDocs)) existingDocs = [];
      break;
    }
  }

  const tieneTextual = (evidenciaTextual && evidenciaTextual.trim() !== '');
  const tieneDocumental = (existingDocs.length > 0 || (Array.isArray(archivosNuevos) && archivosNuevos.length > 0));

  if (!tieneTextual && !tieneDocumental) {
    throw new Error('Debe proporcionar al menos una Evidencia Textual o adjuntar un archivo Documental.');
  }

  const createdDriveFiles = [];
  if (Array.isArray(archivosNuevos) && archivosNuevos.length > 0) {
    const folderSubName = (subAsignada === 'SIN_ASIGNAR' || subAsignada === '') ? 'ADMIN' : cleanFolderName(subAsignada);
    const rootFolder = getOrCreateDriveFolder(ROOT_DRIVE_FOLDER_NAME);
    const subFolder = getOrCreateSubFolder(rootFolder, folderSubName);
    const qFolder = getOrCreateSubFolder(subFolder, 'Pregunta_' + qId);

    try {
      archivosNuevos.forEach(fileObj => {
        if (!fileObj.base64Data) return;
        const bytes = Utilities.base64Decode(fileObj.base64Data);
        const fileName = fileObj.fileName || ('evidencia_' + qId);
        const mimeType = fileObj.mimeType || 'application/octet-stream';
        const blob = Utilities.newBlob(bytes, mimeType, fileName);

        if (blob.getBytes().length > 10 * 1024 * 1024) {
          throw new Error(`El archivo ${fileName} excede el límite máximo de 10 MB.`);
        }

        const driveFile = qFolder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        const fInfo = {
          id: driveFile.getId(),
          name: driveFile.getName(),
          url: driveFile.getUrl(),
          size: blob.getBytes().length,
          mimeType: driveFile.getMimeType(),
          uploadedBy: user.email,
          uploadedAt: new Date().toISOString()
        };
        createdDriveFiles.push(fInfo);
      });
    } catch (err) {
      createdDriveFiles.forEach(f => {
        try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {}
      });
      throw new Error('Error al procesar archivos de evidencia en Drive: ' + err.message);
    }
  }

  const allDocs = existingDocs.concat(createdDriveFiles);
  const nivelRiesgo = RIESGO_MAP[respuesta] || '';
  const now = new Date();

  if (foundIndex > 0) {
    sheet.getRange(foundIndex, 3, 1, 10).setValues([[
      respuesta,
      evidenciaTextual,
      JSON.stringify(allDocs),
      observaciones,
      nivelRiesgo,
      user.email,
      data[foundIndex - 1][8] || now,
      now,
      'Enviada',
      ''
    ]]);
    logAudit('RESPUESTA_ENVIAR_INDIVIDUAL', qId, data[foundIndex - 1][10], 'Enviada', user.email);
  } else {
    sheet.appendRow([
      qId,
      subAsignada,
      respuesta,
      evidenciaTextual,
      JSON.stringify(allDocs),
      observaciones,
      nivelRiesgo,
      user.email,
      now,
      now,
      'Enviada',
      ''
    ]);
    logAudit('RESPUESTA_ENVIAR_INDIVIDUAL', qId, null, 'Enviada', user.email);
  }

  return {
    success: true,
    nivelRiesgo: nivelRiesgo,
    estadoRevision: 'Enviada',
    allFiles: allDocs,
    message: 'Pregunta enviada correctamente para revisión.'
  };
}

function deleteEvidenceFile(token, qIdRaw, fileId) {
  const user = assertAuthenticatedUser(token);
  const qId = String(qIdRaw).trim();
  if (!qId || !fileId) throw new Error('Parámetros inválidos.');

  const asignacionesMap = getAsignacionesMap();
  const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

  if (user.role === 'USER') {
    const userSub = cleanStr(user.subdireccion);
    if (cleanStr(subAsignada) !== userSub) {
      throw new Error('ACCESO DENEGADO (403): No puede eliminar archivos de esta pregunta.');
    }
  }

  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
  } catch (e) {
    Logger.log('Archivo no encontrado en Drive o ya eliminado: ' + e.toString());
  }

  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();
  let updatedList = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === qId && cleanStr(data[i][1]) === cleanStr(subAsignada)) {
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

  logAudit('ARCHIVO_ELIMINAR', qId, fileId, null, user.email);

  return {
    success: true,
    allFiles: updatedList,
    message: 'Archivo eliminado.'
  };
}

// ==============================================================================
// CAMBIO 2: MÓDULO SEGUIMIENTO Y REVISIÓN — LECTURA DIRECTA DE LA PESTAÑA "RESPUESTAS"
// ==============================================================================

function getRespuestasSeguimientoAdmin(token, filtros) {
  assertAdmin(token);

  const rSheet = getSheetSafe(SHEETS.RESPUESTAS);
  const rData = rSheet.getDataRange().getValues();

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();

  const pMap = {};
  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]).trim();
    if (qId) {
      pMap[qId] = {
        componente: pData[i][1],
        principio: pData[i][2],
        pregunta: pData[i][3],
        fundamentoLegal: pData[i][4],
        subdireccionSugerida: pData[i][5] || '',
        loteId: String(pData[i][6] || 'LOTE_INICIAL').trim()
      };
    }
  }

  const fLote = cleanStr(filtros ? filtros.loteId : 'TODOS');
  const fSub = cleanStr(filtros ? filtros.subdireccion : 'TODAS');
  const fComp = cleanStr(filtros ? filtros.componente : 'TODOS');
  const fEstado = cleanStr(filtros ? filtros.estadoRevision : 'TODOS');

  const list = [];

  for (let i = 1; i < rData.length; i++) {
    const qId = String(rData[i][0]).trim();
    if (!qId) continue;

    const subAsignada = String(rData[i][1] || 'SIN_ASIGNAR').trim();
    const respVal = String(rData[i][2] || '').trim();
    const estRev = String(rData[i][10] || 'Borrador').trim();

    const qInfo = pMap[qId] || {
      componente: 'Sin Componente',
      principio: 'Sin Principio',
      pregunta: 'Pregunta ID ' + qId,
      fundamentoLegal: '',
      loteId: 'LOTE_INICIAL'
    };

    if (fLote && fLote !== 'todos' && cleanStr(qInfo.loteId) !== fLote) continue;
    if (fComp && fComp !== 'todos' && cleanStr(qInfo.componente) !== fComp) continue;

    if (fSub && fSub !== 'todas') {
      if (fSub === 'sin_asignar' && (cleanStr(subAsignada) !== 'sin_asignar' && cleanStr(subAsignada) !== '')) continue;
      if (fSub !== 'sin_asignar' && cleanStr(subAsignada) !== fSub) continue;
    }

    if (fEstado && fEstado !== 'todos' && cleanStr(estRev) !== fEstado) continue;

    let docs = [];
    try {
      if (rData[i][4]) {
        docs = JSON.parse(rData[i][4]);
        if (!Array.isArray(docs)) docs = [];
      }
    } catch (e) { docs = []; }

    list.push({
      id: qId,
      componente: qInfo.componente,
      principio: qInfo.principio,
      pregunta: qInfo.pregunta,
      fundamentoLegal: qInfo.fundamentoLegal,
      loteId: qInfo.loteId,
      subdireccionAsignada: subAsignada,
      respuesta: respVal,
      evidenciaTextual: rData[i][3] || '',
      evidenciaDocumental: docs,
      observaciones: rData[i][5] || '',
      nivelRiesgo: rData[i][6] || '',
      usuarioQueRespondio: rData[i][7] || '',
      fechaUltimaModificacion: rData[i][9] || '',
      estadoRevision: estRev,
      observacionAdmin: rData[i][11] || ''
    });
  }

  return list;
}

function revisarRespuestaAdmin(token, payload) {
  const admin = assertAdmin(token);
  const qId = String(payload.questionId).trim();
  const subAsignada = String(payload.subdireccion).trim();
  const nuevoEstado = payload.accion;
  const obsAdminText = payload.observacionAdmin ? payload.observacionAdmin.trim() : '';

  if (!qId || !subAsignada) throw new Error('Parámetros de pregunta inválidos.');
  if (nuevoEstado !== 'Aceptada' && nuevoEstado !== 'Observada') {
    throw new Error('Acción de revisión no válida.');
  }

  if (nuevoEstado === 'Observada' && !obsAdminText) {
    throw new Error('La observación del administrador es obligatoria al marcar como Observada.');
  }

  const sheet = getSheetSafe(SHEETS.RESPUESTAS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === qId && cleanStr(data[i][1]) === cleanStr(subAsignada)) {
      sheet.getRange(i + 1, 11).setValue(nuevoEstado);
      sheet.getRange(i + 1, 12).setValue(obsAdminText);
      sheet.getRange(i + 1, 10).setValue(new Date());

      logAudit('RESPUESTA_REVISAR_' + nuevoEstado.toUpperCase(), qId, data[i][10], { estado: nuevoEstado, obs: obsAdminText }, admin.email);

      return {
        success: true,
        message: `La respuesta fue marcada como "${nuevoEstado}" correctamente.`
      };
    }
  }
  throw new Error('No se encontró el registro de respuesta.');
}

// ==============================================================================
// GESTIÓN DE ARCHIVOS DRIVE DE SOPORTE
// ==============================================================================

function cleanFolderName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim();
}

function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder.createFolder(subFolderName);
}

// ==============================================================================
// INDICADORES Y DASHBOARD GLOBAL (ADMIN)
// ==============================================================================

function getDashboardIndicatorsAdmin(token, filtroLote) {
  assertAdmin(token);

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const targetLote = cleanStr(filtroLote);

  let totalPreguntas = 0;
  let totalRespondidasGlobal = 0;

  let unassignedTotal = 0;
  let unassignedRespondidas = 0;

  let countPendientesRevision = 0;
  let countObservadas = 0;
  let countAceptadas = 0;

  const subMap = {};
  const componenteMap = {};

  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]).trim();
    if (!qId) continue;

    const loteId = String(pData[i][6] || 'LOTE_INICIAL').trim();

    if (targetLote && targetLote !== 'todos' && cleanStr(loteId) !== targetLote) {
      continue;
    }

    totalPreguntas++;
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

      const estRev = resp.estadoRevision || 'Enviada';
      if (estRev === 'Enviada') countPendientesRevision++;
      else if (estRev === 'Observada') countObservadas++;
      else if (estRev === 'Aceptada') countAceptadas++;

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
      unassignedPendientes: unassignedPendientes,
      countPendientesRevision: countPendientesRevision,
      countObservadas: countObservadas,
      countAceptadas: countAceptadas
    },
    subdireccionesProgreso: subMap,
    componentesProgreso: componenteMap
  };
}

function getDetallePreguntasAdmin(token, filtroSubdireccion, filtroComponente, filtroLote) {
  assertAdmin(token);
  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const targetSub = cleanStr(filtroSubdireccion);
  const targetComp = cleanStr(filtroComponente);
  const targetLote = cleanStr(filtroLote);

  const list = [];

  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]).trim();
    if (!qId) continue;

    const comp = pData[i][1];
    const loteId = String(pData[i][6] || 'LOTE_INICIAL').trim();

    if (targetLote && targetLote !== 'todos' && cleanStr(loteId) !== targetLote) {
      continue;
    }

    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';

    if (targetSub && targetSub !== 'todas') {
      if (targetSub === 'sin_asignar' && (cleanStr(subAsignada) !== 'sin_asignar' && cleanStr(subAsignada) !== '')) continue;
      if (targetSub !== 'sin_asignar' && cleanStr(subAsignada) !== targetSub) continue;
    }

    if (targetComp && targetComp !== 'todos' && cleanStr(comp) !== targetComp) {
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
      loteId: loteId,
      subdireccionAsignada: subAsignada,
      respuesta: respObj ? respObj.respuesta : 'PENDIENTE',
      evidenciaTextual: respObj ? respObj.evidenciaTextual : '',
      evidenciaDocumental: respObj ? respObj.evidenciaDocumental : [],
      observaciones: respObj ? respObj.observaciones : '',
      nivelRiesgo: respObj ? respObj.nivelRiesgo : '',
      usuarioQueRespondio: respObj ? respObj.usuarioQueRespondio : '',
      fechaUltimaModificacion: respObj ? respObj.fechaUltimaModificacion : '',
      estadoRevision: respObj ? respObj.estadoRevision : 'Sin responder',
      observacionAdmin: respObj ? respObj.observacionAdmin : ''
    });
  }

  return list;
}

function exportarMatrizRespuestasSheet(token, filtroLote) {
  assertAdmin(token);

  const preguntasSheet = getSheetSafe(SHEETS.PREGUNTAS);
  const pData = preguntasSheet.getDataRange().getValues();
  const asignacionesMap = getAsignacionesMap();
  const respuestasMap = getRespuestasMap();

  const targetLote = cleanStr(filtroLote);

  const newSs = SpreadsheetApp.create('Control Machete - Matriz de Respuestas (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + ')');
  const sheet = newSs.getActiveSheet();

  const headers = [
    'No. ID',
    'Lote ID',
    'Componente',
    'Principio',
    'Pregunta',
    'Fundamento Legal / Normativo',
    'Subdirección Asignada',
    'Respuesta (Sí/Parcial/No/No Aplica)',
    'Nivel Riesgo Residual',
    'Estado Revisión Admin',
    'Observación Admin',
    'Evidencia Textual',
    'Archivos de Evidencia Documental (URLs)',
    'Observaciones Usuario',
    'Usuario Responsable',
    'Última Modificación'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4A148C').setFontColor('#FFFFFF');

  const rows = [];
  for (let i = 1; i < pData.length; i++) {
    const qId = String(pData[i][0]).trim();
    if (!qId) continue;

    const loteId = String(pData[i][6] || 'LOTE_INICIAL').trim();
    if (targetLote && targetLote !== 'todos' && cleanStr(loteId) !== targetLote) {
      continue;
    }

    const subAsignada = asignacionesMap[qId] || 'SIN_ASIGNAR';
    const respKey = qId + '_' + subAsignada;
    const resp = respuestasMap[respKey] || {};

    let driveUrls = '';
    if (resp.evidenciaDocumental && Array.isArray(resp.evidenciaDocumental)) {
      driveUrls = resp.evidenciaDocumental.map(f => f.name + ': ' + f.url).join(' | ');
    }

    rows.push([
      qId,
      loteId,
      pData[i][1],
      pData[i][2],
      pData[i][3],
      pData[i][4],
      subAsignada,
      resp.respuesta || 'SIN RESPONDER',
      resp.nivelRiesgo || '',
      resp.estadoRevision || 'Sin responder',
      resp.observacionAdmin || '',
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

  DriveApp.getFileById(newSs.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    url: newSs.getUrl(),
    name: newSs.getName()
  };
}

// ==============================================================================
// SEEDING
// ==============================================================================

function seedDatabase() {
  const ss = getSpreadsheet();
  initDatabaseStructure(ss);

  const lotesSheet = getSheetSafe(SHEETS.LOTES);
  lotesSheet.clear();
  initSheetHeader(lotesSheet, SHEETS.LOTES);
  lotesSheet.appendRow(['LOTE_INICIAL', 'Lote Inicial', 'Evaluación COSO 61 preguntas inicial', new Date(), 'SISTEMA', true]);

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
    q.subdireccionSugerida || '',
    'LOTE_INICIAL'
  ]);
  pSheet.getRange(2, 1, pRows.length, 7).setValues(pRows);

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

  const asigSheet = getSheetSafe(SHEETS.ASIGNACIONES);
  asigSheet.clear();
  initSheetHeader(asigSheet, SHEETS.ASIGNACIONES);

  const now = new Date();
  const adminEmail = 'admin@merida.gob.mx';
  const asigRows = rawQuestions.map(q => [
    q.id,
    (q.subdireccionSugerida && q.subdireccionSugerida.trim()) ? q.subdireccionSugerida.trim() : 'SIN_ASIGNAR',
    adminEmail,
    now
  ]);
  asigSheet.getRange(2, 1, asigRows.length, 4).setValues(asigRows);

  const userSheet = getSheetSafe(SHEETS.USUARIOS);
  userSheet.clear();
  initSheetHeader(userSheet, SHEETS.USUARIOS);
  userSheet.appendRow([adminEmail, 'Administrador General', '', 'ADMIN', 'ACTIVO', hashPassword('admin123')]);

  return 'Base de datos de Control Machete sembrada e inicializada exitosamente con 61 preguntas COSO.';
}

function get61CosoQuestionsData() {
  return [
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
