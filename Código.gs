/**
 * Sistema de Gestión de Procedimientos y Políticas - Mérida, Yucatán
 * @author Jules
 */

// --- CONFIGURACIÓN Y CONSTANTES ---
const FOLDER_ROOT_NAME = "Gestión_Documental_Mérida";

function getSS() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // Si falla (ej. ejecutado desde el editor sin SS activo), intentar con el ID si se conoce
    // Pero en GAS web apps, getActive suele funcionar si el script está vinculado.
    console.error("Error al obtener Spreadsheet:", e);
    throw new Error("No se pudo conectar con la base de datos. Verifique que el script esté vinculado a una hoja de cálculo.");
  }
}

const SHEETS = {
  DOCUMENTOS: "Documentos",
  TABLAS: "TablasDinamicas",
  ARCHIVOS: "Archivos",
  USUARIOS: "Usuarios",
  SEGUIMIENTO: "Seguimiento",
  PROCEDIMIENTOS: "Procedimientos"
};

const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER"
};

const ESTADOS = {
  BORRADOR: "Borrador",
  REVISION: "En revisión",
  APROBADO: "Aprobado",
  OBSOLETO: "Obsoleto"
};

const TIPOS_DOC = {
  PROCEDIMIENTO: "F-ADM/CMC-14",
  POLITICA: "F-ADM/CMC-13"
};

/**
 * Función inicial para configurar el entorno.
 * Crea las hojas necesarias y carpetas en Drive.
 */
/**
 * Crea el menú en la hoja de cálculo.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('📑 Gestión Documental')
      .addItem('Configurar Sistema', 'setup')
      .addToUi();
}

function verificarOCrearPestana(nombrePestana, headers) {
  const ss = getSS();
  let sheet = ss.getSheetByName(nombrePestana);
  if (!sheet) {
    sheet = ss.insertSheet(nombrePestana);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sheet.setFrozenRows(1);
      try {
        sheet.getRange(1, 1, 1, headers.length).createFilter();
      } catch (e) {
        // Filtro podría fallar si la hoja está vacía o ya tiene uno
      }
    }
  }
  return sheet;
}

function setup() {
  const ss = getSS();

  // 1. Crear hojas si no existen
  const requiredSheets = [
    { name: SHEETS.DOCUMENTOS, headers: ["ID", "Codigo", "Tipo", "Version", "Estado", "NombreDoc", "Objetivo", "Alcance", "Responsabilidades", "Definiciones", "MarcoLegal", "PoliticasGenerales", "PoliticasEspecificas", "Sanciones", "Municipio", "Coordinacion", "Direccion", "Subdireccion", "Departamento", "NR", "CreadoPor", "FechaEdicion", "FechaActualizacion", "FirmaNombre", "FirmaPuesto", "FirmaFecha"] },
    { name: SHEETS.TABLAS, headers: ["ID_Doc", "TipoTabla", "Col1", "Col2", "Col3", "Col4", "Col5", "Col6"] },
    { name: SHEETS.ARCHIVOS, headers: ["ID_Doc", "FileID", "FileName", "FileType", "FileURL"] },
    { name: SHEETS.USUARIOS, headers: ["Email", "Rol", "Nombre"] },
    { name: SHEETS.SEGUIMIENTO, headers: ["Timestamp", "ID", "Registrado por", "Estado", "Observaciones", "Fecha de seguimiento"] },
    { name: SHEETS.PROCEDIMIENTOS, headers: ["ID", "Fecha", "CreadoPor", "Nombre", "Objetivo", "Alcance", "Responsabilidades", "RefDoc", "Definiciones", "Recursos", "DescP1", "DescP2", "DescP3", "Registros", "Anexos", "AnexosURL", "ControlCambiosJSON", "Estado"] }
  ];

  requiredSheets.forEach(sheetDef => {
    verificarOCrearPestana(sheetDef.name, sheetDef.headers);
  });

  // 2. Crear carpeta raíz en Drive si no existe
  const folders = DriveApp.getFoldersByName(FOLDER_ROOT_NAME);
  let rootFolder;
  if (!folders.hasNext()) {
    rootFolder = DriveApp.createFolder(FOLDER_ROOT_NAME);
  } else {
    rootFolder = folders.next();
  }

  // 3. Agregar usuario actual como Admin si no hay usuarios
  const userSheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (userSheet.getLastRow() === 1) {
    const userEmail = Session.getActiveUser().getEmail();
    userSheet.appendRow([userEmail, ROLES.ADMIN, "Administrador Inicial"]);
  }

  return "Configuración completada con éxito.";
}

/**
 * doGet - Punto de entrada para la aplicación web.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Gestión Documental - Mérida')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Incluye archivos HTML (CSS/JS) en la plantilla principal.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtener información del usuario actual y su rol.
 */
