/**
 * Sistema de Gestión de Contratos con Indicadores Visuales
 * v3.3 - Búsqueda Exhaustiva y Diagnóstico Proactivo
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
 * Obtiene una hoja de forma segura (insensible a mayúsculas/minúsculas)
 */
function getSheetSafe(name) {
  if (name === undefined || name === null || String(name).trim() === "") {
    // Retornamos null directamente sin emitir advertencia que alerte el logger de GAS
    return null;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const searchName = String(name).trim().toUpperCase();

  // Intento 1: Nombre exacto
  let sheet = ss.getSheetByName(name);

  // Intento 2: Búsqueda insensible a mayúsculas y espacios
  if (!sheet) {
    const sheets = ss.getSheets();
    sheet = sheets.find(s => {
      const sName = s.getName();
      return sName && String(sName).trim().toUpperCase() === searchName;
    });
  }

  if (!sheet) {
    console.warn("Hoja no encontrada: '" + name + "'. Hojas disponibles: " + ss.getSheets().map(s => s.getName()).join(", "));
  }

  return sheet;
}

/**
 * Sanitiza objetos para evitar errores de serialización en google.script.run
 * Convierte objetos Date a strings ISO
 */
function sanitizeData(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item));
  }

  const sanitized = {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeData(obj[key]);
    }
  }
  return sanitized;
}

/**
 * Carga la configuración desde la hoja
 */
