/**
 * Sistema de Gestión Documental - Mérida
 * Backend Logic (Código.gs)
 */

const FOLDER_ROOT_NAME = "Gestion_Documental_Merida";

const SHEETS = {
  USUARIOS: "Usuarios",
  DOCUMENTOS: "Documentos",
  SECCIONES: "Secciones_Documento",
  HISTORIAL: "Historial_Cambios"
};

const ESTADOS_GLOBAL = {
  EDICION: "En_Edición",
  REVISION: "En_Revision",
  APROBADO: "Aprobado",
  OBSERVADO: "Observado"
};

const ESTADOS_SECCION = {
  PENDIENTE: "Pendiente",
  VISTO_BUENO: "Visto_Bueno",
  OBSERVADO: "Observado"
};

const SECCIONES_TIPO = {
  POLITICA: ["OBJETIVO", "ALCANCE", "MARCO LEGAL", "DEFINICIONES", "POLÍTICAS GENERALES", "POLÍTICAS ESPECÍFICAS", "ANEXOS", "SANCIONES", "CONTROL DE CAMBIOS"],
  PROCESO: ["OBJETIVO", "ALCANCE", "RESPONSABILIDADES", "DOCUMENTOS DE REFERENCIA", "DEFINICIONES", "RECURSOS A UTILIZAR", "DESCRIPCIÓN DEL PROCEDIMIENTO", "REGISTROS QUE GENERA EL PROCEDIMIENTO", "ANEXOS", "CONTROL DE CAMBIOS"]
};

/**
 * Inicialización de la aplicación.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Sistema de Gestión Documental')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Configuración inicial de las hojas de cálculo.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const requiredSheets = [
    { name: SHEETS.USUARIOS, headers: ["ID", "Nombre", "Correo", "Rol", "Coordinación", "Dirección", "Subdirección", "Departamento"] },
    { name: SHEETS.DOCUMENTOS, headers: ["ID_Documento", "Código", "Tipo", "Coordinación", "Dirección", "Subdirección", "Departamento", "Número_Revisión", "ID_Usuario", "Fecha_Creación", "Estado_Global", "Observaciones_Generales"] },
    { name: SHEETS.SECCIONES, headers: ["ID_Seccion", "ID_Documento", "Nombre_Seccion", "Contenido_Texto", "Estado_Seccion", "Observaciones_Seccion", "Fecha_Revision", "Revisado_Por"] },
    { name: SHEETS.HISTORIAL, headers: ["ID", "ID_Documento", "ID_Seccion", "Accion", "Usuario", "Fecha", "Detalle"] }
  ];

  requiredSheets.forEach(sheetDef => {
    let sheet = ss.getSheetByName(sheetDef.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetDef.name);
    }
    sheet.getRange(1, 1, 1, sheetDef.headers.length).setValues([sheetDef.headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  });

  return "Sistema configurado exitosamente.";
}

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('📑 Gestión Documental')
      .addItem('Configurar Tablas', 'setup')
      .addToUi();
}

/**
 * Obtiene información del usuario logueado.
 */
function getUserInfo() {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email) {
      return {
        id: data[i][0],
        nombre: data[i][1],
        email: email,
        rol: data[i][3],
        coordinacion: data[i][4],
        direccion: data[i][5],
        subdireccion: data[i][6],
        departamento: data[i][7]
      };
    }
  }

  // Por defecto si no está registrado
  return { email: email, rol: "usuario", nombre: "Invitado" };
}

/**
 * Genera el código único del documento.
 */
function generateDocCode(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const docs = sheet.getDataRange().getValues();
  const year = new Date().getFullYear();
  const tipoAbrev = data.tipo === "Proceso" ? "PRO" : "POL";

  let consecutive = 1;
  for (let i = 1; i < docs.length; i++) {
    const docCode = docs[i][1];
    if (docCode.includes(`${tipoAbrev}-${year}`)) {
      const parts = docCode.split("-");
      const num = parseInt(parts[parts.length - 1]);
      if (num >= consecutive) consecutive = num + 1;
    }
  }

  const paddedConsecutive = consecutive.toString().padStart(3, '0');
  return `${data.coordinacion}-${data.direccion}-${data.subdireccion}-${data.departamento}-${tipoAbrev}-${year}-${paddedConsecutive}`;
}

/**
 * Guarda o actualiza un documento y sus secciones.
 */