function getUserInfo() {
  const email = Session.getActiveUser().getEmail() || "desconocido@merida.gob.mx";
  const ss = getSS();

  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (!sheet) {
    // Si la hoja no existe, devolvemos un usuario invitado o error informativo
    return {
      email: email,
      rol: ROLES.USER,
      nombre: "Usuario (Requiere Configuración)",
      needsSetup: true
    };
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return {
        email: email,
        rol: data[i][1],
        nombre: data[i][2]
      };
    }
  }

  // Si no está registrado, por defecto es USER (o podrías denegar acceso)
  return {
    email: email,
    rol: ROLES.USER,
    nombre: "Invitado"
  };
}

// --- FUNCIONES DE DOCUMENTOS ---

/**
 * Genera el siguiente código secuencial para un tipo de documento.
 */
function getNextCodigo(tipo) {
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();
  let max = 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === tipo) {
      const code = data[i][1];
      const parts = code.split("-");
      const num = parseInt(parts[parts.length - 1]);
      if (num > max) max = num;
    }
  }

  const nextNum = (max + 1).toString().padStart(3, '0');
  return `${tipo}-${nextNum}`;
}

/**
 * Guarda un nuevo documento o actualiza uno existente.
 */
function saveDocument(docData, dynamicTables) {
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const user = getUserInfo();

  let id = docData.ID;
  const isNew = !id;

  if (isNew) {
    id = Utilities.getUuid();
    docData.ID = id;
    docData.Codigo = getNextCodigo(docData.Tipo);
    docData.Estado = ESTADOS.BORRADOR;
    docData.CreadoPor = user.email;
    docData.FechaEdicion = new Date();
    docData.Version = 1;
  } else {
    // Si ya existe, verificar si estaba aprobado para incrementar versión
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        if (data[i][4] === ESTADOS.APROBADO) {
          docData.Version = (parseInt(data[i][3]) || 1) + 1;
          docData.Estado = ESTADOS.BORRADOR; // Vuelve a borrador al editar un aprobado
        } else {
          docData.Version = data[i][3];
          docData.Estado = data[i][4];
        }
        break;
      }
    }
  }

  docData.FechaActualizacion = new Date();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (isNew) {
    const rowData = headers.map(h => docData[h] || "");
    sheet.appendRow(rowData);
  } else {
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let existingRow = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        rowIndex = i + 1;
        existingRow = data[i];
        break;
      }
    }

    if (rowIndex !== -1) {
      // Fusionar datos: solo actualizar lo que viene en docData
      const updatedRow = headers.map((h, index) => {
        if (docData.hasOwnProperty(h)) return docData[h];
        return existingRow[index];
      });
      sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
    }
  }

  // Guardar tablas dinámicas
  saveDynamicTables(id, dynamicTables);

  return { success: true, id: id, codigo: docData.Codigo };
}

function saveDynamicTables(docId, tables) {
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.TABLAS);
  const data = sheet.getDataRange().getValues();

  // Eliminar registros previos de este documento
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === docId) {
      sheet.deleteRow(i + 1);
    }
  }

  // Preparar todos los nuevos registros para inserción masiva
  const newRows = [];
  Object.keys(tables).forEach(tipoTabla => {
    tables[tipoTabla].forEach(row => {
      // Asegurar que la fila tenga 8 columnas (ID_Doc, TipoTabla + 6 columnas)
      const fullRow = [docId, tipoTabla];
      for (let i = 0; i < 6; i++) {
        fullRow.push(row[i] || "");
      }
      newRows.push(fullRow);
    });
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 8).setValues(newRows);
  }
}

/**
 * Obtiene todos los documentos (filtrado por rol si no es Admin).
 */
function getDocuments() {
  const user = getUserInfo();
  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const docs = [];
  for (let i = 1; i < data.length; i++) {
    const doc = {};
    headers.forEach((h, j) => doc[h] = data[i][j]);

    if (user.rol === ROLES.ADMIN || doc.CreadoPor === user.email) {
      docs.push(doc);
    }
  }
  return docs;
}

/**
 * Obtiene el detalle completo de un documento.
 */
