/**
 * Sistema de Gestión Documental - Mérida
 * Backend Logic (Código.gs)
 * v3.2 - Estabilidad Total y Verificación de Estructura
 */

const SHEETS = {
  USUARIOS: "Usuarios",
  DOCUMENTOS: "Documentos",
  SECCIONES: "Secciones_Documento",
  HISTORIAL: "Historial_Cambios",
  ANEXOS: "Anexo_Documental",
  DEPENDENCIAS: "Dependencias"
};

const SHEET_HEADERS = {
  [SHEETS.USUARIOS]: ["ID", "Nombre", "Correo", "Rol", "Coordinación", "Dirección", "Subdirección", "Departamento"],
  [SHEETS.DOCUMENTOS]: ["ID_Documento", "Código", "Tipo", "Coordinación", "Dirección", "Subdirección", "Departamento", "Número_Revisión", "ID_Usuario", "Fecha_Creación", "Estado_Global", "Observaciones_Generales"],
  [SHEETS.SECCIONES]: ["ID_Seccion", "ID_Documento", "Nombre_Seccion", "Contenido_Texto", "Estado_Seccion", "Observaciones_Seccion", "Fecha_Revision", "Revisado_Por"],
  [SHEETS.HISTORIAL]: ["ID", "ID_Documento", "ID_Seccion", "Accion", "Usuario", "Fecha", "Detalle"],
  [SHEETS.ANEXOS]: ["ID_Anexo", "ID_Documento", "Nombre_Anexo", "Detalle"],
  [SHEETS.DEPENDENCIAS]: ["Direccion", "Subdireccion", "Departamento"]
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
  POLITICA: ["OBJETIVO", "ALCANCE", "MARCO LEGAL", "DEFINICIONES", "POLÍTICAS GENERALES", "POLÍTICAS ESPECÍFICAS", "ANEXOS", "SANCIONES", "CONTROL DE CAMBIOS", "ANEXO DOCUMENTAL"],
  PROCESO: ["OBJETIVO", "ALCANCE", "RESPONSABILIDADES", "DOCUMENTOS DE REFERENCIA", "DEFINICIONES", "RECURSOS A UTILIZAR", "DESCRIPCIÓN DEL PROCEDIMIENTO", "REGISTROS QUE GENERA EL PROCEDIMIENTO", "ANEXOS", "CONTROL DE CAMBIOS", "ANEXO DOCUMENTAL"]
};

function getSS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No se detecta la hoja de cálculo. Vincule el script.");
  return ss;
}

function getSheet(name) {
  const ss = getSS();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = SHEET_HEADERS[name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#e9ecef");
      sheet.setFrozenRows(1);
    }
    SpreadsheetApp.flush();
  }
  return sheet;
}

function doGet() {
  try { setup(); } catch(e) { console.error("Setup falló:", e); }
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Gestión Documental - Mérida')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setup() {
  Object.keys(SHEETS).forEach(key => getSheet(SHEETS[key]));

  // Poblar dependencias de ejemplo si está vacío
  const depSheet = getSheet(SHEETS.DEPENDENCIAS);
  if (depSheet.getLastRow() === 1) {
    const sampleDeps = [
      ["DIRECCIÓN DE ADMINISTRACIÓN", "SUBDIRECCIÓN DE RECURSOS HUMANOS", "DEPARTAMENTO DE NÓMINA"],
      ["DIRECCIÓN DE ADMINISTRACIÓN", "SUBDIRECCIÓN DE RECURSOS HUMANOS", "DEPARTAMENTO DE CAPACITACIÓN"],
      ["DIRECCIÓN DE ADMINISTRACIÓN", "SUBDIRECCIÓN DE TECNOLOGÍAS", "DEPARTAMENTO DE SOPORTE"],
      ["DIRECCIÓN DE GOBERNACIÓN", "", "DEPARTAMENTO DE CONSEJERÍA JURÍDICA"],
      ["DIRECCIÓN DE GOBERNACIÓN", "", "DEPARTAMENTO DE ASUNTOS JURÍDICOS"]
    ];
    depSheet.getRange(2, 1, sampleDeps.length, 3).setValues(sampleDeps);
  }

  const userSheet = getSheet(SHEETS.USUARIOS);
  const ownerEmail = Session.getEffectiveUser().getEmail().toLowerCase().trim();

  const data = userSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString().toLowerCase().trim() === ownerEmail) {
      found = true;
      if (data[i][3] !== "administrador") {
        userSheet.getRange(i + 1, 4).setValue("administrador");
      }
      break;
    }
  }

  if (!found) {
    userSheet.appendRow([Utilities.getUuid(), "Administrador Principal", ownerEmail, "administrador", "N/A", "N/A", "N/A", "N/A"]);
  }

  SpreadsheetApp.flush();
  return "OK";
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📑 Gestión Documental').addItem('Configurar Tablas', 'setup').addToUi();
}

