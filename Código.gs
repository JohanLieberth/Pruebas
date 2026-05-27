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
  ANEXOS: "Anexo_Documental"
};

const SHEET_HEADERS = {
  [SHEETS.USUARIOS]: ["ID", "Nombre", "Correo", "Rol", "Coordinación", "Dirección", "Subdirección", "Departamento"],
  [SHEETS.DOCUMENTOS]: ["ID_Documento", "Código", "Tipo", "Coordinación", "Dirección", "Subdirección", "Departamento", "Número_Revisión", "ID_Usuario", "Fecha_Creación", "Estado_Global", "Observaciones_Generales"],
  [SHEETS.SECCIONES]: ["ID_Seccion", "ID_Documento", "Nombre_Seccion", "Contenido_Texto", "Estado_Seccion", "Observaciones_Seccion", "Fecha_Revision", "Revisado_Por"],
  [SHEETS.HISTORIAL]: ["ID", "ID_Documento", "ID_Seccion", "Accion", "Usuario", "Fecha", "Detalle"],
  [SHEETS.ANEXOS]: ["ID_Anexo", "ID_Documento", "Nombre_Anexo", "Detalle"]
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
  const userSheet = getSheet(SHEETS.USUARIOS);
  if (userSheet.getLastRow() === 1) {
    const email = Session.getActiveUser().getEmail().toLowerCase().trim();
    userSheet.appendRow([Utilities.getUuid(), "Administrador", email, "administrador", "N/A", "N/A", "N/A", "N/A"]);
    SpreadsheetApp.flush();
  }
  return "OK";
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📑 Gestión Documental').addItem('Configurar Tablas', 'setup').addToUi();
}

