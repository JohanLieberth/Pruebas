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
  POLITICA: ["OBJETIVO", "ALCANCE", "MARCO LEGAL", "DEFINICIONES", "POLÍTICAS GENERALES", "POLÍTICAS ESPECÍFICAS", "ANEXOS", "SANCIONES", "CONTROL DE CAMBIOS", "ANEXO DOCUMENTAL"],
  PROCESO: ["OBJETIVO", "ALCANCE", "RESPONSABILIDADES", "DOCUMENTOS DE REFERENCIA", "DEFINICIONES", "RECURSOS A UTILIZAR", "DESCRIPCIÓN DEL PROCEDIMIENTO", "REGISTROS QUE GENERA EL PROCEDIMIENTO", "ANEXOS", "CONTROL DE CAMBIOS", "ANEXO DOCUMENTAL"]
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

  // Auto-registro del primer administrador
  const userSheet = ss.getSheetByName(SHEETS.USUARIOS);
  if (userSheet.getLastRow() === 1) {
    const adminEmail = Session.getActiveUser().getEmail();
    userSheet.appendRow([Utilities.getUuid(), "Administrador Inicial", adminEmail, "administrador", "N/A", "N/A", "N/A", "N/A"]);
  }

  return "Sistema configurado exitosamente. Se ha registrado al usuario actual como administrador.";
}

/**
 * Agrega o actualiza un usuario en la base de datos.
 */
function saveUser(userData) {
  const admin = getUserInfo();
  if (admin.rol !== "administrador") throw new Error("Acceso denegado.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === userData.email) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = [
    userData.id || Utilities.getUuid(),
    userData.nombre,
    userData.email,
    userData.rol,
    userData.coordinacion || "N/A",
    userData.direccion || "N/A",
    userData.subdireccion || "N/A",
    userData.departamento || "N/A"
  ];

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { success: true };
}

/**
 * Elimina un usuario por su email.
 */
