/**
 * Sistema de Administración de Servicios Técnico
 * Consolas y Accesorios de Videojuegos
 */

const CONFIG = {
  NOMBRE_SISTEMA: "BitFix",
  FOLIO_PREFIX: "BF-",
  ADMIN_ROLE: "Administrador",
  SUPERVISOR_ROLE: "Supervisor",
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
    return HtmlService.createHtmlOutput(JSON.stringify(result)).setMimeType(HtmlService.MimeType.JSON);
  } catch (err) {
    return HtmlService.createHtmlOutput("Error: " + err.toString());
  }
}

/**
 * AUTHENTICATION & SECURITY
 */

function checkAuth(auth) {
  if (!auth || !auth.email || !auth.token) return { authorized: false };

  const adminSheet = getSheet("Usuarios_Admin");
  const adminData = adminSheet.getDataRange().getValues();
  for (let i = 1; i < adminData.length; i++) {
    const email = adminData[i][0];
    const pass = adminData[i][1].toString();
    const rol = adminData[i][2];
    const nombre = adminData[i][3];

    // Simple token: sha256(email + pass)
    const serverToken = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email + pass)
                          .map(function(chr){return (chr<0?chr+256:chr).toString(16).padStart(2, '0')}).join('');

    if (email === auth.email && serverToken === auth.token) {
      return { authorized: true, rol: rol, nombre: nombre, email: email };
    }
  }
  return { authorized: false };
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
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
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
      sheet.appendRow([
        "Folio", "Nombre", "Teléfono", "Fecha de recepción", "Correo electrónico",
        "Dispositivo a recibir", "Descripción de la falla", "Estado del equipo",
        "Estatus (admin)", "Solución aplicada (admin)", "Fecha de entrega (admin)",
        "Timestamp de registro", "Total ($)", "Anticipo", "Abono", "PagoTotal",
        "Asignado a", "Garantía", "Vence Garantía", "Fotos",
        "Es Taller", "Responsables", "Dispositivos JSON"
      ]);
    } else if (name === "Usuarios_Admin") {
      sheet.appendRow(["Email", "Contraseña", "Rol", "Nombre"]);
    } else if (name === "Usuarios_Clientes") {
      sheet.appendRow(["Email", "Contraseña", "Nombre", "Teléfono", "Fecha de Registro"]);
    } else if (name === "Puntos_NFC") {
      sheet.appendRow(["Email", "UID_NFC", "Saldo_Puntos", "Historial_JSON", "Ultima_Actualizacion"]);
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
  } else if (name === "Servicios") {
    // Check if new columns need to be appended to existing header row
    const lastCol = sheet.getLastColumn();
    if (lastCol > 0 && lastCol < 23) {
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      if (!headers.includes("Es Taller")) {
        sheet.getRange(1, lastCol + 1, 1, 3).setValues([["Es Taller", "Responsables", "Dispositivos JSON"]]);
      }
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
    datos.password,
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

  // Handle multi-device or single-device data structure
  let dispositivosList = [];
  if (Array.isArray(datos.dispositivos) && datos.dispositivos.length > 0) {
    dispositivosList = datos.dispositivos.map(d => ({
      dispositivo: d.dispositivo || "",
      falla: d.falla || "",
      estadoEquipo: d.estadoEquipo || "",
      fotos: d.fotos || [],
      estatus: d.estatus || "Pendiente",
      costo: parseFloat(d.costo) || 0,
      notificadoListo: false
    }));
  } else if (datos.dispositivo && datos.falla) {
    dispositivosList = [{
      dispositivo: datos.dispositivo,
      falla: datos.falla,
      estadoEquipo: datos.estadoEquipo || "",
      fotos: datos.fotos || [],
      estatus: "Pendiente",
      costo: parseFloat(datos.pagoTotal || datos.costo) || 0,
      notificadoListo: false
    }];
  }

  // Server-side validation
  if (!datos.nombre || !datos.telefono || !datos.correo || dispositivosList.length === 0) {
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
  // Punto 1: Incluir hora en formato dd/MM/yyyy HH:mm
  const fechaRecepcion = Utilities.formatDate(timestamp, "GMT-6", "dd/MM/yyyy HH:mm");

  // Summary strings for table display
  const mainDispositivo = dispositivosList.map(d => d.dispositivo).join(" | ");
  const mainFalla = dispositivosList.map(d => d.falla).join(" | ");
  const mainEstado = dispositivosList.map(d => d.estadoEquipo).join(" | ");

  // Total fotos count across all devices
  let totalFotos = 0;
  dispositivosList.forEach(d => {
    if (d.fotos && Array.isArray(d.fotos)) totalFotos += d.fotos.length;
  });
  const fotoSummary = totalFotos > 0 ? (totalFotos + " fotos cargadas") : "";

  const esTallerVal = (datos.esTaller === true || datos.esTaller === "Sí") ? "Sí" : "No";
  const responsablesVal = Array.isArray(datos.responsables) ? datos.responsables.join(", ") : (datos.responsables || "");

  // Punto 3: Suma dinámica de costo total
  let totalCalculado = 0;
  dispositivosList.forEach(d => {
    totalCalculado += parseFloat(d.costo) || 0;
  });
  const pagoTotalFinal = parseFloat(datos.pagoTotal) > 0 ? parseFloat(datos.pagoTotal) : totalCalculado;

  sheet.appendRow([
    folio,
    datos.nombre,
    datos.telefono,
    fechaRecepcion,
    datos.correo,
    mainDispositivo,
    mainFalla,
    mainEstado,
    "Pendiente",
    "",
    "",
    timestamp,
    pagoTotalFinal, // Total ($)
    datos.anticipo || 0,
    datos.abono || 0,
    pagoTotalFinal,
    "", // Asignado a
    datos.garantia || "No",
    datos.venceGarantia || "",
    fotoSummary,
    esTallerVal,
    responsablesVal,
    JSON.stringify(dispositivosList)
  ]);

  enviarCorreoRegistro({
    nombre: datos.nombre,
    correo: datos.correo,
    dispositivo: mainDispositivo,
    falla: mainFalla,
    dispositivos: dispositivosList
  }, folio);

  return { folio: folio, success: true };
}

function enviarCorreoRegistro(datos, folio) {
  const config = getConfig();
  let logoHtml = "";
  if (config["Logo Principal"]) {
    logoHtml = `<img src="${config["Logo Principal"]}" style="max-width: 200px; display: block; margin-bottom: 20px;">`;
  }

  let dispositivosHtml = "";
  if (datos.dispositivos && datos.dispositivos.length > 0) {
    dispositivosHtml = datos.dispositivos.map((d, i) =>
      `<li><strong>Dispositivo #${i+1}:</strong> ${d.dispositivo}<br><strong>Falla:</strong> ${d.falla}</li>`
    ).join("");
  } else {
    dispositivosHtml = `<li><strong>Dispositivo:</strong> ${datos.dispositivo}</li><li><strong>Falla:</strong> ${datos.falla}</li>`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      ${logoHtml}
      <h2>Registro de Servicio - ${folio}</h2>
      <p>Hola <strong>${datos.nombre}</strong>,</p>
      <p>Tu servicio ha sido registrado exitosamente.</p>
      <ul>
        <li><strong>Folio:</strong> ${folio}</li>
        ${dispositivosHtml}
      </ul>
      <p>Puedes consultar el estatus en tiempo real aquí:</p>
      <a href="${getScriptUrl()}?page=estatus&folio=${folio}" style="background-color: #e94560; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Consultar Estatus</a>
      <br><br>
      <p style="font-size: 0.8em; color: #666;">${CONFIG.RECOLECCION_AVISO}</p>
    </div>
  `;

  try {
    GmailApp.sendEmail(datos.correo, `Registro de Servicio - ${folio}`, "", { htmlBody: htmlBody });
  } catch (e) {
    console.error("Error enviando correo de registro: " + e.toString());
  }
}

function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    return "";
  }
}

function validarLogin(correo, pass) {
  // Check Admins
  const adminSheet = getSheet("Usuarios_Admin");
  const adminData = adminSheet.getDataRange().getValues();
  for (let i = 1; i < adminData.length; i++) {
    if (adminData[i][0] === correo && adminData[i][1].toString() === pass.toString()) {
      const token = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, correo + pass)
                      .map(function(chr){return (chr<0?chr+256:chr).toString(16).padStart(2, '0')}).join('');
      return {
        success: true,
        user: {
          email: adminData[i][0],
          nombre: adminData[i][3],
          rol: adminData[i][2],
          token: token
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

function obtenerServicios(filtros = {}, auth = null) {
  let userRol = null;
  let userName = null;

  if (auth) {
    const authRes = checkAuth(auth);
    if (!authRes.authorized) throw new Error("No autorizado");
    userRol = authRes.rol;
    userName = authRes.nombre;
  } else if (filtros.rol !== CONFIG.CLIENT_ROLE) {
    throw new Error("Petición administrativa requiere autenticación");
  }

  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  const rows = data.slice(1);

  let result = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });

    // Normalize taller / tercero status
    obj.esTaller = (obj["Es Taller"] === "Sí" || obj["Es Taller"] === "true" || obj["Es Taller"] === true);
    obj.responsables = obj["Responsables"] ? obj["Responsables"].split(", ").filter(Boolean) : [];

    // Parse structured dispositivos or fall back to single device historical record
    let dispositivos = [];
    if (obj["Dispositivos JSON"]) {
      try {
        dispositivos = JSON.parse(obj["Dispositivos JSON"]);
      } catch (e) {
        dispositivos = [];
      }
    }
    const generalCost = parseFloat(obj["Total ($)"] || obj["PagoTotal"]) || 0;
    if (!Array.isArray(dispositivos) || dispositivos.length === 0) {
      dispositivos = [{
        dispositivo: obj["Dispositivo a recibir"] || "",
        falla: obj["Descripción de la falla"] || "",
        estadoEquipo: obj["Estado del equipo"] || "",
        fotos: [],
        estatus: obj["Estatus (admin)"] || "Pendiente",
        costo: generalCost,
        notificadoListo: false
      }];
    } else {
      // Ensure every device has estatus, costo, and notificadoListo (historical compatibility)
      const equalShareCost = (dispositivos.length > 0 && generalCost > 0) ? (generalCost / dispositivos.length) : 0;
      dispositivos = dispositivos.map(d => ({
        ...d,
        estatus: d.estatus || obj["Estatus (admin)"] || "Pendiente",
        costo: (d.costo !== undefined && d.costo !== null) ? parseFloat(d.costo) : equalShareCost,
        notificadoListo: d.notificadoListo === true
      }));
    }
    obj.dispositivos = dispositivos;

    return obj;
  });

  // Role-based filtering for Supervisors
  if (userRol === 'Supervisor') {
    result = result.filter(s => s["Asignado a"] === userName);
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
  if (userRol === 'Supervisor') {
    result.forEach(s => {
      delete s["Total ($)"];
      delete s["Anticipo"];
      delete s["Abono"];
      delete s["PagoTotal"];
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
      let obj = {};
      headers.forEach((header, idx) => {
        obj[header] = data[i][idx];
      });

      let dispositivos = [];
      if (obj["Dispositivos JSON"]) {
        try { dispositivos = JSON.parse(obj["Dispositivos JSON"]); } catch (e) { dispositivos = []; }
      }
      const generalCost = parseFloat(obj["Total ($)"] || obj["PagoTotal"]) || 0;
      if (!Array.isArray(dispositivos) || dispositivos.length === 0) {
        dispositivos = [{
          dispositivo: obj["Dispositivo a recibir"] || "",
          falla: obj["Descripción de la falla"] || "",
          estadoEquipo: obj["Estado del equipo"] || "",
          fotos: [],
          estatus: obj["Estatus (admin)"] || "Pendiente",
          costo: generalCost,
          notificadoListo: false
        }];
      } else {
        const equalShareCost = (dispositivos.length > 0 && generalCost > 0) ? (generalCost / dispositivos.length) : 0;
        dispositivos = dispositivos.map(d => ({
          ...d,
          estatus: d.estatus || obj["Estatus (admin)"] || "Pendiente",
          costo: (d.costo !== undefined && d.costo !== null) ? parseFloat(d.costo) : equalShareCost,
          notificadoListo: d.notificadoListo === true
        }));
      }

      return {
        Folio: obj["Folio"],
        Nombre: obj["Nombre"],
        Dispositivo: obj["Dispositivo a recibir"],
        Estatus: obj["Estatus (admin)"],
        FechaEntrega: obj["Fecha de entrega (admin)"],
        Falla: obj["Descripción de la falla"],
        Solucion: obj["Solución aplicada (admin)"],
        "Total ($)": obj["Total ($)"],
        dispositivos: dispositivos
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

      let dispositivos = [];
      if (obj["Dispositivos JSON"]) {
        try { dispositivos = JSON.parse(obj["Dispositivos JSON"]); } catch (e) { dispositivos = []; }
      }
      const generalCost = parseFloat(obj["Total ($)"] || obj["PagoTotal"]) || 0;
      if (!Array.isArray(dispositivos) || dispositivos.length === 0) {
        dispositivos = [{
          dispositivo: obj["Dispositivo a recibir"] || "",
          falla: obj["Descripción de la falla"] || "",
          estadoEquipo: obj["Estado del equipo"] || "",
          fotos: [],
          estatus: obj["Estatus (admin)"] || "Pendiente",
          costo: generalCost,
          notificadoListo: false
        }];
      } else {
        const equalShareCost = (dispositivos.length > 0 && generalCost > 0) ? (generalCost / dispositivos.length) : 0;
        dispositivos = dispositivos.map(d => ({
          ...d,
          estatus: d.estatus || obj["Estatus (admin)"] || "Pendiente",
          costo: (d.costo !== undefined && d.costo !== null) ? parseFloat(d.costo) : equalShareCost,
          notificadoListo: d.notificadoListo === true
        }));
      }
      obj.dispositivos = dispositivos;
      return obj;
    }
  }
  return null;
}

function actualizarEstatus(folio, estatusGeneral, solucion, fechaEntrega, totalOverride, auth, dispositivosActualizados) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized) return { success: false, message: "No autorizado" };

  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colJsonIdx = headers.indexOf("Dispositivos JSON") + 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === folio) {
      const oldStatus = data[i][8];
      const correoCliente = data[i][4];
      const nombreCliente = data[i][1];

      if (authRes.rol === 'Supervisor' && data[i][16] !== authRes.nombre) {
        return { success: false, message: "No tienes permiso para editar este servicio (no asignado)." };
      }

      // Existing dispositivos from JSON column
      let existingDispositivos = [];
      if (colJsonIdx > 0 && data[i][colJsonIdx - 1]) {
        try { existingDispositivos = JSON.parse(data[i][colJsonIdx - 1]); } catch (e) { existingDispositivos = []; }
      }
      if (!Array.isArray(existingDispositivos) || existingDispositivos.length === 0) {
        existingDispositivos = [{
          dispositivo: data[i][5] || "",
          falla: data[i][6] || "",
          estadoEquipo: data[i][7] || "",
          fotos: [],
          estatus: oldStatus || "Pendiente",
          costo: parseFloat(data[i][12]) || 0,
          notificadoListo: false
        }];
      }

      const newlyReadyDevices = [];

      // Update per-device status and costs
      let finalDispositivos = existingDispositivos;
      if (Array.isArray(dispositivosActualizados) && dispositivosActualizados.length > 0) {
        finalDispositivos = existingDispositivos.map((d, idx) => {
          const updateObj = dispositivosActualizados[idx] || {};
          const nextStatus = updateObj.estatus || d.estatus || estatusGeneral || "Pendiente";
          const nextCosto = (updateObj.costo !== undefined && updateObj.costo !== null && updateObj.costo !== "") ? parseFloat(updateObj.costo) : (parseFloat(d.costo) || 0);

          let wasNotified = d.notificadoListo === true;

          // Punto 2: Detect when device passes to "Listo" for the first time
          if (nextStatus === "Listo" && !wasNotified) {
            newlyReadyDevices.push({
              dispositivo: d.dispositivo,
              falla: d.falla,
              costo: nextCosto
            });
            wasNotified = true;
          }

          return {
            ...d,
            estatus: nextStatus,
            costo: nextCosto,
            notificadoListo: wasNotified
          };
        });
      } else if (estatusGeneral) {
        finalDispositivos = existingDispositivos.map(d => {
          let wasNotified = d.notificadoListo === true;
          if (estatusGeneral === "Listo" && !wasNotified) {
            newlyReadyDevices.push({
              dispositivo: d.dispositivo,
              falla: d.falla,
              costo: parseFloat(d.costo) || 0
            });
            wasNotified = true;
          }
          return {
            ...d,
            estatus: estatusGeneral,
            notificadoListo: wasNotified
          };
        });
      }

      // Punto 3: Calculate sum of device costs
      let calculatedTotal = 0;
      finalDispositivos.forEach(d => { calculatedTotal += parseFloat(d.costo) || 0; });
      const finalTotal = (totalOverride !== undefined && totalOverride !== null && totalOverride !== "") ? parseFloat(totalOverride) : calculatedTotal;

      // Calculate order general status from per-device statuses
      let computedOrderEstatus = estatusGeneral;
      if (finalDispositivos.length > 0) {
        const statuses = finalDispositivos.map(d => d.estatus || "Pendiente");
        const allEntregado = statuses.every(s => s === "Entregado");
        const allListo = statuses.every(s => s === "Listo");
        const allCancelado = statuses.every(s => s === "Cancelado");
        const someEntregado = statuses.some(s => s === "Entregado");
        const someEnReparacion = statuses.some(s => s === "En reparación");

        if (allEntregado) {
          computedOrderEstatus = "Entregado";
        } else if (allListo) {
          computedOrderEstatus = "Listo";
        } else if (allCancelado) {
          computedOrderEstatus = "Cancelado";
        } else if (someEntregado || someEnReparacion) {
          computedOrderEstatus = "En reparación";
        } else if (!estatusGeneral) {
          computedOrderEstatus = statuses[0];
        }
      }

      sheet.getRange(i + 1, 9).setValue(computedOrderEstatus);
      sheet.getRange(i + 1, 10).setValue(solucion);
      sheet.getRange(i + 1, 11).setValue(fechaEntrega);

      if (colJsonIdx > 0) {
        sheet.getRange(i + 1, colJsonIdx).setValue(JSON.stringify(finalDispositivos));
      }

      if (authRes.rol === 'Administrador') {
        sheet.getRange(i + 1, 13).setValue(finalTotal);
        sheet.getRange(i + 1, 16).setValue(finalTotal);
      }

      // Punto 2: Send email if any device became "Listo" for the first time
      if (newlyReadyDevices.length > 0) {
        const allReadyInOrder = finalDispositivos.every(d => d.estatus === "Listo" || d.estatus === "Entregado");
        enviarCorreoDispositivosListos(correoCliente, nombreCliente, folio, newlyReadyDevices, allReadyInOrder, finalTotal, solucion);
      }

      return { success: true };
    }
  }
  return { success: false, message: "Folio no encontrado" };
}

// Punto 2: Correo al usuario cuando dispositivo(s) pasa a estatus "Listo" sin duplicados
function enviarCorreoDispositivosListos(correo, nombre, folio, newlyReadyDevices, allReadyInOrder, total, solucion) {
  const config = getConfig();
  let logoHtml = "";
  if (config["Logo Principal"]) {
    logoHtml = `<img src="${config["Logo Principal"]}" style="max-width: 200px; display: block; margin-bottom: 20px;">`;
  }

  const subjectText = allReadyInOrder ? `¡Tu orden está lista para recolección! - ${folio}` : `¡Tu dispositivo está listo! - ${folio}`;

  let listHtml = newlyReadyDevices.map(d =>
    `<li><strong>${d.dispositivo}:</strong> $${parseFloat(d.costo || 0).toFixed(2)}</li>`
  ).join("");

  const mainNotice = allReadyInOrder
    ? `<p style="font-size: 1.1em; color: #2ecc71;"><strong>¡Excelente noticia! Todos los dispositivos de tu orden están listos.</strong></p>`
    : `<p style="font-size: 1.1em; color: #2ecc71;"><strong>¡Excelente noticia! Se ha completado la reparación de los siguientes dispositivos:</strong></p>`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
      ${logoHtml}
      <h2>Notificación de Servicio - ${folio}</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      ${mainNotice}
      <ul style="background: #f8f9fa; padding: 15px 30px; border-radius: 5px;">
        ${listHtml}
      </ul>
      <p><strong>Solución / Notas:</strong> ${solucion || 'Revisión y reparación completada'}</p>
      <p><strong>Total acumulado:</strong> $${parseFloat(total || 0).toFixed(2)}</p>
      <p>Por favor, confírmanos tu recolección:</p>
      <a href="${getScriptUrl()}?page=confirmar&folio=${folio}" style="background-color: #e94560; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Confirmar Recolección</a>
      <br><br>
      <p style="font-size: 0.8em; color: #666; border-top: 1px solid #eee; padding-top: 10px;">${CONFIG.RECOLECCION_AVISO}</p>
    </div>
  `;

  try {
    GmailApp.sendEmail(correo, subjectText, "", { htmlBody: htmlBody });
  } catch (e) {
    console.error("Error enviando correo de dispositivos listos: " + e.toString());
  }
}

function enviarCorreoEquipoListo(rowData, folio, solucion, total) {
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

function eliminarServicio(folio, auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized || authRes.rol !== 'Administrador') {
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

function exportToCSV(auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized) return null;

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

function updateConfig(newConfig, auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized || authRes.rol !== 'Administrador') {
    return { success: false, message: "No autorizado" };
  }

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

function buscarClientePorTelefono(telefono) {
  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
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
    .map(row => row[3]);
}

function asignarTrabajo(folio, supervisorName, auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized || authRes.rol !== 'Administrador') {
    return { success: false, message: "No autorizado" };
  }

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

function enviarCorreoPersonalizado(datos, auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized) return { success: false, message: "No autorizado" };

  try {
    GmailApp.sendEmail(datos.correo, datos.asunto, "", {
      htmlBody: datos.cuerpo
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function getDashboardData(auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized || authRes.rol !== 'Administrador') {
    throw new Error("Acceso denegado a datos financieros.");
  }

  const sheet = getSheet("Servicios");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

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

/**
 * PUNTO 4: SISTEMA DE PUNTOS CON LECTOR USB NFC
 * Regla de conversión: 100 pesos = 1 punto ($250 = 2.5 puntos, redondeado a 1 decimal: Math.round((monto/100)*10)/10)
 */

function asociarUidCliente(email, uid, auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized) return { success: false, message: "No autorizado" };

  if (!email || !uid) return { success: false, message: "Correo y UID NFC obligatorios" };

  const cleanUid = uid.toString().trim();
  const cleanEmail = email.toString().trim().toLowerCase();

  const sheet = getSheet("Puntos_NFC");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === cleanEmail) {
      sheet.getRange(i + 1, 2).setValue(cleanUid);
      sheet.getRange(i + 1, 5).setValue(new Date());
      return { success: true, message: "UID NFC actualizado correctamente para el usuario." };
    }
  }

  sheet.appendRow([
    cleanEmail,
    cleanUid,
    0,
    JSON.stringify([]),
    new Date()
  ]);

  return { success: true, message: "UID NFC registrado correctamente." };
}

function obtenerClientePorUid(uid, auth) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized) return { success: false, message: "No autorizado" };

  if (!uid) return { success: false, message: "UID no proporcionado." };
  const cleanUid = uid.toString().trim();

  const nfcSheet = getSheet("Puntos_NFC");
  const nfcData = nfcSheet.getDataRange().getValues();

  for (let i = 1; i < nfcData.length; i++) {
    if (nfcData[i][1].toString().trim() === cleanUid) {
      const email = nfcData[i][0];
      const saldo = parseFloat(nfcData[i][2]) || 0;
      let historial = [];
      try { historial = JSON.parse(nfcData[i][3]); } catch (e) { historial = []; }

      // Fetch client name and last services
      const clientServices = obtenerServicios({ rol: CONFIG.CLIENT_ROLE, correo: email });
      const nombre = clientServices.length > 0 ? clientServices[0].Nombre : email;

      return {
        success: true,
        cliente: {
          email: email,
          nombre: nombre,
          uid: cleanUid,
          saldoPuntos: saldo,
          historial: historial,
          servicios: clientServices
        }
      };
    }
  }

  return { success: false, message: "No se encontró ningún cliente asociado a este UID NFC (" + cleanUid + ")." };
}

function asignarPuntosPorMonto(uid, montoPagado, auth, folio, concepto) {
  const authRes = checkAuth(auth);
  if (!authRes.authorized) return { success: false, message: "No autorizado" };

  const monto = parseFloat(montoPagado);
  if (isNaN(monto) || monto <= 0) {
    return { success: false, message: "Monto pagado inválido." };
  }

  const cleanUid = uid ? uid.toString().trim() : "";
  if (!cleanUid) return { success: false, message: "UID NFC obligatorio." };

  // Rule: $100 = 1 point. Rounded to 1 decimal place (e.g., $250 -> 2.5 pts)
  const puntosGanados = Math.round((monto / 100) * 10) / 10;

  const sheet = getSheet("Puntos_NFC");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toString().trim() === cleanUid) {
      const email = data[i][0];
      const saldoActual = parseFloat(data[i][2]) || 0;
      const nuevoSaldo = Math.round((saldoActual + puntosGanados) * 10) / 10;

      let historial = [];
      try { historial = JSON.parse(data[i][3]); } catch (e) { historial = []; }

      const movimiento = {
        fecha: Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy HH:mm"),
        folio: folio || "N/A",
        monto: monto,
        puntos: puntosGanados,
        concepto: concepto || "Pago de Servicio"
      };

      historial.push(movimiento);

      sheet.getRange(i + 1, 3).setValue(nuevoSaldo);
      sheet.getRange(i + 1, 4).setValue(JSON.stringify(historial));
      sheet.getRange(i + 1, 5).setValue(new Date());

      return {
        success: true,
        puntosGanados: puntosGanados,
        nuevoSaldo: nuevoSaldo,
        clienteEmail: email,
        message: `¡Se asignaron ${puntosGanados} puntos exitosamente! Nuevo saldo: ${nuevoSaldo} pts.`
      };
    }
  }

  return { success: false, message: "Cliente no encontrado con este UID NFC." };
}