function cargarConfiguracion() {
  const configSheetName = CONFIG && CONFIG.CONFIG_SHEET;
  if (!configSheetName || String(configSheetName).trim() === "") {
    console.log("cargarConfiguracion: Nombre de la hoja de configuración no está definido.");
    return;
  }
  const sheet = getSheetSafe(configSheetName);
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
  // Soporta tanto 'page' como 'v', e 'id' como 'consecutivo'
  const page = (e && e.parameter && (e.parameter.page || e.parameter.v)) ? (e.parameter.page || e.parameter.v) : 'Login';
  const id = (e && e.parameter && (e.parameter.id || e.parameter.consecutivo)) ? (e.parameter.id || e.parameter.consecutivo) : "";

  console.log("doGet: page=" + page + ", id=" + id);

  try {
    const template = HtmlService.createTemplateFromFile(page);
    template.idCarga = id;
    template.webAppUrl = getWebAppUrl();
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
  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  if (!sheetName || String(sheetName).trim() === "") {
    console.log("onOpen: Nombre de la hoja de contratos no está definido.");
    setupDatabase();
  } else if (!getSheetSafe(sheetName)) {
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
 * Función de diagnóstico para depuración desde la consola de GAS
 */
function diagnosticarSistema() {
  console.log("--- INICIANDO DIAGNÓSTICO DEL SISTEMA ---");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  console.log("ID Spreadsheet: " + ss.getId());
  console.log("Hojas presentes: " + ss.getSheets().map(s => s.getName()).join(", "));

  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  if (!sheetName || String(sheetName).trim() === "") {
    console.warn("diagnosticarSistema: El nombre de la hoja CONFIG.SHEET_NAME no está definido.");
    console.log("--- FIN DEL DIAGNÓSTICO ---");
    return;
  }
  const sheet = getSheetSafe(sheetName);
  if (sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    console.log("Hoja '" + sheetName + "': " + lastRow + " filas, " + lastCol + " columnas.");
    if (lastRow > 0) {
      const firstCol = sheet.getRange(1, 1, Math.min(lastRow, 10), 1).getDisplayValues();
      console.log("Primeros 10 IDs (Col A): " + firstCol.map(r => r[0]).join(", "));
    }
  } else {
    console.error("ERROR: No se encontró la hoja '" + sheetName + "'");
  }
  console.log("--- FIN DEL DIAGNÓSTICO ---");
}

/**
 * Obtiene los datos de un contrato con una búsqueda exhaustiva (Múltiples estrategias)
 */
function obtenerDatosContrato(consecutivo) {
  if (!consecutivo || String(consecutivo).trim() === "" || String(consecutivo) === "null") return null;
  const searchId = String(consecutivo).trim();
  console.log("--- INICIANDO BÚSQUEDA EXHAUSTIVA PARA ID: " + searchId + " ---");

  try {
    const sheetName = CONFIG && CONFIG.SHEET_NAME;
    if (!sheetName || String(sheetName).trim() === "") {
      console.warn("obtenerDatosContrato: El nombre de la hoja CONFIG.SHEET_NAME no está definido.");
      return null;
    }
    const sheet = getSheetSafe(sheetName);
    if (!sheet) throw new Error("No se pudo acceder a la hoja de contratos.");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Estrategia 1: TextFinder (Búsqueda nativa de Google Sheets en Columna A)
    const finder = sheet.getRange("A:A").createTextFinder(searchId).matchEntireCell(true);
    const cell = finder.findNext();
    if (cell) {
      console.log("Estrategia 1 (TextFinder): Encontrado en " + cell.getA1Notation());
      const row = cell.getRow();
      const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
      return sanitizeData(procesarFilaParaContrato(rowData, row, headers));
    }

    // Estrategia 2: Escaneo manual de DisplayValues (Lo que el usuario ve)
    const displayValues = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
    for (let i = 1; i < displayValues.length; i++) {
      if (displayValues[i][0].trim() === searchId) {
        console.log("Estrategia 2 (DisplayValues): Encontrado en fila " + (i + 1));
        const rowData = sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
        return sanitizeData(procesarFilaParaContrato(rowData, i + 1, headers));
      }
    }

    // Estrategia 3: Escaneo manual de RawValues (Comparación numérica y de texto exacta)
    const rawValues = sheet.getRange(1, 1, lastRow, 1).getValues();
    const searchIdNum = Number(searchId);
    for (let i = 1; i < rawValues.length; i++) {
      const val = rawValues[i][0];
      if (String(val).trim() === searchId || (!isNaN(searchIdNum) && Number(val) === searchIdNum)) {
        console.log("Estrategia 3 (RawValues): Encontrado en fila " + (i + 1));
        const rowData = sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).getValues()[0];
        return sanitizeData(procesarFilaParaContrato(rowData, i + 1, headers));
      }
    }

    console.warn("--- BÚSQUEDA FINALIZADA SIN ÉXITO ---");
    return null;
  } catch (e) {
    console.error("Error en obtenerDatosContrato: " + e.toString());
    return null;
  }
}

/**
 * Mapea una fila a un objeto estructurado de forma segura
 */
function procesarFilaParaContrato(fila, numeroFila, headers) {
  if (!fila || !Array.isArray(fila)) return null;

  const safe = (idx) => (fila[idx] === undefined || fila[idx] === null) ? "" : fila[idx];

  const stageColStart = 15; // P=15
  const colsPerStage = 11;

  const extractStage = (startIndex, key) => {
    return {
      key: key,
      estatus: safe(startIndex),
      inicio: safe(startIndex + 1),
      fin: safe(startIndex + 2),
      fechaObs: safe(startIndex + 3),
      detalleObs: safe(startIndex + 4),
      fechaSolv: safe(startIndex + 5),
      tipoObs: safe(startIndex + 6),
      origenJuridico: safe(startIndex + 7),
      origenDependencia: safe(startIndex + 8),
      fechaVigencia: safe(startIndex + 9),
      montoSinIva: safe(startIndex + 10)
    };
  };

  const idxComite = headers ? headers.indexOf("URL_COMITE") : 136;
  const idxExpediente = headers ? headers.indexOf("URL_EXPEDIENTE") : 137;
  const idxContrato = headers ? headers.indexOf("URL_CONTRATO_FIRMADO") : 138;

  let idxCreador = headers ? headers.indexOf("Creado/Editado por") : -1;
  if (idxCreador === -1 && headers) idxCreador = headers.indexOf("CREADO_EDITADO_POR");
  if (idxCreador === -1) idxCreador = 139;

  const idxSeExime = headers ? headers.indexOf("ANEXO_SE_EXIME") : -1;
  const idxFechaExencion = headers ? headers.indexOf("ANEXO_FECHA_EXENCION") : -1;

  const anexoStage = extractStage(stageColStart + colsPerStage * 9, 'anexo');
  if (idxSeExime !== -1) anexoStage.seExime = safe(idxSeExime);
  if (idxFechaExencion !== -1) anexoStage.fechaExencion = safe(idxFechaExencion);

  return {
    consecutivo: safe(0),
    fila: numeroFila,
    infoGeneral: {
      numContrato: safe(1),
      dependencia: safe(2),
      tipoContratacion: safe(3),
      objeto: safe(4),
      procedimiento: safe(5),
      tipoContrato: safe(6),
      proveedor: safe(7),
      inicioVigencia: safe(8),
      finVigencia: safe(9),
      monto: safe(10),
      desglose: safe(11),
      fechaAprobacion: safe(12),
      fechaSolicitud: safe(13)
    },
    etapaInterna: {
      revisionDoc: extractStage(stageColStart, 'revisionDoc'),
      elaboracion: extractStage(stageColStart + colsPerStage, 'elaboracion'),
      validacion: extractStage(stageColStart + colsPerStage * 2, 'validacion')
    },
    etapasExternas: {
      gobernacion: extractStage(stageColStart + colsPerStage * 3, 'gobernacion'),
      proveedor: extractStage(stageColStart + colsPerStage * 4, 'proveedor'),
      dependenciaEjecutora: extractStage(stageColStart + colsPerStage * 5, 'dependenciaEjecutora'),
      administracion: extractStage(stageColStart + colsPerStage * 6, 'administracion'),
      secretaria: extractStage(stageColStart + colsPerStage * 7, 'secretaria'),
      alcaldesa: extractStage(stageColStart + colsPerStage * 8, 'alcaldesa'),
      anexo: anexoStage,
      entrega: extractStage(stageColStart + colsPerStage * 10, 'entrega')
    },
    documentos: {
      comite: idxComite !== -1 ? safe(idxComite) : "",
      expediente: idxExpediente !== -1 ? safe(idxExpediente) : "",
      contratoFirmado: idxContrato !== -1 ? safe(idxContrato) : ""
    },
    creadoEditadoPor: idxCreador !== -1 ? safe(idxCreador) : ""
  };
}

/**
 * Guarda o actualiza un contrato
 */
function guardarProgresoContrato(datos, usuarioAutenticado) {
  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  if (!sheetName || String(sheetName).trim() === "") {
    throw new Error("No se pudo guardar: El nombre de la hoja CONFIG.SHEET_NAME no está definido.");
  }
  const sheet = getSheetSafe(sheetName);
  if (!sheet) throw new Error("No se pudo guardar: Hoja de contratos no encontrada.");
  const data = sheet.getDataRange().getValues();
  let fila = -1;

  // Buscar si ya existe por consecutivo para evitar duplicados
  if (datos.consecutivo) {
    const searchId = String(datos.consecutivo).trim();
    const displayValues = sheet.getDataRange().getDisplayValues();
    for (let i = 1; i < displayValues.length; i++) {
      if (displayValues[i][0].trim() === searchId) {
        fila = i + 1;
        break;
      }
    }
  }

  const esCreacion = (fila === -1);

  if (fila === -1) {
    const lastRow = sheet.getLastRow();
    // Obtener todos los valores de la columna A para encontrar el ID máximo real
    const ids = sheet.getRange(1, 1, Math.max(lastRow, 1), 1).getValues().flat();
    let maxId = 0;
    for (let i = 1; i < ids.length; i++) {
      const currentId = parseInt(ids[i]);
      if (!isNaN(currentId) && currentId > maxId) maxId = currentId;
    }

    fila = lastRow + 1;
    sheet.getRange(fila, 1).setValue(maxId + 1);
  }

  const info = datos.infoGeneral;
  const generalValues = [[
    info.numContrato, info.dependencia, info.tipoContratacion, info.objeto,
    info.procedimiento, info.tipoContrato, info.proveedor, info.inicioVigencia,
    info.finVigencia, info.monto, info.desglose, info.fechaAprobacion, info.fechaSolicitud,
    "Activo" // Col O - ESTATUS_GENERAL
  ]];
  sheet.getRange(fila, 2, 1, 14).setValues(generalValues);

  const stageColStart = 16; // Col P
  const colsPerStage = 11;

  const mapStage = (s) => [
    s.estatus, s.inicio, s.fin,
    s.fechaObs, s.detalleObs, s.fechaSolv,
    s.tipoObs || "", s.origenJuridico || false, s.origenDependencia || false,
    s.fechaVigencia || "", s.montoSinIva || ""
  ];

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

  // Guardar URLs de documentos si existen
  if (datos.documentos) {
    const colExpediente = findColumnByHeader(sheet, "URL_EXPEDIENTE");
    const colContrato = findColumnByHeader(sheet, "URL_CONTRATO_FIRMADO");

    if (colExpediente !== -1) sheet.getRange(fila, colExpediente).setValue(datos.documentos.expediente || "");
    if (colContrato !== -1) sheet.getRange(fila, colContrato).setValue(datos.documentos.contratoFirmado || "");
  }

  // Guardar exención si aplica
  const colSeExime = findColumnByHeader(sheet, "ANEXO_SE_EXIME");
  const colFechaExencion = findColumnByHeader(sheet, "ANEXO_FECHA_EXENCION");
  if (datos.etapasExternas && datos.etapasExternas.anexo) {
    const exAnexo = datos.etapasExternas.anexo;
    if (colSeExime !== -1) {
      sheet.getRange(fila, colSeExime).setValue(exAnexo.seExime || "NO");
    }
    if (colFechaExencion !== -1) {
      sheet.getRange(fila, colFechaExencion).setValue(exAnexo.fechaExencion || "");
    }
  }

  // Guardar creador/editor
  let colCreador = findColumnByHeader(sheet, "Creado/Editado por");
  if (colCreador === -1) {
    colCreador = findColumnByHeader(sheet, "CREADO_EDITADO_POR");
  }
  let identificadorUsuario = usuarioAutenticado || "Anónimo";
  if (colCreador !== -1) {
    let emailActivo = "";
    try {
      emailActivo = Session.getActiveUser().getEmail();
    } catch (_) {}

    if (emailActivo && emailActivo !== "") {
      identificadorUsuario = identificadorUsuario + " (" + emailActivo + ")";
    }
    sheet.getRange(fila, colCreador).setValue(identificadorUsuario);
  }

  const consecutivoFinal = sheet.getRange(fila, 1).getValue();
  const accionText = esCreacion ? "Crear" : "Editar";
  registrarEnBitacora(identificadorUsuario, accionText, "Contratos", "Consecutivo ID: " + consecutivoFinal + ", No. Contrato: " + info.numContrato);

  return { success: true, message: "Contrato guardado exitosamente", consecutivo: consecutivoFinal };
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
function getIndicatorLocal(ini, fin, isSec, key) {
  const dias = calcularDiasHabiles(ini, fin);
  const ind = calcularIndicadorVisual(dias, isSec);
  return { dias, ind, key };
}

/**
 * Calcula múltiples indicadores en una sola llamada al servidor
 */
function getIndicatorsBatch(stagesArray) {
  return stagesArray.map(s => {
    if (!s.ini || !s.fin) return { key: s.key, dias: 0, ind: { color: 'GRIS' } };
    const dias = calcularDiasHabiles(s.ini, s.fin);
    const ind = calcularIndicadorVisual(dias, s.isSec);
    return { key: s.key, dias, ind };
  });
}

function obtenerListaContratos() {
  console.log("Iniciando obtenerListaContratos con cálculo de tiempo transcurrido...");
  try {
    const sheetName = CONFIG && CONFIG.SHEET_NAME;
    if (!sheetName || String(sheetName).trim() === "") {
      console.log("obtenerListaContratos: El nombre de la hoja CONFIG.SHEET_NAME no está definido.");
      return [];
    }
    const sheet = getSheetSafe(sheetName);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Obtenemos todos los datos para procesar la lógica de tiempo
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const lista = [];

    const headers = data[0];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = String(row[0]).trim();
      if (!id) continue;

      const c = procesarFilaParaContrato(row, i + 1, headers);

      // Lógica de Tiempo Transcurrido para Estatus General
      // Inicio: Fecha Solicitud (infoGeneral.fechaSolicitud)
      // Fin: Si Entrega es "Completa", usar su fecha de fin. Sino, usar hoy.
      const fechaInicio = c.infoGeneral.fechaSolicitud;
      let fechaFin = new Date();
      let esFinalizado = false;

      if (c.etapasExternas.entrega.estatus === "Completa" && c.etapasExternas.entrega.fin) {
        fechaFin = new Date(c.etapasExternas.entrega.fin);
        esFinalizado = true;
      }

      const diasTranscurridos = calcularDiasHabiles(fechaInicio, fechaFin);
      const estatusTexto = esFinalizado ?
        "Finalizado (" + diasTranscurridos + " días)" :
        "En Proceso (" + diasTranscurridos + " días)";

      lista.push({
        consecutivo: id,
        numContrato: c.infoGeneral.numContrato,
        dependencia: c.infoGeneral.dependencia,
        tipo: c.infoGeneral.tipoContratacion,
        proveedor: c.infoGeneral.proveedor,
        estatus: estatusTexto,
        esFinalizado: esFinalizado,
        creadoEditadoPor: c.creadoEditadoPor || "",
        expedienteUrl: (c.documentos && c.documentos.expediente) || "",
        contratoUrl: (c.documentos && c.documentos.contratoFirmado) || ""
      });
    }

    console.log("Lista generada con " + lista.length + " registros.");
    return lista;
  } catch (e) {
    console.error("Error en obtenerListaContratos: " + e.toString());
    return [];
  }
}


/**
 * Encuentra el índice de una columna por su encabezado (1-based)
 */
function findColumnByHeader(sheet, headerName) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return -1;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = headers.indexOf(headerName);
  return idx !== -1 ? idx + 1 : -1;
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  if (!sheetName || String(sheetName).trim() === "") {
    console.warn("setupDatabase: CONFIG.SHEET_NAME no está definido.");
    return;
  }
  let sheet = getSheetSafe(sheetName);

  const headers = ["CONSECUTIVO", "NUM_CONTRATO", "DEPENDENCIA_EJECUTORA", "TIPO_CONTRATACION", "OBJETO", "PROCEDIMIENTO", "TIPO_CONTRATO", "PROVEEDOR", "INICIO_VIGENCIA", "FIN_VIGENCIA", "MONTO", "DESGLOSE", "FECHA_APROBACION", "FECHA_SOLICITUD", "ESTATUS_GENERAL"];
  const stages = ["REV_DOC", "ELAB_CONT", "VAL_JUR", "GOB", "PROV", "DEP_EJEC", "ADMIN", "SEC", "ALCALDESA", "ANEXO", "ENTREGA"];
  stages.forEach(s => {
    headers.push(
      s + "_ESTATUS", s + "_INICIO", s + "_FIN",
      s + "_FECHA_OBS", s + "_DETALLE_OBS", s + "_FECHA_SOLV",
      s + "_TIPO_OBS", s + "_ORIGEN_JURIDICO", s + "_ORIGEN_DEPENDENCIA",
      s + "_FECHA_VIGENCIA", s + "_MONTO_SIN_IVA"
    );
  });
  headers.push("URL_COMITE", "URL_EXPEDIENTE", "URL_CONTRATO_FIRMADO", "Creado/Editado por");

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f3f3f3");
  } else {
    // Si la hoja existe, verificar si el número de columnas coincide.
    // Si no, es probable que necesitemos migrar (esto es una simplificación)
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length !== headers.length) {
       console.log("Actualizando cabeceras de la hoja...");
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f3f3f3");
    }
  }
  sheet.setFrozenRows(1);

  const resumenSheetName = CONFIG && CONFIG.RESUMEN_SHEET;
  if (resumenSheetName && String(resumenSheetName).trim() !== "") {
    if (!getSheetSafe(resumenSheetName)) ss.insertSheet(resumenSheetName);
  }

  const logSheetName = CONFIG && CONFIG.LOG_SHEET;
  if (logSheetName && String(logSheetName).trim() !== "") {
    if (!getSheetSafe(logSheetName)) ss.insertSheet(logSheetName).appendRow(["FECHA", "CONSECUTIVO", "TIPO", "FILE", "URL", "USER"]);
  }

  const configSheetName = CONFIG && CONFIG.CONFIG_SHEET;
  if (configSheetName && String(configSheetName).trim() !== "") {
    if (!getSheetSafe(configSheetName)) {
      ss.insertSheet(configSheetName).getRange(1, 1, 6, 2).setValues([
        ["PARAMETRO", "VALOR"], ["FOLDER_ID_RAIZ", ""], ["UMBRAL_ESTANDAR_VERDE", 3],
        ["UMBRAL_ESTANDAR_AMARILLO", 5], ["UMBRAL_SECRETARIA_VERDE", 5], ["UMBRAL_SECRETARIA_AMARILLO", 9]
      ]);
    }
  }

  // Configura la tabla de usuarios
  getUsuariosAdminSheet();
  // Configura la bitácora
  getBitacoraSheet();
}

