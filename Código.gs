/**
 * PROYECTO: FriendTravel - App de Ventas, Recibos y Dashboard
 * DESCRIPCIÓN: Sistema de gestión de ventas y cobranza para agencia de viajes.
 */

// --- CONFIGURACIÓN GLOBAL ---
const CONFIG = {
  NOMBRE_ARCHIVO_SS: "FriendTravelVentas",
  NOMBRE_TAB_VENTAS: "Ventas",
  NOMBRE_TAB_PAGOS: "Pagos",
  NOMBRE_HOJA_RECIBO_PLANTILLA: "Formato Recibo",
  NOMBRE_CARPETA_RECIBOS: "FriendTravel/Recibos",
  AGENTES_PERMITIDOS: ["Arlette", "Eduardo", "Enrique", "América"],
  META_MENSUAL_AGENTE: 10000,
  // Estas IDs se llenarán automáticamente o pueden ser pre-configuradas
  ID_SPREADSHEET: "",
  ID_CARPETA_RECIBOS: ""
};

/**
 * Se ejecuta al abrir la hoja de cálculo.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Friend Travel')
    .addItem('⚙️ Configurar Sistema', 'setup')
    .addItem('🚀 Abrir Web App', 'mostrarUrlApp')
    .addToUi();
}

/**
 * Función de alias para inicializar la aplicación.
 */
function setup() {
  return inicializarApp();
}

/**
 * Muestra la URL de la aplicación web en un diálogo.
 */
function mostrarUrlApp() {
  const url = ScriptApp.getService().getUrl();
  if (url) {
    const html = HtmlService.createHtmlOutput(
      `<div style="font-family:sans-serif; text-align:center;">
        <p>La aplicación está lista:</p>
        <a href="${url}" target="_blank" style="padding:10px 20px; background:#1a3a5c; color:white; text-decoration:none; border-radius:5px;">Abrir Aplicación</a>
        <p style="margin-top:20px; font-size:0.8rem; color:grey;">URL: ${url}</p>
      </div>`
    ).setWidth(400).setHeight(200);
    SpreadsheetApp.getUi().showModalDialog(html, 'Friend Travel - Web App');
  } else {
    SpreadsheetApp.getUi().alert('La aplicación no ha sido desplegada como Web App todavía.');
  }
}

/**
 * Función principal para servir la aplicación web.
 */
function doGet(e) {
  // Manejo defensivo del objeto de evento 'e'
  let page = 'Dashboard';
  try {
    if (e && e.parameter && e.parameter.page) {
      page = e.parameter.page;
    }
  } catch (error) {
    console.error("Error al procesar parámetros de URL:", error);
  }

  if (page === 'Reportes') page = 'Estadisticas'; // Redirección por compatibilidad

  // Auto-inicializar si no hay ID de spreadsheet guardado
  getSpreadsheetId();

  const template = HtmlService.createTemplateFromFile('Index');
  template.page = page;
  return template.evaluate()
    .setTitle('FriendTravel - Gestión de Ventas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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
  const ss = DriveUtils.obtenerOCrearSpreadsheet(CONFIG.NOMBRE_ARCHIVO_SS);
  DriveUtils.inicializarHojas(ss);
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
  let ss = null;

  if (id) {
    try {
      // Verificar que el ID sea válido y accesible
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      console.warn("ID guardado no válido o inaccesible, re-inicializando...");
      id = null;
    }
  }

  if (!id) {
    ss = DriveUtils.obtenerOCrearSpreadsheet(CONFIG.NOMBRE_ARCHIVO_SS);
    id = ss.getId();
    PropertiesService.getScriptProperties().setProperty('ID_SPREADSHEET', id);
  }

  // Siempre asegurar que las hojas necesarias existan al obtener el ID
  if (ss) {
    DriveUtils.inicializarHojas(ss);
  }

  return id;
}
