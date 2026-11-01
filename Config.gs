/**
 * Config.gs - Configuración global y constantes del sistema
 * Taller de Reparación de Consolas de Videojuegos
 */

var CONFIG = {
  APP_NAME: 'PixelFix - Taller de Consolas de Videojuegos',
  VERSION: '1.0.0',
  SESSION_TIMEOUT_SECONDS: 21600, // 6 horas
  LOCK_TIMEOUT_MS: 30000, // 30 segundos
  SCHEMA_CACHE_KEY: 'SCHEMA_VERIFIED_FLAG',
  SCHEMA_CACHE_TTL_SECONDS: 21600, // 6 horas entre verificaciones en doGet

  // Propiedades de script esperadas
  PROP_SHEET_ID: 'SHEET_ID',
  PROP_ADMIN_EMAIL: 'ADMIN_EMAIL',
  PROP_ADMIN_NOMBRE: 'ADMIN_NOMBRE',
  PROP_ADMIN_PASSWORD: 'ADMIN_PASSWORD',

  // Nombres de hojas en Google Sheets
  SHEETS: {
    CONFIG: 'Config',
    USUARIOS: 'Usuarios',
    RESPONSABLES_SOLIDARIOS: 'ResponsablesSolidarios',
    USUARIOS_ADMIN: 'UsuariosAdmin',
    ORDENES_SERVICIO: 'OrdenesServicio',
    DISPOSITIVOS: 'Dispositivos',
    HISTORIAL_ESTATUS: 'HistorialEstatus',
    HISTORIAL_COSTOS: 'HistorialCostos',
    PUNTOS_MOVIMIENTOS: 'PuntosMovimientos',
    RECOMPENSAS_PUNTOS: 'RecompensasPuntos',
    ETIQUETAS_NFC: 'EtiquetasNFC',
    CORREOS_LOG: 'CorreosLog',
    LOGS: 'Logs'
  },

  // Única fuente de verdad del esquema: pestañas y lista exacta de columnas en orden
  SCHEMA: {
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
  },

  // Roles en el portal administrativo
  ROLES: {
    ADMINISTRADOR: 'Administrador',
    TECNICO: 'Tecnico'
  },

  // Tipos de usuario cliente
  TIPOS_CLIENTE: {
    NORMAL: 'Normal',
    TALLER: 'Taller'
  },

  // Estatus de dispositivos
  ESTATUS_DISPOSITIVO: {
    PENDIENTE: 'Pendiente',
    EN_REPARACION: 'En reparación',
    PRUEBAS: 'Pruebas',
    LISTO: 'Listo',
    ENTREGADO: 'Entregado',
    CANCELADO: 'Cancelado'
  },

  // Estatus que puede asignar un técnico
  ESTATUS_TECNICO: ['Pendiente', 'En reparación', 'Pruebas', 'Listo'],

  // Todos los estatus permitidos
  ESTATUS_TODOS: ['Pendiente', 'En reparación', 'Pruebas', 'Listo', 'Entregado', 'Cancelado'],

  // Estados de una orden de servicio
  ESTADOS_ORDEN: {
    ABIERTA: 'Abierta',
    PARCIAL: 'Parcial',
    COMPLETADA: 'Completada',
    CANCELADA: 'Cancelada'
  },

  // Tipos de movimiento de puntos
  TIPOS_MOVIMIENTO_PUNTOS: {
    ASIGNACION: 'Asignacion',
    CANJE: 'Canje',
    AJUSTE: 'Ajuste'
  },

  // Consolas y tipos habituales para catálogos/sugerencias
  TIPOS_CONSOLAS: [
    'PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'PlayStation 2', 'PlayStation 1', 'PS Vita', 'PSP',
    'Xbox Series X', 'Xbox Series S', 'Xbox One X', 'Xbox One S', 'Xbox One', 'Xbox 360', 'Xbox Classic',
    'Nintendo Switch OLED', 'Nintendo Switch V1/V2', 'Nintendo Switch Lite', 'Wii U', 'Wii', 'Nintendo 3DS / 2DS',
    'GameCube', 'Nintendo 64', 'Super Nintendo', 'NES', 'Game Boy / GBA',
    'Steam Deck', 'ASUS ROG Ally', 'Lenovo Legion Go',
    'Control / Mando', 'Fuente de Poder', 'Accesorio / VR'
  ]
};

// Variable global SCHEMA como alias a CONFIG.SCHEMA para asegurar máxima compatibilidad
var SCHEMA = CONFIG.SCHEMA;

/**
 * Obtiene el ID del Spreadsheet configurado en ScriptProperties o lanza error descriptivo
 */
function getSpreadsheetId() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty(CONFIG.PROP_SHEET_ID);
  if (!sheetId) {
    throw new Error('Configuración pendiente: No se ha configurado la propiedad "SHEET_ID" en ScriptProperties. Ejecuta setup() o configúrala en la configuración del proyecto.');
  }
  return sheetId;
}

/**
 * Obtiene la hoja de cálculo activa o vinculada
 */
function getDbSpreadsheet() {
  try {
    var id = getSpreadsheetId();
    return SpreadsheetApp.openById(id);
  } catch (e) {
    // Si no hay ID o falla, intenta abrir la activa si es un contenedor ligado
    try {
      var active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    } catch (ignore) {}
    throw new Error('No se pudo acceder a la base de datos Google Sheets: ' + e.message);
  }
}

/**
 * Obtiene una pestaña específica de la base de datos
 */
function getSheet(nombreHoja) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) {
    throw new Error('La pestaña "' + nombreHoja + '" no existe en la base de datos. Ejecuta setup() para inicializar el esquema.');
  }
  return sheet;
}
