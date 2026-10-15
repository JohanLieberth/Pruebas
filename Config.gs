/**
 * Config.gs - Configuración general, constantes y creación de estructura de base de datos.
 */

var SHEETS = {
  PROYECTOS: 'Proyectos',
  MINUTAS: 'Minutas',
  ASISTENCIA: 'Asistencia',
  ORDEN_DEL_DIA: 'OrdenDelDia',
  ACUERDOS: 'Acuerdos',
  USUARIOS: 'Usuarios',
  CATALOGOS: 'Catálogos',
  LOG_NOTIFICACIONES: 'Log_Notificaciones',
  COMENTARIOS: 'Comentarios_Seguimiento'
};

var HEADERS = {
  PROYECTOS: ['ID_Proyecto', 'Nombre_Proyecto', 'Descripción', 'Estatus', 'Fecha_Creación', 'Creado_Por'],
  MINUTAS: ['Folio', 'ID_Proyecto', 'Etapa', 'Dependencia', 'Subdirección', 'Nombre_Reunión', 'Fecha', 'Lugar', 'Objetivos', 'Creado_Por', 'Fecha_Creación'],
  ASISTENCIA: ['ID_Asistencia', 'Folio_Minuta', 'Nombre', 'Dependencia_Area', 'Cargo'],
  ORDEN_DEL_DIA: ['ID_Punto', 'Folio_Minuta', 'Número_Punto', 'Descripción_Punto'],
  ACUERDOS: ['ID_Acuerdo', 'Folio_Minuta', 'Tipo', 'Descripción_Acuerdo', 'Prioridad', 'Solicitantes', 'Responsables', 'Fecha_Límite', 'Subdirección_Asignada', 'Estatus', 'Origen', 'Creado_Por', 'Fecha_Creación', 'Fecha_Modificación'],
  USUARIOS: ['Correo', 'Nombre', 'Rol', 'Subdirección', 'Activo'],
  CATALOGOS: ['Tipo', 'Valor'],
  LOG_NOTIFICACIONES: ['ID_Log', 'ID_Acuerdo', 'Correo_Destino', 'Asunto', 'Fecha_Envío', 'Estatus_Envío'],
  COMENTARIOS: ['ID_Comentario', 'ID_Acuerdo', 'Usuario', 'Fecha_Hora', 'Comentario']
};

/**
 * Obtiene la hoja de cálculo activa.
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Obtiene una pestaña de forma segura. Si no existe, la crea con sus encabezados.
 */
function getSheetSafe(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (HEADERS[sheetName.toUpperCase()]) {
      sheet.appendRow(HEADERS[sheetName.toUpperCase()]);
      sheet.getRange(1, 1, 1, HEADERS[sheetName.toUpperCase()].length).setFontWeight("bold").setBackground("#E8EAF6");
    }
  }
  return sheet;
}

/**
 * Inicializa toda la estructura de la base de datos en Google Sheets.
 */
function inicializarEstructuraBD() {
  var ss = getSpreadsheet();
  var logMessages = [];

  // Crear u obtener cada hoja con sus encabezados
  Object.keys(SHEETS).forEach(function(key) {
    var sheetName = SHEETS[key];
    var sheet = ss.getSheetByName(sheetName);
    var expectedHeaders = HEADERS[key];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      if (expectedHeaders && expectedHeaders.length > 0) {
        sheet.appendRow(expectedHeaders);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#1A237E").setFontColor("#FFFFFF");
      }
      logMessages.push("Pestaña creada: " + sheetName);
    } else {
      if (!expectedHeaders || expectedHeaders.length === 0) return;

      if (sheet.getLastRow() === 0) {
        sheet.appendRow(expectedHeaders);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#1A237E").setFontColor("#FFFFFF");
        logMessages.push("Encabezados agregados a pestaña vacía: " + sheetName);
      } else {
        // Verificar encabezados existentes en la fila 1 y agregar columnas faltantes al final
        var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
          return h.toString().trim();
        });

        var missingHeaders = expectedHeaders.filter(function(h) {
          return existingHeaders.indexOf(h) === -1;
        });

        if (missingHeaders.length > 0) {
          var startCol = sheet.getLastColumn() + 1;
          var newHeaderRange = sheet.getRange(1, startCol, 1, missingHeaders.length);
          newHeaderRange.setValues([missingHeaders]);
          newHeaderRange.setFontWeight("bold").setBackground("#1A237E").setFontColor("#FFFFFF");
          logMessages.push("Columnas agregadas a " + sheetName + ": " + missingHeaders.join(", "));
        } else {
          logMessages.push("Pestaña verificada (completa): " + sheetName);
        }
      }
    }
  });

  // Garantizar usuario administrador inicial si la hoja Usuarios está vacía
  garantizarUsuarioAdminInicial();

  // Poblar catálogos por defecto si están vacíos
  poblarCatalogosIniciales();

  return {
    exito: true,
    mensaje: "Estructura de base de datos verificada/inicializada con éxito.\n" + logMessages.join("\n")
  };
}

/**
 * Asegura la existencia de al menos un usuario Administrador inicial.
 */
function garantizarUsuarioAdminInicial() {
  var sheet = getSheetSafe(SHEETS.USUARIOS);
  var data = sheet.getDataRange().getValues();
  var activeUserEmail = Session.getActiveUser().getEmail() || "admin@midominio.com";

  if (data.length <= 1) { // Solo encabezados
    sheet.appendRow([
      activeUserEmail.toLowerCase().trim(),
      "Administrador Sistema",
      "Administrador",
      "Dirección General",
      "Sí"
    ]);
  }
}

/**
 * Poblar catálogo base si no existen registros.
 */
function poblarCatalogosIniciales() {
  var sheet = getSheetSafe(SHEETS.CATALOGOS);
  if (sheet.getLastRow() <= 1) {
    var catalogosBase = [
      ["Dependencia", "Dirección de Tecnologías"],
      ["Dependencia", "Dirección de Gobernación"],
      ["Dependencia", "Dirección de Obras Públicas"],
      ["Dependencia", "Dirección de Servicios Públicos"],
      ["Subdirección", "Subdirección de Innovación"],
      ["Subdirección", "Subdirección de Infraestructura"],
      ["Subdirección", "Subdirección de Operación"],
      ["Etapa", "Planeación"],
      ["Etapa", "Ejecución"],
      ["Etapa", "Seguimiento"],
      ["Etapa", "Cierre"],
      ["Prioridad", "Alta"],
      ["Prioridad", "Media"],
      ["Prioridad", "Baja"],
      ["Estatus", "Pendiente"],
      ["Estatus", "En Proceso"],
      ["Estatus", "Cumplido"],
      ["Estatus", "Cancelado"]
    ];

    var range = sheet.getRange(2, 1, catalogosBase.length, 2);
    range.setValues(catalogosBase);
  }
}

/**
 * Genera un ID único para registros.
 */
function generarIDUnico(prefix) {
  var timestamp = new Date().getTime().toString(36).toUpperCase();
  var random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return (prefix || 'ID') + '-' + timestamp + '-' + random;
}

/**
 * Convierte una hoja a una lista de objetos JSON basándose en los encabezados de la fila 1.
 */
function sheetToObjects(sheetName) {
  var sheet = getSheetSafe(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var rows = data.slice(1);

  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, idx) {
      var val = row[idx];
      if (val instanceof Date) {
        obj[header] = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      } else {
        obj[header] = val !== undefined && val !== null ? val.toString() : "";
      }
    });
    return obj;
  });
}
