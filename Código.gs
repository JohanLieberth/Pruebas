/**
 * Sistema de Gestión de Contratos con Indicadores Visuales
 * Desarrollado para Google Apps Script
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
    .addItem('Gestión Documental', 'mostrarGestionDocumental')
    .addSeparator()
    .addItem('Calcular Tiempos', 'generarReporteKPI')
    .addItem('Generar Reporte KPI', 'mostrarDashboardKPI')
    .addItem('Configuración', 'mostrarConfiguracion')
    .addToUi();
}

/**
 * Abre la interfaz del Panel de Control
 */
function mostrarPanelContrato() {
  const html = HtmlService.createHtmlOutputFromFile('panelContrato')
    .setTitle('Panel de Control - Gestión de Contratos')
    .setWidth(1000)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Panel de Control');
}

/**
 * Abre la interfaz de Gestión Documental
 */
function mostrarGestionDocumental() {
  const html = HtmlService.createHtmlOutputFromFile('gestionDocumental')
    .setTitle('Gestión Documental')
    .setWidth(900)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Gestión Documental');
}

/**
 * Abre el Dashboard de KPIs
 */
function mostrarDashboardKPI() {
  const html = HtmlService.createHtmlOutputFromFile('dashboardKPI')
    .setTitle('Dashboard de Indicadores KPI')
    .setWidth(1200)
    .setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard KPI');
}

/**
 * Abre la interfaz de Configuración
 */
function mostrarConfiguracion() {
  const html = HtmlService.createHtmlOutputFromFile('Configuracion')
    .setTitle('Configuración del Sistema')
    .setWidth(600)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configuración');
}

/**
 * Obtiene los datos de un contrato por consecutivo o fila
 */
function obtenerDatosContrato(consecutivo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  // Buscar por consecutivo (asumiendo Columna A es consecutivo)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == consecutivo) {
      return procesarFilaParaContrato(data[i], i + 1);
    }
  }
  return null;
}

/**
 * Mapea una fila de la hoja a un objeto de contrato estructurado
 */
function procesarFilaParaContrato(fila, numeroFila) {
  // Columnas base (ajustar según realidad si es necesario)
  // P=15, Q=16, R=17, S=18, T=19, U=20, V=21, W=22, X=23, Y=24, Z=25, AA=26, AB=27
  // AC=28 ... BH=59

  return {
    consecutivo: fila[0],
    numeroContrato: fila[1],
    dependencia: fila[2],
    fila: numeroFila,
    etapaInterna: {
      inicio: fila[15], // Columna P
      revisionDoc: { inicio: fila[16], fin: fila[17], obs: fila[18], solv: fila[19] },
      elaboracion: { inicio: fila[20], fin: fila[21], obs: fila[22], solv: fila[23] },
      validacion: { inicio: fila[24], fin: fila[25], obs: fila[26], solv: fila[27] },
      fin: fila[25] // Columna Z (Fecha Jurídico)
    },
    etapasExternas: {
      gobernacion: { inicio: fila[28], fin: fila[29], obs: fila[30], solv: fila[31] },
      proveedor: { inicio: fila[32], fin: fila[33], obs: fila[34], solv: fila[35] },
      dependenciaEjecutora: { inicio: fila[36], fin: fila[37], obs: fila[38], solv: fila[39] },
      administracion: { inicio: fila[40], fin: fila[41], obs: fila[42], solv: fila[43] },
      secretaria: { inicio: fila[44], fin: fila[45], obs: fila[46], solv: fila[47] },
      alcaldesa: { inicio: fila[48], fin: fila[49], obs: fila[50], solv: fila[51] },
      anexo: { inicio: fila[52], fin: fila[53], obs: fila[54], solv: fila[55] },
      entrega: { inicio: fila[56], fin: fila[57], obs: fila[58], solv: fila[59] }
    },
    documentos: {
      comite: fila[60], // BI
      expediente: fila[61], // BJ
      contratoFirmado: fila[62] // BK
    }
  };
}

/**
 * Guarda la información capturada en el Google Sheet
 */