function getUserInfo() {
  let email = Session.getActiveUser().getEmail();
  if (!email) email = Session.getEffectiveUser().getEmail();

  email = (email || "desconocido@merida.gob.mx").toLowerCase().trim();
  console.log("Identificando usuario:", email);

  const data = getSheet(SHEETS.USUARIOS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const userEmail = (data[i][2] || "").toString().toLowerCase().trim();
    if (userEmail === email && email !== "") {
      return {
        id: data[i][0],
        nombre: data[i][1],
        email: email,
        rol: (data[i][3] || "usuario").toLowerCase().trim(),
        coord: data[i][4],
        dir: data[i][5]
      };
    }
  }

  // Si es el primer usuario o no existe, pero es el propietario del script, darle admin temporal para configuración
  if (email === Session.getEffectiveUser().getEmail().toLowerCase().trim()) {
     return { email: email, rol: "administrador", nombre: "Admin (Propietario)" };
  }

  return { email: email, rol: "usuario", nombre: "Invitado" };
}

function getSystemStatus() {
  const ss = getSS();
  const status = { url: ss.getUrl(), sheets: {} };
  Object.keys(SHEETS).forEach(key => {
    const s = ss.getSheetByName(SHEETS[key]);
    status.sheets[SHEETS[key]] = s ? s.getLastRow() - 1 : "NO EXISTE";
  });
  return status;
}

function getDocuments() {
  try {
    const user = getUserInfo();
    const docsSheet = getSheet(SHEETS.DOCUMENTOS);
    const docsData = docsSheet.getDataRange().getValues();
    const sectionsData = getSheet(SHEETS.SECCIONES).getDataRange().getValues();
    const isAdmin = user.rol === "administrador";
    const userEmail = user.email.toLowerCase().trim();

    console.log("Cargando documentos para:", userEmail, "Es Admin:", isAdmin);

    if (docsData.length <= 1) return [];

    const results = [];
    for (let i = 1; i < docsData.length; i++) {
      const row = docsData[i];
      if (!row[0] || row[0].toString().trim() === "") continue;

      const owner = (row[8] || "").toString().toLowerCase().trim();

      // Filtro de visibilidad
      if (!isAdmin && owner !== userEmail) continue;

      const docId = row[0];
      const docSections = sectionsData.filter(s => s[1] === docId);
      const approved = docSections.filter(s => s[4] === ESTADOS_SECCION.VISTO_BUENO).length;

      const tipoStr = (row[2] || "Proceso");
      const tipoKey = tipoStr.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const total = (SECCIONES_TIPO[tipoKey] || SECCIONES_TIPO.PROCESO).length;

      results.push({
        id: docId,
        codigo: row[1] || "S/C",
        tipo: tipoStr,
        fecha: (row[9] instanceof Date) ? row[9].toISOString() : new Date().toISOString(),
        estado: row[10] || ESTADOS_GLOBAL.EDICION,
        progreso: `${approved} de ${total}`,
        usuario: row[8] || "N/A",
        obs_generales: row[11] || ""
      });
    }
    return results;
  } catch (e) {
    console.error("getDocuments falló:", e);
    throw e;
  }
}

