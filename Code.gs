/**
 * SISTEMA DE INVENTARIO FÍSICO - SUBDIRECCIÓN DE MEJORA REGULATORIA
 * Backend: Code.gs
 */

// Cabeceras exactas para la hoja "Inventario"
const HEADERS_INVENTARIO = [
  "No.", "No. INV.", "DESCRIPCION", "SERIE", "MODELO", "MARCA", "ESTADO", "IMPORTE",
  "UBICACION", "RESGUARDADO", "RESGUARDANTE_REAL", "UBICACION_REAL", "ESTADO_REAL",
  "ULTIMA_ACTUALIZACION", "USUARIO_OPERADOR", "FOTO_ID"
];

// Cabeceras exactas para la hoja "Bitacora"
const HEADERS_BITACORA = [
  "Fecha", "Usuario", "Accion", "No. INV.", "Detalle"
];

// Nombre de la carpeta de fotos en Google Drive
const NOMBRE_CARPETA_FOTOS = "Inventario_MejoraRegulatoria_Fotos";

/**
 * Función de inicio para la Web App.
 * Retorna la interfaz HTML renderizada.
 */
function doGet(e) {
  try {
    // Ejecutar diagnóstico al iniciar para auditar estado de conexión
    ejecutarDiagnosticoSMR();

    // Inicializar la base de datos (crear hojas o migrar columnas faltantes)
    inicializarBaseDatos();

    // Obtener parámetro de consulta opcional para cargar un artículo al inicio
    var noInvInicial = "";
    if (e && e.parameter && e.parameter.noinv) {
      noInvInicial = e.parameter.noinv;
    } else if (e && e.parameter && e.parameter.noInv) {
      noInvInicial = e.parameter.noInv;
    }

    var template = HtmlService.createTemplateFromFile('Index');
    // Para evitar ReferenceError en el cliente si se recarga
    template.initialNoInvQuery = noInvInicial;

    var output = template.evaluate();
    output.setTitle("Inventario Mejora Regulatoria");
    output.addMetaTag("viewport", "width=device-width, initial-scale=1, shrink-to-fit=no");
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return output;
  } catch (error) {
    Logger.log("Error fatal en doGet: " + error.toString());
    var errorHtml = "<html><body style='font-family: sans-serif; padding: 30px; background-color: #fce4ec; color: #c2185b;'>" +
                    "<h2>Error al cargar el Sistema de Inventario</h2>" +
                    "<p>Se produjo un error en el servidor al inicializar la aplicación:</p>" +
                    "<pre style='background: #fff; padding: 15px; border: 1px solid #c2185b; overflow-x: auto;'>" + error.toString() + "</pre>" +
                    "<p>Por favor verifique los permisos de la hoja de cálculo o el registro de ejecuciones en Apps Script.</p>" +
                    "</body></html>";
    return HtmlService.createHtmlOutput(errorHtml).setTitle("Error de Conexión");
  }
}

/**
 * Helper para incluir archivos HTML (CSS/JS) en el template principal.
 */
function include(filename) {
  try {
    filename = capitalize(filename);
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    Logger.log("Error incluyendo archivo '" + filename + "': " + err.toString());
    return "<!-- Error al incluir '" + filename + "': " + err.toString() + " -->";
  }
}

/**
 * Capitaliza la primera letra para mapear de manera segura a los archivos.
 * Preserva el CamelCase (ej. panelCliente -> PanelCliente)
 */
