/**
 * Gestión de Ventas (CRUD).
 */

function registrarVenta(datos) {
  if (!datos) throw new Error("No se recibieron datos para registrar la venta.");

  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_HOJA_VENTAS);

  const total = parseFloat(datos.total) || 0;
  const anticipo = parseFloat(datos.anticipo) || 0;
  const totalCobrado = anticipo;
  const saldo = total - totalCobrado;

  // Generar Folio si no viene
  const folio = datos.folio || "F-" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd-HHmmss");

  const rowData = [
    folio,                  // A: FOLIO/CONCEPTO
    datos.cliente,          // B: CLIENTE
    datos.hotel,            // C: HOTEL
    total,                  // D: TOTAL
    datos.fechaLimite,      // E: FECHA LIMITE DE PAGO
    anticipo,               // F: ANTICIPO
    datos.fechaAnticipo || (anticipo > 0 ? new Date() : ""), // G: FECHA (anticipo)
    "",                     // H: ABONO 1
    "",                     // I: FECHA 1
    "",                     // J: ABONO 2
    "",                     // K: FECHA 2
    totalCobrado,           // L: TOTAL COBRADO
    saldo,                  // M: SALDO
    datos.agente,           // N: AGENTE
    datos.estado || "Pendiente" // O: ESTADO
  ];

  sheet.appendRow(rowData);
  return { success: true, folio: folio };
}

function obtenerVentas() {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_HOJA_VENTAS);
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
  return ventas.filter(v =>
    (v['folio/concepto'] && v['folio/concepto'].toString().toLowerCase().includes(query)) ||
    (v.cliente && v.cliente.toLowerCase().includes(query))
  );
}