/**
 * Obtiene o crea la hoja de Bitácora
 */
function getBitacoraSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Bitácora");
  if (sheet) return sheet;

  sheet = ss.insertSheet("Bitácora");
  sheet.getRange(1, 1, 1, 5)
       .setValues([["Fecha/Hora", "Usuario", "Acción (Crear/Editar/Eliminar)", "Módulo", "Detalle/ID afectado"]])
       .setFontWeight("bold")
       .setBackground("#f3f3f3");
  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * Registra un movimiento en la hoja de Bitácora
 */
function registrarEnBitacora(usuario, accion, modulo, detalle) {
  try {
    const sheet = getBitacoraSheet();
    if (!sheet) return;

    const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
    sheet.appendRow([fechaHora, usuario || "Anónimo", accion, modulo, detalle]);
  } catch (e) {
    console.error("Error al registrar en bitácora: " + e.toString());
  }
}

/**
 * Obtiene los registros de la Bitácora para el rol Administrador
 */
function obtenerRegistrosBitacora(userEmail) {
  console.log("obtenerRegistrosBitacora: solicitado por " + userEmail);
  try {
    const sheetUsuarios = getUsuariosAdminSheet();
    const usuariosData = sheetUsuarios.getDataRange().getValues();
    let rol = "";
    for (let i = 1; i < usuariosData.length; i++) {
      if (String(usuariosData[i][0]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
        rol = String(usuariosData[i][2]).trim();
        break;
      }
    }

    if (rol !== "Administrador") {
      throw new Error("Acceso denegado: Se requiere rol de Administrador para ver la Bitácora.");
    }

    const sheet = getBitacoraSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
    const list = data.map(row => {
      return {
        fechaHora: row[0],
        usuario: row[1],
        accion: row[2],
        modulo: row[3],
        detalle: row[4]
      };
    });

    // Ordenar descendente (últimos movimientos primero)
    list.reverse();
    return list;
  } catch (e) {
    console.error("Error en obtenerRegistrosBitacora: " + e.toString());
    throw new Error(e.toString());
  }
}

/**
 * Obtiene o crea la hoja de Usuarios_Admin
 */
function getUsuariosAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Usuarios_Admin");
  if (sheet) return sheet;

  // Intenta buscar una hoja con nombre "Jurídico"
  try {
    const files = DriveApp.getFilesByName("Jurídico");
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        const tempSS = SpreadsheetApp.open(file);
        const tempSheet = tempSS.getSheetByName("Usuarios_Admin");
        if (tempSheet) return tempSheet;
      }
    }
  } catch (e) {
    console.warn("No se pudo buscar la hoja 'Jurídico' en Drive: " + e.toString());
  }

  // Crear en la hoja actual si no existe
  sheet = ss.insertSheet("Usuarios_Admin");
  sheet.getRange(1, 1, 1, 4).setValues([["Email", "Contraseña", "Rol", "Nombre"]]).setFontWeight("bold").setBackground("#f3f3f3");
  // Registros iniciales para pruebas
  sheet.getRange(2, 1, 1, 4).setValues([["admin@gestion-contratos.com", "admin123", "Administrador", "Admin de Prueba"]]);
  sheet.getRange(3, 1, 1, 4).setValues([["supervisor@gestion-contratos.com", "super123", "Supervisor", "Supervisor de Prueba"]]);
  sheet.getRange(4, 1, 1, 4).setValues([["auditor@gestion-contratos.com", "auditor123", "Auditor", "Auditor de Prueba"]]);
  return sheet;
}

