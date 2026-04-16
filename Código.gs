/**
 * Sistema de Gestión de Contratos con Indicadores Visuales
 * v3.0 - Registro Detallado y Control de Estados
 */

let CONFIG = {
  SHEET_NAME: "CONTRATOS",
  RESUMEN_SHEET: "RESUMEN_TIEMPOS",
  LOG_SHEET: "LOG_DOCUMENTAL",
  CONFIG_SHEET: "CONFIGURACION",
  FOLDER_ID_RAIZ: "",
  UMBRALES: {
    ESTANDAR: { VERDE: 3, AMARILLO: 5 },
    SECRETARIA: { VERDE: 5, AMARILLO: 9 }
  }
};

/**
 * Carga la configuración desde la hoja
 */
function cargarConfiguracion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.CONFIG_SHEET);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    const configObj = {};
    data.forEach(row => { configObj[row[0]] = row[1]; });

    CONFIG.FOLDER_ID_RAIZ = configObj["FOLDER_ID_RAIZ"] || "";
    CONFIG.UMBRALES.ESTANDAR.VERDE = parseInt(configObj["UMBRAL_ESTANDAR_VERDE"]) || 3;
    CONFIG.UMBRALES.ESTANDAR.AMARILLO = parseInt(configObj["UMBRAL_ESTANDAR_AMARILLO"]) || 5;
    CONFIG.UMBRALES.SECRETARIA.VERDE = parseInt(configObj["UMBRAL_SECRETARIA_VERDE"]) || 5;
    CONFIG.UMBRALES.SECRETARIA.AMARILLO = parseInt(configObj["UMBRAL_SECRETARIA_AMARILLO"]) || 9;
  }
}

/**
 * Función que maneja la carga de la aplicación web
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'panelContrato';
  const id = (e && e.parameter && e.parameter.id) ? e.parameter.id : null;

  try {
    const template = HtmlService.createTemplateFromFile(page);
    template.idCarga = id;
    const output = template.evaluate();
    return output
      .setTitle('Sistema de Gestión de Contratos')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput('<h1>Error: Página no encontrada</h1><p>' + err.toString() + '</p>');
  }
}

/**
 * Obtiene la URL de la web app
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Función inicial al abrir el documento
 */
function onOpen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(CONFIG.SHEET_NAME)) {
    setupDatabase();
  }
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gestión de Contratos')
    .addItem('Panel de Control', 'mostrarPanelContrato')
    .addItem('Listado de Registros', 'mostrarListaRegistros')
    .addItem('Dashboard de Indicadores', 'mostrarDashboardKPI')
    .addSeparator()
    .addItem('Calcular Tiempos', 'generarReporteKPI')
    .addItem('Configuración', 'mostrarConfiguracion')
    .addToUi();
}

function mostrarPanelContrato() {
  const html = HtmlService.createTemplateFromFile('panelContrato').evaluate()
    .setWidth(1200).setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, 'Panel de Control');
}

function mostrarListaRegistros() {
  const html = HtmlService.createTemplateFromFile('listaRegistros').evaluate()
    .setWidth(1200).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Listado de Registros');
}

function mostrarDashboardKPI() {
  const html = HtmlService.createTemplateFromFile('dashboardKPI').evaluate()
    .setWidth(1200).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard KPI');
}

function mostrarConfiguracion() {
  const html = HtmlService.createTemplateFromFile('Configuracion').evaluate()
    .setWidth(600).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuración');
}

/**
 * Obtiene los datos de un contrato por consecutivo
 */
function obtenerDatosContrato(consecutivo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == consecutivo) {
      return procesarFilaParaContrato(data[i], i + 1);
    }
  }
  return null;
}

/**
 * Mapea una fila a un objeto estructurado
 */