function saveDocument(docData, sections) {
  const user = getUserInfo();
  const docSheet = getSheet(SHEETS.DOCUMENTOS);
  const secSheet = getSheet(SHEETS.SECCIONES);
  const anexoSheet = getSheet(SHEETS.ANEXOS);

  let idDoc = docData.ID_Documento;
  const isNew = !idDoc;

  if (!isNew) {
    const docMeta = docSheet.getDataRange().getValues().find(r => r[0] === idDoc);
    if (docMeta && docMeta[10] === ESTADOS_GLOBAL.APROBADO && user.rol !== "administrador") {
      throw new Error("El documento está aprobado y bloqueado para edición.");
    }
  }

  if (isNew) {
    idDoc = Utilities.getUuid();
    docData.Código = generateDocCode(docData);
    docSheet.appendRow([idDoc, docData.Código, docData.tipo, docData.coordinacion, docData.direccion, docData.subdireccion, docData.departamento, docData.Número_Revisión, user.email, new Date(), ESTADOS_GLOBAL.EDICION, ""]);
  } else {
    const dataDocs = docSheet.getDataRange().getValues();
    let rIdx = -1;
    for(let i=1; i<dataDocs.length; i++) {
      if (dataDocs[i][0] === idDoc) {
        if (dataDocs[i][8].toString().toLowerCase().trim() !== user.email && user.rol !== "administrador") throw new Error("No permitido");
        rIdx = i + 1; break;
      }
    }
    if (rIdx !== -1) docSheet.getRange(rIdx, 8).setValue(docData.Número_Revisión);
  }

  const existingSections = secSheet.getDataRange().getValues()
      .filter(r => r[1] === idDoc && !r[2].includes("_PART_"));

  sections.forEach(sec => {
    // Preservar estado si ya existía
    const prev = existingSections.find(ex => ex[2] === sec.nombre);
    let finalEstado = ESTADOS_SECCION.PENDIENTE;
    let finalObs = "";
    let finalFecha = "";
    let finalUser = "";

    if (prev) {
      // Si la sección ya estaba aprobada (Visto Bueno), mantenemos el estado
      // a menos que sea el Administrador quien la esté modificando intencionalmente
      if (prev[4] === ESTADOS_SECCION.VISTO_BUENO && user.rol !== "administrador") {
        finalEstado = ESTADOS_SECCION.VISTO_BUENO;
        finalObs = prev[5];
        finalFecha = prev[6];
        finalUser = prev[7];
      }
    }

    const content = sec.contenido || "";
    const fragments = content.match(/.{1,45000}/g) || [""];

    // Limpiar secciones anteriores
    const sData = secSheet.getDataRange().getValues();
    for (let j = sData.length - 1; j >= 1; j--) {
      const currentName = sData[j][2] || "";
      if (sData[j][1] === idDoc && (currentName === sec.nombre || currentName.startsWith(sec.nombre + "_PART_"))) {
        secSheet.deleteRow(j + 1);
      }
    }

    // Insertar fragmentos
    fragments.forEach((frag, idx) => {
      const nombreFinal = idx === 0 ? sec.nombre : `${sec.nombre}_PART_${idx}`;
      // El estado y metadatos de revisión solo se ponen en la fila base (idx 0)
      if (idx === 0) {
        secSheet.appendRow([Utilities.getUuid(), idDoc, nombreFinal, frag, finalEstado, finalObs, finalFecha, finalUser]);
      } else {
        secSheet.appendRow([Utilities.getUuid(), idDoc, nombreFinal, frag, "", "", "", ""]);
      }
    });
  });

  SpreadsheetApp.flush();
  return { success: true, idDoc: idDoc, codigo: docData.Código || "OK" };
}

function generateDocCode(data) {
  const docs = getSheet(SHEETS.DOCUMENTOS).getDataRange().getValues();

  // Claves según tipo
  const CLAVES = {
    "Política": "PL",
    "Proceso": "P",
    "Instructivo": "I",
    "Descriptiva de Puesto": "DP",
    "Formato": "F",
    "Documento": "D",
    "Especificación Técnica": "E",
    "Mapa de Proceso": "MP",
    "Macroprocesos": "MAC",
    "Manual de Calidad": "MC",
    "Plan de Calidad": "PC"
  };

  const clave = CLAVES[data.tipo] || "D";
  const siglasDir = getSiglas(data.direccion);
  const siglasUA = getSiglas(data.departamento || data.subdireccion || "UA");

  // Cálculo de consecutivo por departamento/despacho
  let count = 1;
  const prefix = `${clave}-${siglasDir}/${siglasUA}-`;

  docs.forEach(r => {
    if (r[1] && r[1].startsWith(prefix)) {
      const parts = r[1].split("-");
      const n = parseInt(parts[parts.length - 1]);
      if (!isNaN(n) && n >= count) count = n + 1;
    }
  });

  return `${prefix}${count.toString().padStart(2, '0')}`;
}

