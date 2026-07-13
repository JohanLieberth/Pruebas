/**
 * Sistema de Administración de Servicios Técnico
 * Consolas y Accesorios de Videojuegos
 */

const CONFIG = {
  NOMBRE_SISTEMA: "BitFix",
  FOLIO_PREFIX: "BF-",
  ADMIN_ROLE: "admin",
  CLIENT_ROLE: "cliente",
  ESTADOS: ["Pendiente", "En reparación", "Listo", "Entregado", "Cancelado"],
  RECOLECCION_AVISO: "DISPOSITIVO CON AVISO DE RECOLECCIÓN, DESPUES DE 30 DIAS, NO NOS HACEMOS RESPONSABLES DEL EQUIPO. EQUIPO MOJADO O CON DAÑOS DE HUMEDAD NO TIENE GARANTIA. EN REPARACIONES LA GARANTIA ES DE 15 DIAS SOBRE LA PIEZA CAMBIADA, APLICA RESTRICCIONES. TRABAJO DE MANTENIMIENTO NO APLICA GARANTIA. PUEDE COMUNICARSE AL 9999693251 PARA INFORMACION DE LUNES A SABADO DE 10 AM A 7 PM."
};

function doGet(e) {
  e = e || {};
  e.parameter = e.parameter || {};

  let page = e.parameter.page || 'index';
  let folio = e.parameter.folio;
  let tipo = e.parameter.tipo;

  if (page === 'estatus' && folio) {
    return render('Estatus', { folio: folio });
  }

  if (page === 'dashboard') {
    return render('Dashboard');
  }

  if (page === 'confirmar' && folio) {
    return render('Confirmar', { folio: folio });
  }

  if (page === 'imprimir' && folio) {
    const servicio = obtenerDatosCompletosServicio(folio);
    if (!servicio) {
      return render('Error', { mensaje: "Folio no encontrado: " + folio });
    }
    return render('Imprimir', { servicio: servicio, tipo: tipo, scriptUrl: getScriptUrl() });
  }

  return render(capitalize(page));
}

function doPost(e) {
  const result = { success: false, message: "Petición no procesada." };
  try {
    const action = e.parameter.action;
    // Basic dispatcher for POST actions if needed, though we prefer google.script.run
    return HtmlService.createHtmlOutput(JSON.stringify(result)).setMimeType(HtmlService.MimeType.JSON);
  } catch (err) {
    return HtmlService.createHtmlOutput("Error: " + err.toString());
  }
}

function render(templateName, data = {}) {
  try {
    if (!templateName || typeof templateName !== 'string') {
      return HtmlService.createHtmlOutput("Error: Nombre de plantilla inválido.");
    }

    const template = HtmlService.createTemplateFromFile(templateName);
    template.data = data;
    return template.evaluate()
      .setTitle(CONFIG.NOMBRE_SISTEMA)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    console.error("Error en render(): " + e.toString());
    return HtmlService.createHtmlOutput("Error cargando página: " + e.toString());
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function capitalize(s) {
  if (typeof s !== 'string' || s.length === 0) return '';
  // We keep the rest of the string as is to support CamelCase filenames like PanelCliente
  // But we ensure it's not a path or containing invalid characters for template names
  const safeName = s.replace(/[^a-zA-Z0-9]/g, '');
  if (safeName.length === 0) return '';
  return safeName.charAt(0).toUpperCase() + safeName.slice(1);
}

/**
 * DATABASE OPERATIONS
 */

function getSS() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("No hay una hoja de cálculo activa vinculada.");
    }
    return ss;
  } catch (e) {
    console.error("Error en getSS(): " + e.toString());
    throw e;
  }
}

function getSheet(name) {
  const ss = getSS();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "Servicios") {
      sheet.appendRow(["Folio", "Nombre", "Teléfono", "Fecha de recepción", "Correo electrónico", "Dispositivo a recibir", "Descripción de la falla", "Estado del equipo", "Estatus (admin)", "Solución aplicada (admin)", "Fecha de entrega (admin)", "Timestamp de registro", "Total ($)", "Anticipo", "Abono", "PagoTotal", "Asignado a", "Garantía", "Vence Garantía", "Fotos"]);
    } else if (name === "Usuarios_Admin") {
      sheet.appendRow(["Email", "Contraseña", "Rol", "Nombre"]);
    } else if (name === "Usuarios_Clientes") {
      sheet.appendRow(["Email", "Contraseña", "Nombre", "Teléfono", "Fecha de Registro"]);
    } else if (name === "Config") {
      sheet.appendRow(["Parámetro", "Valor"]);
      sheet.appendRow(["Logo Principal", ""]);
      sheet.appendRow(["Logo Pequeño", ""]);
      sheet.appendRow(["URL_Video_Promocional", ""]);
      sheet.appendRow(["Paleta", "Tecnología Profesional"]);
    } else if (name === "Confirmaciones") {
      sheet.appendRow(["Folio", "Fecha de Confirmación", "Cliente"]);
    } else if (name === "Notificaciones") {
      sheet.appendRow(["Fecha", "Tipo", "Folio", "Destinatario", "Estatus"]);
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
      if (lastFolio && typeof lastFolio === 'string') {
        const match = lastFolio.match(/\d+$/);
        if (match) {
          nextNum = parseInt(match[0]) + 1;
        }
      }
    }

    return CONFIG.FOLIO_PREFIX + nextNum.toString().padStart(5, '0');
  } finally {
    lock.releaseLock();
  }
}