function guardarProgresoContrato(datos) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const fila = datos.fila;

  // Mapeo de campos a columnas específicas
  // Etapa Interna
  sheet.getRange(fila, 16).setValue(datos.etapaInterna.inicio); // P

  const ei = datos.etapaInterna;
  sheet.getRange(fila, 17, 1, 4).setValues([[ei.revisionDoc.inicio, ei.revisionDoc.fin, ei.revisionDoc.obs, ei.revisionDoc.solv]]);
  sheet.getRange(fila, 21, 1, 4).setValues([[ei.elaboracion.inicio, ei.elaboracion.fin, ei.elaboracion.obs, ei.elaboracion.solv]]);
  sheet.getRange(fila, 25, 1, 4).setValues([[ei.validacion.inicio, ei.validacion.fin, ei.validacion.obs, ei.validacion.solv]]);

  // Etapas Externas
  const ex = datos.etapasExternas;
  sheet.getRange(fila, 29).setValue(ex.gobernacion.inicio); // AC
  sheet.getRange(fila, 29, 1, 4).setValues([[ex.gobernacion.inicio, ex.gobernacion.fin, ex.gobernacion.obs, ex.gobernacion.solv]]);
  sheet.getRange(fila, 33, 1, 4).setValues([[ex.proveedor.inicio, ex.proveedor.fin, ex.proveedor.obs, ex.proveedor.solv]]);
  sheet.getRange(fila, 37, 1, 4).setValues([[ex.dependenciaEjecutora.inicio, ex.dependenciaEjecutora.fin, ex.dependenciaEjecutora.obs, ex.dependenciaEjecutora.solv]]);
  sheet.getRange(fila, 41, 1, 4).setValues([[ex.administracion.inicio, ex.administracion.fin, ex.administracion.obs, ex.administracion.solv]]);
  sheet.getRange(fila, 45, 1, 4).setValues([[ex.secretaria.inicio, ex.secretaria.fin, ex.secretaria.obs, ex.secretaria.solv]]);
  sheet.getRange(fila, 49, 1, 4).setValues([[ex.alcaldesa.inicio, ex.alcaldesa.fin, ex.alcaldesa.obs, ex.alcaldesa.solv]]);
  sheet.getRange(fila, 53, 1, 4).setValues([[ex.anexo.inicio, ex.anexo.fin, ex.anexo.obs, ex.anexo.solv]]);
  sheet.getRange(fila, 57, 1, 4).setValues([[ex.entrega.inicio, ex.entrega.fin, ex.entrega.obs, ex.entrega.solv]]);

  // Documentos
  const doc = datos.documentos;
  sheet.getRange(fila, 61, 1, 3).setValues([[doc.comite, doc.expediente, doc.contratoFirmado]]);

  return { success: true, message: "Datos guardados correctamente" };
}

/**
 * Calcula días hábiles entre dos fechas
 */
function calcularDiasHabiles(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0;
  let inicio = new Date(fechaInicio);
  let fin = new Date(fechaFin);
  let dias = 0;

  while (inicio <= fin) {
    const diaSemana = inicio.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) { // 0: Domingo, 6: Sábado
      dias++;
    }
    inicio.setDate(inicio.getDate() + 1);
  }
  return dias;
}

/**
 * Determina el indicador visual según los días y el tipo de etapa
 */
function calcularIndicadorVisual(dias, esSecretaria) {
  cargarConfiguracion();
  const umbrales = esSecretaria ? CONFIG.UMBRALES.SECRETARIA : CONFIG.UMBRALES.ESTANDAR;

  if (dias <= umbrales.VERDE) return { color: "VERDE", emoji: "🟢", clase: "estado-verde" };
  if (dias <= umbrales.AMARILLO) return { color: "AMARILLO", emoji: "🟡", clase: "estado-amarillo" };
  return { color: "ROJO", emoji: "🔴", clase: "estado-rojo" };
}

/**
 * Obtiene métricas agregadas para el Dashboard
 */
