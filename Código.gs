/**
 * Mujeres Seguras - Google Apps Script Backend (v2)
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.p) || 'Index';
  // Note: Admin section is removed as per requirements.
  if (page === 'Admin') page = 'Index';

  try {
    return HtmlService.createTemplateFromFile(page)
        .evaluate()
        .setTitle('Mujeres Seguras - Registro de Certificación')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput("Error al cargar la página: " + err.toString());
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Asegura que la hoja exista, si no, la crea con la nueva estructura
 */
function getSheetSafe(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

/**
 * Inicializa las hojas de cálculo necesarias con la estructura solicitada
 */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = {
    "Empresas": ["RFC", "Representante", "Teléfono", "Correo", "Folio", "FechaRegistro", "Estatus", "CompromisosGenerales"],
    "Ubicaciones": ["ID", "RFC_Empresa", "Nombre", "Dirección", "Latitud_Longitud", "Fecha", "Compromisos"],
    "Planes_Trabajo": ["ID", "RFC", "Nombre_Archivo", "URL_Archivo", "Estatus", "Observaciones", "Fecha_Subida", "Ultima_Modificacion"],
    "UsuariosAppSheet": ["Usuario", "Contraseña", "Rol"]
  };

  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight("bold").setBackground("#6B2C91").setFontColor("white");
    }
  }
  return "Base de datos configurada correctamente.";
}

/**
 * Valida si un RFC ya existe
 */
function validarRFCExistente(rfc) {
  var sheet = getSheetSafe("Empresas");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === rfc) return true;
  }
  return false;
}

/**
 * Genera un folio único: MS-AAAA-#####
 */
function generarFolio() {
  var sheet = getSheetSafe("Empresas");
  var year = new Date().getFullYear();
  var lastRow = sheet.getLastRow();
  var consecutive = 1;

  if (lastRow > 1) {
    consecutive = lastRow;
  }

  var numStr = ("00000" + consecutive).slice(-5);
  return "MS-" + year + "-" + numStr;
}

/**
 * Procesa el registro completo (Empresa + Ubicaciones)
 */
function procesarRegistro(data) {
  try {
    var sheetEmpresas = getSheetSafe("Empresas");
    var sheetUbicaciones = getSheetSafe("Ubicaciones");

    if (validarRFCExistente(data.empresa.rfc)) {
      throw new Error("El RFC ya se encuentra registrado.");
    }

    var folio = generarFolio();
    var fecha = new Date();

    // Guardar Empresa
    sheetEmpresas.appendRow([
      data.empresa.rfc,
      data.empresa.representante,
      data.empresa.telefono,
      data.empresa.correo,
      folio,
      fecha,
      "Pendiente",
      JSON.stringify(data.compromisos)
    ]);

    // Guardar Ubicaciones (antes Sucursales)
    data.sucursales.forEach(function(suc) {
      sheetUbicaciones.appendRow([
        Utilities.getUuid(),
        data.empresa.rfc,
        suc.nombre,
        suc.direccion,
        suc.coordenadas, // Latitud/Longitud unificado
        fecha,
        JSON.stringify(suc.compromisos || [])
      ]);
    });

    var qrUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(folio) + "&size=200";

    return {
      success: true,
      folio: folio,
      qrUrl: qrUrl
    };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Agrega una nueva ubicación de forma independiente
 */
function agregarNuevaSucursal(data) {
  try {
    var sheetUbicaciones = getSheetSafe("Ubicaciones");
    var fecha = new Date();

    sheetUbicaciones.appendRow([
      Utilities.getUuid(),
      data.rfc,
      data.nombre,
      data.direccion,
      data.coordenadas,
      fecha,
      JSON.stringify(data.compromisos || [])
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Obtiene datos de una empresa por RFC
 */
function buscarPorRFC(rfc) {
  var sheet = getSheetSafe("Empresas");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === rfc) {
      return {
        rfc: data[i][0],
        representante: data[i][1],
        folio: data[i][4],
        estatus: data[i][6]
      };
    }
  }
  return null;
}

/**
 * Obtiene el historial de Planes de Trabajo para un RFC
 */
function getPlanesTrabajo(rfc) {
  var sheet = getSheetSafe("Planes_Trabajo");
  var data = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === rfc) {
      result.push({
        id: data[i][0],
        nombreArchivo: data[i][2],
        urlArchivo: data[i][3],
        estatus: data[i][4],
        observaciones: data[i][5],
        fechaSubida: Utilities.formatDate(data[i][6], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
      });
    }
  }
  return result;
}

/**
 * Guarda el Plan de Trabajo y gestiona el archivo en Drive
 */
function guardarPlanTrabajo(data) {
  try {
    var sheetPlanes = getSheetSafe("Planes_Trabajo");
    var folderName = "Planes_Trabajo_Mujeres_Seguras";
    var folder, fileUrl = "", fileName = "Sin archivo";
    var now = new Date();

    if (data.fileData) {
      var folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }

      var contentType = data.fileData.substring(data.fileData.indexOf(":")+1, data.fileData.indexOf(";"));
      var bytes = Utilities.base64Decode(data.fileData.split(",")[1]);
      var blob = Utilities.newBlob(bytes, contentType, data.fileName);
      var file = folder.createFile(blob);
      fileUrl = file.getUrl();
      fileName = data.fileName;
    }

    sheetPlanes.appendRow([
      Utilities.getUuid(),
      data.rfc,
      fileName,
      fileUrl,
      "Recibido",
      "",
      now,
      now
    ]);

    // Actualizar estatus general de la empresa
    var sheetEmpresas = getSheetSafe("Empresas");
    var empData = sheetEmpresas.getDataRange().getValues();
    for (var i = 1; i < empData.length; i++) {
      if (empData[i][0] === data.rfc) {
        sheetEmpresas.getRange(i + 1, 7).setValue("En Revisión");
        break;
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Las funciones de administración getRegistrosAdmin y cambiarEstatus han sido ELIMINADAS.