function getUserInfo() {
  const email = Session.getActiveUser().getEmail().toLowerCase().trim();
  const data = getSheet(SHEETS.USUARIOS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString().toLowerCase().trim() === email) {
      return { id: data[i][0], nombre: data[i][1], email: email, rol: data[i][3] };
    }
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
    const docsData = getSheet(SHEETS.DOCUMENTOS).getDataRange().getValues();
    const sectionsData = getSheet(SHEETS.SECCIONES).getDataRange().getValues();
    const userEmail = user.email;

    if (docsData.length <= 1) return [];

    const results = [];
    for (let i = 1; i < docsData.length; i++) {
      const row = docsData[i];
      if (!row[0] || row[0].toString().trim() === "") continue;

      const owner = (row[8] || "").toString().toLowerCase().trim();
      if (user.rol !== "administrador" && owner !== userEmail) continue;

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

  sections.forEach(sec => {
    if (sec.nombre === 'ANEXO DOCUMENTAL') {
      try {
        const anexos = JSON.parse(sec.contenido || "[]");
        const aData = anexoSheet.getDataRange().getValues();
        for(let k=aData.length-1; k>=1; k--) if(aData[k][1] === idDoc) anexoSheet.deleteRow(k+1);
        anexos.forEach(a => { if(a.nombre) anexoSheet.appendRow([Utilities.getUuid(), idDoc, a.nombre, a.detalle]); });
      } catch(e) { console.error("Anexo err:", e); }
    }

    const sData = secSheet.getDataRange().getValues();
    let sIdx = -1;
    for(let j=1; j<sData.length; j++) if(sData[j][1] === idDoc && sData[j][2] === sec.nombre) { sIdx = j+1; break; }

    if (sIdx !== -1) {
      secSheet.getRange(sIdx, 4).setValue(sec.contenido);
      if (user.rol !== "administrador") secSheet.getRange(sIdx, 5).setValue(ESTADOS_SECCION.PENDIENTE);
    } else {
      secSheet.appendRow([Utilities.getUuid(), idDoc, sec.nombre, sec.contenido, ESTADOS_SECCION.PENDIENTE, "", "", ""]);
    }
  });

  SpreadsheetApp.flush();
  return { success: true, codigo: docData.Código || "OK" };
}

function generateDocCode(data) {
  const docs = getSheet(SHEETS.DOCUMENTOS).getDataRange().getValues();
  const year = new Date().getFullYear();
  const abrev = data.tipo === "Proceso" ? "PRO" : "POL";
  let count = 1;
  docs.forEach(r => { if(r[1] && r[1].includes(`${abrev}-${year}`)) { const n = parseInt(r[1].split("-").pop()); if(!isNaN(n) && n >= count) count = n + 1; } });
  return `${(data.coordinacion||"COR").substring(0,3).toUpperCase()}-${(data.direccion||"DIR").substring(0,3).toUpperCase()}-${abrev}-${year}-${count.toString().padStart(3, '0')}`;
}

function getDocumentDetail(idDoc) {
  const doc = getSheet(SHEETS.DOCUMENTOS).getDataRange().getValues().find(r => r[0] === idDoc);
  if (!doc) throw new Error("No encontrado");
  const sections = getSheet(SHEETS.SECCIONES).getDataRange().getValues().filter(r => r[1] === idDoc);
  const anexos = getSheet(SHEETS.ANEXOS).getDataRange().getValues().filter(r => r[1] === idDoc);

  const mapped = sections.map(s => {
    let content = s[3];
    if (s[2] === 'ANEXO DOCUMENTAL' && anexos.length > 0) content = JSON.stringify(anexos.map(a => ({ nombre: a[2], detalle: a[3] })));
    return { id: s[0], nombre: s[2], contenido: content, estado: s[4], observaciones: s[5] };
  });

  if (!mapped.find(s => s.nombre === 'ANEXO DOCUMENTAL')) {
    mapped.push({ id: 'sim', nombre: 'ANEXO DOCUMENTAL', contenido: JSON.stringify(anexos.map(a => ({ nombre: a[2], detalle: a[3] }))), estado: 'Pendiente', observaciones: '' });
  }

  return {
    doc: { id: doc[0], codigo: doc[1], tipo: doc[2], coordinacion: doc[3], direccion: doc[4], subdireccion: doc[5], departamento: doc[6], revision: doc[7], creador: doc[8], estado: doc[10], obs_generales: doc[11] },
    sections: mapped
  };
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
  return {
    coords: ["Coordinación General de Buen Gobierno", "Coordinación General de Justicia Social y Desarrollo Humano", "Coordinación General de Desarrollo Ordenado y Gestión de la Ciudad", "AYUNTAMIENTO", "Organismos Paramunicipales"],
    dirs: ["Presidencia Municipal", "Oficina de Presidencia", "Secretaría Municipal", "Instituto Municipal de Planeación de Mérida", "Secretaría de Participación y Atención Ciudadana", "Unidad de Transparencia y Municipio Abierto", "Unidad de Comunicación Ciudadana", "Unidad de Contraloría Municipal", "Dirección de la Policía Municipal", "Dirección de Gobernación", "Dirección de Administración", "Dirección de Finanzas y Tesorería Municipal", "Dirección de Innovación y Gobierno Inteligente", "Secretaría Técnica de Planeación, seguimiento y evaluación", "Dirección de Desarrollo Integral de la Familia", "Dirección de Desarrollo Social y Combate a la Pobreza", "Unidad de Turismo", "Dirección de Bienestar Humano", "Dirección de Prosperidad y Bienestar Económico", "Instituto de las Mujeres", "Dirección de Cultura e Identidad", "Dirección de Desarrollo Urbano", "Dirección de Catastro Municipal", "Dirección de Obras Públicas", "Dirección de Servicios Públicos", "Unidad de Medio Ambiente y Bienestar Animal", "Secretaría Ejecutiva del Comité Permanente del Carnaval", "Reserva Cuxtal", "Central de Abastos", "Abastos de Mérida", "SERVI-LIMPIA"],
    subs: ["01 REGIDURÍA", "02 SECRETARÍA", "03 DESPACHO DEL SÍNDICO", "04 SUBDIRECCIÓN DE LA SECRETARÍA MUNICIPAL", "01 DIRECCIÓN DE FINANZAS", "02 SUBDIRECCIÓN DE INGRESOS", "03 SUBDIRECCIÓN DE EGRESOS", "04 SUBDIRECCIÓN DE POLÍTICA TRIBUTARIA", "05 SUBDIRECCIÓN DE PRESUPUESTOS Y CONTROL DEL GASTO", "07 SUBDIRECCIÓN DE CONTABILIDAD Y ADMINISTRACIÓN", "01 DIRECCIÓN DE CONTRALORÍA MUNICIPAL", "02 SUBDIRECCIÓN DE AUDITORÍA Y SEGUIMIENTO DE ACTOS DE FISCALIZACIÓN", "03 SUBDIRECCIÓN DE NORMATIVIDAD Y RESPONSABILIDADES", "01 DIRECCIÓN DE ADMINISTRACIÓN", "03 SUBDIRECCIÓN DE ADMINISTRACIÓN y DE PROVEEDURÍA", "05 SUBDIRECCIÓN DE RECURSOS HUMANOS", "06 SUBDIRECCIÓN DE SERVICIOS INTERNOS", "08 SUBDIRECCIÓN DE MEJORA REGULATORIA", "10 SUBDIRECCIÓN DE VENTANILLAS ÚNICAS", "11 SUBDIRECCIÓN DE PATRIMONIO MUNICIPAL", "01 DIRECCIÓN DE DESARROLLO SOCIAL Y COMBATE A LA POBREZA", "02 SUBDIRECCIÓN DE PROMOCIÓN SOCIAL", "03 SUBDIRECCIÓN DE PARTICIPACIÓN CIUDADANA", "04 SUBDIRECCIÓN DE INFRAESTRUCTURA SOCIAL", "07 SUBDIRECCIÓN DE ATENCIÓN A COMISARÍAS", "08 SECRETARÍA TÉCNICA DE COMBATE A LA POBREZA", "01 DIRECCIÓN DE SERVICIOS PÚBLICOS", "02 SUBDIRECCIÓN DE VERIFICACIÓN Y GESTIÓN", "03 SUBDIRECCIÓN DE SERVICIOS GENERALES", "04 SUBDIRECCIÓN DE SERVICIOS ORIENTE", "05 SUBDIRECCIÓN DE ADMINISTRACIÓN", "08 SUBDIRECCIÓN DE SERVICIOS BÁSICOS PONIENTE", "01 OBRAS PÚBLICAS", "02 OBRAS E INFRAESTRUCTURA", "03 VÍAS TERRESTRES", "04 SUBDIRECCIÓN DE ADMINISTRACIÓN", "05 PLANEACIÓN Y ORGANIZACIÓN DE OBRAS", "01 DIRECCIÓN DE DESARROLLO URBANO", "03 SUBDIRECCIÓN DE GESTIÓN Y CONTROL DEL TERRITORIO", "04 SUBDIRECCIÓN DE PATRIMONIO CULTURAL", "05 SUBDIRECCIÓN JURÍDICA", "06 SUBDIRECCIÓN DE NUEVOS DESARROLLOS", "07 SUBDIRECCIÓN DE CALIDAD Y ATENCION CIUDADANA", "01 INSTITUTO DE LAS MUJERES", "02 SUBDIRECCIÓN DE ATENCIÓN A LAS VIOLENCIAS", "01 UNIDAD DE TRANSPARENCIA DEL MUNICIPIO DE MÉRIDA", "01 DIRECCIÓN DE INNOVACIÓN Y GOBIERNO INTELIGENTE", "02 SUBDIRECCIÓN DE INGENIERÍA DE SOFTWARE", "03 SUBDIRECCIÓN DE INFRAESTRUCTURA", "04 SUBDIRECCIÓN DE INNOVACIÓN", "01 DIRECCIÓN DE DESARROLLO INTEGRAL DE LA FAMILIA (DIF MUNICIPAL)", "02 SUBDIRECCIÓN DE DESARROLLO INTEGRAL DE LA FAMILIA (DIF MUNICIPAL)", "01 DIRECCIÓN DE GOBERNACIÓN", "02 SUBDIRECCIÓN DE CONSEJERÍA JURÍDICA", "03 SUBDIRECCIÓN DE ASUNTOS JURÍDICOS", "04 SUBDIRECCIÓN OPERATIVA", "07 SUBDIRECCIÓN DE GOBERNACIÓN", "01 DIRECCIÓN DE BIENESTAR HUMANO", "02 SUBDIRECCIÓN DE SALUD", "03 SUBDIRECCIÓN DE DEPORTES", "04 SUBDIRECCIÓN DE ADMINISTRACIÓN", "05 SUBDIRECCIÓN DE EDUCACIÓN", "01 DIRECCIÓN DE SECRETARÍA DE PARTICIPACIÓN Y ATENCIÓN CIUDADANA", "03 SUBDIRECTOR DE PARTICIPACIÓN SOCIAL", "04 UNIDAD DE ATENCIÓN CIUDADANA", "01 DIRECCIÓN DE CATASTRO", "02 SUBDIRECCIÓN DE OPERACIONES Y PROCESOS", "03 SUBDIRECCIÓN TÉCNICA", "01 DIRECCIÓN DE IDENTIDAD Y CULTURA", "02 SUBDIRECCIÓN OPERATIVA", "03 SUBDIRECCIÓN DE CONSERVACIÓN Y DIFUSIÓN PATRIMONIAL", "04 SUBDIRECCIÓN DE CULTURA", "01 DESPACHO DEL DIRECTOR", "02 SUBDIRECCIÓN DE INFRAESTRUCTURA VERDE", "03 SUBDIRECCIÓN DE BIENESTAR ANIMAL", "01 COORDINACIÓN GENERAL DE BUEN GOBIERNO", "02 SUBDIRECCIÓN DE PROYECTOS ESPECIALES", "03 SUBDIRECCIÓN DE LOGÍSTICA", "04 SUBDIRECCIÓN DE RELACIONES PÚBLICAS Y PROTOCOLO", "05 SECRETARÍA TÉCNICA DE GESTIÓN ADMINISTRATIVA", "06 SECRETARÍA TÉCNICA DE COORDINACIÓN DE ENTIDADES PARAMUNICIPALES", "07 SECRETARIA TÉCNICA DE PLANEACIÓN, SEGUIMIENTO Y EVALUACIÓN", "09 SUBDIRECCIÓN ESPECIALIZADA EN ESTABLECIMIENTOS FIJOS, SEMIFIJOS Y AMBULANTAJE", "10 SUBDIRECCIÓN DE MERCADOS PÚBLICOS", "01 COORDINACIÓN GENERAL DE JUSTICIA SOCIAL Y DESARROLLO HUMANO", "03 UNIDAD DE TURISMO", "01 COORDINACIÓN GENERAL DE DESARROLLO ORDENADO Y GESTIÓN DE LA CIUDAD", "02 SECRETARÍA TÉCNICA DE GESTIÓN INTEGRAL DE RESIDUOS MUNICIPALES", "03 SUBDIRECCIÓN DE RESIDUOS MUNICIPALES", "04 SUBDIRECCIÓN DE PLANEACIÓN Y PROYECTOS DE RESIDUOS MUNICIPALES", "01 DIRECCIÓN DE PROSPERIDAD Y BIENESTAR ECONÓMICO", "02 SUBDIRECCIÓN DE BIENESTAR ECONÓMICO", "04 SUBDIRECCIÓN DE PROSPERIDAD", "01 DESPACHO DEL DIRECTOR", "02 SUBDIRECCIÓN DE PREVENCIÓN SOCIAL DEL DELITO Y PARTICIPACIÓN CIUDADANA", "03 SUBDIRECCIÓN DE ÁREAS DE APOYO", "04 SUBDIRECCIÓN GENERAL OPERATIVA", "05 GUARDAPARQUES", "N/A"]
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
