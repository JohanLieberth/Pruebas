/**
 * Sistema de Administración de Servicios Técnico
 * Consolas y Accesorios de Videojuegos
 */

const CONFIG = {
  NOMBRE_SISTEMA: "GameService Pro",
  FOLIO_PREFIX: "BF-",
  ADMIN_ROLE: "admin",
  CLIENT_ROLE: "cliente",
  ESTADOS: ["Pendiente", "En reparación", "Listo", "Entregado", "Cancelado"],
  RECOLECCION_AVISO: "DISPOSITIVO CON AVISO DE RECOLECCIÓN, DESPUES DE 30 DIAS, NO NOS HACEMOS RESPONSABLES DEL EQUIPO. EQUIPO MOJADO O CON DAÑOS DE HUMEDAD NO TIENE GARANTIA. EN REPARACIONES LA GARANTIA ES DE 15 DIAS SOBRE LA PIEZA CAMBIADA, APLICA RESTRICCIONES. TRABAJO DE MANTENIMIENTO NO APLICA GARANTIA. PUEDE COMUNICARSE AL 9999693251 PARA INFORMACION DE LUNES A SABADO DE 10 AM A 7 PM."
};

function doGet(e) {
  let page = e.parameter.page || 'index';
  let folio = e.parameter.folio;
  let tipo = e.parameter.tipo;

  if (page === 'estatus' && folio) {
    return render('Estatus', { folio: folio });
  }

  if (page === 'imprimir' && folio) {
    const servicio = obtenerDatosCompletosServicio(folio);
    return render('Imprimir', { servicio: servicio, tipo: tipo, scriptUrl: getScriptUrl() });
  }

  return render(capitalize(page));
}

function render(templateName, data = {}) {
  try {
    const template = HtmlService.createTemplateFromFile(templateName);
    template.data = data;
    return template.evaluate()
      .setTitle(CONFIG.NOMBRE_SISTEMA)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    return HtmlService.createHtmlOutput("Error: " + e.toString());
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function capitalize(s) {
  if (typeof s !== 'string') return '';
  // We keep the rest of the string as is to support CamelCase filenames like PanelCliente
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * DATABASE OPERATIONS
 */

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSS();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "Servicios") {
      sheet.appendRow(["Folio", "Nombre", "Teléfono", "Fecha de recepción", "Correo electrónico", "Dispositivo a recibir", "Descripción de la falla", "Estado del equipo", "Estatus (admin)", "Solución aplicada (admin)", "Fecha de entrega (admin)", "Timestamp de registro"]);
    } else if (name === "Usuarios") {
      sheet.appendRow(["Correo electrónico", "Nombre", "Teléfono", "Contraseña", "Rol"]);
    }
  }
  return sheet;
}

function generateFolio() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = getSheet("Servicios");
    const lastRow = sheet.getLastRow();
    let nextNum = 1;

    if (lastRow > 1) {
      const lastFolio = sheet.getRange(lastRow, 1).getValue();
      const match = lastFolio.match(/\d+$/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }

    return CONFIG.FOLIO_PREFIX + nextNum.toString().padStart(5, '0');
  } finally {
    lock.releaseLock();
  }
}

