/**
 * Code.gs - Router principal de vistas, inclusión de plantillas, ensureSchema() y función setup()
 */

/**
 * Fuente única de verdad para el mapeo ruta -> nombre de plantilla HTML
 */
var PAGES = {
  'index': 'index',
  'inicio': 'index',
  'home': 'index',
  'consulta': 'consulta-publica',
  'consulta-publica': 'consulta-publica',
  'consultapublica': 'consulta-publica',
  'login': 'login-usuario',
  'login-usuario': 'login-usuario',
  'loginusuario': 'login-usuario',
  'registro': 'registro-usuario',
  'registro-usuario': 'registro-usuario',
  'registrousuario': 'registro-usuario',
  'portal-usuario': 'portal-usuario',
  'usuario': 'portal-usuario',
  'portalusuario': 'portal-usuario',
  'login-admin': 'login-admin',
  'admin-login': 'login-admin',
  'loginadmin': 'login-admin',
  'adminlogin': 'login-admin',
  'admin': 'portal-admin',
  'portal-admin': 'portal-admin',
  'portaladmin': 'portal-admin',
  'tecnico': 'portal-tecnico',
  'portal-tecnico': 'portal-tecnico',
  'portaltecnico': 'portal-tecnico'
};

/**
 * Manejador principal HTTP GET de la Web App
 */
function doGet(e) {
  try {
    // Asegura el esquema de la base de datos al arrancar de forma controlada (cacheada)
    try {
      ensureSchemaOnStartup();
    } catch (errSchema) {
      Logger.log('Advertencia en ensureSchemaOnStartup: ' + errSchema.message);
    }

    // Aceptar tanto 'p' como 'page' de forma flexible
    var rawParam = (e && e.parameter) ? (e.parameter.p || e.parameter.page || 'index') : 'index';
    var requestedPage = String(rawParam).trim().toLowerCase();
    var templateName = PAGES[requestedPage];

    // Fallback controlado: si la ruta no existe, renderizar siempre la página de inicio
    if (!templateName) {
      Logger.log('Ruta no reconocida: "' + requestedPage + '". Fallback a vista index.');
      templateName = 'index';
    }

    // Obtener la URL del servicio Web App de forma segura
    var scriptUrl = '';
    try {
      scriptUrl = ScriptApp.getService().getUrl() || '';
    } catch (ignoreUrl) {
      scriptUrl = '';
    }

    var template = HtmlService.createTemplateFromFile(templateName);
    template.pageParam = requestedPage;
    template.appName = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.APP_NAME) ? CONFIG.APP_NAME : 'PixelFix';
    template.scriptUrl = scriptUrl;

    return template.evaluate()
      .setTitle(template.appName)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (fatalError) {
    Logger.log('Error crítico en doGet: ' + fatalError.message + '\n' + (fatalError.stack || ''));
    // Fallback controlado para que NUNCA quede una pantalla en blanco
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><base target="_top"><meta charset="UTF-8"><title>PixelFix - Estado</title>' +
      '<style>body{font-family:sans-serif;padding:2rem;text-align:center;background:#f8fafc;color:#1e293b;}' +
      '.box{max-width:520px;margin:3rem auto;background:#fff;padding:2rem;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 4px 6px rgba(0,0,0,0.05);}' +
      'a{display:inline-block;margin-top:1.25rem;padding:0.6rem 1.25rem;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;}' +
      '</style></head><body><div class="box"><h2>🎮 PixelFix - Taller de Consolas</h2>' +
      '<p>La aplicación está iniciando o actualizando sus componentes.</p>' +
      '<a href="?p=index">Ir a Inicio</a></div></body></html>'
    ).setTitle('PixelFix');
  }
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
  var cacheKey = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SCHEMA_CACHE_KEY) ? CONFIG.SCHEMA_CACHE_KEY : 'SCHEMA_VERIFIED_FLAG';
  var cacheTtl = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SCHEMA_CACHE_TTL_SECONDS) ? CONFIG.SCHEMA_CACHE_TTL_SECONDS : 21600;

  try {
    cachedFlag = cache.get(cacheKey);
  } catch (ignore) {}

  if (!cachedFlag) {
    var resultado = ensureSchema();
    if (resultado && resultado.success) {
      try {
        cache.put(cacheKey, 'VERIFIED_' + (new Date().getTime()), cacheTtl);
      } catch (ignoreCache) {}
    }
  }
}

/**
 * Helper seguro para resolver el esquema central sin depender de la secuencia de carga de archivos
 */