function saveDocument(docData, sections) {
  const user = getUserInfo();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const secSheet = ss.getSheetByName(SHEETS.SECCIONES);

  let idDoc = docData.ID_Documento;
  const isNew = !idDoc;

  if (isNew) {
    idDoc = Utilities.getUuid();
    docData.Código = generateDocCode(docData);
    docData.Fecha_Creación = new Date();
    docData.Estado_Global = ESTADOS_GLOBAL.EDICION;
    docData.ID_Usuario = user.email;

    const row = [idDoc, docData.Código, docData.tipo, docData.coordinacion, docData.direccion, docData.subdireccion, docData.departamento, docData.Número_Revisión, user.email, docData.Fecha_Creación, docData.Estado_Global, ""];
    docSheet.appendRow(row);
  } else {
    // Validar propiedad del documento
    const existingDocs = docSheet.getDataRange().getValues();
    let rowIndex = -1;
    for(let i=1; i<existingDocs.length; i++) {
      if (existingDocs[i][0] === idDoc) {
        if (existingDocs[i][8] !== user.email && user.rol !== "administrador") throw new Error("No tienes permiso para editar este documento.");
        rowIndex = i + 1;
        break;
      }
    }
    // Actualizar encabezado si es necesario (ej. número de revisión)
    docSheet.getRange(rowIndex, 8).setValue(docData.Número_Revisión);
  }

  // Guardar Secciones
  sections.forEach(sec => {
    const secData = secSheet.getDataRange().getValues();
    let secRowIndex = -1;
    for(let j=1; j<secData.length; j++) {
      if (secData[j][1] === idDoc && secData[j][2] === sec.nombre) {
        // Si la sección ya está aprobada, no permitir cambios al usuario normal
        if (secData[j][4] === ESTADOS_SECCION.VISTO_BUENO && user.rol !== "administrador") return;
        secRowIndex = j + 1;
        break;
      }
    }

    if (secRowIndex !== -1) {
      secSheet.getRange(secRowIndex, 4).setValue(sec.contenido);
      if (user.rol === "usuario") {
        secSheet.getRange(secRowIndex, 5).setValue(ESTADOS_SECCION.PENDIENTE); // Reset a pendiente tras edición del usuario
      }
    } else {
      const idSec = Utilities.getUuid();
      secSheet.appendRow([idSec, idDoc, sec.nombre, sec.contenido, ESTADOS_SECCION.PENDIENTE, "", "", ""]);
    }

    // Registrar historial
    logChange(idDoc, sec.nombre, "Edición", user.email, `Contenido actualizado: ${sec.contenido.substring(0, 50)}...`);
  });

  return { success: true, id: idDoc, codigo: docData.Código };
}

function logChange(idDoc, idSec, accion, usuario, detalle) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.HISTORIAL);
  sheet.appendRow([Utilities.getUuid(), idDoc, idSec, accion, usuario, new Date(), detalle]);
}

/**
 * Obtiene lista de documentos para el dashboard.
 */
function getDocuments() {
  const user = getUserInfo();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const secSheet = ss.getSheetByName(SHEETS.SECCIONES);

  const docsData = docSheet.getDataRange().getValues();
  const sectionsData = secSheet.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < docsData.length; i++) {
    const doc = docsData[i];
    // Filtro por usuario si no es admin
    if (user.rol !== "administrador" && doc[8] !== user.email) continue;

    // Calcular progreso
    const docId = doc[0];
    const docSections = sectionsData.filter(s => s[1] === docId);
    const approved = docSections.filter(s => s[4] === ESTADOS_SECCION.VISTO_BUENO).length;
    const total = SECCIONES_TIPO[doc[2].toUpperCase().replace("Ó", "O")].length;

    results.push({
      id: docId,
      codigo: doc[1],
      tipo: doc[2],
      fecha: doc[9],
      estado: doc[10],
      progreso: `${approved} de ${total}`,
      usuario: doc[8]
    });
  }
  return results;
}

/**
 * Obtiene detalle completo de un documento y sus secciones.
 */
/**
 * Obtiene catálogos para el encabezado.
 */
function getCatalogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  const coords = [...new Set(data.slice(1).map(r => r[4]))].filter(Boolean);
  const dirs = [...new Set(data.slice(1).map(r => r[5]))].filter(Boolean);
  const subs = [...new Set(data.slice(1).map(r => r[6]))].filter(Boolean);
  const depts = [...new Set(data.slice(1).map(r => r[7]))].filter(Boolean);

  return { coords, dirs, subs, depts };
}