function obtenerMetricasDashboard() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let verdes = 0, amarillos = 0, rojos = 0, secretariaRojo = 0;

  for (let i = 1; i < data.length; i++) {
    const contrato = procesarFilaParaContrato(data[i], i + 1);
    const etapas = [
      { d: contrato.etapaInterna.revisionDoc, n: "Revision" },
      { d: contrato.etapaInterna.elaboracion, n: "Elaboracion" },
      { d: contrato.etapaInterna.validacion, n: "Validacion" },
      { d: contrato.etapasExternas.gobernacion, n: "Gobernacion" },
      { d: contrato.etapasExternas.proveedor, n: "Proveedor" },
      { d: contrato.etapasExternas.dependenciaEjecutora, n: "DepEjec" },
      { d: contrato.etapasExternas.administracion, n: "Admin" },
      { d: contrato.etapasExternas.secretaria, n: "Secretaria" },
      { d: contrato.etapasExternas.alcaldesa, n: "Alcaldesa" },
      { d: contrato.etapasExternas.anexo, n: "Anexo" },
      { d: contrato.etapasExternas.entrega, n: "Entrega" }
    ];

    etapas.forEach(e => {
      if (e.d && e.d.inicio && e.d.fin) {
        const dias = calcularDiasHabiles(e.d.inicio, e.d.fin);
        const esSec = e.n === "Secretaria";
        const ind = calcularIndicadorVisual(dias, esSec);
        if (ind.color === "VERDE") verdes++;
        else if (ind.color === "AMARILLO") amarillos++;
        else if (ind.color === "ROJO") {
          rojos++;
          if (esSec) secretariaRojo++;
        }
      }
    });
  }

  return { verdes, amarillos, rojos, secretariaRojo };
}

/**
 * Guarda la configuración desde la interfaz
 */
function guardarConfiguracionServer(config) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.CONFIG_SHEET);
  sheet.getRange(2, 2, 5, 1).setValues([
    [config.folderId],
    [config.estandarVerde],
    [config.estandarAmarillo],
    [config.secretariaVerde],
    [config.secretariaAmarillo]
  ]);
  return { success: true };
}

/**
 * Obtiene la lista de todos los contratos para el selector
 */
function obtenerListaContratos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const lista = [];

  for (let i = 1; i < data.length; i++) {
    const contrato = data[i];
    if (!contrato[0]) continue; // Saltar vacíos

    // Cálculo rápido de estado para la lista
    const diasTotales = 0; // Implementar suma si es necesario

    lista.push({
      consecutivo: contrato[0],
      numeroContrato: contrato[1],
      dependencia: contrato[2],
      diasTotales: diasTotales,
      claseIndicador: "bg-success",
      emojiIndicador: "🟢",
      docsCompletos: !!(contrato[60] && contrato[61] && contrato[62])
    });
  }
  return lista;
}

/**
 * Función para subir archivos a Drive
 */
function subirArchivoADrive(base64Data, fileName, tipoDoc, consecutivo) {
  cargarConfiguracion();
  const folder = CONFIG.FOLDER_ID_RAIZ ? DriveApp.getFolderById(CONFIG.FOLDER_ID_RAIZ) : DriveApp.getRootFolder();

  const contentType = base64Data.substring(5, base64Data.indexOf(';'));
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, fileName);

  const file = folder.createFile(blob);
  const url = file.getUrl();

  // Actualizar en el sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let fila = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == consecutivo) {
      fila = i + 1;
      break;
    }
  }

  if (fila !== -1) {
    let col = 61; // URL_COMITE
    if (tipoDoc === 'expediente') col = 62;
    if (tipoDoc === 'contrato') col = 63;
    sheet.getRange(fila, col).setValue(url);

    // Log Documental
    const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.LOG_SHEET);
    if (logSheet) {
      logSheet.appendRow([new Date(), consecutivo, tipoDoc, fileName, url, Session.getActiveUser().getEmail()]);
    }
  }

  return { success: true, url: url };
}

/**
 * Genera la hoja de resumen con todos los cálculos e indicadores
 */
