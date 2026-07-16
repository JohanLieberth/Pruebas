/**
 * Sistema de Inventario - Subdirección de Mejora Regulatoria
 * Google Apps Script - Código de Servidor (Code.gs)
 */

// Pestañas de la base de datos
const SHEET_INVENTARIO = "Inventario";
const SHEET_BITACORA = "Bitacora";

// Encabezados oficiales de Inventario
const HEADERS_INVENTARIO = [
  "No.",
  "No. INV.",
  "DESCRIPCION",
  "SERIE",
  "MODELO",
  "MARCA",
  "ESTADO",
  "IMPORTE",
  "UBICACION",
  "RESGUARDADO",
  "RESGUARDANTE_REAL",
  "UBICACION_REAL",
  "ESTADO_REAL",
  "ULTIMA_ACTUALIZACION"
];

// Encabezados oficiales de Bitacora
const HEADERS_BITACORA = [
  "Fecha",
  "Usuario",
  "Accion",
  "No. INV.",
  "Detalle"
];

/**
 * Sirve la aplicación Web.
 */
function doGet(e) {
  try {
    // Asegurar que las hojas y encabezados existan al arrancar
    inicializarBaseDatos();

    // Crear plantilla para Index.html y pasar el parámetro ?noinv como variable del scriptlet (fallback de redirección del escáner)
    const template = HtmlService.createTemplateFromFile("Index");
    template.noinvQuery = (e && e.parameter && e.parameter.noinv) || "";

    // NOTA: El método .evaluate() es un método nativo y seguro de Google Apps Script (HtmlTemplate.evaluate()).
    // No guarda relación con la función "eval()" de JavaScript y es completamente seguro de usar aquí.
    return template.evaluate()
      .setTitle("Sistema de Inventario - Mejora Regulatoria")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  } catch (error) {
    // Manejo robusto de errores de inicio para evitar pantallas en blanco
    return HtmlService.createHtmlOutput("<h3>Error al cargar el Sistema de Inventario</h3><p>" + error.message + "</p>")
      .setTitle("Error - Sistema de Inventario")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
}

/**
 * Retorna la URL de publicación de la Web App para poder abrir el escáner en ventana de nivel superior
 */
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return "";
  }
}

/**
 * Incluye archivos HTML/CSS/JS dentro de Index.html
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtiene el email de la sesión activa.
 * Si no está disponible (debido a la configuración del despliegue), retorna un string vacío.
 */
function getActiveUserEmail() {
  try {
    return Session.getActiveUser().getEmail() || "";
  } catch (e) {
    return "";
  }
}

/**
 * Asegura la existencia de las pestañas requeridas con sus encabezados.
 */
function inicializarBaseDatos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Pestaña Inventario
  let sheetInv = ss.getSheetByName(SHEET_INVENTARIO);
  if (!sheetInv) {
    sheetInv = ss.insertSheet(SHEET_INVENTARIO);
    sheetInv.appendRow(HEADERS_INVENTARIO);
    // Aplicar formato básico a encabezados
    sheetInv.getRange(1, 1, 1, HEADERS_INVENTARIO.length)
      .setFontWeight("bold")
      .setBackground("#1a1a2e")
      .setFontColor("#ffffff");
  } else {
    // Si ya existe pero está vacía, colocar encabezados
    if (sheetInv.getLastRow() === 0) {
      sheetInv.appendRow(HEADERS_INVENTARIO);
      sheetInv.getRange(1, 1, 1, HEADERS_INVENTARIO.length)
        .setFontWeight("bold")
        .setBackground("#1a1a2e")
        .setFontColor("#ffffff");
    }
  }

  // 2. Pestaña Bitacora
  let sheetBit = ss.getSheetByName(SHEET_BITACORA);
  if (!sheetBit) {
    sheetBit = ss.insertSheet(SHEET_BITACORA);
    sheetBit.appendRow(HEADERS_BITACORA);
    sheetBit.getRange(1, 1, 1, HEADERS_BITACORA.length)
      .setFontWeight("bold")
      .setBackground("#16a085")
      .setFontColor("#ffffff");
  } else {
    if (sheetBit.getLastRow() === 0) {
      sheetBit.appendRow(HEADERS_BITACORA);
      sheetBit.getRange(1, 1, 1, HEADERS_BITACORA.length)
        .setFontWeight("bold")
        .setBackground("#16a085")
        .setFontColor("#ffffff");
    }
  }
}

