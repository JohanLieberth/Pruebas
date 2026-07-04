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
 * Busca ventas con saldo pendiente. Refactorizado para máxima robustez siguiendo instrucciones del usuario.
 * Implementa LOGS críticos y retornos garantizados en todos los caminos.
 */
function obtenerVentasConSaldo(query) {
  // Asegurar que query sea string
  const q = query || "";
  console.log("Servidor: [INICIO] obtenerVentasConSaldo - Query recibida: '" + q + "'");

  try {
    // 1. Obtener spreadsheet y validar
    const ssId = getSpreadsheetId();
    console.log("Servidor: [LOG] Usando SS ID: " + ssId);

    const ss = SpreadsheetApp.openById(ssId);
    if (!ss) {
      console.error("Servidor: [ERROR] No se pudo acceder al Spreadsheet.");
      return { status: "error", message: "No se pudo acceder a la base de datos.", data: [] };
    }

    // 2. Obtener hoja "Ventas" - VERIFICAR NOMBRE EXACTO
    const sheetName = CONFIG.NOMBRE_TAB_VENTAS || "Ventas";
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      const hojasDisponibles = ss.getSheets().map(s => s.getName()).join(", ");
      console.error("Servidor: [ERROR] Hoja '" + sheetName + "' no encontrada. Disponibles: " + hojasDisponibles);
      return { status: "error", message: "Hoja '" + sheetName + "' no encontrada. Verifique el nombre exacto.", data: [] };
    }

    // 3. Obtener datos
    const data = sheet.getDataRange().getValues();
    console.log("Servidor: [LOG] Filas totales leídas: " + data.length);

    if (data.length <= 1) {
      return { status: "success", message: "La hoja 'Ventas' está vacía o solo tiene encabezados.", data: [], totalRegistros: 0 };
    }

    // Función robusta para parsear números
    const parseNum = (v) => {
      if (v === null || v === undefined || v === "") return 0;
      if (typeof v === 'number') return v;
      const clean = v.toString().replace(/[$,]/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    // 4. Procesar datos (Saltando encabezados)
    const ventas = [];
    const queryLower = q.toString().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Ignorar filas sin folio o marcadas como TOTALES
      if (!row[0] || row[0].toString().toUpperCase() === "TOTALES") continue;

      // ESTRUCTURA DE COLUMNAS (Basada en DriveUtils.gs):
      // 0:FOLIO, 1:CLIENTE, 2:CORREO, 3:HOTEL, 4:TOTAL, 5:FECHA LIMITE, 6:ANTICIPO, ..., 12:COBRADO, 13:SALDO, 14:AGENTE, 15:ESTADO
      const folio = (row[0] || "").toString();
      const cliente = (row[1] || "").toString();
      const saldo = parseNum(row[13]);

      // Filtro de búsqueda
      if (queryLower && !folio.toLowerCase().includes(queryLower) && !cliente.toLowerCase().includes(queryLower)) {
        continue;
      }

      // Solo incluir si tiene saldo pendiente
      if (saldo > 0) {
        // Stringificar fechas para evitar problemas de serialización en el transporte
        let fechaStr = "-";
        if (row[5]) {
          if (row[5] instanceof Date) {
            fechaStr = Utilities.formatDate(row[5], Session.getScriptTimeZone(), "dd/MM/yyyy");
          } else {
            fechaStr = row[5].toString();
          }
        }

        ventas.push({
          folio: folio,
          cliente: cliente,
          total: parseNum(row[4]),
          fechaLimite: fechaStr,
          anticipo: parseNum(row[6]),
          cobrado: parseNum(row[12]),
          saldo: saldo,
          estado: (row[15] || "Pendiente").toString(),
          agente: (row[14] || "").toString(),
          hotel: (row[3] || "").toString(),
          correo: (row[2] || "").toString(),
          // Compatibilidad adicional
          "folio/concepto": folio,
          fecha_limite: fechaStr,
          total_cobrado: parseNum(row[12])
        });
      }
    }

    console.log("Servidor: [EXITO] Retornando " + ventas.length + " ventas con saldo.");

    // 5. RETORNO OBLIGATORIO Y EXPLÍCITO
    const respuesta = {
      status: "success",
      data: ventas,
      totalRegistros: ventas.length,
      message: ventas.length > 0 ? "Ventas cargadas correctamente" : "No hay ventas con saldo pendiente"
    };
    return respuesta;

  } catch (error) {
    // 6. CAPTURA DE ERRORES - SIEMPRE retornar
    console.error("Servidor: [FATAL] Error en obtenerVentasConSaldo: " + error.toString());
    return {
      status: "error",
      message: "Error en el servidor: " + error.toString(),
      data: []
    };
  }
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