function generarReporteKPI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const resSheet = ss.getSheetByName(CONFIG.RESUMEN_SHEET);
  const data = sheet.getDataRange().getValues();

  const resumenRows = [];
  for (let i = 1; i < data.length; i++) {
    const c = procesarFilaParaContrato(data[i], i + 1);
    if (!c.consecutivo) continue;

    const diasInterna = calcularDiasHabiles(c.etapaInterna.inicio, c.etapaInterna.fin);
    const indInterna = calcularIndicadorVisual(diasInterna, false);

    const row = [
      c.consecutivo,
      c.numeroContrato,
      c.dependencia,
      data[i][3], // Tipo contrato
      c.etapaInterna.inicio,
      c.etapaInterna.fin,
      diasInterna,
      indInterna.emoji,
      0, // Días obs (implementar si se requiere detalle)
      diasInterna, // Días netos
      indInterna.emoji,
      "", // Áreas externas
      "", // Fecha última etapa
      0, // Días externa
      "", // Indicador externa
      0, 0, // Días obs y netos externa
      diasInterna, // Total
      indInterna.emoji,
      "Activo",
      (c.documentos.comite && c.documentos.expediente && c.documentos.contratoFirmado) ? "Completa" : "Incompleta",
      "", // Indicador secretaría
      c.documentos.comite ? "Sí" : "No",
      c.documentos.expediente ? "Sí" : "No",
      c.documentos.contratoFirmado ? "Sí" : "No",
      0, // Días sin doc
      "", // Indicador doc
      "" // URL
    ];
    resumenRows.push(row);
  }

  if (resumenRows.length > 0) {
    resSheet.getRange(2, 1, resSheet.getLastRow() > 1 ? resSheet.getLastRow() - 1 : 1, resSheet.getLastHeaderColumn()).clearContent();
    resSheet.getRange(2, 1, resumenRows.length, resumenRows[0].length).setValues(resumenRows);
  }

  SpreadsheetApp.getUi().alert("Reporte generado exitosamente en la hoja " + CONFIG.RESUMEN_SHEET);
}

/**
 * Configura la estructura inicial de las hojas si no existen
 */
/**
 * Trigger que se ejecuta al editar la hoja
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();

  if (sheet.getName() === CONFIG.SHEET_NAME && range.getRow() > 1) {
    // Si se edita una fecha, podríamos disparar cálculos automáticos
    // Por simplicidad en este MVP, se recomienda usar el botón "Calcular Tiempos"
    // Pero aquí se podría implementar validación inmediata
  }
}

/**
 * Envía alertas por correo para etapas en rojo
 */