function procesarFilaParaContrato(fila, numeroFila) {
  // Mapeo según setupDatabase
  // A=0, B=1... O=14
  const stageColStart = 15; // P=15
  const colsPerStage = 6;

  const extractStage = (startIndex) => {
    return {
      estatus: fila[startIndex],
      inicio: fila[startIndex + 1],
      fin: fila[startIndex + 2],
      fechaObs: fila[startIndex + 3],
      detalleObs: fila[startIndex + 4],
      fechaSolv: fila[startIndex + 5]
    };
  };

  return {
    consecutivo: fila[0],
    fila: numeroFila,
    infoGeneral: {
      numContrato: fila[1],
      dependencia: fila[2],
      tipoContratacion: fila[3],
      objeto: fila[4],
      procedimiento: fila[5],
      tipoContrato: fila[6],
      proveedor: fila[7],
      inicioVigencia: fila[8],
      finVigencia: fila[9],
      monto: fila[10],
      desglose: fila[11],
      fechaAprobacion: fila[12],
      fechaSolicitud: fila[13]
    },
    etapaInterna: {
      revisionDoc: extractStage(stageColStart),
      elaboracion: extractStage(stageColStart + colsPerStage),
      validacion: extractStage(stageColStart + colsPerStage * 2)
    },
    etapasExternas: {
      gobernacion: extractStage(stageColStart + colsPerStage * 3),
      proveedor: extractStage(stageColStart + colsPerStage * 4),
      dependenciaEjecutora: extractStage(stageColStart + colsPerStage * 5),
      administracion: extractStage(stageColStart + colsPerStage * 6),
      secretaria: extractStage(stageColStart + colsPerStage * 7),
      alcaldesa: extractStage(stageColStart + colsPerStage * 8),
      anexo: extractStage(stageColStart + colsPerStage * 9),
      entrega: extractStage(stageColStart + colsPerStage * 10)
    },
    documentos: {
      comite: fila[81], // Actualizar estos índices según setupDatabase
      expediente: fila[82],
      contratoFirmado: fila[83]
    }
  };
}

/**
 * Guarda o actualiza un contrato
 */
function guardarProgresoContrato(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let fila = -1;

  // Buscar si ya existe por consecutivo para evitar duplicados
  if (datos.consecutivo) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == datos.consecutivo) {
        fila = i + 1;
        break;
      }
    }
  }

  if (fila === -1) {
    const lastRow = sheet.getLastRow();
    const lastConsecutivo = lastRow > 1 ? parseInt(sheet.getRange(lastRow, 1).getValue()) || 0 : 0;
    fila = lastRow + 1;
    sheet.getRange(fila, 1).setValue(lastConsecutivo + 1);
  }

  const info = datos.infoGeneral;
  const generalValues = [[
    info.numContrato, info.dependencia, info.tipoContratacion, info.objeto,
    info.procedimiento, info.tipoContrato, info.proveedor, info.inicioVigencia,
    info.finVigencia, info.monto, info.desglose, info.fechaAprobacion, info.fechaSolicitud
  ]];
  sheet.getRange(fila, 2, 1, 13).setValues(generalValues);

  const stageColStart = 16; // Col P
  const colsPerStage = 6;

  const mapStage = (s) => [s.estatus, s.inicio, s.fin, s.fechaObs, s.detalleObs, s.fechaSolv];

  const ei = datos.etapaInterna;
  const stagesI = [ei.revisionDoc, ei.elaboracion, ei.validacion];
  stagesI.forEach((s, idx) => {
    sheet.getRange(fila, stageColStart + (idx * colsPerStage), 1, colsPerStage).setValues([mapStage(s)]);
  });

  const ex = datos.etapasExternas;
  const stagesE = [
    ex.gobernacion, ex.proveedor, ex.dependenciaEjecutora, ex.administracion,
    ex.secretaria, ex.alcaldesa, ex.anexo, ex.entrega
  ];
  stagesE.forEach((s, idx) => {
    sheet.getRange(fila, stageColStart + ((idx + 3) * colsPerStage), 1, colsPerStage).setValues([mapStage(s)]);
  });

  return { success: true, message: "Contrato guardado exitosamente", consecutivo: sheet.getRange(fila, 1).getValue() };
}

/**
 * Obtiene listas para los dropdowns
 */