function capitalize(s) {
  if (typeof s !== 'string' || s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Obtiene el Spreadsheet de base de datos de manera robusta.
 * Si falla el container-bound, cae hacia ScriptProperties y busca por nombre en Drive.
 */
function getActiveSpreadsheetSafe() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {
    Logger.log("Fallo al obtener active spreadsheet (puede ser standalone): " + e.toString());
  }

  var prop = PropertiesService.getScriptProperties();
  var savedId = prop.getProperty("SPREADSHEET_ID");
  if (savedId) {
    try {
      ss = SpreadsheetApp.openById(savedId);
      if (ss) return ss;
    } catch (e) {
      Logger.log("ID guardado de Spreadsheet no es válido o inaccesible: " + e.toString());
    }
  }

  // Buscar en Drive nombres similares
  var queryNames = ['InvetarioMR', 'InventarioMR', 'Inventario', 'Invetario'];
  for (var i = 0; i < queryNames.length; i++) {
    var files = DriveApp.getFilesByName(queryNames[i]);
    while (files.hasNext()) {
      var file = files.next();
      try {
        ss = SpreadsheetApp.open(file);
        if (ss) {
          prop.setProperty("SPREADSHEET_ID", ss.getId());
          Logger.log("Spreadsheet encontrado en Drive y guardado: " + ss.getName() + " (" + ss.getId() + ")");
          return ss;
        }
      } catch (err) {
        Logger.log("No se pudo abrir el archivo de Drive: " + file.getName());
      }
    }
  }

  throw new Error("No se pudo establecer conexión con ninguna base de datos compatible en Google Sheets.");
}

/**
 * Remueve acentos y pasa a minúsculas para comparaciones tolerantes.
 */
function limpiarTextoParaComparar(txt) {
  if (!txt || typeof txt !== 'string') return "";
  return txt.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
}

/**
 * Obtiene una hoja de cálculo de manera tolerante, ignorando mayúsculas/minúsculas y acentos.
 * Validación estricta al inicio para evitar TypeError con valores no strings o nulos.
 */
function getSheetSafe(name) {
  if (!name || typeof name !== 'string') {
    Logger.log("getSheetSafe: Parámetro de nombre no válido o nulo.");
    return null;
  }

  var ss = getActiveSpreadsheetSafe();
  var sheets = ss.getSheets();
  var nameNormalized = limpiarTextoParaComparar(name);

  // Buscar coincidencia exacta primero
  var sheetExact = ss.getSheetByName(name);
  if (sheetExact) return sheetExact;

  // Buscar de forma tolerante
  for (var i = 0; i < sheets.length; i++) {
    var currentNameNormalized = limpiarTextoParaComparar(sheets[i].getName());
    if (currentNameNormalized === nameNormalized) {
      return sheets[i];
    }
  }

  // Fallbacks específicos para errores ortográficos comunes
  if (nameNormalized === "inventario") {
    for (var i = 0; i < sheets.length; i++) {
      var cName = limpiarTextoParaComparar(sheets[i].getName());
      if (cName.indexOf("invet") === 0 || cName.indexOf("invent") === 0) {
        return sheets[i];
      }
    }
  }

  return null;
}

/**
 * Inicializa las hojas de la base de datos y aplica la lógica de auto-migración de columnas.
 */
function inicializarBaseDatos() {
  var ss = getActiveSpreadsheetSafe();

  // 1. Hoja Inventario
  var sheetInventario = getSheetSafe("Inventario");
  if (!sheetInventario) {
    sheetInventario = ss.insertSheet("Inventario");
    sheetInventario.appendRow(HEADERS_INVENTARIO);
    // Aplicar estilo simple a cabeceras
    sheetInventario.getRange(1, 1, 1, HEADERS_INVENTARIO.length)
                   .setBackground("#1B5E20")
                   .setFontColor("#FFFFFF")
                   .setFontWeight("bold");
  } else {
    // Auto-migración de esquema si faltan columnas
    var headersActuales = sheetInventario.getRange(1, 1, 1, sheetInventario.getLastColumn()).getValues()[0];
    var mapHeadersActuales = headersActuales.map(function(h) { return limpiarTextoParaComparar(h); });

    for (var i = 0; i < HEADERS_INVENTARIO.length; i++) {
      var headerObjetivo = HEADERS_INVENTARIO[i];
      var headerObjNorm = limpiarTextoParaComparar(headerObjetivo);
      if (mapHeadersActuales.indexOf(headerObjNorm) === -1) {
        // La columna no existe, se añade al final
        var colNueva = sheetInventario.getLastColumn() + 1;
        sheetInventario.getRange(1, colNueva).setValue(headerObjetivo)
                       .setBackground("#1B5E20")
                       .setFontColor("#FFFFFF")
                       .setFontWeight("bold");
        Logger.log("Columna agregada dinámicamente en migración: " + headerObjetivo);
      }
    }
  }

  // 2. Hoja Bitacora
  var sheetBitacora = getSheetSafe("Bitacora");
  if (!sheetBitacora) {
    sheetBitacora = ss.insertSheet("Bitacora");
    sheetBitacora.appendRow(HEADERS_BITACORA);
    sheetBitacora.getRange(1, 1, 1, HEADERS_BITACORA.length)
                 .setBackground("#424242")
                 .setFontColor("#FFFFFF")
                 .setFontWeight("bold");
  } else {
    // Verificar cabeceras de bitácora
    var headersBitActuales = sheetBitacora.getRange(1, 1, 1, sheetBitacora.getLastColumn()).getValues()[0];
    if (headersBitActuales.length < HEADERS_BITACORA.length) {
      sheetBitacora.getRange(1, 1, 1, HEADERS_BITACORA.length).setValues([HEADERS_BITACORA])
                   .setBackground("#424242")
                   .setFontColor("#FFFFFF")
                   .setFontWeight("bold");
    }
  }
}

/**
 * Obtiene el rango de datos de Inventario limitando de forma segura
 * el número de columnas para evitar out-of-bounds exceptions.
 */
function getInventarioRowsAndData() {
  var sheet = getSheetSafe("Inventario");
  if (!sheet) return { headers: [], rows: [] };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { headers: [], rows: [] };

  // Cargar cabeceras reales
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Cargar valores, limitando columnas para evitar desbordamiento
  var capCol = Math.min(lastCol, HEADERS_INVENTARIO.length);
  var values = sheet.getRange(2, 1, lastRow - 1, capCol).getValues();

  return {
    headers: headers,
    rows: values
  };
}

/**
 * Obtiene la lista completa de artículos para mostrar en la app.
 * Filtra los registros vacíos (donde No. INV es nulo o vacío).
 */
function listarArticulos() {
  try {
    var data = getInventarioRowsAndData();
    if (data.rows.length === 0) return [];

    var headers = data.headers;
    var listado = [];

    // Crear mapa de índices para mapeo flexible
    var idxNo = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no."; });
    var idxNoInv = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no. inv."; });
    var idxDesc = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "descripcion"; });
    var idxSerie = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "serie"; });
    var idxModelo = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "modelo"; });
    var idxMarca = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "marca"; });
    var idxEstado = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "estado"; });
    var idxImporte = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "importe"; });
    var idxUbicacion = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ubicacion"; });
    var idxResguardado = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "resguardado"; });
    var idxResgReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "resguardante_real"; });
    var idxUbiReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ubicacion_real"; });
    var idxEstReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "estado_real"; });
    var idxUltAct = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ultima_actualizacion"; });
    var idxUsrOp = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "usuario_operador"; });
    var idxFotoId = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "foto_id"; });

    for (var i = 0; i < data.rows.length; i++) {
      var row = data.rows[i];
      var noInv = idxNoInv !== -1 ? String(row[idxNoInv] || "").trim() : "";

      // Filtrado defensivo de filas vacías
      if (!noInv) continue;

      var item = {
        "No.": idxNo !== -1 ? row[idxNo] : "",
        "No. INV.": noInv,
        "DESCRIPCION": idxDesc !== -1 ? row[idxDesc] : "",
        "SERIE": idxSerie !== -1 ? row[idxSerie] : "",
        "MODELO": idxModelo !== -1 ? row[idxModelo] : "",
        "MARCA": idxMarca !== -1 ? row[idxMarca] : "",
        "ESTADO": idxEstado !== -1 ? row[idxEstado] : "",
        "IMPORTE": idxImporte !== -1 ? row[idxImporte] : 0,
        "UBICACION": idxUbicacion !== -1 ? row[idxUbicacion] : "",
        "RESGUARDADO": idxResguardado !== -1 ? row[idxResguardado] : "",
        "RESGUARDANTE_REAL": idxResgReal !== -1 ? row[idxResgReal] : "",
        "UBICACION_REAL": idxUbiReal !== -1 ? row[idxUbiReal] : "",
        "ESTADO_REAL": idxEstReal !== -1 ? row[idxEstReal] : "",
        "ULTIMA_ACTUALIZACION": idxUltAct !== -1 ? row[idxUltAct] : "",
        "USUARIO_OPERADOR": idxUsrOp !== -1 ? row[idxUsrOp] : "",
        "FOTO_ID": idxFotoId !== -1 ? row[idxFotoId] : ""
      };

      listado.push(item);
    }

    return listado;
  } catch (error) {
    Logger.log("Error en listarArticulos: " + error.toString());
    throw new Error("No se pudo obtener el listado de inventario: " + error.message);
  }
}