/**
 * Valida las credenciales de un usuario
 */
function validarCredenciales(email, password) {
  console.log("validarCredenciales: intentando validar para " + email);
  try {
    const sheet = getUsuariosAdminSheet();
    if (!sheet) {
      return { success: false, message: "No se pudo acceder a la tabla de usuarios." };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const dbEmail = String(data[i][0]).trim().toLowerCase();
      const dbPassword = String(data[i][1]).trim();
      const dbRol = String(data[i][2]).trim();
      const dbNombre = String(data[i][3]).trim();

      if (dbEmail === String(email).trim().toLowerCase() && dbPassword === String(password).trim()) {
        return {
          success: true,
          user: {
            email: dbEmail,
            nombre: dbNombre,
            rol: dbRol
          }
        };
      }
    }
    return { success: false, message: "Credenciales incorrectas." };
  } catch (e) {
    console.error("Error en validarCredenciales: " + e.toString());
    return { success: false, message: "Error interno del servidor: " + e.toString() };
  }
}

/**
 * Elimina un contrato si el usuario tiene rol de Administrador
 */
function eliminarContrato(consecutivo, userEmail) {
  console.log("eliminarContrato: consecutivo=" + consecutivo + ", userEmail=" + userEmail);
  try {
    const sheetUsuarios = getUsuariosAdminSheet();
    const usuariosData = sheetUsuarios.getDataRange().getValues();
    let rol = "";
    for (let i = 1; i < usuariosData.length; i++) {
      if (String(usuariosData[i][0]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
        rol = String(usuariosData[i][2]).trim();
        break;
      }
    }

    if (rol !== "Administrador") {
      return { success: false, message: "No tiene permisos para eliminar registros (se requiere rol de Administrador)." };
    }

    const sheetName = CONFIG && CONFIG.SHEET_NAME;
    if (!sheetName || String(sheetName).trim() === "") {
      throw new Error("El nombre de la hoja CONFIG.SHEET_NAME no está definido.");
    }
    const sheet = getSheetSafe(sheetName);
    if (!sheet) throw new Error("Hoja de contratos no encontrada.");

    const displayValues = sheet.getRange("A:A").getDisplayValues();
    const searchId = String(consecutivo).trim();
    let fila = -1;
    for (let i = 1; i < displayValues.length; i++) {
      if (displayValues[i][0].trim() === searchId) {
        fila = i + 1;
        break;
      }
    }

    if (fila !== -1) {
      const numContrato = sheet.getRange(fila, 2).getValue(); // Col B is NUM_CONTRATO
      sheet.deleteRow(fila);

      // Obtener el nombre del usuario
      let usuarioNombre = userEmail;
      try {
        const sheetUsuarios = getUsuariosAdminSheet();
        const uData = sheetUsuarios.getDataRange().getValues();
        for (let i = 1; i < uData.length; i++) {
          if (String(uData[i][0]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
            usuarioNombre = String(uData[i][3]).trim();
            break;
          }
        }
      } catch (_) {}

      registrarEnBitacora(usuarioNombre, "Eliminar", "Contratos", "Consecutivo ID: " + consecutivo + ", No. Contrato: " + numContrato);
      return { success: true, message: "Contrato eliminado exitosamente." };
    } else {
      return { success: false, message: "Registro no encontrado." };
    }
  } catch (e) {
    console.error("Error en eliminarContrato: " + e.toString());
    return { success: false, message: "Error al eliminar: " + e.toString() };
  }
}

function generarReporteKPI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  const resumenSheetName = CONFIG && CONFIG.RESUMEN_SHEET;
  if (!sheetName || String(sheetName).trim() === "" || !resumenSheetName || String(resumenSheetName).trim() === "") {
    console.log("generarReporteKPI: CONFIG.SHEET_NAME o CONFIG.RESUMEN_SHEET no están definidos.");
    return;
  }

  const mainSheet = getSheetSafe(sheetName);
  const resSheet = getSheetSafe(resumenSheetName);
  if (!mainSheet || !resSheet) return;

  const data = mainSheet.getDataRange().getValues();
  const headers = [
    "CONSECUTIVO", "NÚMERO DE CONTRATO", "DEPENDENCIA", "TIPO DE CONTRATO",
    "FECHA_SOLICITUD", "FECHA_JURIDICO", "DIAS_ETAPA_INTERNA", "INDICADOR_ETAPA_INTERNA",
    "AREAS_EXTERNAS_SELECCIONADAS", "FECHA_ULTIMA_ETAPA_EXTERNA", "DIAS_ETAPA_EXTERNA_TOTAL",
    "INDICADOR_ETAPA_EXTERNA", "TIEMPO_TOTAL_CONTRATO", "INDICADOR_TOTAL_CONTRATO",
    "ESTADO_ACTUAL", "DOCUMENTACION_COMPLETA", "INDICADOR_SECRETARIA_ESPECIFICO"
  ];

  const results = [headers];
  const sheetHeaders = data[0];

  for (let i = 1; i < data.length; i++) {
    const c = procesarFilaParaContrato(data[i], i + 1, sheetHeaders);
    if (!c.consecutivo) continue;

    const diasInt = calcularDiasHabiles(c.infoGeneral.fechaSolicitud, c.etapaInterna.validacion.fin);
    const indInt = calcularIndicadorVisual(diasInt, false);

    const ultimaExt = c.etapasExternas.entrega.fin || c.etapasExternas.anexo.fin || c.etapasExternas.alcaldesa.fin;
    const diasExt = calcularDiasHabiles(c.etapasExternas.gobernacion.inicio, ultimaExt);
    const indExt = calcularIndicadorVisual(diasExt, false);

    const diasSec = calcularDiasHabiles(c.etapasExternas.secretaria.inicio, c.etapasExternas.secretaria.fin);
    const indSec = c.etapasExternas.secretaria.inicio ? calcularIndicadorVisual(diasSec, true) : { emoji: "-" };

    const docsOk = (c.documentos.comite && c.documentos.expediente && c.documentos.contratoFirmado) ? "COMPLETA" : "FALTANTE";

    // Cálculo de Estatus Global con Tiempo Transcurrido
    const fInicio = c.infoGeneral.fechaSolicitud;
    let fFin = new Date();
    let isFinished = false;
    if (c.etapasExternas.entrega.estatus === "Completa" && c.etapasExternas.entrega.fin) {
      fFin = new Date(c.etapasExternas.entrega.fin);
      isFinished = true;
    }
    const tTotal = calcularDiasHabiles(fInicio, fFin);
    const estatusCalculado = isFinished ? "Finalizado (" + tTotal + " días)" : "En Proceso (" + tTotal + " días)";

    results.push([
      c.consecutivo, c.infoGeneral.numContrato, c.infoGeneral.dependencia, c.infoGeneral.tipoContrato,
      c.infoGeneral.fechaSolicitud, c.etapaInterna.validacion.fin, diasInt, indInt.emoji,
      "Gobernación, Proveedor, Jurídico, etc", ultimaExt, diasExt,
      indExt.emoji, tTotal, "",
      estatusCalculado, docsOk, indSec.emoji
    ]);
  }

  resSheet.clear();
  resSheet.getRange(1, 1, results.length, headers.length).setValues(results);
  resSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");

  SpreadsheetApp.getUi().alert("Reporte KPI generado con éxito en la hoja: " + CONFIG.RESUMEN_SHEET);
}

function obtenerDependenciasRegistradas() {
  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  if (!sheetName || String(sheetName).trim() === "") {
    console.log("obtenerDependenciasRegistradas: CONFIG.SHEET_NAME no está definido.");
    return [];
  }
  const sheet = getSheetSafe(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const deps = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2]) deps.add(data[i][2]);
  }
  return Array.from(deps).sort();
}

