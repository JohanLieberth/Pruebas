/**
 * Code.gs - Router principal de vistas, inclusión de plantillas y función setup() de inicialización
 */

/**
 * Manejador principal HTTP GET de la Web App
 */
function doGet(e) {
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
 * Esquema completo de la base de datos Google Sheets
 */
var ESQUEMA_HOJAS = {
  Config: ['CLAVE', 'VALOR', 'DESCRIPCION'],
  Usuarios: [
    'IDUsuario', 'TipoUsuario', 'NombreORazonSocial', 'Correo', 'Telefono',
    'PasswordHash', 'PasswordSalt', 'PuntosActuales', 'Activo', 'FechaRegistro',
    'UltimoAcceso', 'CorreoVerificado', 'Notas'
  ],
  ResponsablesSolidarios: [
    'IDResponsable', 'IDUsuario', 'Nombre', 'Telefono', 'Correo', 'Relacion', 'Activo', 'FechaRegistro'
  ],
  UsuariosAdmin: [
    'IDAdmin', 'Nombre', 'Correo', 'Telefono', 'PasswordHash', 'PasswordSalt', 'Rol', 'Activo', 'FechaCreacion', 'CreadoPor'
  ],
  OrdenesServicio: [
    'IDOrden', 'Folio', 'IDUsuario', 'TipoUsuario', 'NombreCliente', 'CorreoContacto',
    'TelefonoContacto', 'IDResponsable', 'EstadoOrden', 'Observaciones', 'TotalEstimado',
    'TotalCobrado', 'Saldo', 'FechaCreacion', 'FechaActualizacion', 'CreadoPor'
  ],
  Dispositivos: [
    'IDDispositivo', 'IDOrden', 'FolioOrden', 'TipoDispositivo', 'Marca', 'Modelo',
    'NumeroSerie', 'Color', 'Accesorios', 'FallaReportada', 'Diagnostico', 'Estatus',
    'IDTecnicoAsignado', 'TecnicoAsignado', 'CostoEstimado', 'CostoFinal', 'FechaRecepcion',
    'FechaHoraEstatus', 'FechaEntrega', 'EntregadoParcial', 'Observaciones'
  ],
  HistorialEstatus: [
    'IDHistorial', 'IDDispositivo', 'IDOrden', 'EstatusAnterior', 'EstatusNuevo',
    'Comentario', 'UsuarioCambio', 'RolUsuario', 'FechaHora'
  ],
  HistorialCostos: [
    'IDHistorialCosto', 'IDDispositivo', 'CostoAnterior', 'CostoNuevo',
    'Motivo', 'UsuarioCambio', 'FechaHora'
  ],
  PuntosMovimientos: [
    'IDMovimiento', 'IDUsuario', 'Correo', 'Telefono', 'TipoMovimiento', 'Puntos',
    'SaldoAnterior', 'SaldoNuevo', 'Motivo', 'IDOrden', 'IDDispositivo', 'UsuarioAdmin', 'FechaHora'
  ],
  RecompensasPuntos: [
    'IDRecompensa', 'Nombre', 'PuntosRequeridos', 'Descripcion', 'Activo', 'Orden'
  ],
  EtiquetasNFC: [
    'IDNFC', 'CodigoNFC', 'IDUsuario', 'Activo', 'FechaAsignacion', 'AsignadoPor'
  ],
  CorreosLog: [
    'IDCorreo', 'Destinatario', 'Asunto', 'Estado', 'FechaHora', 'Error'
  ],
  Logs: [
    'IDLog', 'Accion', 'Detalle', 'Usuario', 'FechaHora'
  ]
};

/**
 * Función SETUP obligatoria:
 * Construye todas las pestañas y encabezados si no existen.
 * Siembra el catálogo de recompensas de puntos y el administrador principal usando ScriptProperties.
 * Si no se encuentra SHEET_ID en ScriptProperties, toma el contenedor activo si está vinculado.
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

  Logger.log('Iniciando inicialización de base de datos en Spreadsheet: ' + ss.getName() + ' (' + ss.getId() + ')');

  // 1. Crear cada hoja y sus encabezados si no existen
  for (var nombreHoja in ESQUEMA_HOJAS) {
    if (ESQUEMA_HOJAS.hasOwnProperty(nombreHoja)) {
      var cols = ESQUEMA_HOJAS[nombreHoja];
      var sheet = ss.getSheetByName(nombreHoja);
      if (!sheet) {
        sheet = ss.insertSheet(nombreHoja);
        Logger.log('Pestaña creada: ' + nombreHoja);
      }

      // Validar fila de encabezados
      var lastCol = sheet.getLastColumn();
      if (sheet.getLastRow() === 0 || lastCol === 0) {
        sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
        sheet.getRange(1, 1, 1, cols.length)
          .setBackground('#4338ca')
          .setFontColor('#ffffff')
          .setFontWeight('bold');
        sheet.setFrozenRows(1);
      } else {
        // Verificar si faltan columnas y añadirlas
        var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return String(h).trim();
        });
        for (var c = 0; c < cols.length; c++) {
          if (existingHeaders.indexOf(cols[c]) === -1) {
            var newColIdx = sheet.getLastColumn() + 1;
            sheet.getRange(1, newColIdx).setValue(cols[c]);
          }
        }
      }
    }
  }

  // Eliminar la 'Hoja 1' o 'Sheet1' por defecto si está vacía
  var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() <= 1 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (ignore) {}
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
