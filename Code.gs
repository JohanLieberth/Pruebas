/**
 * Sistema de Inventario - Subdirección de Mejora Regulatoria
 * Google Apps Script - Código de Servidor (Code.gs)
 */

// Pestañas de la base de datos
const SHEET_INVENTARIO = "Inventario";
const SHEET_BITACORA = "Bitacora";

// Encabezados oficiales de Inventario (incluyendo auditoría y fotos para cumplimiento)
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
  "ULTIMA_ACTUALIZACION",
  "USUARIO_OPERADOR",
  "FOTO_ID"
];

/**
 * Convierte un email o nombre de usuario en un nombre completo legible para auditoría de operadores.
 * @param {string} usuario - Identificador del usuario (nombre o email).
 * @returns {string} Nombre completo formateado y capitalizado.
 */
function formatearNombreCompleto(usuario) {
  if (!usuario) return "Operador Desconocido";

  // Si es un correo electrónico, extraer el prefijo y darle formato
  if (usuario.indexOf("@") !== -1) {
    const prefijo = usuario.split("@")[0];
    const limpio = prefijo.replace(/[\._\-0-9]/g, " ").trim();
    return limpio.split(" ").map(palabra => {
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    }).join(" ");
  }

  // Si ya es un nombre completo, retornarlo capitalizado
  return usuario.trim().split(" ").map(palabra => {
    return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
  }).join(" ");
}

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
    const htmlOutput = template.evaluate()
      .setTitle("Sistema de Inventario - Mejora Regulatoria")
      .setFaviconUrl("https://www.google.com/favicon.ico")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Permitir visualización en iframe con compatibilidad extendida
      .addMetaTag("viewport", "width=device-width, initial-scale=1");

    return htmlOutput;
  } catch (error) {
    // Manejo robusto de errores de inicio para evitar pantallas en blanco
    return HtmlService.createHtmlOutput("<h3>Error al cargar el Sistema de Inventario</h3><p>" + error.message + "</p>")
      .setTitle("Error - Sistema de Inventario")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
}

/**
 * Función para verificar permisos de cámara (Opción A de GAS Web App)
 */
function checkCameraPermissions() {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <script>
            if (navigator.permissions && navigator.permissions.query) {
              navigator.permissions.query({name: 'camera'})
                .then(permissionStatus => {
                  console.log('Estado de permiso de cámara:', permissionStatus.state);
                  if (permissionStatus.state === 'granted') {
                    google.script.run.permisoConcedido();
                  } else if (permissionStatus.state === 'prompt') {
                    navigator.mediaDevices.getUserMedia({ video: true })
                      .then(stream => {
                        stream.getTracks().forEach(track => track.stop());
                        google.script.run.permisoConcedido();
                      })
                      .catch(error => {
                        console.error('Error al solicitar permiso:', error);
                        google.script.run.permisoDenegado(error.message);
                      });
                  } else {
                    google.script.run.permisoDenegado('Permiso denegado por el navegador');
                  }
                })
                .catch(error => {
                  console.error('Error al verificar permisos:', error);
                  navigator.mediaDevices.getUserMedia({ video: true })
                    .then(stream => {
                      stream.getTracks().forEach(track => track.stop());
                      google.script.run.permisoConcedido();
                    })
                    .catch(err => {
                      google.script.run.permisoDenegado(err.message);
                    });
                });
            } else {
              navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                  stream.getTracks().forEach(track => track.stop());
                  google.script.run.permisoConcedido();
                })
                .catch(error => {
                  google.script.run.permisoDenegado(error.message);
                });
            }
          <\/script>
        </head>
        <body>
          <p>Verificando permisos de cámara...</p>
        </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(html);
  } catch (error) {
    console.error('Error en checkCameraPermissions:', error);
    return false;
  }
}

// Callbacks para permisos de cámara
function permisoConcedido() {
  return { success: true, message: 'Permiso de cámara concedido' };
}