function getDropdownLists() {
  return {
    dependencias: [
      "Secretaría Municipal", "Instituto Municipal de Planeación de Mérida", "Unidad de Transparencia",
      "Unidad de Comunicación Ciudadana", "Dirección de la Policía Municipal", "Dirección de Contraloría Municipal",
      "Secretaría de Participación y Atención Ciudadana", "Coordinación General de Buen Gobierno", "Unidad de Planeación y Gestión",
      "Dirección de Gobernación", "Dirección de Administración", "Dirección de Finanzas y Tesorería Municipal",
      "Dirección de Innovación y Gobierno Inteligente", "Coordinación General de Justicia Social y Desarrollo Humano",
      "Unidad de Turismo", "Dirección de Desarrollo Integral de la Familia", "Dirección de Desarrollo Social y Combate a la Pobreza",
      "Dirección de Bienestar Humano", "Dirección de Prosperidad y Bienestar Económico", "Instituto de las Mujeres",
      "Dirección de Identidad y Cultura", "Coordinación General de Desarrollo Ordenado y Gestión de la Ciudad",
      "Dirección de Desarrollo Urbano", "Dirección de Obras Públicas", "Dirección de Servicios Públicos",
      "Unidad de Medio Ambiente y Bienestar Animal", "Dirección de Catastro", "Secretaría Ejecutiva del Comité Permanente del Carnaval",
      "Reserva Cuxtal", "Central de Abastos", "Abastos de Mérida", "SERVI-LIMPIA"
    ],
    tiposContratacion: ["Prestación de servicios", "Arrendamiento muebles", "Arrendamiento inmuebles", "Adquisición", "Comodato"],
    procedimientos: ["Adjudicación Directa", "Licitiación Pública", "Concurso por Invitación", "Otros"],
    estatus: ["Pendiente", "Revisión", "Observación", "Completa"]
  };
}

/**
 * Calcula días hábiles entre dos fechas
 */
function calcularDiasHabiles(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0;
  let inicio = new Date(fechaInicio);
  let fin = new Date(fechaFin);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 0;

  let dias = 0;
  let curr = new Date(inicio);
  while (curr <= fin) {
    const d = curr.getDay();
    if (d !== 0 && d !== 6) dias++;
    curr.setDate(curr.getDate() + 1);
  }
  return dias;
}

function calcularIndicadorVisual(dias, esSecretaria) {
  cargarConfiguracion();
  const umbrales = esSecretaria ? CONFIG.UMBRALES.SECRETARIA : CONFIG.UMBRALES.ESTANDAR;
  if (dias <= umbrales.VERDE) return { color: "VERDE", emoji: "🟢", clase: "estado-verde" };
  if (dias <= umbrales.AMARILLO) return { color: "AMARILLO", emoji: "🟡", clase: "estado-amarillo" };
  return { color: "ROJO", emoji: "🔴", clase: "estado-rojo" };
}

/**
 * Función para cálculos en tiempo real desde la UI
 */
function getIndicatorLocal(ini, fin, isSec) {
  const dias = calcularDiasHabiles(ini, fin);
  const ind = calcularIndicadorVisual(dias, isSec);
  return { dias, ind };
}

function obtenerListaContratos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    lista.push({
      consecutivo: data[i][0],
      numContrato: data[i][1],
      dependencia: data[i][2],
      tipo: data[i][3],
      estatus: data[i][14] || "Activo"
    });
  }
  return lista;
}

