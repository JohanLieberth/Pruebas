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
  try {
    const ssId = getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_VENTAS);

    if (!sheet) {
      console.error("Hoja Ventas no encontrada");
      return [];
    }

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
  } catch (e) {
    console.error("Error en obtenerVentas: " + e.message);
    return [];
  }
}

/**
 * Busca ventas con saldo pendiente. Implementado con máxima robustez y logs de diagnóstico solicitados.
 */
function obtenerVentasConSaldo(query) {
  const q = query || "";
  console.log("Servidor: [INICIO] obtenerVentasConSaldo - Query: '" + q + "'");

  try {
    const ssId = getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    if (!ss) {
      return { status: "error", message: "No se pudo acceder al spreadsheet activo", data: [] };
    }

    const sheetName = CONFIG.NOMBRE_TAB_VENTAS || "Ventas";
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      console.log("Hojas disponibles: " + ss.getSheets().map(s => s.getName()).join(", "));
      return { status: "error", message: "Hoja 'Ventas' no encontrada", data: [] };
    }

    const data = sheet.getDataRange().getValues();

    // LOGS CRÍTICOS SOLICITADOS
    console.log("Filas totales en hoja: " + data.length);
    console.log("Primera fila (encabezado): " + JSON.stringify(data[0]));
    if (data.length > 1) {
      console.log("Segunda fila (primer dato): " + JSON.stringify(data[1]));
    }

    if (data.length <= 1) {
      return { status: "empty", message: "No hay datos en la hoja", data: [] };
    }

    const parseNum = (v) => {
      if (v === null || v === undefined || v === "") return 0;
      if (typeof v === 'number') return v;
      // Limpieza profunda de strings de moneda: quitar $, espacios, comas
      const clean = v.toString().replace(/[$,\s]/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    var ventas = [];
    const queryLower = q.toString().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Ignorar filas sin folio o marcadas como TOTALES
      if (!row[0] || row[1] === "TOTALES" || row[0].toString().toUpperCase() === "TOTALES") continue;

      // Estructura EXACTA (Basada en DriveUtils.gs):
      // 0:FOLIO, 1:CLIENTE, 4:TOTAL, 5:LIMITE, 6:ANTICIPO, 13:SALDO, 15:ESTADO
      var folio = row[0];
      var cliente = row[1];
      var total = row[4];
      var fechaLimite = row[5];
      var anticipo = row[6];
      var saldo = row[13];
      var estado = row[15];

      // CRÍTICO: Parseo de números - manejar formatos de moneda
      var totalNum = parseNum(total);
      var anticipoNum = parseNum(anticipo);
      var saldoNum = parseNum(saldo);

      // Si SALDO es 0 pero TOTAL > 0 y COBRADO es menor, intentar recalcular
      if (saldoNum === 0 && totalNum > 0) {
        var cobradoNum = parseNum(row[12]);
        if (totalNum > cobradoNum) {
          saldoNum = totalNum - cobradoNum;
        }
      }

      // LOG DE DIAGNÓSTICO POR FILA
      console.log("Fila " + i + ": folio=" + folio + ", saldo=" + saldoNum + ", tipoOriginal=" + typeof row[13]);

      if (queryLower && !folio.toString().toLowerCase().includes(queryLower) && !cliente.toString().toLowerCase().includes(queryLower)) {
        continue;
      }

      // Incluir ventas con saldo pendiente
      if (saldoNum > 0) {
        ventas.push({
          folio: String(folio || ""),
          cliente: String(cliente || ""),
          total: totalNum,
          fechaLimite: formatearFecha(fechaLimite),
          anticipo: anticipoNum,
          saldo: saldoNum,
          estado: String(estado || "Pendiente"),
          // Compatibilidad SPA
          "folio/concepto": String(folio || ""),
          hotel: String(row[3] || ""),
          agente: String(row[14] || ""),
          total_cobrado: parseNum(row[12])
        });
      }
    }

    // LOG CRÍTICO SOLICITADO
    console.log("Ventas procesadas: " + ventas.length);

    return {
      status: "success",
      data: ventas,
      totalRegistros: ventas.length,
      message: ventas.length > 0 ? "Datos cargados" : "No se encontraron ventas con saldo pendiente"
    };

  } catch (error) {
    console.error("ERROR Fatal en obtenerVentasConSaldo: " + error.toString());
    return { status: "error", message: "Error en el servidor: " + error.toString(), data: [] };
  }
}

/**
 * Auxiliar para formatear fechas a dd/MM/yyyy
 */
function formatearFecha(fecha) {
  if (fecha instanceof Date) {
    try {
      return Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy");
    } catch(e) {
      return fecha.toLocaleDateString();
    }
  }
  return fecha ? fecha.toString() : "";
}

/**
 * Obtiene ventas disponibles para pago leyendo desde la pestaña 'Pagos'
 * y cruzando con 'Ventas' para obtener el saldo actual.
 */
function buscarVentaPorFolioOCliente(query) {
  return obtenerVentasConSaldo(query);
}

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