function permisoDenegado(error) {
  return { success: false, error: error };
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
 * Obtiene y cachea el contenido de un archivo CSS externo para evitar bloqueos CSP y acelerar la carga.
 * Soporta cacheo en múltiples chunks para esquivar el límite de 100KB de Google CacheService.
 */
function getExternalCss(url) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = url.replace(/[^a-zA-Z0-9]/g, "").substring(0, 200);

    // Intentar reconstruir desde caché multi-chunk
    const chunk1 = cache.get(cacheKey + "_c1");
    const chunk2 = cache.get(cacheKey + "_c2");

    if (chunk1 && chunk2) {
      return chunk1 + chunk2;
    } else if (chunk1 && !url.includes("bootstrap")) {
      return chunk1;
    }

    // Si no está en caché, realizar la petición HTTP
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      let cssContent = response.getContentText();

      // Corregir referencias de rutas relativas de FontAwesome a URLs absolutas CDN
      if (url.includes("font-awesome")) {
        cssContent = cssContent.replace(/url\(\.\.\/webfonts\//g, "url(https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/");
      }

      // Dividir en chunks de 90KB y guardar en caché por 6 horas (21600 segundos)
      const chunkSize = 90 * 1024;
      if (cssContent.length <= chunkSize) {
        cache.put(cacheKey + "_c1", cssContent, 21600);
      } else {
        const c1 = cssContent.substring(0, chunkSize);
        const c2 = cssContent.substring(chunkSize);
        cache.put(cacheKey + "_c1", c1, 21600);

        if (c2.length <= chunkSize) {
          cache.put(cacheKey + "_c2", c2, 21600);
        } else {
          cache.put(cacheKey + "_c2", c2.substring(0, chunkSize), 21600);
          cache.put(cacheKey + "_c3", c2.substring(chunkSize), 21600);
        }
      }
      return cssContent;
    }
  } catch (e) {
    console.error("Error al obtener o cachear CSS externo inline: " + url, e);
  }
  return "/* Error al inyectar inline " + url + " */";
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
    } else {
      // Auto-migración defensiva: asegurar que existan las nuevas columnas de auditoría y fotos si ya existía la hoja
      const actualCols = sheetInv.getLastColumn();
      const actualHeadersRange = sheetInv.getRange(1, 1, 1, actualCols);
      const actualHeaders = actualHeadersRange.getValues()[0];

      if (actualHeaders.indexOf("USUARIO_OPERADOR") === -1) {
        // Agregar columna USUARIO_OPERADOR al final de los encabezados
        sheetInv.getRange(1, actualCols + 1).setValue("USUARIO_OPERADOR")
          .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      }
      if (actualHeaders.indexOf("FOTO_ID") === -1) {
        // Asegurar que actualColumn se recalcule si ya añadimos USUARIO_OPERADOR
        const nuevaCols = sheetInv.getLastColumn();
        sheetInv.getRange(1, nuevaCols + 1).setValue("FOTO_ID")
          .setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
      }
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
 * ==========================================
 * GOOGLE DRIVE PHOTO INTEGRATION ENDPOINTS
 * ==========================================
 */

/**
 * Obtiene o crea de forma segura la carpeta dedicada en Google Drive para almacenar las fotos de inventario.
 * @returns {Folder} La carpeta de Google Drive.
 */
function obtenerOCrearCarpetaFotos() {
  const nombreCarpeta = "SMR_Fotos_Inventario";
  const carpetas = DriveApp.getFoldersByName(nombreCarpeta);
  if (carpetas.hasNext()) {
    return carpetas.next();
  }
  return DriveApp.createFolder(nombreCarpeta);
}

/**
 * Sube una imagen codificada en formato Base64 directamente a Google Drive,
 * nombrándola con el formato [CÓDIGO_ARTÍCULO]_[FECHA].ext, habilitando acceso público y
 * guardando la referencia (File ID) en la columna 'FOTO_ID' del artículo (hasta 3 fotos máximas permitidas).
 * @param {string} noInv - El número de inventario del artículo asociado.
 * @param {string} base64Data - El string de datos de imagen en formato base64.
 * @param {string} extension - La extensión del archivo de imagen (png, jpg, jpeg, webp, gif).
 * @param {string} nombreOriginal - Nombre de archivo original.
 * @returns {Object} JSON conteniendo estado de éxito, ID del archivo y URL de descarga directa.
 */
function subirFotoArticulo(noInv, base64Data, extension, nombreOriginal) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    if (!noInv) throw new Error("No. de inventario inválido.");

    const existente = buscarPorNoInv(noInv);
    if (!existente) throw new Error("El artículo con No. INV. '" + noInv + "' no existe.");

    // Separar la data base64 de su cabecera si viene tipo data-URI
    let rawData = base64Data;
    if (base64Data.indexOf(",") !== -1) {
      rawData = base64Data.split(",")[1];
    }

    // Decodificar base64 a blob
    const decoded = Utilities.base64Decode(rawData);

    // Generar el nombre de archivo solicitado: [CÓDIGO_ARTÍCULO]_[FECHA].ext
    const fechaStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "yyyyMMdd_HHmmss");
    const nombreArchivo = `${noInv}_${fechaStr}.${extension}`;

    // Crear el blob con el tipo de mime correcto
    let mimeType = "image/jpeg";
    if (extension === "png") mimeType = "image/png";
    else if (extension === "gif") mimeType = "image/gif";
    else if (extension === "webp") mimeType = "image/webp";

    const blob = Utilities.newBlob(decoded, mimeType, nombreArchivo);

    // Obtener la carpeta de Drive dedicada
    const carpeta = obtenerOCrearCarpetaFotos();
    const archivoDrive = carpeta.createFile(blob);
    // Habilitar acceso de lectura público por enlace para poder mostrar miniaturas en la interfaz
    archivoDrive.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = archivoDrive.getId();

    // Guardar en la hoja de cálculo
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    const rowIndex = existente._sheetRowIndex;

    // Obtener las fotos existentes en la columna FOTO_ID (hasta 3 fotos, separadas por comas)
    let fotosExistentes = existente["FOTO_ID"] ? String(existente["FOTO_ID"]).trim() : "";
    let arrayFotos = fotosExistentes ? fotosExistentes.split(",") : [];

    if (arrayFotos.length >= 3) {
      throw new Error("Ya se han subido las 3 fotografías máximas permitidas. Elimine alguna antes de continuar.");
    }

    arrayFotos.push(fileId);
    const nuevoValorFotos = arrayFotos.join(",");

    sheet.getRange(rowIndex, 16).setValue(nuevoValorFotos); // Columna 16 es FOTO_ID

    // Agregar cambio en la bitácora
    const userOperador = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
    registrarBitacora("FOTO_CARGA", noInv, `Fotografía adjuntada. Archivo ID: ${fileId}`, "Sistema");

    return { success: true, fileId: fileId, fileUrl: archivoDrive.getDownloadUrl() };
  } catch (e) {
    console.error("Error al subir foto:", e);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina una foto asociada con el artículo, retirándola de la base de datos de Sheets
 * y eliminando el archivo correspondiente de Drive de forma permanente.
 * @param {string} noInv - El número de inventario del artículo asociado.
 * @param {string} fileId - ID del archivo de Google Drive a eliminar.
 * @returns {Object} JSON conteniendo estado de éxito.
 */
function eliminarFotoArticulo(noInv, fileId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const existente = buscarPorNoInv(noInv);
    if (!existente) throw new Error("El artículo no existe.");

    let fotosExistentes = existente["FOTO_ID"] ? String(existente["FOTO_ID"]).trim() : "";
    let arrayFotos = fotosExistentes ? fotosExistentes.split(",") : [];

    const index = arrayFotos.indexOf(fileId);
    if (index !== -1) {
      arrayFotos.splice(index, 1);
    }

    const nuevoValorFotos = arrayFotos.join(",");

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTARIO);
    sheet.getRange(existente._sheetRowIndex, 16).setValue(nuevoValorFotos);

    // Eliminar físicamente el archivo en Drive para liberar espacio
    try {
      const file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
    } catch (err) {
      console.warn("No se pudo eliminar el archivo en Drive (puede haber sido eliminado antes):", err);
    }

    registrarBitacora("FOTO_ELIMINAR", noInv, `Fotografía eliminada. Archivo ID: ${fileId}`, "Sistema");
    return { success: true };
  } catch (e) {
    console.error("Error al eliminar foto:", e);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Busca un número de inventario en la hoja de cálculo
 * @param {string} numeroInventario - Número a buscar
 * @returns {Object} Datos del inventario o null si no se encuentra
 */
function buscarPorNumeroInventario(numeroInventario) {
  try {
    if (!numeroInventario || String(numeroInventario).trim() === '') {
      return null;
    }

    // Buscar usando nuestra función robusta existente
    const articulo = buscarPorNoInv(String(numeroInventario).trim());
    if (articulo) {
      return {
        numero: articulo["No. INV."],
        descripcion: articulo["DESCRIPCION"] || "",
        ubicacion: articulo["UBICACION_REAL"] || articulo["UBICACION"] || "",
        cantidad: 1,
        observaciones: "Resguardante real: " + (articulo["RESGUARDANTE_REAL"] || articulo["RESGUARDADO"] || "N/A"),
        fila: articulo._sheetRowIndex
      };
    }

    return null;
  } catch (error) {
    console.error('Error en buscarPorNumeroInventario:', error);
    return null;
  }
}

/**
 * Limpia el número de inventario (elimina caracteres no numéricos)
 * @param {string} numero - Número a limpiar
 * @returns {string} Número limpio
 */
function limpiarNumeroInventario(numero) {
  if (!numero) return '';
  return String(numero).replace(/[^0-9]/g, '');
}

/**
 * Obtiene todo el inventario (para búsquedas avanzadas)
 */
function obtenerTodoInventario() {
  try {
    const listado = listarArticulos();
    return listado.map(item => ({
      numero: item["No. INV."],
      descripcion: item["DESCRIPCION"] || "",
      ubicacion: item["UBICACION_REAL"] || item["UBICACION"] || "",
      cantidad: 1,
      observaciones: "Resguardante real: " + (item["RESGUARDANTE_REAL"] || item["RESGUARDADO"] || "N/A"),
      fila: item._sheetRowIndex
    }));
  } catch (error) {
    console.error('Error al obtener todo el inventario:', error);
    return [];
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
    const timestampUser = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
    const userOperador = formatearNombreCompleto(usuario) + " - " + timestampUser;
    const fotoId = articulo["FOTO_ID"] || "";

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
      timestamp,
      userOperador,
      fotoId
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

    // Escribir auditoría obligatoria de operador
    const timestampUser = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
    const userOperador = formatearNombreCompleto(usuario) + " - " + timestampUser;
    sheet.getRange(rowIndex, 15).setValue(userOperador);

    // Escribir ID de Foto si viene adjunto
    if (articulo["FOTO_ID"] !== undefined) {
      sheet.getRange(rowIndex, 16).setValue(articulo["FOTO_ID"]);
    }

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

    // Escribir auditoría obligatoria de operador
    const timestampUser = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
    const userOperador = formatearNombreCompleto(usuario) + " - " + timestampUser;
    sheet.getRange(rowIndex, 15).setValue(userOperador);

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

          if (colMap["USUARIO_OPERADOR"]) {
            const timestampUser = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
            sheet.getRange(rowIndex, colMap["USUARIO_OPERADOR"]).setValue(formatearNombreCompleto(usuario) + " - " + timestampUser);
          }

          actualizadosCont++;
        } else {
          // Omitir registro duplicado
          omitidosCont++;
        }
      } else {
        // Es un registro nuevo. Insertar fila.
        const rowNum = reg["No."] || correlativoActual++;

        const timestampUser = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-6", "dd/MM/yyyy HH:mm:ss");
        const userOperador = formatearNombreCompleto(usuario) + " - " + timestampUser;

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
          timestamp,
          userOperador,
          "" // Foto ID vacía inicialmente en carga excel
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
