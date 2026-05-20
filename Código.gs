/**
 * Proyecto: Mujeres Seguras - Gestión Documental
 * @author Jules
 */

// --- CONFIGURACIÓN Y CONSTANTES ---
const FOLDER_ROOT_NAME = "MujeresSeguras_Anexos";

function getSS() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    console.error("Error al obtener Spreadsheet:", e);
    throw new Error("No se pudo conectar con la base de datos.");
  }
}

const SHEETS = {
  DOCUMENTOS: "Documentos",
  SEGUIMIENTO: "Seguimiento",
  HISTORIAL_REVISIONES: "HistorialRevisiones",
  ANEXOS: "Anexos",
  USUARIOS: "Usuarios"
};

const ESTADOS = {
  BORRADOR: "Borrador",
  REVISION: "En revisión",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  AJUSTES: "Requiere ajustes",
  OBSOLETO: "Obsoleto"
};

/**
 * Punto de entrada App Web.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Mujeres Seguras - Gestión Documental')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    console.error("Fallo al incluir archivo:", filename);
    return `<!-- Error: No se encontró ${filename} -->`;
  }
}

/**
 * Función de inicialización robusta.
 */
function setup() {
  const ss = getSS();
  const requiredSheets = [
    { name: SHEETS.DOCUMENTOS, headers: ["ID", "Codigo", "Tipo", "Nombre", "Version", "Estado", "UltimaActualizacion", "CreadoPor", "TieneAnexos"] },
    { name: SHEETS.SEGUIMIENTO, headers: ["Codigo", "TipoDocumento", "NombreDocumento", "Versión", "Estado", "UltimaActualizacion", "Observaciones", "RevisadoPor", "FechaRevision"] },
    { name: SHEETS.HISTORIAL_REVISIONES, headers: ["ID_Seguimiento", "RevisadoPor", "FechaRevision", "Observaciones", "NuevoEstado"] },
    { name: SHEETS.ANEXOS, headers: ["ID", "CodigoDocumento", "TipoAnexo", "NombreArchivo", "URLDrive", "Descripcion", "SubidoPor", "FechaSubida"] },
    { name: SHEETS.USUARIOS, headers: ["Email", "Rol", "Nombre"] }
  ];

  requiredSheets.forEach(sheetDef => {
    verificarOCrearPestana(sheetDef.name, sheetDef.headers);
  });

  return "Entorno inicializado correctamente.";
}

function verificarOCrearPestana(nombre, headers) {
  const ss = getSS();
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Auditoría de usuario.
 */
function getUserInfo() {
  const email = Session.getActiveUser().getEmail() || "invitado@mujeresseguras.mx";
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return { email: email, rol: "USER", nombre: "Usuario Externo" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) return { email: email, rol: data[i][1], nombre: data[i][2] };
  }
  return { email: email, rol: "USER", nombre: "Usuario Registrado" };
}

// --- LÓGICA DE NEGOCIO ---

function saveDocument(docData) {
  const ss = getSS();
  const sheet = verificarOCrearPestana(SHEETS.DOCUMENTOS, ["ID", "Codigo", "Tipo", "Nombre", "Version", "Estado", "UltimaActualizacion", "CreadoPor", "TieneAnexos"]);
  const user = getUserInfo();

  const id = docData.ID || Utilities.getUuid();
  const codigo = docData.Codigo || "DOC-" + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const timestamp = new Date();

  const rowData = [
    id,
    codigo,
    docData.Tipo,
    docData.Nombre,
    docData.Version || "v1.0",
    ESTADOS.REVISION,
    timestamp,
    user.email,
    "No"
  ];

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { rowIndex = i + 1; break; }
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  sincronizarSeguimiento(codigo, docData.Tipo, docData.Nombre, docData.Version || "v1.0", ESTADOS.REVISION, timestamp);

  return { success: true, codigo: codigo };
}