function registrarUsuarioCliente(datos) {
  const sheet = getSheet("Usuarios_Clientes");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === datos.email) {
      return { success: false, message: "El correo ya está registrado." };
    }
  }
  sheet.appendRow([
    datos.email,
    datos.password, // MVP: basic encryption or plain as requested
    datos.nombre,
    datos.telefono,
    new Date()
  ]);
  return { success: true };
}

function registrarServicio(datos) {
  if (!datos || typeof datos !== 'object') {
    return { success: false, message: "Datos de registro no proporcionados." };
  }

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

  let fotoLinks = [];
  if (datos.fotos && datos.fotos.length > 0) {
    // Logic to save base64 to Drive would go here in a production system
    // For now we assume they are already uploaded or we store the count
    fotoLinks.push(datos.fotos.length + " fotos cargadas");
  }

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
    timestamp,
    "", // Total ($)
    datos.anticipo || 0,
    datos.abono || 0,
    datos.pagoTotal || 0,
    "", // Asignado a
    datos.garantia || "No",
    datos.venceGarantia || "",
    fotoLinks.join(", ")
  ]);

  enviarCorreoRegistro(datos, folio);

  return { folio: folio, success: true };
}

function enviarCorreoRegistro(datos, folio) {
  console.log(`Intentando enviar correo de registro para el folio ${folio}...`);
  const config = getConfig();
  let logoHtml = "";
  if (config["Logo Principal"]) {
    logoHtml = `<img src="${config["Logo Principal"]}" style="max-width: 200px; display: block; margin-bottom: 20px;">`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      ${logoHtml}
      <h2>Registro de Servicio - ${folio}</h2>
      <p>Hola <strong>${datos.nombre}</strong>,</p>
      <p>Tu servicio ha sido registrado exitosamente.</p>
      <ul>
        <li><strong>Folio:</strong> ${folio}</li>
        <li><strong>Dispositivo:</strong> ${datos.dispositivo}</li>
        <li><strong>Falla:</strong> ${datos.falla}</li>
      </ul>
      <p>Puedes consultar el estatus en tiempo real aquí:</p>
      <a href="${getScriptUrl()}?page=estatus&folio=${folio}" style="background-color: #e94560; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Consultar Estatus</a>
      <br><br>
      <p style="font-size: 0.8em; color: #666;">${CONFIG.RECOLECCION_AVISO}</p>
    </div>
  `;

  try {
    GmailApp.sendEmail(datos.correo, `Registro de Servicio - ${folio}`, "", { htmlBody: htmlBody });
    console.log(`Correo de registro enviado a ${datos.correo}`);
  } catch (e) {
    console.error("Error enviando correo de registro: " + e.toString());
  }
}

function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    console.error("Error obteniendo URL del script: " + err.toString());
    return "";
  }
}

function validarLogin(correo, pass) {
  // Check Admins
  const adminSheet = getSheet("Usuarios_Admin");
  const adminData = adminSheet.getDataRange().getValues();
  for (let i = 1; i < adminData.length; i++) {
    if (adminData[i][0] === correo && adminData[i][1].toString() === pass.toString()) {
      return {
        success: true,
        user: {
          email: adminData[i][0],
          nombre: adminData[i][3],
          rol: adminData[i][2] // 'Administrador' or 'Supervisor'
        }
      };
    }
  }

  // Check Clients
  const clientSheet = getSheet("Usuarios_Clientes");
  const clientData = clientSheet.getDataRange().getValues();
  for (let i = 1; i < clientData.length; i++) {
    if (clientData[i][0] === correo && clientData[i][1].toString() === pass.toString()) {
      return {
        success: true,
        user: {
          email: clientData[i][0],
          nombre: clientData[i][2],
          rol: 'cliente'
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

  // Role-based filtering for Supervisors
  if (filtros.userRole === 'Supervisor') {
    result = result.filter(s => s["Asignado a"] === filtros.userName);
  }

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
      s["Correo electrónico"].toLowerCase().includes(q) ||
      (s["Descripción de la falla"] && s["Descripción de la falla"].toLowerCase().includes(q))
    );
  }

  // Remove sensitive data for Supervisors
  if (filtros.userRole === 'Supervisor') {
    result.forEach(s => {
      delete s["Total ($)"];
    });
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
        Solucion: data[i][9],
        "Total ($)": data[i][12]
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

function actualizarEstatus(folio, estatus, solucion, fechaEntrega, userRole, total) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      const oldStatus = data[i][8];
      sheet.getRange(i + 1, 9).setValue(estatus);
      sheet.getRange(i + 1, 10).setValue(solucion);
      sheet.getRange(i + 1, 11).setValue(fechaEntrega);
      if (total !== undefined && total !== null) {
        sheet.getRange(i + 1, 13).setValue(total);
      }

      if (estatus === "Listo" && oldStatus !== "Listo") {
        enviarCorreoEquipoListo(data[i], folio, solucion, total);
      }
      return { success: true };
    }
  }
  return { success: false, message: "Folio no encontrado" };
}

function enviarCorreoEquipoListo(rowData, folio, solucion, total) {
  console.log(`Intentando enviar correo de 'Listo' para el folio ${folio}...`);
  const config = getConfig();
  const correo = rowData[4];
  const nombre = rowData[1];
  let logoHtml = "";
  if (config["Logo Principal"]) {
    logoHtml = `<img src="${config["Logo Principal"]}" style="max-width: 200px; display: block; margin-bottom: 20px;">`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; text-align: center;">
      ${logoHtml}
      <h2 style="color: #2ecc71;">¡Tu equipo está listo!</h2>
      <p>Hola <strong>${nombre}</strong>, tenemos excelentes noticias.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: left; display: inline-block; width: 100%; max-width: 400px;">
        <p><strong>Folio:</strong> ${folio}</p>
        <p><strong>Solución:</strong> ${solucion}</p>
        <p><strong>Total a pagar:</strong> $${total || '0.00'}</p>
      </div>
      <p>Por favor, confírmanos que vendrás a recogerlo:</p>
      <a href="${getScriptUrl()}?page=confirmar&folio=${folio}" style="background-color: #e94560; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Confirmar Recolección</a>
      <br><br>
      <p style="font-size: 0.8em; color: #666;">${CONFIG.RECOLECCION_AVISO}</p>
    </div>
  `;

  try {
    GmailApp.sendEmail(correo, `Equipo Listo - ${folio}`, "", { htmlBody: htmlBody });
    console.log(`Correo de equipo listo enviado a ${correo}`);
  } catch (e) {
    console.error("Error enviando correo de listo: " + e.toString());
  }
}

function confirmarRecoleccion(folio) {
  const sheet = getSheet("Confirmaciones");
  const servSheet = getSheet("Servicios");
  const data = servSheet.getDataRange().getValues();
  let cliente = "Desconocido";

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      cliente = data[i][1];
      break;
    }
  }

  sheet.appendRow([folio, new Date(), cliente]);
  return { success: true };
}


