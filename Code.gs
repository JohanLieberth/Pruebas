/**
 * Code.gs - Router principal de vistas, inclusión de plantillas, ensureSchema() y función setup()
 */

/**
 * Manejador principal HTTP GET de la Web App
 */
function doGet(e) {
  // Asegura el esquema de la base de datos al arrancar de forma controlada (cacheada)
  try {
    ensureSchemaOnStartup();
  } catch (errSchema) {
    Logger.log('Advertencia en ensureSchemaOnStartup: ' + errSchema.message);
  }

  var page = (e && e.parameter && e.parameter.p) ? e.parameter.p.toLowerCase() : 'index';
  var templateName = 'index';

  switch (page) {
    case 'consulta':
    case 'consulta-publica':
      templateName = 'consulta-publica';
      break;
    case 'login':
    case 'login-usuario':
      templateName = 'login-usuario';
      break;
    case 'registro':
    case 'registro-usuario':
      templateName = 'registro-usuario';
      break;
    case 'portal-usuario':
    case 'usuario':
      templateName = 'portal-usuario';
      break;
    case 'login-admin':
    case 'admin-login':
      templateName = 'login-admin';
      break;
    case 'admin':
    case 'portal-admin':
      templateName = 'portal-admin';
      break;
    case 'tecnico':
    case 'portal-tecnico':
      templateName = 'portal-tecnico';
      break;
    default:
      templateName = 'index';
      break;
  }

  var template = HtmlService.createTemplateFromFile(templateName);
  template.pageParam = page;
  template.appName = CONFIG.APP_NAME;

  return template.evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Trigger al abrir el archivo contenedor de Google Sheets (si está vinculado)
 */
function onOpen(e) {
  try {
    ensureSchema();
  } catch (err) {
    Logger.log('Error en onOpen ejecutando ensureSchema: ' + err.message);
  }
}

/**
 * Verificación en arranque invocada por doGet de forma controlada.
 * Utiliza CacheService/PropertiesService para evitar correr ensureSchema en cada petición.
 */
function ensureSchemaOnStartup() {
  var cache = CacheService.getScriptCache();
  var cachedFlag = null;
  try {
    cachedFlag = cache.get(CONFIG.SCHEMA_CACHE_KEY);
  } catch (ignore) {}

  if (!cachedFlag) {
    var resultado = ensureSchema();
    if (resultado && resultado.success) {
      try {
        cache.put(CONFIG.SCHEMA_CACHE_KEY, 'VERIFIED_' + (new Date().getTime()), CONFIG.SCHEMA_CACHE_TTL_SECONDS);
      } catch (ignoreCache) {}
    }
  }
}

/**
 * Alias global para retrocompatibilidad
 */
var ESQUEMA_HOJAS = CONFIG.SCHEMA;

/**
 * Función idempotente que garantiza que el Spreadsheet tenga todas las pestañas y columnas requeridas.
 * - Abre el Spreadsheet usando ScriptProperties.SHEET_ID sin hardcodear.
 * - Recorre SCHEMA central.
 * - Si falta alguna pestaña, la crea con encabezado estilizado y frozen row.
 * - Si la pestaña existe, agrega únicamente las columnas faltantes al final del encabezado sin alterar datos ni reordenar.
 * - Formatea únicamente las columnas nuevas.
 * - Protegida con LockService para evitar condiciones de carrera.
 * - No borra ni altera datos existentes.
 */
function ensureSchema() {
  return Utils.withScriptLock(function() {
    var ss = null;
    try {
      ss = getDbSpreadsheet();
    } catch (e) {
      var msg = 'ensureSchema(): No se pudo conectar al Spreadsheet con ScriptProperties.SHEET_ID: ' + e.message;
      Logger.log(msg);
      try {
        Utils.logAction('ERROR_ENSURE_SCHEMA', msg, 'Sistema');
      } catch (ignoreLog) {}
      return { success: false, error: msg };
    }

    var esquema = CONFIG.SCHEMA;
    var cambiosRealizados = {
      pestañasCreadas: [],
      columnasAgregadas: {}
    };

    for (var nombreHoja in esquema) {
      if (esquema.hasOwnProperty(nombreHoja)) {
        var columnasRequeridas = esquema[nombreHoja];
        var sheet = ss.getSheetByName(nombreHoja);

        if (!sheet) {
          // 1. La pestaña no existe: crearla completa con sus encabezados
          sheet = ss.insertSheet(nombreHoja);
          sheet.getRange(1, 1, 1, columnasRequeridas.length).setValues([columnasRequeridas]);
          sheet.getRange(1, 1, 1, columnasRequeridas.length)
            .setBackground('#4338ca')
            .setFontColor('#ffffff')
            .setFontWeight('bold');
          sheet.setFrozenRows(1);
          cambiosRealizados.pestañasCreadas.push(nombreHoja);
          Logger.log('ensureSchema: Pestaña creada -> ' + nombreHoja);
        } else {
          // 2. La pestaña existe: auditar columnas existentes en la fila 1
          var lastCol = sheet.getLastColumn();
          var existingHeaders = [];

          if (lastCol > 0 && sheet.getLastRow() > 0) {
            existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
              return String(h).trim();
            });
          }

          var columnasFaltantes = [];
          for (var c = 0; c < columnasRequeridas.length; c++) {
            var colName = columnasRequeridas[c];
            if (existingHeaders.indexOf(colName) === -1) {
              columnasFaltantes.push(colName);
            }
          }

          // Si hay columnas faltantes, agregarlas estrictamente al final
          if (columnasFaltantes.length > 0) {
            var startCol = lastCol + 1;
            // Si la hoja estaba totalmente en blanco
            if (lastCol === 0) {
              sheet.getRange(1, 1, 1, columnasFaltantes.length).setValues([columnasFaltantes]);
              sheet.getRange(1, 1, 1, columnasFaltantes.length)
                .setBackground('#4338ca')
                .setFontColor('#ffffff')
                .setFontWeight('bold');
              sheet.setFrozenRows(1);
            } else {
              // Agregar al final respetando columnas existentes y datos
              sheet.getRange(1, startCol, 1, columnasFaltantes.length).setValues([columnasFaltantes]);
              sheet.getRange(1, startCol, 1, columnasFaltantes.length)
                .setBackground('#4338ca')
                .setFontColor('#ffffff')
                .setFontWeight('bold');
            }

            cambiosRealizados.columnasAgregadas[nombreHoja] = columnasFaltantes;
            Logger.log('ensureSchema: Columnas agregadas a ' + nombreHoja + ' -> ' + columnasFaltantes.join(', '));
          }
        }
      }
    }

    // Limpieza de pestaña por defecto vacía si hay otras hojas creadas
    var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (defaultSheet && defaultSheet.getLastRow() <= 1 && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(defaultSheet);
      } catch (ignore) {}
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      spreadsheetId: ss.getId(),
      cambios: cambiosRealizados,
      message: 'Esquema verificado e inicializado correctamente.'
    };
  });
}