function obtenerMetricasDashboard(filtroDependencia) {
  console.log("Iniciando obtenerMetricasDashboard. Filtro:", filtroDependencia);
  const sheetName = CONFIG && CONFIG.SHEET_NAME;
  if (!sheetName || String(sheetName).trim() === "") {
    console.error("obtenerMetricasDashboard: CONFIG.SHEET_NAME no está definido.");
    return { verdes: 0, amarillos: 0, rojos: 0, secretariaRojo: 0, tasaRetrabajo: 0, tatPromedio: 0, obsJuridico: 0, obsDependencia: 0 };
  }
  const sheet = getSheetSafe(sheetName);
  if (!sheet) {
    console.error("No se encontró la hoja de contratos para el dashboard.");
    return { verdes: 0, amarillos: 0, rojos: 0, secretariaRojo: 0, tasaRetrabajo: 0, tatPromedio: 0, obsJuridico: 0, obsDependencia: 0 };
  }

  const data = sheet.getDataRange().getValues();
  console.log("Filas a procesar:", data.length - 1);

  let verdes = 0, amarillos = 0, rojos = 0, secretariaRojo = 0;
  let totalContratos = 0;
  let contratosConObs = 0;
  let sumaTAT = 0;
  let conteoTAT = 0;
  let obsJuridico = 0;
  let obsDependencia = 0;

  const sheetHeaders = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "") continue;
    if (filtroDependencia && data[i][2] !== filtroDependencia) continue;

    totalContratos++;
    const c = procesarFilaParaContrato(data[i], i + 1, sheetHeaders);
    let tieneObs = false;

    const allStages = [
      ...Object.values(c.etapaInterna),
      ...Object.values(c.etapasExternas)
    ];

    allStages.forEach((s, idx) => {
      if (s && s.inicio && s.fin) {
        const dias = calcularDiasHabiles(s.inicio, s.fin);
        const ind = calcularIndicadorVisual(dias, s.key === "secretaria");
        if (ind.color === "VERDE") verdes++;
        else if (ind.color === "AMARILLO") amarillos++;
        else if (ind.color === "ROJO") {
          rojos++;
          if (s.key === "secretaria") {
            secretariaRojo++;
          }
        }
      }

      // Re-trabajo y Origen
      if (s && s.detalleObs && s.detalleObs.trim() !== "") {
        tieneObs = true;
        if (s.origenJuridico === true || s.origenJuridico === "true") obsJuridico++;
        if (s.origenDependencia === true || s.origenDependencia === "true") obsDependencia++;
      }
    });

    if (tieneObs) contratosConObs++;

    // Ciclo de Entrega (TAT) - Solo registros con Entrega "Completa"
    if (c.etapasExternas.entrega.estatus === "Completa" && c.infoGeneral.fechaSolicitud && c.etapasExternas.entrega.fin) {
      const tat = calcularDiasHabiles(c.infoGeneral.fechaSolicitud, c.etapasExternas.entrega.fin);
      sumaTAT += tat;
      conteoTAT++;
    }
  }

  const res = {
    verdes, amarillos, rojos, secretariaRojo,
    tasaRetrabajo: totalContratos > 0 ? ((contratosConObs / totalContratos) * 100).toFixed(1) : 0,
    tatPromedio: conteoTAT > 0 ? (sumaTAT / conteoTAT).toFixed(1) : 0,
    obsJuridico,
    obsDependencia
  };
  console.log("Métricas finales calculadas:", JSON.stringify(res));
  return res;
}