function enviarEmailAlertas(contratosEnRojo) {
  contratosEnRojo.forEach(c => {
    MailApp.sendEmail({
      to: "admin@ejemplo.com", // Configurable
      subject: `ALERTA: Contrato ${c.numeroContrato} en estado CRÍTICO`,
      body: `El contrato ${c.numeroContrato} de la dependencia ${c.dependencia} tiene etapas excedidas en tiempo. Favor de revisar.`
    });
  });
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Hoja Principal
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    const headers = [
      "CONSECUTIVO", "NÚMERO DE CONTRATO", "DEPENDENCIA", "TIPO DE CONTRATO", "", "", "", "", "", "", "", "", "", "", "",
      "FECHA_SOLICITUD (P)", // 16
      "REV_DOC_INICIO (Q)", "REV_DOC_FIN (R)", "REV_DOC_OBS (S)", "REV_DOC_SOLV (T)", // 17-20
      "ELAB_CONT_INICIO (U)", "ELAB_CONT_FIN (V)", "ELAB_CONT_OBS (W)", "ELAB_CONT_SOLV (X)", // 21-24
      "VAL_JUR_INICIO (Y)", "FECHA_JURIDICO (Z)", "VAL_JUR_OBS (AA)", "VAL_JUR_SOLV (AB)", // 25-28
      "GOB_INICIO (AC)", "GOB_FIN (AD)", "GOB_OBS (AE)", "GOB_SOLV (AF)", // 29-32
      "PROV_INICIO (AG)", "PROV_FIN (AH)", "PROV_OBS (AI)", "PROV_SOLV (AJ)", // 33-36
      "DEP_EJEC_INICIO (AK)", "DEP_EJEC_FIN (AL)", "DEP_EJEC_OBS (AM)", "DEP_EJEC_SOLV (AN)", // 37-40
      "ADMIN_INICIO (AO)", "ADMIN_FIN (AP)", "ADMIN_OBS (AQ)", "ADMIN_SOLV (AR)", // 41-44
      "SEC_INICIO (AS)", "SEC_FIN (AT)", "SEC_OBS (AU)", "SEC_SOLV (AV)", // 45-48
      "ALCALDESA_INICIO (AW)", "ALCALDESA_FIN (AX)", "ALCALDESA_OBS (AY)", "ALCALDESA_SOLV (AZ)", // 49-52
      "ANEXO_INICIO (BA)", "ANEXO_FIN (BB)", "ANEXO_OBS (BC)", "ANEXO_SOLV (BD)", // 53-56
      "ENTREGA_INICIO (BE)", "ENTREGA_FIN (BF)", "ENTREGA_OBS (BG)", "ENTREGA_SOLV (BH)", // 57-60
      "URL_COMITE (BI)", "URL_EXPEDIENTE (BJ)", "URL_CONTRATO_FIRMADO (BK)" // 61, 62, 63
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }

  // Hoja Log Documental
  if (!ss.getSheetByName(CONFIG.LOG_SHEET)) {
    const logS = ss.insertSheet(CONFIG.LOG_SHEET);
    logS.appendRow(["FECHA", "CONSECUTIVO", "TIPO_DOC", "NOMBRE_ARCHIVO", "URL", "USUARIO"]);
  }

  // Hoja de Resumen
  if (!ss.getSheetByName(CONFIG.RESUMEN_SHEET)) {
    const resSheet = ss.insertSheet(CONFIG.RESUMEN_SHEET);
    const headersRes = [
      "CONSECUTIVO", "NÚMERO DE CONTRATO", "DEPENDENCIA", "TIPO DE CONTRATO", "FECHA_SOLICITUD", "FECHA_JURIDICO",
      "DIAS_ETAPA_INTERNA", "INDICADOR_ETAPA_INTERNA", "DIAS_OBSERVACIONES_INTERNA", "DIAS_NETOS_INTERNA",
      "INDICADOR_NETO_INTERNO", "AREAS_EXTERNAS_SELECCIONADAS", "FECHA_ULTIMA_ETAPA_EXTERNA", "DIAS_ETAPA_EXTERNA_TOTAL",
      "INDICADOR_ETAPA_EXTERNA", "DIAS_OBSERVACIONES_EXTERNA", "DIAS_NETOS_EXTERNA", "TIEMPO_TOTAL_CONTRATO",
      "INDICADOR_TOTAL_CONTRATO", "ESTADO_ACTUAL", "DOCUMENTACION_COMPLETA", "INDICADOR_SECRETARIA_ESPECIFICO",
      "FECHA_SUBIDA_COMITE", "FECHA_SUBIDA_EXPEDIENTE", "FECHA_SUBIDA_CONTRATO_FIRMADO", "DIAS_SIN_DOCUMENTACION",
      "INDICADOR_DOCUMENTACION", "URL_DOCUMENTOS"
    ];
    resSheet.getRange(1, 1, 1, headersRes.length).setValues([headersRes]).setFontWeight("bold").setBackground("#d9ead3");
  }

  // Hoja de Configuración
  if (!ss.getSheetByName(CONFIG.CONFIG_SHEET)) {
    const confSheet = ss.insertSheet(CONFIG.CONFIG_SHEET);
    confSheet.getRange(1, 1, 4, 2).setValues([
      ["PARAMETRO", "VALOR"],
      ["FOLDER_ID_RAIZ", ""],
      ["UMBRAL_ESTANDAR_VERDE", 3],
      ["UMBRAL_ESTANDAR_AMARILLO", 5]
    ]);
  }
}