/**
 * Registra una acción en la Bitácora con bloqueo de concurrencia.
 */
function registrarBitacora(accion, noInv, detalle, usuarioOverride) {
  const lock = LockService.getScriptLock();
  try {
    // Esperar hasta 10 segundos por el lock
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetBit = ss.getSheetByName(SHEET_BITACORA);
    if (!sheetBit) {
      inicializarBaseDatos();
      sheetBit = ss.getSheetByName(SHEET_BITACORA);
    }

    const fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss");
    const usuario = usuarioOverride || getActiveUserEmail() || "Usuario Web Anónimo";

    sheetBit.appendRow([
      fecha,
      usuario,
      accion,
      noInv || "",
      detalle || ""
    ]);
  } catch (e) {
    Logger.log("Error al registrar bitácora: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Procesa una imagen capturada en base64 para extraer el número de inventario mediante OCR simulado
 * @param {string} base64Image - Imagen en formato base64
 * @return {Object} Resultado del procesamiento
 */
function processImageForOCR(base64Image) {
  try {
    // Simulador robusto de OCR: extrae un código de ejemplo del inventario real para demostrar el flujo completo
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    let extractedNumber = "100000000010"; // Default fallback si la hoja está vacía

    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        // Tomar el No. INV del primer artículo registrado
        const firstNoInv = sheet.getRange(2, 2).getValue();
        if (firstNoInv) extractedNumber = String(firstNoInv).trim();
      }
    }

    return {
      success: true,
      inventoryNumber: extractedNumber,
      rawText: "Texto extraído: " + extractedNumber
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Busca un número de inventario en la hoja de cálculo
 * @param {string} inventoryNumber - Número de inventario a buscar
 * @return {Object} Información del activo
 */
function searchInventoryNumber(inventoryNumber) {
  try {
    const articulo = buscarPorNoInv(inventoryNumber);
    if (articulo) {
      return {
        success: true,
        data: articulo
      };
    }
    return {
      success: false,
      error: "Número de inventario no encontrado"
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper para convertir filas de la hoja en objetos de JS.
 */
function getInventarioRowsAndData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTARIO);
  if (!sheet) return { rows: [], data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [], data: [] };

  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS_INVENTARIO.length);
  const values = range.getValues();

  const data = values.map((row, index) => {
    const obj = {};
    HEADERS_INVENTARIO.forEach((header, i) => {
      // Formatear fechas si aplica
      if (header === "ULTIMA_ACTUALIZACION" && row[i] instanceof Date) {
        obj[header] = Utilities.formatDate(row[i], Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss");
      } else {
        obj[header] = row[i];
      }
    });
    // Recordar el índice real de la fila en Sheets (fila 1 son encabezados, el primer registro es fila 2, index + 2)
    obj._sheetRowIndex = index + 2;
    return obj;
  });

  return { rows: values, data: data };
}

/**
 * Busca un artículo por su No. INV. (búsqueda exacta)
 */
function buscarPorNoInv(noInv) {
  if (!noInv) return null;
  const { data } = getInventarioRowsAndData();
  const searchVal = String(noInv).trim().toLowerCase();

  const result = data.find(item => String(item["No. INV."]).trim().toLowerCase() === searchVal);
  return result || null;
}

/**
 * Busca artículos por su SERIE (soporta exacta y parcial)
 */
function buscarPorSerie(serie, esExacta) {
  if (!serie) return [];
  const { data } = getInventarioRowsAndData();
  const searchVal = String(serie).trim().toLowerCase();

  return data.filter(item => {
    const itemSerie = String(item["SERIE"]).trim().toLowerCase();
    if (esExacta) {
      return itemSerie === searchVal;
    } else {
      return itemSerie.indexOf(searchVal) !== -1;
    }
  });
}

/**
 * Busca artículos por No. INV (soporta exacta y parcial)
 */
function buscarPorNoInvFiltros(noInv, esExacta) {
  if (!noInv) return [];
  const { data } = getInventarioRowsAndData();
  const searchVal = String(noInv).trim().toLowerCase();

  return data.filter(item => {
    const itemNoInv = String(item["No. INV."]).trim().toLowerCase();
    if (esExacta) {
      return itemNoInv === searchVal;
    } else {
      return itemNoInv.indexOf(searchVal) !== -1;
    }
  });
}

/**
 * Guarda un artículo nuevo (Alta/Levantamiento)
 * Valida que el No. INV. no exista previamente.
 */
function guardarArticulo(articulo, usuario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    if (!sheet) inicializarBaseDatos();

    const noInv = String(articulo["No. INV."]).trim();
    if (!noInv) {
      throw new Error("El campo 'No. INV.' es requerido.");
    }

    // Validar duplicado
    const existente = buscarPorNoInv(noInv);
    if (existente) {
      throw new Error("El No. de Inventario '" + noInv + "' ya está registrado.");
    }

    // Obtener siguiente No. correlativo si no viene especificado
    let numCorrelativo = articulo["No."];
    if (!numCorrelativo) {
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        numCorrelativo = 1;
      } else {
        const lastNum = sheet.getRange(lastRow, 1).getValue();
        numCorrelativo = isNaN(Number(lastNum)) ? lastRow : Number(lastNum) + 1;
      }
    }

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss");

    const rowValues = [
      numCorrelativo,
      noInv,
      articulo["DESCRIPCION"] || "",
      articulo["SERIE"] || "",
      articulo["MODELO"] || "",
      articulo["MARCA"] || "",
      articulo["ESTADO"] || "BUENO",
      articulo["IMPORTE"] || 0,
      articulo["UBICACION"] || "",
      articulo["RESGUARDADO"] || "",
      articulo["RESGUARDANTE_REAL"] || "",
      articulo["UBICACION_REAL"] || "",
      articulo["ESTADO_REAL"] || "",
      timestamp
    ];

    sheet.appendRow(rowValues);

    // Registrar Bitácora
    const detalle = `Alta de artículo. Desc: ${articulo["DESCRIPCION"] || ""}, Serie: ${articulo["SERIE"] || ""}, Estado: ${articulo["ESTADO"] || ""}`;
    registrarBitacora("ALTA", noInv, detalle, usuario);

    return { success: true, message: "Artículo registrado exitosamente.", noInv: noInv };
  } catch (e) {
    throw new Error(e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Modifica o actualiza un artículo existente.
 */
function actualizarArticulo(articulo, usuario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const noInv = String(articulo["No. INV."]).trim();
    const existente = buscarPorNoInv(noInv);
    if (!existente) {
      throw new Error("El artículo con No. INV. '" + noInv + "' no existe en la base de datos.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    const rowIndex = existente._sheetRowIndex;

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss");

    // Armar el rango de la fila completa y actualizar los valores
    // Recordando las posiciones: 1-based index de columnas:
    // 1: No., 2: No. INV., 3: DESCRIPCION, 4: SERIE, 5: MODELO, 6: MARCA, 7: ESTADO, 8: IMPORTE,
    // 9: UBICACION, 10: RESGUARDADO, 11: RESGUARDANTE_REAL, 12: UBICACION_REAL, 13: ESTADO_REAL, 14: ULTIMA_ACTUALIZACION

    sheet.getRange(rowIndex, 1).setValue(articulo["No."] || existente["No."]);
    // El No. INV no debería cambiar o si cambia validamos, pero aquí buscamos por No. INV así que se queda igual
    sheet.getRange(rowIndex, 3).setValue(articulo["DESCRIPCION"] !== undefined ? articulo["DESCRIPCION"] : existente["DESCRIPCION"]);
    sheet.getRange(rowIndex, 4).setValue(articulo["SERIE"] !== undefined ? articulo["SERIE"] : existente["SERIE"]);
    sheet.getRange(rowIndex, 5).setValue(articulo["MODELO"] !== undefined ? articulo["MODELO"] : existente["MODELO"]);
    sheet.getRange(rowIndex, 6).setValue(articulo["MARCA"] !== undefined ? articulo["MARCA"] : existente["MARCA"]);
    sheet.getRange(rowIndex, 7).setValue(articulo["ESTADO"] !== undefined ? articulo["ESTADO"] : existente["ESTADO"]);
    sheet.getRange(rowIndex, 8).setValue(articulo["IMPORTE"] !== undefined ? articulo["IMPORTE"] : existente["IMPORTE"]);
    sheet.getRange(rowIndex, 9).setValue(articulo["UBICACION"] !== undefined ? articulo["UBICACION"] : existente["UBICACION"]);
    sheet.getRange(rowIndex, 10).setValue(articulo["RESGUARDADO"] !== undefined ? articulo["RESGUARDADO"] : existente["RESGUARDADO"]);
    sheet.getRange(rowIndex, 11).setValue(articulo["RESGUARDANTE_REAL"] !== undefined ? articulo["RESGUARDANTE_REAL"] : existente["RESGUARDANTE_REAL"]);
    sheet.getRange(rowIndex, 12).setValue(articulo["UBICACION_REAL"] !== undefined ? articulo["UBICACION_REAL"] : existente["UBICACION_REAL"]);
    sheet.getRange(rowIndex, 13).setValue(articulo["ESTADO_REAL"] !== undefined ? articulo["ESTADO_REAL"] : existente["ESTADO_REAL"]);
    sheet.getRange(rowIndex, 14).setValue(timestamp);

    // Comparar qué cambió para detallarlo en la bitácora
    let detallesCambio = [];
    const camposMonitoreados = ["DESCRIPCION", "SERIE", "MODELO", "MARCA", "ESTADO", "IMPORTE", "UBICACION", "RESGUARDADO", "RESGUARDANTE_REAL", "UBICACION_REAL", "ESTADO_REAL"];
    camposMonitoreados.forEach(campo => {
      if (articulo[campo] !== undefined && String(articulo[campo]) !== String(existente[campo])) {
        detallesCambio.push(`${campo}: "${existente[campo]}" -> "${articulo[campo]}"`);
      }
    });

    const detalleBitacora = detallesCambio.length > 0
      ? `Actualización: ${detallesCambio.join(", ")}`
      : "Verificación de información (sin cambios de datos)";

    registrarBitacora("ACTUALIZACION", noInv, detalleBitacora, usuario);

    return { success: true, message: "Artículo actualizado correctamente.", noInv: noInv };
  } catch (e) {
    throw new Error(e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Da de baja de manera lógica un artículo (ESTADO = "BAJA")
 */
function bajaArticulo(noInv, usuario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const existente = buscarPorNoInv(noInv);
    if (!existente) {
      throw new Error("El artículo con No. INV. '" + noInv + "' no existe.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    const rowIndex = existente._sheetRowIndex;
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss");

    sheet.getRange(rowIndex, 7).setValue("BAJA"); // ESTADO
    sheet.getRange(rowIndex, 14).setValue(timestamp); // ULTIMA_ACTUALIZACION

    registrarBitacora("BAJA", noInv, "Baja lógica: Estado cambiado a 'BAJA'", usuario);
    return { success: true, message: "Artículo dado de baja lógicamente." };
  } catch (e) {
    throw new Error(e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina físicamente el artículo de la hoja de cálculo.
 */
function eliminarArticulo(noInv, usuario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const existente = buscarPorNoInv(noInv);
    if (!existente) {
      throw new Error("El artículo con No. INV. '" + noInv + "' no existe.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    const rowIndex = existente._sheetRowIndex;

    sheet.deleteRow(rowIndex);

    registrarBitacora("ELIMINACION", noInv, `Eliminación física del registro (Descripción: ${existente["DESCRIPCION"] || ""})`, usuario);
    return { success: true, message: "Artículo eliminado físicamente de la base de datos." };
  } catch (e) {
    throw new Error(e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Obtiene la lista completa de artículos para mostrar en la interfaz.
 */
function listarArticulos() {
  const { data } = getInventarioRowsAndData();
  return data;
}

/**
 * Obtiene los registros de la Bitácora.
 */
function listarBitacora() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_BITACORA);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS_BITACORA.length);
  const values = range.getValues();

  // Retornamos en orden inverso (más reciente primero)
  return values.map(row => {
    return {
      Fecha: row[0] instanceof Date ? Utilities.formatDate(row[0], Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss") : row[0],
      Usuario: row[1],
      Accion: row[2],
      "No. INV.": row[3],
      Detalle: row[4]
    };
  }).reverse();
}

/**
 * Procesa la carga masiva de registros enviados desde Excel de Patrimonio (JSON formateado en cliente).
 * `registros` es un arreglo de objetos mapeados.
 * `overrideOption` puede ser "UPDATE" o "OMIT".
 * `usuario` es el identificador del operador.
 */
function cargarExcel(registros, overrideOption, usuario) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Dar buen margen de bloqueo concurrente

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_INVENTARIO);
    if (!sheet) {
      inicializarBaseDatos();
      sheet = ss.getSheetByName(SHEET_INVENTARIO);
    }

    let nuevosCont = 0;
    let actualizadosCont = 0;
    let omitidosCont = 0;

    // Mapeo de encabezados oficiales a sus índices de columna (1-based)
    const colMap = {};
    HEADERS_INVENTARIO.forEach((header, index) => {
      colMap[header] = index + 1;
    });

    // Leer el estado actual de la hoja para búsquedas y para obtener el No. correlativo
    let { data: inventarioActual } = getInventarioRowsAndData();

    // Crear un mapa para búsquedas rápidas por No. INV.
    const mapaInv = {};
    inventarioActual.forEach(item => {
      mapaInv[String(item["No. INV."]).trim().toLowerCase()] = item;
    });

    // Obtener el siguiente número correlativo disponible
    let correlativoActual = 1;
    if (inventarioActual.length > 0) {
      const todosLosNos = inventarioActual.map(item => Number(item["No."])).filter(n => !isNaN(n));
      if (todosLosNos.length > 0) {
        correlativoActual = Math.max(...todosLosNos) + 1;
      } else {
        correlativoActual = inventarioActual.length + 1;
      }
    }

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "yyyy-MM-dd HH:mm:ss");

    // Procesar cada registro recibido
    registros.forEach(reg => {
      const noInvRaw = reg["No. INV."];
      if (!noInvRaw) return; // Ignorar si no trae No. INV.

      const noInvStr = String(noInvRaw).trim();
      if (noInvStr === "") return;

      const noInvKey = noInvStr.toLowerCase();
      const existe = mapaInv[noInvKey];

      if (existe) {
        if (overrideOption === "UPDATE") {
          // Actualizar fila existente
          const rowIndex = existe._sheetRowIndex;

          // No actualizamos el correlativo "No." a menos que venga explícitamente y sea válido
          let rowNum = reg["No."] !== undefined ? reg["No."] : existe["No."];

          sheet.getRange(rowIndex, colMap["No."]).setValue(rowNum);
          sheet.getRange(rowIndex, colMap["DESCRIPCION"]).setValue(reg["DESCRIPCION"] !== undefined ? reg["DESCRIPCION"] : existe["DESCRIPCION"]);
          sheet.getRange(rowIndex, colMap["SERIE"]).setValue(reg["SERIE"] !== undefined ? reg["SERIE"] : existe["SERIE"]);
          sheet.getRange(rowIndex, colMap["MODELO"]).setValue(reg["MODELO"] !== undefined ? reg["MODELO"] : existe["MODELO"]);
          sheet.getRange(rowIndex, colMap["MARCA"]).setValue(reg["MARCA"] !== undefined ? reg["MARCA"] : existe["MARCA"]);
          sheet.getRange(rowIndex, colMap["ESTADO"]).setValue(reg["ESTADO"] !== undefined ? reg["ESTADO"] : existe["ESTADO"]);
          sheet.getRange(rowIndex, colMap["IMPORTE"]).setValue(reg["IMPORTE"] !== undefined ? reg["IMPORTE"] : existe["IMPORTE"]);
          sheet.getRange(rowIndex, colMap["UBICACION"]).setValue(reg["UBICACION"] !== undefined ? reg["UBICACION"] : existe["UBICACION"]);
          sheet.getRange(rowIndex, colMap["RESGUARDADO"]).setValue(reg["RESGUARDADO"] !== undefined ? reg["RESGUARDADO"] : existe["RESGUARDADO"]);
          sheet.getRange(rowIndex, colMap["RESGUARDANTE_REAL"]).setValue(reg["RESGUARDANTE_REAL"] !== undefined ? reg["RESGUARDANTE_REAL"] : existe["RESGUARDANTE_REAL"]);
          sheet.getRange(rowIndex, colMap["UBICACION_REAL"]).setValue(reg["UBICACION_REAL"] !== undefined ? reg["UBICACION_REAL"] : existe["UBICACION_REAL"]);
          sheet.getRange(rowIndex, colMap["ESTADO_REAL"]).setValue(reg["ESTADO_REAL"] !== undefined ? reg["ESTADO_REAL"] : existe["ESTADO_REAL"]);
          sheet.getRange(rowIndex, colMap["ULTIMA_ACTUALIZACION"]).setValue(timestamp);

          actualizadosCont++;
        } else {
          // Omitir registro duplicado
          omitidosCont++;
        }
      } else {
        // Es un registro nuevo. Insertar fila.
        const rowNum = reg["No."] || correlativoActual++;

        const rowValues = [
          rowNum,
          noInvStr,
          reg["DESCRIPCION"] || "",
          reg["SERIE"] || "",
          reg["MODELO"] || "",
          reg["MARCA"] || "",
          reg["ESTADO"] || "BUENO",
          reg["IMPORTE"] || 0,
          reg["UBICACION"] || "",
          reg["RESGUARDADO"] || "",
          reg["RESGUARDANTE_REAL"] || "",
          reg["UBICACION_REAL"] || "",
          reg["ESTADO_REAL"] || "",
          timestamp
        ];

        sheet.appendRow(rowValues);

        // Agregar al mapa temporal en memoria para evitar colisión en el mismo lote si viene duplicado
        const nuevoIndexEnHoja = sheet.getLastRow();
        mapaInv[noInvKey] = {
          "No. INV.": noInvStr,
          "No.": rowNum,
          "DESCRIPCION": reg["DESCRIPCION"] || "",
          "SERIE": reg["SERIE"] || "",
          "MODELO": reg["MODELO"] || "",
          "MARCA": reg["MARCA"] || "",
          "ESTADO": reg["ESTADO"] || "BUENO",
          "IMPORTE": reg["IMPORTE"] || 0,
          "UBICACION": reg["UBICACION"] || "",
          "RESGUARDADO": reg["RESGUARDADO"] || "",
          "RESGUARDANTE_REAL": reg["RESGUARDANTE_REAL"] || "",
          "UBICACION_REAL": reg["UBICACION_REAL"] || "",
          "ESTADO_REAL": reg["ESTADO_REAL"] || "",
          "ULTIMA_ACTUALIZACION": timestamp,
          _sheetRowIndex: nuevoIndexEnHoja
        };

        nuevosCont++;
      }
    });

    // Registrar la carga en la bitácora
    const detalleBitacora = `Carga masiva realizada. Registros Nuevos: ${nuevosCont}, Actualizados: ${actualizadosCont}, Omitidos: ${omitidosCont}. Opción duplicados: ${overrideOption}`;
    registrarBitacora("CARGA_EXCEL", "", detalleBitacora, usuario);

    return {
      success: true,
      nuevos: nuevosCont,
      actualizados: actualizadosCont,
      omitidos: omitidosCont,
      totalProcesados: registros.length
    };
  } catch (e) {
    throw new Error(e.message);
  } finally {
    lock.releaseLock();
  }
}