function deleteUser(email) {
  const admin = getUserInfo();
  if (admin.rol !== "administrador") throw new Error("Acceso denegado.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][2] === email) {
      sheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}

/**
 * Lista todos los usuarios (Solo Admin).
 */
function getUsersList() {
  const admin = getUserInfo();
  if (admin.rol !== "administrador") throw new Error("Acceso denegado.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.USUARIOS);
  const data = sheet.getDataRange().getValues();

  return data.slice(1).map(row => ({
    nombre: row[1],
    email: row[2],
    rol: row[3],
    coordinacion: row[4],
    direccion: row[5],
    subdireccion: row[6],
    departamento: row[7]
  }));
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
    if (!doc[0]) continue; // Saltar filas vacías o sin ID

    // Filtro por usuario si no es admin
    if (user.rol !== "administrador" && doc[8] !== user.email) continue;

    // Calcular progreso
    const docId = doc[0];
    const docSections = sectionsData.filter(s => s[1] === docId);
    const approved = docSections.filter(s => s[4] === ESTADOS_SECCION.VISTO_BUENO).length;

    // Normalización robusta del tipo para acceder a SECCIONES_TIPO
    const tipoStr = doc[2] || "PROCESO";
    const tipoNormalizado = tipoStr.toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const total = (SECCIONES_TIPO[tipoNormalizado] || []).length || 1;

    results.push({
      id: docId,
      codigo: doc[1] || "S/C",
      tipo: tipoStr,
      fecha: doc[9] || new Date(),
      estado: doc[10] || "En_Edición",
      progreso: `${approved} de ${total}`,
      usuario: doc[8] || "Desconocido"
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
  return {
    coords: [
      "Coordinación General de Buen Gobierno",
      "Coordinación General de Justicia Social y Desarrollo Humano",
      "Coordinación General de Desarrollo Ordenado y Gestión de la Ciudad",
      "AYUNTAMIENTO",
      "Organismos Paramunicipales"
    ],
    dirs: [
      "Presidencia Municipal",
      "Oficina de Presidencia",
      "Secretaría Municipal",
      "Instituto Municipal de Planeación de Mérida",
      "Secretaría de Participación y Atención Ciudadana",
      "Unidad de Transparencia y Municipio Abierto",
      "Unidad de Comunicación Ciudadana",
      "Unidad de Contraloría Municipal",
      "Dirección de la Policía Municipal",
      "Dirección de Gobernación",
      "Dirección de Administración",
      "Dirección de Finanzas y Tesorería Municipal",
      "Dirección de Innovación y Gobierno Inteligente",
      "Secretaría Técnica de Planeación, seguimiento y evaluación",
      "Dirección de Desarrollo Integral de la Familia",
      "Dirección de Desarrollo Social y Combate a la Pobreza",
      "Unidad de Turismo",
      "Dirección de Bienestar Humano",
      "Dirección de Prosperidad y Bienestar Económico",
      "Instituto de las Mujeres",
      "Dirección de Cultura e Identidad",
      "Dirección de Desarrollo Urbano",
      "Dirección de Catastro Municipal",
      "Dirección de Obras Públicas",
      "Dirección de Servicios Públicos",
      "Unidad de Medio Ambiente y Bienestar Animal",
      "Secretaría Ejecutiva del Comité Permanente del Carnaval",
      "Reserva Cuxtal",
      "Central de Abastos",
      "Abastos de Mérida",
      "SERVI-LIMPIA"
    ],
    subs: [
      "01 REGIDURÍA",
      "02 SECRETARÍA",
      "03 DESPACHO DEL SÍNDICO",
      "04 SUBDIRECCIÓN DE LA SECRETARÍA MUNICIPAL",
      "01 DIRECCIÓN DE FINANZAS",
      "02 SUBDIRECCIÓN DE INGRESOS",
      "03 SUBDIRECCIÓN DE EGRESOS",
      "04 SUBDIRECCIÓN DE POLÍTICA TRIBUTARIA",
      "05 SUBDIRECCIÓN DE PRESUPUESTOS Y CONTROL DEL GASTO",
      "07 SUBDIRECCIÓN DE CONTABILIDAD Y ADMINISTRACIÓN",
      "01 DIRECCIÓN DE CONTRALORÍA MUNICIPAL",
      "02 SUBDIRECCIÓN DE AUDITORÍA Y SEGUIMIENTO DE ACTOS DE FISCALIZACIÓN",
      "03 SUBDIRECCIÓN DE NORMATIVIDAD Y RESPONSABILIDADES",
      "01 DIRECCIÓN DE ADMINISTRACIÓN",
      "03 SUBDIRECCIÓN DE ADMINISTRACIÓN y DE PROVEEDURÍA",
      "05 SUBDIRECCIÓN DE RECURSOS HUMANOS",
      "06 SUBDIRECCIÓN DE SERVICIOS INTERNOS",
      "08 SUBDIRECCIÓN DE MEJORA REGULATORIA",
      "10 SUBDIRECCIÓN DE VENTANILLAS ÚNICAS",
      "11 SUBDIRECCIÓN DE PATRIMONIO MUNICIPAL",
      "01 DIRECCIÓN DE DESARROLLO SOCIAL Y COMBATE A LA POBREZA",
      "02 SUBDIRECCIÓN DE PROMOCIÓN SOCIAL",
      "03 SUBDIRECCIÓN DE PARTICIPACIÓN CIUDADANA",
      "04 SUBDIRECCIÓN DE INFRAESTRUCTURA SOCIAL",
      "07 SUBDIRECCIÓN DE ATENCIÓN A COMISARÍAS",
      "08 SECRETARÍA TÉCNICA DE COMBATE A LA POBREZA",
      "01 DIRECCIÓN DE SERVICIOS PÚBLICOS",
      "02 SUBDIRECCIÓN DE VERIFICACIÓN Y GESTIÓN",
      "03 SUBDIRECCIÓN DE SERVICIOS GENERALES",
      "04 SUBDIRECCIÓN DE SERVICIOS ORIENTE",
      "05 SUBDIRECCIÓN DE ADMINISTRACIÓN",
      "08 SUBDIRECCIÓN DE SERVICIOS BÁSICOS PONIENTE",
      "01 OBRAS PÚBLICAS",
      "02 OBRAS E INFRAESTRUCTURA",
      "03 VÍAS TERRESTRES",
      "04 SUBDIRECCIÓN DE ADMINISTRACIÓN",
      "05 PLANEACIÓN Y ORGANIZACIÓN DE OBRAS",
      "01 DIRECCIÓN DE DESARROLLO URBANO",
      "03 SUBDIRECCIÓN DE GESTIÓN Y CONTROL DEL TERRITORIO",
      "04 SUBDIRECCIÓN DE PATRIMONIO CULTURAL",
      "05 SUBDIRECCIÓN JURÍDICA",
      "06 SUBDIRECCIÓN DE NUEVOS DESARROLLOS",
      "07 SUBDIRECCIÓN DE CALIDAD Y ATENCION CIUDADANA",
      "01 INSTITUTO DE LAS MUJERES",
      "02 SUBDIRECCIÓN DE ATENCIÓN A LAS VIOLENCIAS",
      "01 UNIDAD DE TRANSPARENCIA DEL MUNICIPIO DE MÉRIDA",
      "01 DIRECCIÓN DE INNOVACIÓN Y GOBIERNO INTELIGENTE",
      "02 SUBDIRECCIÓN DE INGENIERÍA DE SOFTWARE",
      "03 SUBDIRECCIÓN DE INFRAESTRUCTURA",
      "04 SUBDIRECCIÓN DE INNOVACIÓN",
      "01 DIRECCIÓN DE DESARROLLO INTEGRAL DE LA FAMILIA (DIF MUNICIPAL)",
      "02 SUBDIRECCIÓN DE DESARROLLO INTEGRAL DE LA FAMILIA (DIF MUNICIPAL)",
      "01 DIRECCIÓN DE GOBERNACIÓN",
      "02 SUBDIRECCIÓN DE CONSEJERÍA JURÍDICA",
      "03 SUBDIRECCIÓN DE ASUNTOS JURÍDICOS",
      "04 SUBDIRECCIÓN OPERATIVA",
      "07 SUBDIRECCIÓN DE GOBERNACIÓN",
      "01 DIRECCIÓN DE BIENESTAR HUMANO",
      "02 SUBDIRECCIÓN DE SALUD",
      "03 SUBDIRECCIÓN DE DEPORTES",
      "04 SUBDIRECCIÓN DE ADMINISTRACIÓN",
      "05 SUBDIRECCIÓN DE EDUCACIÓN",
      "01 DIRECCIÓN DE SECRETARÍA DE PARTICIPACIÓN Y ATENCIÓN CIUDADANA",
      "03 SUBDIRECTOR DE PARTICIPACIÓN SOCIAL",
      "04 UNIDAD DE ATENCIÓN CIUDADANA",
      "01 DIRECCIÓN DE CATASTRO",
      "02 SUBDIRECCIÓN DE OPERACIONES Y PROCESOS",
      "03 SUBDIRECCIÓN TÉCNICA",
      "01 DIRECCIÓN DE IDENTIDAD Y CULTURA",
      "02 SUBDIRECCIÓN OPERATIVA",
      "03 SUBDIRECCIÓN DE CONSERVACIÓN Y DIFUSIÓN PATRIMONIAL",
      "04 SUBDIRECCIÓN DE CULTURA",
      "01 DESPACHO DEL DIRECTOR",
      "02 SUBDIRECCIÓN DE INFRAESTRUCTURA VERDE",
      "03 SUBDIRECCIÓN DE BIENESTAR ANIMAL",
      "01 COORDINACIÓN GENERAL DE BUEN GOBIERNO",
      "02 SUBDIRECCIÓN DE PROYECTOS ESPECIALES",
      "03 SUBDIRECCIÓN DE LOGÍSTICA",
      "04 SUBDIRECCIÓN DE RELACIONES PÚBLICAS Y PROTOCOLO",
      "05 SECRETARÍA TÉCNICA DE GESTIÓN ADMINISTRATIVA",
      "06 SECRETARÍA TÉCNICA DE COORDINACIÓN DE ENTIDADES PARAMUNICIPALES",
      "07 SECRETARIA TÉCNICA DE PLANEACIÓN, SEGUIMIENTO Y EVALUACIÓN",
      "09 SUBDIRECCIÓN ESPECIALIZADA EN ESTABLECIMIENTOS FIJOS, SEMIFIJOS Y AMBULANTAJE",
      "10 SUBDIRECCIÓN DE MERCADOS PÚBLICOS",
      "01 COORDINACIÓN GENERAL DE JUSTICIA SOCIAL Y DESARROLLO HUMANO",
      "03 UNIDAD DE TURISMO",
      "01 COORDINACIÓN GENERAL DE DESARROLLO ORDENADO Y GESTIÓN DE LA CIUDAD",
      "02 SECRETARÍA TÉCNICA DE GESTIÓN INTEGRAL DE RESIDUOS MUNICIPALES",
      "03 SUBDIRECCIÓN DE RESIDUOS MUNICIPALES",
      "04 SUBDIRECCIÓN DE PLANEACIÓN Y PROYECTOS DE RESIDUOS MUNICIPALES",
      "01 DIRECCIÓN DE PROSPERIDAD Y BIENESTAR ECONÓMICO",
      "02 SUBDIRECCIÓN DE BIENESTAR ECONÓMICO",
      "04 SUBDIRECCIÓN DE PROSPERIDAD",
      "01 DESPACHO DEL DIRECTOR",
      "02 SUBDIRECCIÓN DE PREVENCIÓN SOCIAL DEL DELITO Y PARTICIPACIÓN CIUDADANA",
      "03 SUBDIRECCIÓN DE ÁREAS DE APOYO",
      "04 SUBDIRECCIÓN GENERAL OPERATIVA",
      "05 GUARDAPARQUES",
      "N/A"
    ]
  };
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