/**
 * Obtiene los valores únicos para autocompletar ubicaciones y resguardantes.
 */
function obtenerCamposAutocompletar() {
  try {
    var articulos = listarArticulos();
    var ubicaciones = {};
    var resguardantes = {};

    articulos.forEach(function(item) {
      var ubi = String(item["UBICACION_REAL"] || item["UBICACION"] || "").trim();
      var res = String(item["RESGUARDANTE_REAL"] || item["RESGUARDADO"] || "").trim();
      if (ubi) ubicaciones[ubi] = true;
      if (res) resguardantes[res] = true;
    });

    return {
      ubicaciones: Object.keys(ubicaciones).sort(),
      resguardantes: Object.keys(resguardantes).sort()
    };
  } catch (error) {
    Logger.log("Error en obtenerCamposAutocompletar: " + error.toString());
    return { ubicaciones: [], resguardantes: [] };
  }
}

/**
 * Obtiene las estadísticas de inicio.
 */
function obtenerEstadisticas() {
  try {
    var articulos = listarArticulos();
    var total = articulos.length;
    var levantados = 0;

    articulos.forEach(function(item) {
      if (String(item["UBICACION_REAL"] || "").trim() !== "") {
        levantados++;
      }
    });

    return {
      total: total,
      levantados: levantados,
      pendientes: Math.max(0, total - levantados)
    };
  } catch (error) {
    Logger.log("Error al obtener estadísticas: " + error.toString());
    return { total: 0, levantados: 0, pendientes: 0 };
  }
}

/**
 * Busca un artículo por No. INV.
 */
function buscarPorNoInv(noInv) {
  try {
    var articulos = listarArticulos();
    var q = String(noInv).trim().toLowerCase();
    for (var i = 0; i < articulos.length; i++) {
      if (String(articulos[i]["No. INV."]).trim().toLowerCase() === q) {
        return articulos[i];
      }
    }
    return null;
  } catch (error) {
    Logger.log("Error en buscarPorNoInv: " + error.toString());
    return null;
  }
}

/**
 * Busca un artículo por Serie.
 */
function buscarPorSerie(serie) {
  try {
    var articulos = listarArticulos();
    var q = String(serie).trim().toLowerCase();
    if (!q) return [];

    var matches = [];
    for (var i = 0; i < articulos.length; i++) {
      var s = String(articulos[i]["SERIE"] || "").trim().toLowerCase();
      if (s === q && s !== "s/s" && s !== "s/s." && s !== "sin serie" && s !== "") {
        matches.push(articulos[i]);
      }
    }
    return matches;
  } catch (error) {
    Logger.log("Error en buscarPorSerie: " + error.toString());
    return [];
  }
}

/**
 * Formatea el nombre completo o correo del usuario agregando una marca de tiempo exacta.
 */