function getDocumentDetail(id) {
  const ss = getSS();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const tableSheet = ss.getSheetByName(SHEETS.TABLAS);
  const fileSheet = ss.getSheetByName(SHEETS.ARCHIVOS);

  const docData = docSheet.getDataRange().getValues();
  const headers = docData[0];
  let doc = null;

  for (let i = 1; i < docData.length; i++) {
    if (docData[i][0] === id) {
      doc = {};
      headers.forEach((h, j) => doc[h] = docData[i][j]);
      break;
    }
  }

  if (!doc) throw new Error("Documento no encontrado");

  // Obtener tablas dinámicas
  const tables = {};
  const tableData = tableSheet.getDataRange().getValues();
  for (let i = 1; i < tableData.length; i++) {
    if (tableData[i][0] === id) {
      const tipo = tableData[i][1];
      if (!tables[tipo]) tables[tipo] = [];
      tables[tipo].push(tableData[i].slice(2));
    }
  }

  // Obtener archivos
  const files = [];
  const fileData = fileSheet.getDataRange().getValues();
  for (let i = 1; i < fileData.length; i++) {
    if (fileData[i][0] === id) {
      files.push({
        fileID: fileData[i][1],
        fileName: fileData[i][2],
        fileType: fileData[i][3],
        fileURL: fileData[i][4]
      });
    }
  }

  return { doc, tables, files };
}

/**
 * Manejo de subida de archivos.
 */
function uploadFile(id, fileName, base64Data, fileType) {
  const ss = getSS();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const fileSheet = ss.getSheetByName(SHEETS.ARCHIVOS);

  // Buscar el documento para obtener su código (para el nombre de la carpeta)
  let codigo = "SIN_CODIGO";
  const docs = docSheet.getDataRange().getValues();
  for (let i = 1; i < docs.length; i++) {
    if (docs[i][0] === id) {
      codigo = docs[i][1].replace(/\//g, '-');
      break;
    }
  }

  let root;
  const roots = DriveApp.getFoldersByName(FOLDER_ROOT_NAME);
  if (roots.hasNext()) {
    root = roots.next();
  } else {
    root = DriveApp.createFolder(FOLDER_ROOT_NAME);
  }

  let folder;
  const folders = root.getFoldersByName(codigo);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = root.createFolder(codigo);
  }

  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(",")[1]), fileType, fileName);
  const file = folder.createFile(blob);

  fileSheet.appendRow([id, file.getId(), fileName, fileType, file.getUrl()]);

  return { success: true, fileURL: file.getUrl() };
}

/**
 * Cambia el estado de un documento.
 */
function changeStatus(id, newStatus, firmaData = null) {
  const user = getUserInfo();
  if (newStatus === ESTADOS.APROBADO || newStatus === ESTADOS.OBSOLETO) {
    if (user.rol !== ROLES.ADMIN) throw new Error("No tiene permisos para cambiar a este estado.");
  }

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) throw new Error("Documento no encontrado");

  const colEstado = headers.indexOf("Estado") + 1;
  sheet.getRange(rowIndex, colEstado).setValue(newStatus);

  if (firmaData) {
    const colNombre = headers.indexOf("FirmaNombre") + 1;
    const colPuesto = headers.indexOf("FirmaPuesto") + 1;
    const colFecha = headers.indexOf("FirmaFecha") + 1;
    sheet.getRange(rowIndex, colNombre).setValue(firmaData.nombre);
    sheet.getRange(rowIndex, colPuesto).setValue(firmaData.puesto);
    sheet.getRange(rowIndex, colFecha).setValue(new Date());
  }

  return { success: true };
}

/**
 * Obtener estadísticas para el dashboard admin.
 */
function getAdminStats() {
  const user = getUserInfo();
  if (user.rol !== ROLES.ADMIN) throw new Error("Acceso denegado: Se requiere rol ADMIN.");

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();

  const stats = {
    total: 0,
    porEstado: {},
    porTipo: {}
  };

  for (let i = 1; i < data.length; i++) {
    stats.total++;
    const estado = data[i][4];
    const tipo = data[i][2];

    stats.porEstado[estado] = (stats.porEstado[estado] || 0) + 1;
    stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1;
  }

  return stats;
}

/**
 * Obtiene todos los usuarios registrados.
 */
function getUsers() {
  const user = getUserInfo();
  if (user.rol !== ROLES.ADMIN) throw new Error("Acceso denegado: Se requiere rol ADMIN.");

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  const users = [];

  for (let i = 1; i < data.length; i++) {
    users.push({
      email: data[i][0],
      rol: data[i][1],
      nombre: data[i][2]
    });
  }
  return users;
}

/**
 * Agrega o actualiza un usuario.
 */