function eliminarServicio(folio, userRole) {
  if (userRole !== 'Administrador') {
    return { success: false, message: "No tienes permisos para eliminar registros." };
  }
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: "Folio no encontrado." };
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
    const estatus = (data[i][8] || "").toString().trim();
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

function getConfig() {
  const sheet = getSheet("Config");
  const data = sheet.getDataRange().getValues();
  let config = {};
  for (let i = 1; i < data.length; i++) {
    config[data[i][0]] = data[i][1];
  }
  return config;
}

function updateConfig(newConfig) {
  const sheet = getSheet("Config");
  const data = sheet.getDataRange().getValues();
  for (let key in newConfig) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(newConfig[key]);
        break;
      }
    }
  }
  return { success: true };
}

/**
 * NEW BACKEND FUNCTIONS
 */

function buscarClientePorTelefono(telefono) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) { // Reverse to get most recent
    if (data[i][2].toString() === telefono.toString()) {
      return {
        nombre: data[i][1],
        correo: data[i][4]
      };
    }
  }
  return null;
}

function obtenerSupervisores() {
  const sheet = getSheet("Usuarios_Admin");
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[2] === 'Supervisor')
    .map(row => row[3]); // Return Names
}

function asignarTrabajo(folio, supervisorName) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      sheet.getRange(i + 1, 17).setValue(supervisorName);
      return { success: true };
    }
  }
  return { success: false, message: "Folio no encontrado" };
}

function enviarCorreoPersonalizado(datos) {
  try {
    GmailApp.sendEmail(datos.correo, datos.asunto, "", {
      htmlBody: datos.cuerpo
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function getDashboardData() {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  // Collections by Day
  const dailyCollections = {};
  const supervisorStats = {};

  rows.forEach(row => {
    const timestamp = row[11];
    const status = row[8];
    const supervisor = row[16] || "No asignado";
    const anticipo = parseFloat(row[13]) || 0;
    const abono = parseFloat(row[14]) || 0;
    const pagoTotal = parseFloat(row[15]) || 0;
    const totalDay = anticipo + abono + pagoTotal;

    if (timestamp instanceof Date) {
      const dayKey = Utilities.formatDate(timestamp, "GMT-6", "dd/MM");
      dailyCollections[dayKey] = (dailyCollections[dayKey] || 0) + totalDay;
    }

    if (supervisor !== "No asignado") {
      if (!supervisorStats[supervisor]) {
        supervisorStats[supervisor] = {
          "Pendiente": 0,
          "En reparación": 0,
          "Listo": 0,
          "Entregado": 0,
          "Cancelado": 0
        };
      }
      if (supervisorStats[supervisor].hasOwnProperty(status)) {
        supervisorStats[supervisor][status]++;
      }
    }
  });

  return {
    dailyCollections: dailyCollections,
    supervisorStats: supervisorStats
  };
}
