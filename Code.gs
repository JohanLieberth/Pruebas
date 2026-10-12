/**
 * Control Machete - App de Control para Responder Auditorías
 * Main entry point, UI rendering, database initialization and setup helpers.
 */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
      .setTitle('Control Machete - Gestión de Auditorías')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Retrieves or establishes the target Spreadsheet database.
 */
function getSpreadsheet() {
  var sp = PropertiesService.getScriptProperties();
  var id = sp.getProperty('SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      console.warn('Could not open spreadsheet by script property ID: ' + id);
    }
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    sp.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }

  throw new Error('No hay una hoja de cálculo vinculada. Ejecute inicializarBD() o guarde SPREADSHEET_ID en Propiedades del Script.');
}

/**
 * Gets or creates a sheet by name defensively.
 */
function getSheetSafe(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Initializes database sheets and seeds default initial data.
 */
function inicializarBD() {
  var ss = getSpreadsheet();

  var schemas = {
    'Lotes': ['LoteID', 'NombreLote', 'Descripcion', 'Activo', 'FechaCreacion', 'CreadoPor'],
    'Preguntas': ['QuestionID', 'LoteID', 'No', 'Categoria', 'Subcategoria', 'Pregunta', 'FundamentoLegal', 'Activa', 'FechaCreacion', 'FechaModificacion'],
    'Subdirecciones': ['SubdireccionID', 'Nombre', 'Activa', 'FechaCreacion'],
    'Usuarios': ['UsuarioID', 'Email', 'Nombre', 'PasswordHash', 'Salt', 'Rol', 'SubdireccionID', 'Activo', 'FechaCreacion', 'FechaModificacion', 'CreadoPor'],
    'Asignaciones': ['AsignacionID', 'QuestionID', 'LoteID', 'SubdireccionID', 'Activa', 'FechaAsignacion', 'AsignadoPor'],
    'Respuestas': ['RespuestaID', 'QuestionID', 'SubdireccionID', 'UsuarioID', 'Respuesta', 'EvidenciaTextual', 'EvidenciaDocumental', 'Observaciones', 'NivelRiesgo', 'UsuarioQueRespondio', 'FechaCreacion', 'FechaUltimaModificacion', 'EstadoRevision', 'ObservacionAdmin', 'RevisadoPor', 'FechaRevision'],
    'Catalogos': ['Tipo', 'Valor', 'Activo'],
    'Logs': ['Fecha', 'Usuario', 'Accion', 'Detalle']
  };

  for (var sheetName in schemas) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(schemas[sheetName]);
      sheet.getRange(1, 1, 1, schemas[sheetName].length).setFontWeight('bold').setBackground('#2B3A42').setFontColor('#FFFFFF');
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(schemas[sheetName]);
      sheet.getRange(1, 1, 1, schemas[sheetName].length).setFontWeight('bold').setBackground('#2B3A42').setFontColor('#FFFFFF');
    }
  }

  // Seed Catalogos
  var catSheet = ss.getSheetByName('Catalogos');
  if (catSheet.getLastRow() <= 1) {
    var catalogosData = [
      ['Respuesta', 'Sí', true],
      ['Respuesta', 'Parcial', true],
      ['Respuesta', 'No', true],
      ['Respuesta', 'No Aplica', true],
      ['NivelRiesgo', 'Alto', true],
      ['NivelRiesgo', 'Medio', true],
      ['NivelRiesgo', 'Bajo', true],
      ['NivelRiesgo', 'No Aplica', true],
      ['EstadoRevision', 'Pendiente', true],
      ['EstadoRevision', 'Enviada', true],
      ['EstadoRevision', 'En revisión', true],
      ['EstadoRevision', 'Observada', true],
      ['EstadoRevision', 'Aceptada', true]
    ];
    catalogosData.forEach(function(row) {
      catSheet.appendRow(row);
    });
  }

  // Seed Subdirecciones
  var subSheet = ss.getSheetByName('Subdirecciones');
  if (subSheet.getLastRow() <= 1) {
    var subdireccionesData = [
      ['SUB-001', 'Subdirección de Administración y de Proveeduría', true, new Date().toISOString()],
      ['SUB-002', 'Subdirección de Servicios Internos', true, new Date().toISOString()],
      ['SUB-003', 'Subdirección de Recursos Humanos', true, new Date().toISOString()],
      ['SUB-004', 'Subdirección de Mejora Regulatoria', true, new Date().toISOString()],
      ['SUB-005', 'Subdirección de Patrimonio Municipal', true, new Date().toISOString()],
      ['SUB-006', 'Subdirección de Ventanilla Única', true, new Date().toISOString()],
      ['SUB-007', 'Subdirección de Servicios Internos // Comité de Ética', true, new Date().toISOString()],
      ['SUB-008', 'Subdirección de Mejora Regulatoria // Calidad y Mejora Continua', true, new Date().toISOString()]
    ];
    subdireccionesData.forEach(function(row) {
      subSheet.appendRow(row);
    });
  }

  // Seed Default Admin User
  var userSheet = ss.getSheetByName('Usuarios');
  if (userSheet.getLastRow() <= 1) {
    var adminEmail = 'admin@machete.gob.mx';
    var adminSalt = Utilities.getUuid();
    var adminHash = hashPasswordWithSalt('Admin123456!', adminSalt);

    userSheet.appendRow([
      'USR-001',
      adminEmail,
      'Administrador del Sistema',
      adminHash,
      adminSalt,
      'administrador',
      '',
      true,
      new Date().toISOString(),
      new Date().toISOString(),
      'Sistema'
    ]);
  }

  // Seed Default Lote & Sample Preguntas if empty
  var loteSheet = ss.getSheetByName('Lotes');
  if (loteSheet.getLastRow() <= 1) {
    var loteID = 'LOTE-001';
    loteSheet.appendRow([
      loteID,
      'Auditoría Control Interno 2025',
      'Lote inicial de preguntas de auditoría interna basadas en Excel Control Machete',
      true,
      new Date().toISOString(),
      'admin@machete.gob.mx'
    ]);

    var pregSheet = ss.getSheetByName('Preguntas');
    var sampleQuestions = [
      ['LOTE-001-001', loteID, 1, 'Ambiente de Control', 'Normas de Conducta', '¿La dependencia cuenta con un Código de Ética formalmente difundido y firmado por el personal?', 'Ley de Responsabilidades Administrativas Art. 7', true, new Date().toISOString(), new Date().toISOString()],
      ['LOTE-001-002', loteID, 2, 'Administración de Riesgos', 'Evaluación de Riesgos', '¿Se cuenta con una matriz de riesgos actualizada para el ejercicio fiscal vigente?', 'Lineamientos de Control Interno Art. 12', true, new Date().toISOString(), new Date().toISOString()],
      ['LOTE-001-003', loteID, 3, 'Actividades de Control', 'Políticas y Procedimientos', '¿Los manuales de organización y procedimientos se encuentran actualizados y autorizados?', 'Reglamento de la Administración Pública Municipal Art. 25', true, new Date().toISOString(), new Date().toISOString()]
    ];
    sampleQuestions.forEach(function(q) {
      pregSheet.appendRow(q);
    });

    var asigSheet = ss.getSheetByName('Asignaciones');
    asigSheet.appendRow(['ASIG-001', 'LOTE-001-001', loteID, 'SUB-001', true, new Date().toISOString(), 'admin@machete.gob.mx']);
    asigSheet.appendRow(['ASIG-002', 'LOTE-001-002', loteID, 'SUB-002', true, new Date().toISOString(), 'admin@machete.gob.mx']);
    asigSheet.appendRow(['ASIG-003', 'LOTE-001-003', loteID, 'SUB-003', true, new Date().toISOString(), 'admin@machete.gob.mx']);
  }

  logAccion('Sistema', 'Inicialización', 'Base de datos inicializada correctamente');
  return { success: true, message: 'Base de datos e inicialización completadas con éxito.' };
}

/**
 * Reads full sheet rows as arrays of objects using headers as keys.
 */
function getSheetObjects(sheetName) {
  var sheet = getSheetSafe(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Skip completely empty rows
    if (row.join('').trim() === '') continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj._rowIndex = i + 1; // 1-based index in sheet
    result.push(obj);
  }
  return result;
}

/**
 * Appends a log entry to Logs sheet.
 */
function logAccion(usuario, accion, detalle) {
  try {
    var sheet = getSheetSafe('Logs');
    sheet.appendRow([new Date().toISOString(), usuario || 'Anonimo', accion, detalle]);
  } catch (e) {
    console.error('Error al registrar log: ' + e.message);
  }
}