function getEsquemaHojas() {
  if (typeof getSchema === 'function') {
    return getSchema();
  }
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SCHEMA) {
    return CONFIG.SCHEMA;
  }
  if (typeof SCHEMA !== 'undefined' && SCHEMA) {
    return SCHEMA;
  }
  throw new Error('No se pudo resolver el esquema central.');
}

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

    var esquema = getEsquemaHojas();
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

    // Garantizar existencia del administrador principal inicial de forma idempotente
    try {
      if (typeof Auth !== 'undefined' && typeof Auth.ensureInitialAdmin === 'function') {
        Auth.ensureInitialAdmin();
      }
    } catch (errAdmin) {
      Logger.log('ensureSchema: Advertencia asegurando admin inicial: ' + errAdmin.message);
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
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return '?p=index';
  }
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

  // 4. Sembrar Administrador Principal inicial usando ScriptProperties y Auth.ensureInitialAdmin()
  var adminEmail = props.getProperty(CONFIG.PROP_ADMIN_EMAIL) || 'sakurazukamori21@gmail.com';
  var adminNombre = props.getProperty(CONFIG.PROP_ADMIN_NOMBRE) || 'Administrador Principal';
  var adminPass = props.getProperty(CONFIG.PROP_ADMIN_PASSWORD) || 'Monster123';

  if (typeof Auth !== 'undefined' && typeof Auth.ensureInitialAdmin === 'function') {
    Auth.ensureInitialAdmin();
  }

  // Si en ScriptProperties se configuró un correo adicional distinto a sakurazukamori21@gmail.com, sembrarlo también
  if (adminEmail.toLowerCase() !== 'sakurazukamori21@gmail.com') {
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
      Utils.appendRecord(CONFIG.SHEETS.USUARIOS_ADMIN, {
        IDAdmin: idAdmin,
        Nombre: adminNombre,
        Correo: adminEmail.trim().toLowerCase(),
        Telefono: '5512345678',
        PasswordHash: hash,
        PasswordSalt: salt,
        Rol: CONFIG.ROLES.ADMINISTRADOR,
        Activo: 'SI',
        FechaCreacion: Utils.formatDateTime(),
        CreadoPor: 'SetupInicial'
      });
      Logger.log('Administrador secundario sembrado: ' + adminEmail);
    }
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


/**
 * Obtiene la configuración pública (logo, videos del carrusel, textos)
 */
function apiObtenerConfiguracionPublica() {
  try {
    var vals = Utils.getAllConfigValues();
    var videos = [];
    try {
      if (vals.VIDEOS_CARRUSEL) {
        videos = JSON.parse(vals.VIDEOS_CARRUSEL);
      }
    } catch (e) {
      videos = [];
    }
    return Utils.responseSuccess({
      nombreTaller: vals.NOMBRE_TALLER || 'PixelFix - Taller de Consolas',
      logoUrl: vals.LOGO_URL || '',
      videosCarrusel: videos,
      leyendaTicket: vals.LEYENDA_TICKET || ''
    });
  } catch (err) {
    return Utils.responseError(err.message);
  }
}

/**
 * Obtiene la configuración completa para el panel administrador
 */
function apiObtenerConfiguracionAdmin(token) {
  try {
    var admin = Auth.requireAdmin(token);
    var vals = Utils.getAllConfigValues();
    var videos = [];
    try {
      if (vals.VIDEOS_CARRUSEL) {
        videos = JSON.parse(vals.VIDEOS_CARRUSEL);
      }
    } catch (e) {
      videos = [];
    }
    return Utils.responseSuccess({
      nombreTaller: vals.NOMBRE_TALLER || 'PixelFix - Taller de Consolas',
      logoUrl: vals.LOGO_URL || '',
      videosCarrusel: videos,
      leyendaTicket: vals.LEYENDA_TICKET || 'DISPOSITIVO CON AVISO DE RECOLECCIÓN, DESPUES DE 30 DIAS, NO NOS HACEMOS RESPONSABLES DEL EQUIPO. EQUIPO MOJADO O CON DAÑOS DE HUMEDAD NO TIENE GARANTIA. EN REPARACIONES LA GARANTIA ES DE 15 DIAS SOBRE LA PIEZA CAMBIADA, APLICA RESTRICCIONES. TRABAJO DE MANTENIMIENTO NO APLICA GARANTIA. PUEDE COMUNICARSE AL 9999693251 PARA INFORMACION DE LUNES A SABADO DE 10 AM A 7 PM.',
      mostrarLogoTicket: vals.MOSTRAR_LOGO_TICKET !== 'NO',
      mostrarClienteTicket: vals.MOSTRAR_CLIENTE_TICKET !== 'NO',
      mostrarTelefonoTicket: vals.MOSTRAR_TELEFONO_TICKET !== 'NO',
      mostrarResponsableTicket: vals.MOSTRAR_RESPONSABLE_TICKET !== 'NO',
      mostrarDispositivosTicket: vals.MOSTRAR_DISPOSITIVOS_TICKET !== 'NO',
      mostrarFallasTicket: vals.MOSTRAR_FALLAS_TICKET !== 'NO',
      mostrarDiagnosticoTicket: vals.MOSTRAR_DIAGNOSTICO_TICKET !== 'NO',
      mostrarCostosTicket: vals.MOSTRAR_COSTOS_TICKET !== 'NO'
    });
  } catch (err) {
    return Utils.responseError(err.message);
  }
}