function registrarServicio(datos) {
  // Server-side validation
  if (!datos.nombre || !datos.telefono || !datos.correo || !datos.dispositivo || !datos.falla) {
    return { success: false, message: "Todos los campos obligatorios deben ser llenados." };
  }

  if (!/^\d{10}$/.test(datos.telefono)) {
    return { success: false, message: "El teléfono debe tener 10 dígitos numéricos." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) {
    return { success: false, message: "El formato del correo electrónico es inválido." };
  }

  const folio = generateFolio();
  const sheet = getSheet("Servicios");
  const timestamp = new Date();
  const fechaRecepcion = Utilities.formatDate(timestamp, "GMT-6", "dd/MM/yyyy");

  sheet.appendRow([
    folio,
    datos.nombre,
    datos.telefono,
    fechaRecepcion,
    datos.correo,
    datos.dispositivo,
    datos.falla,
    datos.estadoEquipo,
    "Pendiente",
    "",
    "",
    timestamp
  ]);

  const cuerpo = `Hola ${datos.nombre},\n\nTu servicio ha sido registrado con el folio: ${folio}.\n\nDispositivo: ${datos.dispositivo}\nFalla: ${datos.falla}\n\nPuedes consultar el estatus en: ${getScriptUrl()}?page=estatus&folio=${folio}\n\n${CONFIG.RECOLECCION_AVISO}`;

  try {
    GmailApp.sendEmail(datos.correo, `Registro de Servicio - ${folio}`, cuerpo);
  } catch (e) {
    console.error("Error enviando correo: " + e.toString());
  }

  return { folio: folio, success: true };
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function validarLogin(correo, pass) {
  const sheet = getSheet("Usuarios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === correo && data[i][3].toString() === pass.toString()) {
      return {
        success: true,
        user: {
          email: data[i][0],
          nombre: data[i][1],
          rol: data[i][4]
        }
      };
    }
  }
  return { success: false, message: "Credenciales incorrectas" };
}

function obtenerServicios(filtros = {}) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  const rows = data.slice(1);

  let result = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });

  if (filtros.rol === CONFIG.CLIENT_ROLE && filtros.correo) {
    result = result.filter(s => s["Correo electrónico"] === filtros.correo);
  }

  if (filtros.estatus && filtros.estatus !== "Todos") {
    result = result.filter(s => s["Estatus (admin)"] === filtros.estatus);
  }

  if (filtros.busqueda) {
    const q = filtros.busqueda.toLowerCase();
    result = result.filter(s =>
      s["Folio"].toLowerCase().includes(q) ||
      s["Nombre"].toLowerCase().includes(q) ||
      s["Teléfono"].toLowerCase().includes(q) ||
      s["Correo electrónico"].toLowerCase().includes(q)
    );
  }

  return result.reverse(); // Newest first
}

function obtenerEstatusPorFolio(folio) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      return {
        Folio: data[i][0],
        Nombre: data[i][1],
        Dispositivo: data[i][5],
        Estatus: data[i][8],
        FechaEntrega: data[i][10],
        Falla: data[i][6],
        Solucion: data[i][9]
      };
    }
  }
  return null;
}

function obtenerDatosCompletosServicio(folio) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      let obj = {};
      headers.forEach((header, idx) => {
        obj[header] = data[i][idx];
      });
      return obj;
    }
  }
  return null;
}

function actualizarEstatus(folio, estatus, solucion, fechaEntrega) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      const oldStatus = data[i][8];
      sheet.getRange(i + 1, 9).setValue(estatus);
      sheet.getRange(i + 1, 10).setValue(solucion);
      sheet.getRange(i + 1, 11).setValue(fechaEntrega);

      if (estatus === "Listo" && oldStatus !== "Listo") {
        const correo = data[i][4];
        const nombre = data[i][1];
        const cuerpo = `Hola ${nombre},\n\nTu equipo con folio ${folio} ya está LISTO para ser recogido.\n\nSolución: ${solucion}\n\n${CONFIG.RECOLECCION_AVISO}`;
        try {
          GmailApp.sendEmail(correo, `Equipo Listo - ${folio}`, cuerpo);
        } catch (e) {
          console.error("Error enviando correo de listo: " + e.toString());
        }
      }
      return { success: true };
    }
  }
  return { success: false, message: "Folio no encontrado" };
}

function getDashboardStats() {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  const stats = {
    "Pendiente": 0,
    "En reparación": 0,
    "Listo": 0,
    "Entregado": 0,
    "Cancelado": 0
  };

  for (let i = 1; i < data.length; i++) {
    const estatus = data[i][8];
    if (stats.hasOwnProperty(estatus)) {
      stats[estatus]++;
    }
  }
  return stats;
}

function exportToCSV() {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getDisplayValues();
  let csvContent = "";
  data.forEach(row => {
    csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",") + "\r\n";
  });
  return Utilities.base64Encode(csvContent, Utilities.Charset.UTF_8);
}

function getDisclaimer() {
  return CONFIG.RECOLECCION_AVISO;
}
