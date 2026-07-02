/**
 * Gestión de Ventas (CRUD).
 */

function registrarVenta(datos = {}) {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_VENTAS);

  const total = parseFloat(datos.total) || 0;
  const anticipo = parseFloat(datos.anticipo) || 0;
  const totalCobrado = anticipo;
  const saldo = total - totalCobrado;
  const fechaActual = new Date();

  // Generar Folio si no viene
  const folio = datos.folio || "F-" + Utilities.formatDate(fechaActual, "GMT", "yyyyMMdd-HHmmss");

  const rowData = [
    folio,                  // A: FOLIO/CONCEPTO
    datos.cliente,          // B: CLIENTE
    datos.correo,           // C: CORREO
    datos.hotel,            // D: HOTEL
    total,                  // E: TOTAL
    datos.fechaLimite,      // F: FECHA LIMITE DE PAGO
    anticipo,               // G: ANTICIPO
    datos.fechaAnticipo || (anticipo > 0 ? fechaActual : ""), // H: FECHA (anticipo)
    "",                     // I: ABONO 1
    "",                     // J: FECHA 1
    "",                     // K: ABONO 2
    "",                     // L: FECHA 2
    totalCobrado,           // M: TOTAL COBRADO
    saldo,                  // N: SALDO
    datos.agente,           // O: AGENTE
    datos.estado || "Pendiente" // P: ESTADO
  ];

  sheet.appendRow(rowData);

  // Registrar en Reportes
  try {
    const reportSheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_REPORTES);
    reportSheet.appendRow([folio, datos.cliente, datos.correo, datos.hotel, total, totalCobrado, saldo, datos.agente, datos.estado || "Pendiente"]);
  } catch(e) { console.error("Error al registrar en reportes", e); }

  // Enviar Correo de Recibo
  try {
    enviarReciboVenta(datos, folio, anticipo);
  } catch(e) { console.error("Error al enviar correo", e); }

  // Registrar Anticipo en Pagos
  if (anticipo > 0) {
    try {
      const pagosSheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
      pagosSheet.appendRow([Utilities.getUuid(), folio, datos.fechaAnticipo || fechaActual, anticipo, "Anticipo", datos.estado || "Pendiente"]);
    } catch(e) { console.error("Error al registrar anticipo en pagos", e); }
  }

  const result = {
    success: true,
    folio: folio,
    data: {
      cliente: datos.cliente,
      correo: datos.correo,
      hotel: datos.hotel,
      agente: datos.agente,
      folio: folio,
      total: total,
      anticipo: anticipo,
      saldo: saldo,
      fecha: fechaActual.toISOString()
    }
  };

  return result;
}

/**
 * Envía el recibo por correo electrónico.
 */
function enviarReciboVenta(datos, folio, montoPagado) {
  const logoUrl = getLogoUrl();
  const subject = "Recibo de Venta - FriendTravel - Folio: " + folio;

  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${logoUrl}" style="max-height: 100px; margin-bottom: 20px;">
        <h2 style="color: #1a3a5c;">Recibo de Venta</h2>
      </div>
      <p>Hola <strong>${datos.cliente}</strong>,</p>
      <p>Gracias por tu compra. Aquí tienes el resumen de tu reservación:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Folio:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${folio}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Destino:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${datos.hotel}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$${parseFloat(datos.total).toLocaleString()}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Monto Pagado:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$${parseFloat(montoPagado).toLocaleString()}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Saldo Pendiente:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; color: red;">$${(parseFloat(datos.total) - parseFloat(montoPagado)).toLocaleString()}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Fecha Límite:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${datos.fechaLimite}</td></tr>
      </table>
      <p style="margin-top: 20px;">Si tienes alguna duda, por favor contáctanos.</p>
      <p>Atentamente,<br><strong>FriendTravel</strong></p>
    </div>
  `;

  GmailApp.sendEmail(datos.correo, subject, "", { htmlBody: body });
}

function obtenerVentas() {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_VENTAS);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  // Filtrar fila de totales si existe (la que tiene "TOTALES" en la columna C o índice 2)
  const rows = data.filter(row => row[2] !== "TOTALES" && row[0] !== "");

  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      // Normalizar nombres de propiedades
      let key = h.replace(/\s+/g, '_').toLowerCase();
      obj[key] = row[i];
    });
    return obj;
  }).reverse(); // Mostrar más recientes primero
}

function buscarVentaPorFolioOCliente(query) {
  if (!query) return [];
  const ventas = obtenerVentas();
  query = query.toLowerCase();

  // Filtrar solo ventas con saldo pendiente y que coincidan con la búsqueda
  return ventas.filter(v => {
    const coincide = (v['folio/concepto'] && v['folio/concepto'].toString().toLowerCase().includes(query)) ||
                     (v.cliente && v.cliente.toLowerCase().includes(query));
    const tieneSaldo = parseFloat(v.saldo) > 0;
    return coincide && tieneSaldo;
  });
}