function addUser(userData) {
  const user = getUserInfo();
  if (user.rol !== ROLES.ADMIN) throw new Error("Acceso denegado: Se requiere rol ADMIN.");

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.email) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, 3).setValues([[userData.email, userData.rol, userData.nombre]]);
  } else {
    sheet.appendRow([userData.email, userData.rol, userData.nombre]);
  }
  return { success: true };
}

// --- MÓDULO PROCEDIMIENTOS (REQUERIMIENTOS ESPECÍFICOS) ---

/**
 * Guarda un Procedimiento con fragmentación del campo Descripción si es necesario.
 */
function guardarProcedimiento(datos) {
  const user = getUserInfo();
  const sheet = verificarOCrearPestana(SHEETS.PROCEDIMIENTOS, [
    "ID", "Fecha", "CreadoPor", "Nombre", "Objetivo", "Alcance", "Responsabilidades",
    "RefDoc", "Definiciones", "Recursos", "DescP1", "DescP2", "DescP3",
    "Registros", "Anexos", "AnexosURL", "ControlCambiosJSON", "Estado"
  ]);

  const id = datos.ID || Utilities.getUuid();
  const fecha = datos.Fecha || new Date();
  const creador = user.email;

  // Fragmentar descripción (Límite 50,000 por celda)
  const desc = datos.Descripcion || "";
  const descParts = [
    desc.substring(0, 50000),
    desc.substring(50000, 100000),
    desc.substring(100000, 150000)
  ];

  const rowData = [
    id,
    fecha,
    creador,
    datos.Nombre,
    datos.Objetivo,
    datos.Alcance,
    datos.Responsabilidades,
    datos.RefDoc,
    datos.Definiciones,
    datos.Recursos,
    descParts[0],
    descParts[1],
    descParts[2],
    datos.Registros,
    datos.Anexos,
    datos.AnexosURL,
    JSON.stringify(datos.ControlCambios || []),
    datos.Estado || "Borrador"
  ];

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success: true, id: id };
}

/**
 * Obtiene un Procedimiento reconstruyendo la descripción.
 */
function obtenerProcedimiento(id) {
  const sheet = verificarOCrearPestana(SHEETS.PROCEDIMIENTOS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const row = data[i];
      const proc = {};
      headers.forEach((h, j) => proc[h] = row[j]);

      // Reconstruir descripción
      proc.Descripcion = (proc.DescP1 || "") + (proc.DescP2 || "") + (proc.DescP3 || "");
      proc.ControlCambios = JSON.parse(proc.ControlCambiosJSON || "[]");

      return proc;
    }
  }
  throw new Error("Procedimiento no encontrado");
}

/**
 * Lista procedimientos para el dashboard.
 */
function listarProcedimientos() {
  const sheet = verificarOCrearPestana(SHEETS.PROCEDIMIENTOS);
  const data = sheet.getDataRange().getValues();
  const procs = [];

  for (let i = 1; i < data.length; i++) {
    procs.push({
      ID: data[i][0],
      Fecha: data[i][1],
      Nombre: data[i][3],
      Objetivo: data[i][4].substring(0, 100) + "...",
      Estado: data[i][17],
      CreadoPor: data[i][2]
    });
  }
  return procs;
}

/**
 * Registra una acción de seguimiento.
 */
function registrarSeguimiento(datos) {
  const user = getUserInfo();
  const sheet = verificarOCrearPestana(SHEETS.SEGUIMIENTO, ["Timestamp", "ID", "Registrado por", "Estado", "Observaciones", "Fecha de seguimiento"]);

  sheet.appendRow([
    new Date(),
    datos.ID,
    user.email,
    datos.Estado,
    datos.Observaciones,
    datos.FechaSeguimiento
  ]);

  return { success: true };
}

/**
 * Obtiene el historial de seguimiento para un ID.
 */
function obtenerSeguimiento(id) {
  const sheet = verificarOCrearPestana(SHEETS.SEGUIMIENTO);
  const data = sheet.getDataRange().getValues();
  const filtered = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === id) {
      filtered.push({
        timestamp: data[i][0],
        registradoPor: data[i][2],
        estado: data[i][3],
        observaciones: data[i][4],
        fechaSeguimiento: data[i][5]
      });
    }
  }
  return filtered;
}

/**
 * Elimina un usuario.
 */
function removeUser(email) {
  const user = getUserInfo();
  if (user.rol !== ROLES.ADMIN) throw new Error("Acceso denegado: Se requiere rol ADMIN.");

  const ss = getSS();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === email) {
      sheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}