function guardarConfiguracionServer(config) {
  const configSheetName = CONFIG && CONFIG.CONFIG_SHEET;
  if (!configSheetName || String(configSheetName).trim() === "") {
    console.error("guardarConfiguracionServer: CONFIG.CONFIG_SHEET no está definido.");
    return { success: false, message: "Nombre de hoja de configuración no definido." };
  }
  const sheet = getSheetSafe(configSheetName);
  if (!sheet) {
    console.error("guardarConfiguracionServer: Hoja de configuración no encontrada.");
    return { success: false, message: "Hoja de configuración no encontrada." };
  }
  sheet.getRange(2, 2, 5, 1).setValues([[config.folderId], [config.estandarVerde], [config.estandarAmarillo], [config.secretariaVerde], [config.secretariaAmarillo]]);
  return { success: true };
}

function obtenerConfiguracionFull() {
  const configSheetName = CONFIG && CONFIG.CONFIG_SHEET;
  if (!configSheetName || String(configSheetName).trim() === "") {
    console.error("obtenerConfiguracionFull: CONFIG.CONFIG_SHEET no está definido.");
    return { estandarVerde: 3, estandarAmarillo: 5, secretariaVerde: 5, secretariaAmarillo: 9, folderId: "" };
  }
  const configSheet = getSheetSafe(configSheetName);
  if (!configSheet) {
    return { estandarVerde: 3, estandarAmarillo: 5, secretariaVerde: 5, secretariaAmarillo: 9, folderId: "" };
  }
  const configData = configSheet.getDataRange().getValues();
  const configObj = {};
  configData.forEach(row => { configObj[row[0]] = row[1]; });

  return {
    estandarVerde: configObj["UMBRAL_ESTANDAR_VERDE"],
    estandarAmarillo: configObj["UMBRAL_ESTANDAR_AMARILLO"],
    secretariaVerde: configObj["UMBRAL_SECRETARIA_VERDE"],
    secretariaAmarillo: configObj["UMBRAL_SECRETARIA_AMARILLO"],
    folderId: configObj["FOLDER_ID_RAIZ"]
  };
}