/**
 * Guarda la configuración del taller desde el panel administrador
 */
function apiGuardarConfiguracionAdmin(token, config) {
  try {
    var admin = Auth.requireAdmin(token);
    if (!config || typeof config !== 'object') {
      return Utils.responseError('Parámetros de configuración inválidos');
    }

    if (config.nombreTaller !== undefined) {
      Utils.setConfigValue('NOMBRE_TALLER', config.nombreTaller, 'Nombre comercial del taller');
    }
    if (config.logoUrl !== undefined) {
      Utils.setConfigValue('LOGO_URL', config.logoUrl, 'URL o DataURI del logo del taller');
    }
    if (config.videosCarrusel !== undefined) {
      var strVideos = typeof config.videosCarrusel === 'string' ? config.videosCarrusel : JSON.stringify(config.videosCarrusel);
      Utils.setConfigValue('VIDEOS_CARRUSEL', strVideos, 'Lista de videos JSON para el carrusel de inicio');
    }
    if (config.leyendaTicket !== undefined) {
      Utils.setConfigValue('LEYENDA_TICKET', config.leyendaTicket, 'Texto legal y de garantía al pie del ticket térmico');
    }

    if (config.mostrarLogoTicket !== undefined) Utils.setConfigValue('MOSTRAR_LOGO_TICKET', config.mostrarLogoTicket ? 'SI' : 'NO', 'Mostrar logo en ticket');
    if (config.mostrarClienteTicket !== undefined) Utils.setConfigValue('MOSTRAR_CLIENTE_TICKET', config.mostrarClienteTicket ? 'SI' : 'NO', 'Mostrar cliente en ticket');
    if (config.mostrarTelefonoTicket !== undefined) Utils.setConfigValue('MOSTRAR_TELEFONO_TICKET', config.mostrarTelefonoTicket ? 'SI' : 'NO', 'Mostrar teléfono en ticket');
    if (config.mostrarResponsableTicket !== undefined) Utils.setConfigValue('MOSTRAR_RESPONSABLE_TICKET', config.mostrarResponsableTicket ? 'SI' : 'NO', 'Mostrar responsable en ticket');
    if (config.mostrarDispositivosTicket !== undefined) Utils.setConfigValue('MOSTRAR_DISPOSITIVOS_TICKET', config.mostrarDispositivosTicket ? 'SI' : 'NO', 'Mostrar dispositivos en ticket');
    if (config.mostrarFallasTicket !== undefined) Utils.setConfigValue('MOSTRAR_FALLAS_TICKET', config.mostrarFallasTicket ? 'SI' : 'NO', 'Mostrar fallas en ticket');
    if (config.mostrarDiagnosticoTicket !== undefined) Utils.setConfigValue('MOSTRAR_DIAGNOSTICO_TICKET', config.mostrarDiagnosticoTicket ? 'SI' : 'NO', 'Mostrar diagnóstico en ticket');
    if (config.mostrarCostosTicket !== undefined) Utils.setConfigValue('MOSTRAR_COSTOS_TICKET', config.mostrarCostosTicket ? 'SI' : 'NO', 'Mostrar costos en ticket');

    Utils.registrarLog('ACTUALIZAR_CONFIGURACION', 'Configuración del sistema actualizada por ' + admin.nombre, admin.nombre);
    return Utils.responseSuccess(null, 'Configuración actualizada con éxito');
  } catch (err) {
    return Utils.responseError(err.message);
  }
}