function getDocumentDetail(idDoc) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const secSheet = ss.getSheetByName(SHEETS.SECCIONES);

  const docs = docSheet.getDataRange().getValues();
  let doc = null;
  for (let i = 1; i < docs.length; i++) {
    if (docs[i][0] === idDoc) {
      doc = {
        id: docs[i][0],
        codigo: docs[i][1],
        tipo: docs[i][2],
        coordinacion: docs[i][3],
        direccion: docs[i][4],
        subdireccion: docs[i][5],
        departamento: docs[i][6],
        revision: docs[i][7],
        creador: docs[i][8],
        estado: docs[i][10],
        obs_generales: docs[i][11]
      };
      break;
    }
  }

  const sections = secSheet.getDataRange().getValues()
    .filter(s => s[1] === idDoc)
    .map(s => ({
      id: s[0],
      nombre: s[2],
      contenido: s[3],
      estado: s[4],
      observaciones: s[5]
    }));

  return { doc, sections };
}

/**
 * Cambia el estado del documento a Revisión.
 */
function sendToReview(idDoc) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idDoc) {
      sheet.getRange(i + 1, 11).setValue(ESTADOS_GLOBAL.REVISION);

      // Notificación Email
      try {
        const adminEmail = "revisor@merida.gob.mx"; // Email del administrador/revisor
        GmailApp.sendEmail(adminEmail,
          "📝 Documento enviado a revisión: " + data[i][1],
          "El usuario " + Session.getActiveUser().getEmail() + " ha enviado el documento " + data[i][1] + " para su revisión administrativa.");
      } catch(e) { console.error("Error envío email: " + e); }

      return true;
    }
  }
  return false;
}

/**
 * Lógica de revisión por sección (Solo Administrador).
 */
function reviewSection(idDoc, nombreSec, decision, observaciones) {
  const user = getUserInfo();
  if (user.rol !== "administrador") throw new Error("Acceso denegado.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const secSheet = ss.getSheetByName(SHEETS.SECCIONES);
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);

  const secData = secSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < secData.length; i++) {
    if (secData[i][1] === idDoc && secData[i][2] === nombreSec) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) throw new Error("Sección no encontrada.");

  const nuevoEstado = decision === "aprobar" ? ESTADOS_SECCION.VISTO_BUENO : ESTADOS_SECCION.OBSERVADO;
  secSheet.getRange(rowIndex, 5).setValue(nuevoEstado);
  secSheet.getRange(rowIndex, 6).setValue(observaciones || "");
  secSheet.getRange(rowIndex, 7).setValue(new Date());
  secSheet.getRange(rowIndex, 8).setValue(user.email);

  // Verificar si todas las secciones están aprobadas para actualizar estado global
  updateGlobalStatus(idDoc);

  return true;
}

function updateGlobalStatus(idDoc) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const secSheet = ss.getSheetByName(SHEETS.SECCIONES);
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTOS);

  const docData = docSheet.getDataRange().getValues();
  let docRow = -1;
  let tipo = "";
  for(let i=1; i<docData.length; i++) {
    if(docData[i][0] === idDoc) {
      docRow = i + 1;
      tipo = docData[i][2];
      break;
    }
  }

  const allSections = secSheet.getDataRange().getValues().filter(s => s[1] === idDoc);
  const requiredSections = SECCIONES_TIPO[tipo.toUpperCase().replace("Ó", "O")];

  const areAllApproved = requiredSections.every(secName => {
                           const s = allSections.find(as => as[2] === secName);
                           return s && s[4] === ESTADOS_SECCION.VISTO_BUENO;
                         });

  const anyObserved = allSections.some(s => s[4] === ESTADOS_SECCION.OBSERVADO);

  if (areAllApproved) {
    docSheet.getRange(docRow, 11).setValue(ESTADOS_GLOBAL.APROBADO);
  } else if (anyObserved) {
    docSheet.getRange(docRow, 11).setValue(ESTADOS_GLOBAL.OBSERVADO);

    // Notificar al usuario
    try {
      const userEmail = docData[docRow-1][8];
      GmailApp.sendEmail(userEmail,
        "⚠️ Observaciones en documento: " + docData[docRow-1][1],
        "Su documento " + docData[docRow-1][1] + " ha recibido observaciones. Por favor ingrese al sistema para corregirlas.");
    } catch(e) { console.error("Error envío email usuario: " + e); }
  }
}