function getSiglas(texto) {
  if (!texto) return "UA";

  // Eliminar stop words institucionales
  const stopWords = ["DIRECCIÓN", "UNIDAD", "SUBDIRECCIÓN", "DEPARTAMENTO", "COORDINACIÓN", "DE", "Y", "LA", "EL", "LOS", "LAS"];
  let palabras = texto.toUpperCase().split(/\s+/).filter(p => !stopWords.includes(p) && p.length > 0);

  if (palabras.length === 0) return texto.substring(0, 3).toUpperCase();

  if (palabras.length === 1) {
    return palabras[0].substring(0, 3);
  } else if (palabras.length === 2) {
    return palabras[0].substring(0, 2) + palabras[1].substring(0, 1);
  } else {
    return palabras[0].substring(0, 1) + palabras[1].substring(0, 1) + palabras[2].substring(0, 1);
  }
}

function getDocumentDetail(idDoc) {
  const doc = getSheet(SHEETS.DOCUMENTOS).getDataRange().getValues().find(r => r[0] === idDoc);
  if (!doc) throw new Error("No encontrado");

  const allSections = getSheet(SHEETS.SECCIONES).getDataRange().getValues().filter(r => r[1] === idDoc);
  const baseSections = allSections.filter(s => !s[2].includes("_PART_"));

  const mapped = baseSections.map(s => {
    let content = s[3];
    const baseName = s[2];

    // Recomponer fragmentos
    const parts = allSections.filter(p => p[2].startsWith(`${baseName}_PART_`))
                             .sort((a, b) => a[2].localeCompare(b[2]));
    parts.forEach(p => content += p[3]);

    return { id: s[0], nombre: baseName, contenido: content, estado: s[4], observaciones: s[5] };
  });

  return {
    doc: { id: doc[0], codigo: doc[1], tipo: doc[2], coordinacion: doc[3], direccion: doc[4], subdireccion: doc[5], departamento: doc[6], revision: doc[7], creador: doc[8], estado: doc[10], obs_generales: doc[11] },
    sections: mapped
  };
}

/**
 * Gestión de Archivos en Drive
 */
function uploadFileToDrive(idDoc, base64Data, fileName, mimeType) {
  const user = getUserInfo();
  const doc = getSheet(SHEETS.DOCUMENTOS).getDataRange().getValues().find(r => r[0] === idDoc);
  if (!doc) throw new Error("Documento no encontrado.");

  const folderName = `DOC_${doc[1].replace(/\//g, '_')}`;
  let rootFolder;
  const folders = DriveApp.getFoldersByName("GESTION_DOCUMENTAL_MERIDA");
  if (folders.hasNext()) rootFolder = folders.next();
  else rootFolder = DriveApp.createFolder("GESTION_DOCUMENTAL_MERIDA");

  let docFolder;
  const subFolders = rootFolder.getFoldersByName(folderName);
  if (subFolders.hasNext()) docFolder = subFolders.next();
  else docFolder = rootFolder.createFolder(folderName);

  const decoded = Utilities.base64Decode(base64Data.split(",")[1]);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const file = docFolder.createFile(blob);

  const anexoSheet = getSheet(SHEETS.ANEXOS);
  anexoSheet.appendRow([Utilities.getUuid(), idDoc, fileName, file.getUrl()]);

  // Si es un "Documento Firmado", cambiar estado a APROBADO
  if (fileName.toLowerCase().includes("firmado")) {
    const docSheet = getSheet(SHEETS.DOCUMENTOS);
    const data = docSheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if (data[i][0] === idDoc) {
        docSheet.getRange(i+1, 11).setValue(ESTADOS_GLOBAL.APROBADO);
        break;
      }
    }
  }

  return { success: true, url: file.getUrl() };
}

function getAttachedFiles(idDoc) {
  return getSheet(SHEETS.ANEXOS).getDataRange().getValues()
    .filter(r => r[1] === idDoc)
    .map(r => ({ id: r[0], nombre: r[2], url: r[3] }));
}

