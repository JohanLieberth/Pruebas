/**
 * PROYECTO: FriendTravel - App de Ventas, Recibos y Dashboard
 * DESCRIPCIÓN: Sistema de gestión de ventas y cobranza para agencia de viajes.
 */

// --- CONFIGURACIÓN GLOBAL ---
const CONFIG = {
  NOMBRE_HOJA_VENTAS: "VENTAS JUNIO",
  NOMBRE_HOJA_RECIBO_PLANTILLA: "Formato Recibo",
  NOMBRE_CARPETA_RECIBOS: "FriendTravel/Recibos",
  AGENTES_PERMITIDOS: ["Arlette", "Eduardo", "Enrique", "América"],
  META_MENSUAL_AGENTE: 10000,
  // Estas IDs se llenarán automáticamente o pueden ser pre-configuradas
  ID_SPREADSHEET: "",
  ID_CARPETA_RECIBOS: ""
};

/**
 * Función principal para servir la aplicación web.
 */
function doGet(e) {
  let page = e.parameter.page || 'Dashboard';
  if (page === 'Reportes') page = 'Estadisticas'; // Redirección por compatibilidad
  const template = HtmlService.createTemplateFromFile('Index');
  template.page = page;
  return template.evaluate()
    .setTitle('FriendTravel - Gestión de Ventas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Función para incluir archivos HTML dentro de otros.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtener configuración para el frontend.
 */
function getAppConfig() {
  return CONFIG;
}

/**
 * Inicialización de la aplicación: busca o crea la estructura de archivos.
 */
function inicializarApp() {
  const ss = DriveUtils.obtenerOCrearSpreadsheet(CONFIG.NOMBRE_HOJA_VENTAS);
  CONFIG.ID_SPREADSHEET = ss.getId();

  const folder = DriveUtils.obtenerOCrearCarpeta(CONFIG.NOMBRE_CARPETA_RECIBOS);
  CONFIG.ID_CARPETA_RECIBOS = folder.getId();

  // Guardar IDs en propiedades del script para persistencia si es necesario
  PropertiesService.getScriptProperties().setProperties({
    'ID_SPREADSHEET': CONFIG.ID_SPREADSHEET,
    'ID_CARPETA_RECIBOS': CONFIG.ID_CARPETA_RECIBOS
  });

  return "App Inicializada Correctamente: " + ss.getUrl();
}

/**
 * Obtener la ID del Spreadsheet desde las propiedades del script.
 */
function getSpreadsheetId() {
  let id = PropertiesService.getScriptProperties().getProperty('ID_SPREADSHEET');
  if (!id) {
    id = DriveUtils.obtenerOCrearSpreadsheet(CONFIG.NOMBRE_HOJA_VENTAS).getId();
    PropertiesService.getScriptProperties().setProperty('ID_SPREADSHEET', id);
  }
  return id;
}
