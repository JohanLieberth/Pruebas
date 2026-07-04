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

  // Registrar en Pagos (Siempre, para permitir lectura posterior y abonos)
  try {
    const pagosSheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
    const tipoPago = anticipo > 0 ? "Anticipo" : "Registro Venta";
    const fechaPago = datos.fechaAnticipo || fechaActual;
    const numRecibo = "REC-" + Utilities.formatDate(new Date(), "GMT-6", "HHmmss");
    // ["FECHA", "FOLIO VENTA", "CLIENTE", "MONTO PAGADO", "METODO", "SALDO ANTERIOR", "NUEVO SALDO", "NUMERO RECIBO"]
    pagosSheet.appendRow([fechaPago, folio, datos.cliente, anticipo, tipoPago, total, saldo, numRecibo]);
  } catch(e) { console.error("Error al registrar en pagos", e); }

  // Sincronizar con Google Calendar
  try {
    CalendarUtils.sincronizarEventoCalendario({
      'folio/concepto': folio,
      cliente: datos.cliente,
      fecha_limite: datos.fechaLimite,
      total: total,
      saldo: saldo,
      estado: datos.estado || "Pendiente"
    });
  } catch(e) { console.error("Error al sincronizar calendario", e); }

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
      monto: anticipo, // Para el recibo unificado
      tipo: anticipo > 0 ? "Anticipo" : "Registro",
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
  if (data.length <= 1) return [];

  // Encabezados exactos de la hoja Ventas (A-P)
  const headers = ["folio/concepto", "cliente", "correo", "hotel", "total", "fecha_limite", "anticipo", "fecha_ant", "abono_1", "fecha_1", "abono_2", "fecha_2", "total_cobrado", "saldo", "agente", "estado"];
  data.shift(); // Quitar encabezados reales de la hoja

  // Filtrar filas vacías o de totales
  const rows = data.filter(row => row[0] !== "" && row[1] !== "TOTALES");

  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  }).reverse(); // Mostrar más recientes primero
}

function buscarVentaPorFolioOCliente(query) {
  const ventas = obtenerVentas();

  // Normalizar el parsing de saldo para que sea robusto
  const parsearSaldo = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === 'number') return val;
    // Quitar símbolos de moneda y comas si vienen como string
    return parseFloat(val.toString().replace(/[$,]/g, '')) || 0;
  };

  // CASO A: Sin query (Vista inicial o campo vacío)
  if (!query) {
    const conSaldo = ventas.filter(v => parsearSaldo(v.saldo) > 0);
    return { status: "OK", results: conSaldo };
  }

  query = query.toLowerCase();

  // PASO 1: Búsqueda por coincidencia de FOLIO/CONCEPTO o CLIENTE
  const coincidencias = ventas.filter(v => {
    return (v['folio/concepto'] && v['folio/concepto'].toString().toLowerCase().includes(query)) ||
           (v.cliente && v.cliente.toLowerCase().includes(query));
  });

  if (coincidencias.length === 0) {
    return {
      status: "NOT_FOUND",
      message: "No se encontró ninguna venta con el folio/concepto ingresado. Verifique e intente nuevamente.",
      results: []
    };
  }

  // PASO 2: Validación de saldo sobre las coincidencias
  const conSaldo = coincidencias.filter(v => parsearSaldo(v.saldo) > 0);

  if (conSaldo.length === 0) {
    // Si encontramos la venta pero no tiene saldo
    const folios = coincidencias.map(v => v['folio/concepto']).join(', ');
    return {
      status: "LIQUIDATED",
      message: "La venta [" + folios + "] no tiene saldo pendiente. Ya está liquidada.",
      results: []
    };
  }

  // CASO C: Encontradas y con saldo
  return { status: "OK", results: conSaldo };
}

/**
 * Obtiene ventas disponibles para pago leyendo desde la pestaña 'Pagos'
 * y cruzando con 'Ventas' para obtener el saldo actual.
 */
function obtenerVentasDesdePagos() {
  try {
    const ssId = getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    const sheetPagos = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
    if (!sheetPagos) return [];

    const dataPagos = sheetPagos.getDataRange().getValues();
    if (dataPagos.length <= 1) return []; // Solo encabezados

    // Obtener folios únicos que tienen algún pago registrado
    const foliosConPagos = [...new Set(dataPagos.slice(1).map(row => row[1]))];

    // Obtener todas las ventas para cruzar datos de saldo y cliente
    const todasVentas = obtenerVentas();

    // Filtrar ventas que tengan pagos Y tengan saldo pendiente
    return todasVentas.filter(v =>
      foliosConPagos.includes(v['folio/concepto']) &&
      parseFloat(v.saldo) > 0
    );
  } catch (error) {
    console.error("Error en obtenerVentasDesdePagos:", error);
    return [];
  }
}