/**
 * Obtiene todos los usuarios registrados (Rol Administrador únicamente)
 */
function obtenerUsuariosAdmin(requesterEmail) {
  try {
    const sheetUsuarios = getUsuariosAdminSheet();
    const data = sheetUsuarios.getDataRange().getValues();

    // Validar rol del solicitante
    let requesterRol = "";
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(requesterEmail).trim().toLowerCase()) {
        requesterRol = String(data[i][2]).trim();
        break;
      }
    }
    if (requesterRol !== "Administrador") {
      throw new Error("Acceso denegado: Se requiere rol de Administrador.");
    }

    const list = [];
    for (let i = 1; i < data.length; i++) {
      list.push({
        email: String(data[i][0]).trim(),
        contrasena: String(data[i][1]).trim(),
        rol: String(data[i][2]).trim(),
        nombre: String(data[i][3]).trim()
      });
    }
    return list;
  } catch (e) {
    console.error("Error en obtenerUsuariosAdmin: " + e.toString());
    throw new Error(e.toString());
  }
}

/**
 * Guarda o edita un usuario en la hoja Usuarios_Admin
 */
function guardarUsuarioAdmin(datos, requesterEmail) {
  try {
    const sheetUsuarios = getUsuariosAdminSheet();
    const data = sheetUsuarios.getDataRange().getValues();

    // Validar rol del solicitante
    let requesterRol = "";
    let requesterNombre = "";
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(requesterEmail).trim().toLowerCase()) {
        requesterRol = String(data[i][2]).trim();
        requesterNombre = String(data[i][3]).trim();
        break;
      }
    }
    if (requesterRol !== "Administrador") {
      throw new Error("Acceso denegado: Se requiere rol de Administrador.");
    }

    if (!datos.email || !datos.contrasena || !datos.rol || !datos.nombre) {
      return { success: false, message: "Todos los campos son obligatorios." };
    }

    const targetEmail = String(datos.email).trim().toLowerCase();

    // Buscar si ya existe por Email para decidir si es actualización o creación
    let filaEncontrada = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === targetEmail) {
        filaEncontrada = i + 1;
        break;
      }
    }

    if (datos.esNuevo) {
      if (filaEncontrada !== -1) {
        return { success: false, message: "Error: Ya existe un usuario registrado con el email '" + targetEmail + "'." };
      }

      sheetUsuarios.appendRow([targetEmail, datos.contrasena, datos.rol, datos.nombre]);
      registrarEnBitacora(requesterNombre, "Crear", "Usuarios", "Email: " + targetEmail + ", Rol: " + datos.rol + ", Nombre: " + datos.nombre);
      return { success: true, message: "Usuario creado exitosamente." };
    } else {
      if (filaEncontrada === -1) {
        return { success: false, message: "Error: No se encontró el usuario con el email '" + targetEmail + "' para actualizar." };
      }

      sheetUsuarios.getRange(filaEncontrada, 1, 1, 4).setValues([[targetEmail, datos.contrasena, datos.rol, datos.nombre]]);
      registrarEnBitacora(requesterNombre, "Editar", "Usuarios", "Email: " + targetEmail + ", Rol: " + datos.rol + ", Nombre: " + datos.nombre);
      return { success: true, message: "Usuario actualizado exitosamente." };
    }
  } catch (e) {
    console.error("Error en guardarUsuarioAdmin: " + e.toString());
    return { success: false, message: "Error: " + e.toString() };
  }
}