function formatearNombreCompleto(usuario) {
  var email = usuario || Session.getActiveUser().getEmail() || "Usuario Desconocido";
  var d = new Date();
  var pad = function(n) { return n < 10 ? '0' + n : n; };
  var fechaStr = pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " +
                 pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  return email + " - " + fechaStr;
}

/**
 * Registra un movimiento en la pestaña "Bitacora"
 */
function registrarBitacora(accion, noInv, detalle) {
  try {
    var sheet = getSheetSafe("Bitacora");
    if (!sheet) return;

    var fecha = new Date();
    var usuario = Session.getActiveUser().getEmail() || "Usuario Desconocido";

    sheet.appendRow([
      fecha,
      usuario,
      String(accion).toUpperCase(),
      String(noInv || ""),
      typeof detalle === 'object' ? JSON.stringify(detalle) : String(detalle || "")
    ]);
  } catch (e) {
    Logger.log("Error al escribir en bitácora: " + e.toString());
  }
}

/**
 * Guarda el levantamiento de un bien.
 */
function guardarLevantamiento(noInv, datos) {
  try {
    var sheet = getSheetSafe("Inventario");
    if (!sheet) throw new Error("No se pudo obtener la hoja Inventario.");

    var data = getInventarioRowsAndData();
    var headers = data.headers;
    var lastRow = sheet.getLastRow();

    var idxNoInv = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no. inv."; });
    var idxResgReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "resguardante_real"; });
    var idxUbiReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ubicacion_real"; });
    var idxEstReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "estado_real"; });
    var idxUltAct = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ultima_actualizacion"; });
    var idxUsrOp = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "usuario_operador"; });

    if (idxNoInv === -1) throw new Error("No se encuentra la columna 'No. INV.' en la hoja.");

    var targetRow = -1;
    var q = String(noInv).trim().toLowerCase();

    for (var i = 0; i < data.rows.length; i++) {
      var cellVal = String(data.rows[i][idxNoInv]).trim().toLowerCase();
      if (cellVal === q) {
        targetRow = i + 2; // Fila real en la hoja (i es index 0, fila 1 es header)
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error("El artículo con No. INV. " + noInv + " no existe.");
    }

    var usuarioLog = formatearNombreCompleto(Session.getActiveUser().getEmail());
    var fechaActual = new Date();

    // Cambios para bitácora
    var anteriorUbi = idxUbiReal !== -1 ? sheet.getRange(targetRow, idxUbiReal + 1).getValue() : "";
    var anteriorRes = idxResgReal !== -1 ? sheet.getRange(targetRow, idxResgReal + 1).getValue() : "";
    var anteriorEst = idxEstReal !== -1 ? sheet.getRange(targetRow, idxEstReal + 1).getValue() : "";

    // Actualizar celdas
    if (idxResgReal !== -1) sheet.getRange(targetRow, idxResgReal + 1).setValue(datos.resguardanteReal);
    if (idxUbiReal !== -1) sheet.getRange(targetRow, idxUbiReal + 1).setValue(datos.ubicacionReal);
    if (idxEstReal !== -1) sheet.getRange(targetRow, idxEstReal + 1).setValue(datos.estadoReal);
    if (idxUltAct !== -1) sheet.getRange(targetRow, idxUltAct + 1).setValue(fechaActual);
    if (idxUsrOp !== -1) sheet.getRange(targetRow, idxUsrOp + 1).setValue(usuarioLog);

    var detalleCambio = {
      "anterior": { "ubicacion": anteriorUbi, "resguardante": anteriorRes, "estado": anteriorEst },
      "nuevo": { "ubicacion": datos.ubicacionReal, "resguardante": datos.resguardanteReal, "estado": datos.estadoReal }
    };

    registrarBitacora("ACTUALIZACION", noInv, detalleCambio);
    return { success: true, message: "Levantamiento guardado exitosamente." };
  } catch (error) {
    Logger.log("Error al guardar levantamiento: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Registra un traslado de bien (cambio rápido de ubicación y resguardante).
 */
function registrarTraslado(noInv, datos) {
  try {
    var sheet = getSheetSafe("Inventario");
    if (!sheet) throw new Error("No se pudo obtener la hoja Inventario.");

    var data = getInventarioRowsAndData();
    var headers = data.headers;

    var idxNoInv = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no. inv."; });
    var idxResgReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "resguardante_real"; });
    var idxUbiReal = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ubicacion_real"; });
    var idxUltAct = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ultima_actualizacion"; });
    var idxUsrOp = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "usuario_operador"; });

    if (idxNoInv === -1) throw new Error("No se encuentra la columna 'No. INV.' en la hoja.");

    var targetRow = -1;
    var q = String(noInv).trim().toLowerCase();

    for (var i = 0; i < data.rows.length; i++) {
      var cellVal = String(data.rows[i][idxNoInv]).trim().toLowerCase();
      if (cellVal === q) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error("El artículo con No. INV. " + noInv + " no existe.");
    }

    var anteriorUbi = idxUbiReal !== -1 ? sheet.getRange(targetRow, idxUbiReal + 1).getValue() : "";
    var anteriorRes = idxResgReal !== -1 ? sheet.getRange(targetRow, idxResgReal + 1).getValue() : "";

    var usuarioLog = formatearNombreCompleto(Session.getActiveUser().getEmail());
    var fechaActual = new Date();

    if (idxResgReal !== -1) sheet.getRange(targetRow, idxResgReal + 1).setValue(datos.resguardanteReal);
    if (idxUbiReal !== -1) sheet.getRange(targetRow, idxUbiReal + 1).setValue(datos.ubicacionReal);
    if (idxUltAct !== -1) sheet.getRange(targetRow, idxUltAct + 1).setValue(fechaActual);
    if (idxUsrOp !== -1) sheet.getRange(targetRow, idxUsrOp + 1).setValue(usuarioLog);

    var detalleTraslado = "Traslado de No. INV: " + noInv + " de [" + anteriorUbi + "] a [" + datos.ubicacionReal + "]. Motivo: " + datos.motivo;
    registrarBitacora("TRASLADO", noInv, detalleTraslado);

    return { success: true, message: "Traslado registrado exitosamente." };
  } catch (error) {
    Logger.log("Error al registrar traslado: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Registra el alta de un nuevo bien en la base de datos.
 */
function altaBien(datos) {
  try {
    var sheet = getSheetSafe("Inventario");
    if (!sheet) throw new Error("No se pudo obtener la hoja Inventario.");

    inicializarBaseDatos(); // Asegurar columnas correctas antes de insertar

    var noInvString = String(datos.noInv).trim();
    if (buscarPorNoInv(noInvString) !== null) {
      return { success: false, message: "El No. de Inventario '" + noInvString + "' ya existe en la base de datos." };
    }

    var data = getInventarioRowsAndData();
    var maxNo = 0;

    var idxNo = data.headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no."; });
    if (idxNo !== -1) {
      for (var i = 0; i < data.rows.length; i++) {
        var n = parseInt(data.rows[i][idxNo], 10);
        if (!isNaN(n) && n > maxNo) {
          maxNo = n;
        }
      }
    }
    var nuevoConsecutivo = maxNo + 1;

    var usuarioLog = formatearNombreCompleto(Session.getActiveUser().getEmail());
    var fechaActual = new Date();

    // Preparar fila completa según las columnas de la hoja
    var headers = data.headers;
    var nuevaFila = new Array(headers.length).fill("");

    var mapValores = {
      "no.": nuevoConsecutivo,
      "no. inv.": noInvString,
      "descripcion": String(datos.descripcion).trim(),
      "serie": String(datos.serie).trim(),
      "modelo": String(datos.modelo).trim(),
      "marca": String(datos.marca).trim(),
      "estado": String(datos.estado || "BUENO").trim(),
      "importe": parseFloat(datos.importe) || 0,
      "ubicacion": String(datos.ubicacion || "").trim(),
      "resguardado": String(datos.resguardado || "").trim(),
      "resguardante_real": String(datos.resguardanteReal || "").trim(),
      "ubicacion_real": String(datos.ubicacionReal || "").trim(),
      "estado_real": String(datos.estadoReal || "Bueno").trim(),
      "ultima_actualizacion": fechaActual,
      "usuario_operador": usuarioLog,
      "foto_id": ""
    };

    for (var i = 0; i < headers.length; i++) {
      var headerNorm = limpiarTextoParaComparar(headers[i]);
      if (mapValores.hasOwnProperty(headerNorm)) {
        nuevaFila[i] = mapValores[headerNorm];
      }
    }

    sheet.appendRow(nuevaFila);
    registrarBitacora("ALTA", noInvString, "Alta del bien No. INV: " + noInvString);

    return { success: true, message: "Bien dado de alta correctamente.", noInv: noInvString };
  } catch (error) {
    Logger.log("Error en altaBien: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Obtiene o crea la carpeta de fotos en Google Drive.
 */
function obtenerCarpetaFotosSafe() {
  try {
    var folders = DriveApp.getFoldersByName(NOMBRE_CARPETA_FOTOS);
    if (folders.hasNext()) {
      return folders.next();
    } else {
      var folder = DriveApp.createFolder(NOMBRE_CARPETA_FOTOS);
      Logger.log("Carpeta de fotos creada en Drive: " + NOMBRE_CARPETA_FOTOS);
      return folder;
    }
  } catch (e) {
    Logger.log("Error al obtener o crear carpeta de fotos: " + e.toString());
    throw new Error("No se pudo acceder o crear la carpeta '" + NOMBRE_CARPETA_FOTOS + "' en Drive.");
  }
}

/**
 * Sube una foto asociada a un artículo y guarda su ID en la columna FOTO_ID.
 */
function subirFotoArticulo(noInv, base64Data, fileName, index) {
  try {
    var sheet = getSheetSafe("Inventario");
    if (!sheet) throw new Error("No se pudo obtener la hoja Inventario.");

    var data = getInventarioRowsAndData();
    var headers = data.headers;

    var idxNoInv = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no. inv."; });
    var idxFotoId = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "foto_id"; });

    if (idxNoInv === -1 || idxFotoId === -1) throw new Error("Columnas necesarias para guardar foto no configuradas.");

    var targetRow = -1;
    var q = String(noInv).trim().toLowerCase();
    for (var i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i][idxNoInv]).trim().toLowerCase() === q) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error("El artículo con No. INV. " + noInv + " no existe.");
    }

    // Obtener la carpeta de fotos
    var folder = obtenerCarpetaFotosSafe();

    // Procesar datos base64
    var contentType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";"));
    var rawBase64 = base64Data.substring(base64Data.indexOf(",") + 1);
    var decoded = Utilities.base64Decode(rawBase64);

    // Formatear nombre de archivo: [No. INV.]_YYYYMMDD_HHmmss_[index].ext
    var date = new Date();
    var pad = function(num) { return num < 10 ? '0' + num : num; };
    var timestamp = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "_" +
                    pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());

    var ext = "jpg";
    if (contentType.indexOf("png") !== -1) ext = "png";
    if (contentType.indexOf("gif") !== -1) ext = "gif";
    if (contentType.indexOf("webp") !== -1) ext = "webp";

    var nombreArchivoFormateado = noInv + "_" + timestamp + "_" + (index || "0") + "." + ext;

    var blob = Utilities.newBlob(decoded, contentType, nombreArchivoFormateado);
    var file = folder.createFile(blob);

    // Compartir de manera pública para permitir la vista miniatura en la Web App
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log("No se pudo configurar uso compartido público de fotos, continuando: " + e.toString());
    }

    var driveId = file.getId();

    // Actualizar campo FOTO_ID en la fila
    var fotosActuales = String(sheet.getRange(targetRow, idxFotoId + 1).getValue() || "").trim();
    var listaFotos = fotosActuales ? fotosActuales.split(",") : [];
    listaFotos.push(driveId);

    sheet.getRange(targetRow, idxFotoId + 1).setValue(listaFotos.join(","));

    registrarBitacora("FOTO_ADJUNTA", noInv, "Foto adjunta al bien No. INV: " + noInv + " con ID: " + driveId);

    return { success: true, fileId: driveId, fileName: nombreArchivoFormateado };
  } catch (error) {
    Logger.log("Error al subir foto de artículo: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Elimina una foto de la base de datos y de Drive.
 */
function eliminarFotoArticulo(noInv, fotoId) {
  try {
    var sheet = getSheetSafe("Inventario");
    if (!sheet) throw new Error("No se pudo obtener la hoja Inventario.");

    var data = getInventarioRowsAndData();
    var headers = data.headers;

    var idxNoInv = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no. inv."; });
    var idxFotoId = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "foto_id"; });

    if (idxNoInv === -1 || idxFotoId === -1) throw new Error("Estructura de la hoja incompatible.");

    var targetRow = -1;
    var q = String(noInv).trim().toLowerCase();
    for (var i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i][idxNoInv]).trim().toLowerCase() === q) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error("El artículo con No. INV. " + noInv + " no existe.");
    }

    // Remover de la columna FOTO_ID
    var fotosActuales = String(sheet.getRange(targetRow, idxFotoId + 1).getValue() || "").trim();
    var listaFotos = fotosActuales ? fotosActuales.split(",") : [];
    var indice = listaFotos.indexOf(fotoId);

    if (indice !== -1) {
      listaFotos.splice(indice, 1);
      sheet.getRange(targetRow, idxFotoId + 1).setValue(listaFotos.join(","));
    }

    // Intentar eliminar de Google Drive
    try {
      var file = DriveApp.getFileById(fotoId);
      file.setTrashed(true);
    } catch (e) {
      Logger.log("No se pudo eliminar el archivo en Drive (puede ser que ya no exista): " + e.toString());
    }

    registrarBitacora("FOTO_ELIMINADA", noInv, "Foto eliminada del bien No. INV: " + noInv + " con ID: " + fotoId);
    return { success: true };
  } catch (error) {
    Logger.log("Error al eliminar foto: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Importación masiva de datos en lote desde el cliente.
 * Soporta actualización selectiva y omisión de duplicados.
 * Optimizado para rendimiento en lote (batch setValues) y evitar límites de ejecución de GAS.
 */
function importarDatosExcel(rows, opcionDuplicados) {
  try {
    var sheet = getSheetSafe("Inventario");
    if (!sheet) throw new Error("No se pudo obtener la hoja de Inventario.");

    inicializarBaseDatos(); // Asegurar migración de columnas

    var data = getInventarioRowsAndData();
    var headers = data.headers;

    var idxNo = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no."; });
    var idxNoInv = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "no. inv."; });

    if (idxNoInv === -1) throw new Error("La columna 'No. INV.' es obligatoria en la hoja de destino.");

    var valoresTrabajo = [];
    var inventarioExistente = {};

    // Normalizar y precargar todas las filas existentes en memoria para modificarlas directamente
    for (var i = 0; i < data.rows.length; i++) {
      var rowValores = data.rows[i];
      if (rowValores.length < headers.length) {
        var diff = headers.length - rowValores.length;
        for (var d = 0; d < diff; d++) {
          rowValores.push("");
        }
      } else if (rowValores.length > headers.length) {
        rowValores = rowValores.slice(0, headers.length);
      }

      valoresTrabajo.push(rowValores);

      var cod = String(rowValores[idxNoInv]).trim();
      if (cod) {
        inventarioExistente[cod.toLowerCase()] = {
          index: i,
          values: rowValores
        };
      }
    }

    // Calcular el consecutivo máximo "No." actual
    var maxNo = 0;
    if (idxNo !== -1) {
      for (var i = 0; i < valoresTrabajo.length; i++) {
        var n = parseInt(valoresTrabajo[i][idxNo], 10);
        if (!isNaN(n) && n > maxNo) {
          maxNo = n;
        }
      }
    }

    var nuevosCount = 0;
    var actualizadosCount = 0;
    var omitidosCount = 0;
    var erroresCount = 0;

    var usuarioLog = formatearNombreCompleto(Session.getActiveUser().getEmail());
    var fechaActual = new Date();

    // Procesar las filas recibidas
    for (var r = 0; r < rows.length; r++) {
      var rowData = rows[r];
      var noInvInput = String(rowData["No. INV."] || "").trim();

      if (!noInvInput) {
        erroresCount++;
        continue;
      }

      var noInvNorm = noInvInput.toLowerCase();
      var existe = inventarioExistente.hasOwnProperty(noInvNorm);

      if (existe) {
        if (opcionDuplicados === "omitir") {
          omitidosCount++;
          continue;
        } else if (opcionDuplicados === "actualizar") {
          var match = inventarioExistente[noInvNorm];
          var workingIndex = match.index;
          var filaExistente = valoresTrabajo[workingIndex];

          for (var c = 0; c < headers.length; c++) {
            var headerNormLim = limpiarTextoParaComparar(headers[c]);

            // Si el campo es patrimonial, actualizamos con lo que viene del Excel
            var keyBuscar = null;
            if (headerNormLim === "descripcion") keyBuscar = "DESCRIPCION";
            else if (headerNormLim === "serie") keyBuscar = "SERIE";
            else if (headerNormLim === "modelo") keyBuscar = "MODELO";
            else if (headerNormLim === "marca") keyBuscar = "MARCA";
            else if (headerNormLim === "estado") keyBuscar = "ESTADO";
            else if (headerNormLim === "importe") keyBuscar = "IMPORTE";
            else if (headerNormLim === "ubicacion") keyBuscar = "UBICACION";
            else if (headerNormLim === "resguardado") keyBuscar = "RESGUARDADO";

            if (keyBuscar && rowData.hasOwnProperty(keyBuscar)) {
              var valorGuardar = rowData[keyBuscar];
              if (keyBuscar === "IMPORTE") valorGuardar = parseFloat(valorGuardar) || 0;
              filaExistente[c] = valorGuardar;
            }

            // Si el campo es de levantamiento, actualizamos SOLO si viene explícitamente informado y no vacío
            var keyLev = null;
            if (headerNormLim === "resguardante_real") keyLev = "RESGUARDANTE_REAL";
            else if (headerNormLim === "ubicacion_real") keyLev = "UBICACION_REAL";
            else if (headerNormLim === "estado_real") keyLev = "ESTADO_REAL";
            else if (headerNormLim === "foto_id") keyLev = "FOTO_ID";

            if (keyLev && rowData.hasOwnProperty(keyLev) && String(rowData[keyLev]).trim() !== "") {
              filaExistente[c] = rowData[keyLev];
            }
          }

          // Actualizar ultima actualización y usuario operador
          var idxUltAct = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "ultima_actualizacion"; });
          var idxUsrOp = headers.findIndex(function(h) { return limpiarTextoParaComparar(h) === "usuario_operador"; });
          if (idxUltAct !== -1) filaExistente[idxUltAct] = fechaActual;
          if (idxUsrOp !== -1) filaExistente[idxUsrOp] = usuarioLog;

          actualizadosCount++;
        }
      } else {
        // Registro nuevo, insertar fila completa en memoria
        maxNo++;
        var nuevaFila = new Array(headers.length).fill("");

        var mapValores = {
          "no.": maxNo,
          "no. inv.": noInvInput,
          "descripcion": String(rowData["DESCRIPCION"] || "").trim(),
          "serie": String(rowData["SERIE"] || "SIN SERIE").trim(),
          "modelo": String(rowData["MODELO"] || "").trim(),
          "marca": String(rowData["MARCA"] || "").trim(),
          "estado": String(rowData["ESTADO"] || "BUENO").trim(),
          "importe": parseFloat(rowData["IMPORTE"]) || 0,
          "ubicacion": String(rowData["UBICACION"] || "").trim(),
          "resguardado": String(rowData["RESGUARDADO"] || "").trim(),
          "resguardante_real": String(rowData["RESGUARDANTE_REAL"] || "").trim(),
          "ubicacion_real": String(rowData["UBICACION_REAL"] || "").trim(),
          "estado_real": String(rowData["ESTADO_REAL"] || "").trim(),
          "ultima_actualizacion": fechaActual,
          "usuario_operador": usuarioLog,
          "foto_id": String(rowData["FOTO_ID"] || "").trim()
        };

        for (var c = 0; c < headers.length; c++) {
          var headerNormLim = limpiarTextoParaComparar(headers[c]);
          if (mapValores.hasOwnProperty(headerNormLim)) {
            nuevaFila[c] = mapValores[headerNormLim];
          }
        }

        valoresTrabajo.push(nuevaFila);

        // Agregar a la estructura de existentes para evitar duplicaciones dentro del mismo lote
        inventarioExistente[noInvNorm] = {
          index: valoresTrabajo.length - 1,
          values: nuevaFila
        };

        nuevosCount++;
      }
    }

    // Guardar la matriz de trabajo completa de un solo golpe (Batch operation)
    if (valoresTrabajo.length > 0) {
      sheet.getRange(2, 1, valoresTrabajo.length, headers.length).setValues(valoresTrabajo);
    }

    // Registrar evento de carga masiva en Bitácora
    var detalleBitacora = "Carga masiva realizada. Registros Nuevos: " + nuevosCount +
                          ", Actualizados: " + actualizadosCount + ", Omitidos: " + omitidosCount +
                          ", Errores: " + erroresCount + ". Opción duplicados: " + opcionDuplicados.toUpperCase();

    registrarBitacora("CARGA_EXCEL", "", detalleBitacora);

    return {
      success: true,
      nuevos: nuevosCount,
      actualizados: actualizadosCount,
      omitidos: omitidosCount,
      errores: erroresCount
    };
  } catch (error) {
    Logger.log("Error en importarDatosExcel: " + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Helper para obtener y procesar hojas de estilo CSS externas (como Bootstrap)
 * y retornarlas en formato inline. Resuelve el problema de Content Security Policy (CSP).
 * Soporta archivos > 100KB dividiéndolos en fragmentos en CacheService.
 * Reemplaza referencias de fuentes de FontAwesome relativas con URLs CDN absolutas.
 */
function getExternalCss(url) {
  var cache = CacheService.getScriptCache();
  // Crear una clave única de caché basada en la URL hash
  var cacheKey = "css_" + url.replace(/[^a-zA-Z0-9]/g, "").substring(0, 50);

  // Buscar en caché si ya está procesado
  var cacheLength = cache.get(cacheKey + "_len");
  if (cacheLength) {
    var totalChunks = parseInt(cacheLength, 10);
    var fullCss = "";
    for (var i = 0; i < totalChunks; i++) {
      var chunk = cache.get(cacheKey + "_" + i);
      if (chunk) fullCss += chunk;
    }
    if (fullCss) return fullCss;
  }

  try {
    var response = UrlFetchApp.fetch(url);
    var rawCss = response.getContentText();

    // Reescribir rutas relativas de FontAwesome (ej. webfonts) por enlaces CDN absolutos
    // Buscamos '../webfonts/' y reemplazamos por el CDN absoluto de fontawesome.
    var absoluteFontCdn = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/";
    var processedCss = rawCss.replace(/\.\.\/webfonts\//g, absoluteFontCdn);

    // Guardar en CacheService en fragmentos de hasta 95KB (límite de caché es 100KB)
    var chunkSize = 90 * 1024; // 90KB
    var index = 0;
    var offset = 0;

    while (offset < processedCss.length) {
      var chunk = processedCss.substring(offset, offset + chunkSize);
      cache.put(cacheKey + "_" + index, chunk, 21600); // Guardar por 6 horas (máximo permitido)
      offset += chunkSize;
      index++;
    }
    cache.put(cacheKey + "_len", index.toString(), 21600);

    return processedCss;
  } catch (err) {
    Logger.log("Error al recuperar CSS de " + url + ": " + err.toString());
    return "/* Error al cargar CSS externo: " + err.toString() + " */";
  }
}

/**
 * Función de diagnóstico que se puede ejecutar de forma interactiva en la consola de GAS
 * o automáticamente al arrancar la aplicación para auditar la conexión a la hoja de cálculo.
 */
function ejecutarDiagnosticoSMR() {
  var auditoria = {
    conectado: false,
    archivoNombre: "",
    archivoId: "",
    pestañasEncontradas: [],
    conteoInventario: 0,
    conteoBitacora: 0,
    columnasInventario: [],
    alertas: []
  };

  try {
    var ss = getActiveSpreadsheetSafe();
    auditoria.conectado = true;
    auditoria.archivoNombre = ss.getName();
    auditoria.archivoId = ss.getId();

    var sheets = ss.getSheets();
    sheets.forEach(function(s) {
      auditoria.pestañasEncontradas.push(s.getName());
    });

    var sheetInv = getSheetSafe("Inventario");
    if (sheetInv) {
      auditoria.conteoInventario = Math.max(0, sheetInv.getLastRow() - 1);
      if (sheetInv.getLastColumn() > 0) {
        auditoria.columnasInventario = sheetInv.getRange(1, 1, 1, sheetInv.getLastColumn()).getValues()[0];
      }
    } else {
      auditoria.alertas.push("Falta la pestaña 'Inventario'.");
    }

    var sheetBit = getSheetSafe("Bitacora");
    if (sheetBit) {
      auditoria.conteoBitacora = Math.max(0, sheetBit.getLastRow() - 1);
    } else {
      auditoria.alertas.push("Falta la pestaña 'Bitacora'.");
    }

    Logger.log("--- DIAGNÓSTICO SMR ---");
    Logger.log("Archivo: " + auditoria.archivoNombre + " (" + auditoria.archivoId + ")");
    Logger.log("Hojas: " + auditoria.pestañasEncontradas.join(", "));
    Logger.log("Registros de Inventario: " + auditoria.conteoInventario);
    Logger.log("Registros de Bitácora: " + auditoria.conteoBitacora);
    if (auditoria.alertas.length > 0) {
      Logger.log("Alertas: " + auditoria.alertas.join(" | "));
    }
    Logger.log("------------------------");
  } catch (e) {
    Logger.log("ERROR EN DIAGNÓSTICO: " + e.toString());
  }
  return auditoria;
}