function deleteAttachedFile(idAnexo) {
  const sheet = getSheet(SHEETS.ANEXOS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if (data[i][0] === idAnexo) {
      // Intentar borrar de Drive si es URL de Drive
      try {
        const fileId = data[i][3].split("id=")[1] || data[i][3].split("/d/")[1].split("/")[0];
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch(e) {}
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return true;
}

function reviewSection(idDoc, nombreSec, decision, obs) {
  const user = getUserInfo();
  if (user.rol !== "administrador") throw new Error("Acceso denegado");
  const sheet = getSheet(SHEETS.SECCIONES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === idDoc && data[i][2] === nombreSec) {
      const estado = decision === "aprobar" ? ESTADOS_SECCION.VISTO_BUENO : ESTADOS_SECCION.OBSERVADO;
      sheet.getRange(i + 1, 5, 1, 4).setValues([[estado, obs, new Date(), user.email]]);
      break;
    }
  }
  updateGlobalStatus(idDoc);
  SpreadsheetApp.flush();
  return true;
}

function updateGlobalStatus(idDoc) {
  const docSheet = getSheet(SHEETS.DOCUMENTOS);
  const sections = getSheet(SHEETS.SECCIONES).getDataRange().getValues().filter(r => r[1] === idDoc);
  const data = docSheet.getDataRange().getValues();
  let row = -1;
  for(let i=0; i<data.length; i++) if(data[i][0] === idDoc) { row = i+1; break; }

  const tipo = data[row-1][2].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const required = SECCIONES_TIPO[tipo] || [];
  const allApproved = required.every(name => sections.find(s => s[2] === name && s[4] === ESTADOS_SECCION.VISTO_BUENO));
  const anyObserved = sections.some(s => s[4] === ESTADOS_SECCION.OBSERVADO);

  if (allApproved) docSheet.getRange(row, 11).setValue(ESTADOS_GLOBAL.APROBADO);
  else if (anyObserved) docSheet.getRange(row, 11).setValue(ESTADOS_GLOBAL.OBSERVADO);
}

function sendToReview(idDoc) {
  const sheet = getSheet(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (data[i][0] === idDoc) { sheet.getRange(i + 1, 11).setValue(ESTADOS_GLOBAL.REVISION); break; }
  SpreadsheetApp.flush();
  return true;
}

function getUsersList() {
  return getSheet(SHEETS.USUARIOS).getDataRange().getValues().slice(1).map(r => ({ nombre: r[1], email: r[2], rol: r[3], coordinacion: r[4], direccion: r[5] }));
}

function saveUser(u) {
  const sheet = getSheet(SHEETS.USUARIOS);
  sheet.appendRow([Utilities.getUuid(), u.nombre, u.email.toLowerCase().trim(), u.rol, u.coordinacion, u.direccion, "N/A", "N/A"]);
  SpreadsheetApp.flush();
  return true;
}

function deleteUser(email) {
  const sheet = getSheet(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) if (data[i][2].toString().toLowerCase().trim() === email.toLowerCase().trim()) sheet.deleteRow(i + 1);
  SpreadsheetApp.flush();
  return true;
}

function getCatalogs() {
  const depSheet = getSheet(SHEETS.DEPENDENCIAS);
  const data = depSheet.getDataRange().getValues();
  // Formato jerárquico: { Direccion: { Subdireccion: [Deptos] } }
  const tree = {};

  for (let i = 1; i < data.length; i++) {
    const [dir, sub, dep] = data[i].map(v => v.toString().trim());
    if (!dir) continue;

    if (!tree[dir]) tree[dir] = {};
    const subKey = sub || "N/A"; // Cambiado de GENERAL a N/A
    if (!tree[dir][subKey]) tree[dir][subKey] = [];
    if (dep && !tree[dir][subKey].includes(dep)) tree[dir][subKey].push(dep);
  }

  return {
    tree: tree
  };
}

function updateGeneralObs(idDoc, obs) {
  const admin = getUserInfo();
  if (admin.rol !== "administrador") throw new Error("Acceso denegado");
  const sheet = getSheet(SHEETS.DOCUMENTOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (data[i][0] === idDoc) { sheet.getRange(i + 1, 12).setValue(obs); break; }
  SpreadsheetApp.flush();
  return true;
}