/**
 * Elimina un usuario de la hoja Usuarios_Admin
 */
function eliminarUsuarioAdmin(email, requesterEmail) {
  try {
    const sheetUsuarios = getUsuariosAdminSheet();
    const data = sheetUsuarios.getDataRange().getValues();

    // Validar rol del solicitante
    let requesterRol = "";
    let requesterNombre = "";
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(requesterEmail).trim().toLowerCase()) {
        requesterRol = String(data[i][2]).trim();
        requesterNombre = String(data[i][3]).trim();
        break;
      }
    }
    if (requesterRol !== "Administrador") {
      throw new Error("Acceso denegado: Se requiere rol de Administrador.");
    }

    const targetEmail = String(email).trim().toLowerCase();

    // Evitar que el propio Administrador se elimine a sí mismo
    if (targetEmail === String(requesterEmail).trim().toLowerCase()) {
      return { success: false, message: "Error: No puede eliminar su propia cuenta de administrador." };
    }

    let filaEncontrada = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === targetEmail) {
        filaEncontrada = i + 1;
        break;
      }
    }

    if (filaEncontrada !== -1) {
      sheetUsuarios.deleteRow(filaEncontrada);
      registrarEnBitacora(requesterNombre, "Eliminar", "Usuarios", "Email: " + targetEmail);
      return { success: true, message: "Usuario eliminado exitosamente." };
    } else {
      return { success: false, message: "Usuario no encontrado." };
    }
  } catch (e) {
    console.error("Error en eliminarUsuarioAdmin: " + e.toString());
    return { success: false, message: "Error: " + e.toString() };
  }
}