/**
 * Función auxiliar para incluir archivos HTML dentro de otros (CSS, JS compartidos, componentes)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Retorna la URL pública de la Web App actual para redirecciones y navegación
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Función SETUP obligatoria:
 * Invoca ensureSchema() para garantizar todas las pestañas y encabezados sin duplicar lógica.
 * Siembra el catálogo de recompensas de puntos y el administrador principal usando ScriptProperties.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty(CONFIG.PROP_SHEET_ID);
  var ss = null;

  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      Logger.log('No se pudo abrir por SHEET_ID: ' + e.message);
    }
  }

  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        props.setProperty(CONFIG.PROP_SHEET_ID, ss.getId());
      }
    } catch (e2) {}
  }

  if (!ss) {
    throw new Error('Error en setup(): Debes configurar la propiedad "SHEET_ID" en ScriptProperties con el ID de tu Google Sheet antes de ejecutar setup().');
  }

  Logger.log('Iniciando setup() en Spreadsheet: ' + ss.getName() + ' (' + ss.getId() + ')');

  // 1. Garantizar todas las pestañas y columnas consumiendo la fuente de verdad central
  var schemaResult = ensureSchema();
  if (!schemaResult.success) {
    throw new Error('Fallo al asegurar el esquema: ' + schemaResult.error);
  }

  // 2. Poblar configuración general si está vacía
  var configSheet = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
  if (configSheet && configSheet.getLastRow() <= 1) {
    var configDefaults = [
      ['APP_NOMBRE', CONFIG.APP_NAME, 'Nombre del taller o aplicación'],
      ['PUNTOS_POR_PESO', '0.05', 'Equivalencia de puntos por cada peso pagado (5%)'],
      ['VERSION_BD', '1.0.0', 'Versión del esquema de base de datos'],
      ['MONEDA', 'MXN', 'Moneda de operación']
    ];
    for (var k = 0; k < configDefaults.length; k++) {
      configSheet.appendRow(configDefaults[k]);
    }
  }

  // 3. Poblar catálogo de recompensas de puntos si está vacío
  var recompSheet = ss.getSheetByName(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
  if (recompSheet && recompSheet.getLastRow() <= 1) {
    var recompensasIniciales = [
      ['REC-001', 'Limpieza profunda de control / mando', 500, 'Mantenimiento preventivo, desinfección y lubricación de palancas', 'SI', 1],
      ['REC-002', 'Reemplazo de palanca / Joystick Hall Effect', 1000, 'Cambio de mecanismo análogo por sensor magnético anti-drift', 'SI', 2],
      ['REC-003', 'Reparación menor / Conector HDMI / Botón', 1000, 'Reparación de puerto, switch de encendido o soldadura menor', 'SI', 3],
      ['REC-004', 'Mantenimiento preventivo de consola', 2000, 'Cambio de pasta térmica de alta conductividad, metal líquido y limpieza de disipador', 'SI', 4],
      ['REC-005', 'Reballing / Reparación de circuito de carga', 3500, 'Reparación especializada de IC de administración de energía o chip de video', 'SI', 5]
    ];
    for (var r = 0; r < recompensasIniciales.length; r++) {
      recompSheet.appendRow(recompensasIniciales[r]);
    }
    Logger.log('Catálogo de recompensas inicial sembrado');
  }

  // 4. Sembrar Administrador Principal inicial usando ScriptProperties
  var adminEmail = props.getProperty(CONFIG.PROP_ADMIN_EMAIL) || 'admin@pixelfix.com';
  var adminNombre = props.getProperty(CONFIG.PROP_ADMIN_NOMBRE) || 'Administrador Principal';
  var adminPass = props.getProperty(CONFIG.PROP_ADMIN_PASSWORD) || 'Admin123!';

  var adminSheet = ss.getSheetByName(CONFIG.SHEETS.USUARIOS_ADMIN);
  var adminData = adminSheet.getDataRange().getValues();
  var adminExiste = false;

  for (var a = 1; a < adminData.length; a++) {
    if (String(adminData[a][2] || '').trim().toLowerCase() === adminEmail.trim().toLowerCase()) {
      adminExiste = true;
      break;
    }
  }

  if (!adminExiste) {
    var salt = Utils.generateSalt(16);
    var hash = Utils.hashPassword(adminPass, salt);
    var idAdmin = Utils.generateId('ADM');

    adminSheet.appendRow([
      idAdmin,
      adminNombre,
      adminEmail.trim().toLowerCase(),
      '5512345678',
      hash,
      salt,
      CONFIG.ROLES.ADMINISTRADOR,
      'SI',
      Utils.formatDateTime(),
      'SetupInicial'
    ]);

    Logger.log('Administrador sembrado con éxito: ' + adminEmail + ' (Contraseña inicial: ' + adminPass + ')');
  }

  // Marcar flag de verificación en cache para evitar re-verificación inmediata en el primer request
  try {
    var cache = CacheService.getScriptCache();
    cache.put(CONFIG.SCHEMA_CACHE_KEY, 'VERIFIED_' + (new Date().getTime()), CONFIG.SCHEMA_CACHE_TTL_SECONDS);
  } catch (ignoreCache) {}

  Logger.log('Setup completado exitosamente.');
  return {
    success: true,
    sheetId: ss.getId(),
    sheetName: ss.getName(),
    adminEmail: adminEmail,
    adminPasswordInicial: adminPass,
    message: 'Base de datos PixelFix inicializada correctamente con todas sus pestañas, catálogos y administrador.'
  };
}