function sincronizarSeguimiento(codigo, tipo, nombre, version, estado, timestamp) {
  const sheet = verificarOCrearPestana(SHEETS.SEGUIMIENTO, ["Codigo", "TipoDocumento", "NombreDocumento", "Versión", "Estado", "UltimaActualizacion", "Observaciones", "RevisadoPor", "FechaRevision"]);
  const data = sheet.getDataRange().getValues();

  const rowData = [codigo, tipo, nombre, version, estado, timestamp, "", "", ""];

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === codigo) { rowIndex = i + 1; break; }
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, 6).setValues([[codigo, tipo, nombre, version, estado, timestamp]]);
  } else {
    sheet.appendRow(rowData);
  }
}

function getSeguimientoData() {
  const sheet = verificarOCrearPestana(SHEETS.SEGUIMIENTO);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function guardarRevision(revData) {
  const user = getUserInfo();
  const ss = getSS();
  const sheetSeg = ss.getSheetByName(SHEETS.SEGUIMIENTO);
  const data = sheetSeg.getDataRange().getValues();

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === revData.codigo) { rowIndex = i + 1; break; }
  }

  if (rowIndex === -1) throw new Error("Documento no encontrado en seguimiento.");

  const timestamp = new Date();
  sheetSeg.getRange(rowIndex, 5, 1, 5).setValues([[revData.nuevoEstado, timestamp, revData.observaciones, user.email, timestamp]]);

  const sheetHist = verificarOCrearPestana(SHEETS.HISTORIAL_REVISIONES);
  sheetHist.appendRow([revData.codigo, user.email, timestamp, revData.observaciones, revData.nuevoEstado]);

  const sheetDoc = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const dataDoc = sheetDoc.getDataRange().getValues();
  for (let i = 1; i < dataDoc.length; i++) {
    if (dataDoc[i][1] === revData.codigo) {
      sheetDoc.getRange(i + 1, 6, 1, 2).setValues([[revData.nuevoEstado, timestamp]]);
      break;
    }
  }

  return { success: true };
}

function getDocumentosParaSelect() {
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => ({ codigo: row[1], nombre: row[3] }));
}

function subirAnexo(base64Data, mimeType, nombreArchivo, codigoDocumento, tipoAnexo, descripcion) {
  const user = getUserInfo();
  const folderRootName = FOLDER_ROOT_NAME;

  let root;
  const roots = DriveApp.getFoldersByName(folderRootName);
  root = roots.hasNext() ? roots.next() : DriveApp.createFolder(folderRootName);

  let subfolder;
  const subs = root.getFoldersByName(codigoDocumento);
  subfolder = subs.hasNext() ? subs.next() : root.createFolder(codigoDocumento);

  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, nombreArchivo);
  const file = subfolder.createFile(blob);

  const url = file.getUrl();
  const timestamp = new Date();

  const sheetAnexos = verificarOCrearPestana(SHEETS.ANEXOS);
  sheetAnexos.appendRow([Utilities.getUuid(), codigoDocumento, tipoAnexo, nombreArchivo, url, descripcion, user.email, timestamp]);

  const ss = getSS();
  const sheetDoc = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const dataDoc = sheetDoc.getDataRange().getValues();
  for (let i = 1; i < dataDoc.length; i++) {
    if (dataDoc[i][1] === codigoDocumento) {
      sheetDoc.getRange(i + 1, 9).setValue("Sí");
      break;
    }
  }

  return { success: true, url: url };
}

function obtenerAnexos(codigo) {
  const sheet = verificarOCrearPestana(SHEETS.ANEXOS);
  const data = sheet.getDataRange().getValues();
  return data.slice(1).filter(row => row[1] === codigo).map(row => ({
    tipo: row[2],
    nombre: row[3],
    url: row[4],
    desc: row[5]
  }));
}

function getUsers() {
  const user = getUserInfo();
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => ({ email: row[0], nombre: row[2], rol: row[1] }));
}