function subirArchivoADrive(base64Data, fileName, tipoDoc, consecutivo) {
  cargarConfiguracion();
  const folder = CONFIG.FOLDER_ID_RAIZ ? DriveApp.getFolderById(CONFIG.FOLDER_ID_RAIZ) : DriveApp.getRootFolder();
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, base64Data.substring(5, base64Data.indexOf(';')), fileName);
  const file = folder.createFile(blob);
  const url = file.getUrl();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == consecutivo) {
      let col = 82; // BI=81? A=1, B=2... BI=61?
      // Re-evaluar columnas de docs
      if (tipoDoc === 'expediente') col = 83;
      if (tipoDoc === 'contrato') col = 84;
      sheet.getRange(i + 1, col).setValue(url);
      break;
    }
  }
  return { success: true, url: url };
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  const headers = ["CONSECUTIVO", "NUM_CONTRATO", "DEPENDENCIA_EJECUTORA", "TIPO_CONTRATACION", "OBJETO", "PROCEDIMIENTO", "TIPO_CONTRATO", "PROVEEDOR", "INICIO_VIGENCIA", "FIN_VIGENCIA", "MONTO", "DESGLOSE", "FECHA_APROBACION", "FECHA_SOLICITUD", "ESTATUS_GENERAL"];

  const stages = ["REV_DOC", "ELAB_CONT", "VAL_JUR", "GOB", "PROV", "DEP_EJEC", "ADMIN", "SEC", "ALCALDESA", "ANEXO", "ENTREGA"];
  stages.forEach(s => {
    headers.push(s + "_ESTATUS", s + "_INICIO", s + "_FIN", s + "_FECHA_OBS", s + "_DETALLE_OBS", s + "_FECHA_SOLV");
  });
  headers.push("URL_COMITE", "URL_EXPEDIENTE", "URL_CONTRATO_FIRMADO");

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f3f3f3");
  sheet.setFrozenRows(1);

  if (!ss.getSheetByName(CONFIG.RESUMEN_SHEET)) ss.insertSheet(CONFIG.RESUMEN_SHEET);
  if (!ss.getSheetByName(CONFIG.LOG_SHEET)) ss.insertSheet(CONFIG.LOG_SHEET).appendRow(["FECHA", "CONSECUTIVO", "TIPO", "FILE", "URL", "USER"]);
  if (!ss.getSheetByName(CONFIG.CONFIG_SHEET)) {
    ss.insertSheet(CONFIG.CONFIG_SHEET).getRange(1, 1, 6, 2).setValues([
      ["PARAMETRO", "VALOR"], ["FOLDER_ID_RAIZ", ""], ["UMBRAL_ESTANDAR_VERDE", 3],
      ["UMBRAL_ESTANDAR_AMARILLO", 5], ["UMBRAL_SECRETARIA_VERDE", 5], ["UMBRAL_SECRETARIA_AMARILLO", 9]
    ]);
  }
}

function generarReporteKPI() {
  // Implementación simplificada para el reporte
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const resSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.RESUMEN_SHEET);
  const data = sheet.getDataRange().getValues();
  resSheet.clear();
  resSheet.getRange(1, 1, data.length, 10).setValues(data.map(r => [r[0], r[1], r[2], r[14], "...", "...", "...", "...", "...", "..."]));
  SpreadsheetApp.getUi().alert("Reporte actualizado");
}

function obtenerMetricasDashboard() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { verdes: 0, amarillos: 0, rojos: 0, secretariaRojo: 0 };
  const data = sheet.getDataRange().getValues();
  let verdes = 0, amarillos = 0, rojos = 0, secretariaRojo = 0;

  for (let i = 1; i < data.length; i++) {
    const c = procesarFilaParaContrato(data[i], i + 1);
    const etapas = [
      { d: c.etapaInterna.revisionDoc, n: "Standard" },
      { d: c.etapaInterna.elaboracion, n: "Standard" },
      { d: c.etapaInterna.validacion, n: "Standard" },
      { d: c.etapasExternas.secretaria, n: "Secretaria" }
    ];
    etapas.forEach(e => {
      if (e.d.inicio && e.d.fin) {
        const dias = calcularDiasHabiles(e.d.inicio, e.d.fin);
        const ind = calcularIndicadorVisual(dias, e.n === "Secretaria");
        if (ind.color === "VERDE") verdes++;
        else if (ind.color === "AMARILLO") amarillos++;
        else { rojos++; if (e.n === "Secretaria") secretariaRojo++; }
      }
    });
  }
  return { verdes, amarillos, rojos, secretariaRojo };
}

function guardarConfiguracionServer(config) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.CONFIG_SHEET);
  sheet.getRange(2, 2, 5, 1).setValues([[config.folderId], [config.estandarVerde], [config.estandarAmarillo], [config.secretariaVerde], [config.secretariaAmarillo]]);
  return { success: true };
}
