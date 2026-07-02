/**
 * Gestión de Pagos (Abonos).
 */

function registrarPago(datos = {}) {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_VENTAS);
  const data = sheet.getDataRange().getValues();

  const folio = datos.folio;
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == folio) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) throw new Error("Venta no encontrada con folio: " + folio);

  const row = data[rowIndex - 1];
  const totalVenta = parseFloat(row[4]); // Cambio de índice por Col C: CORREO
  const montoPago = parseFloat(datos.monto);
  const fechaPago = datos.fecha || new Date();

  let colMonto, colFecha;

  if (datos.tipo === "Anticipo") {
    colMonto = 7; // Col G
    colFecha = 8; // Col H
  } else if (!row[8]) { // Si Abono 1 está vacío
    colMonto = 9; // Col I
    colFecha = 10; // Col J
  } else if (!row[10]) { // Si Abono 2 está vacío
    colMonto = 11; // Col K
    colFecha = 12; // Col L
  } else {
    throw new Error("Límite de abonos alcanzado para esta venta (Máximo 2 abonos después del anticipo).");
  }

  sheet.getRange(rowIndex, colMonto).setValue(montoPago);
  sheet.getRange(rowIndex, colFecha).setValue(fechaPago);

  // Recalcular Totales
  const actualizadoRow = sheet.getRange(rowIndex, 1, 1, 16).getValues()[0];
  const nuevoTotalCobrado = (parseFloat(actualizadoRow[6]) || 0) +
                            (parseFloat(actualizadoRow[8]) || 0) +
                            (parseFloat(actualizadoRow[10]) || 0);
  const nuevoSaldo = totalVenta - nuevoTotalCobrado;

  sheet.getRange(rowIndex, 13).setValue(nuevoTotalCobrado); // Col M
  sheet.getRange(rowIndex, 14).setValue(nuevoSaldo);        // Col N

  // Cambiar estado si ya está pagado
  const nuevoEstado = nuevoSaldo <= 0 ? "Pagado" : "Pendiente";
  if (nuevoSaldo <= 0) {
    sheet.getRange(rowIndex, 16).setValue(nuevoEstado);
  }

  // Registrar en hoja Pagos
  try {
    const pagosSheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
    pagosSheet.appendRow([Utilities.getUuid(), folio, fechaPago, montoPago, datos.tipo, nuevoEstado]);
  } catch(e) { console.error("Error al registrar en Pagos", e); }

  // Sincronizar con Reportes
  try {
    const reportSheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_REPORTES);
    const reportData = reportSheet.getDataRange().getValues();
    for (let i = 1; i < reportData.length; i++) {
      if (reportData[i][0] == folio) {
        reportSheet.getRange(i + 1, 6).setValue(nuevoTotalCobrado); // COBRADO
        reportSheet.getRange(i + 1, 7).setValue(nuevoSaldo);        // SALDO
        reportSheet.getRange(i + 1, 9).setValue(nuevoEstado);       // ESTADO
        break;
      }
    }
  } catch(e) { console.error("Error al sincronizar Reportes", e); }

  // Generar PDF
  const urlPdf = Recibos.generarRecibo(folio, {
    tipo: datos.tipo,
    monto: montoPago,
    fecha: fechaPago,
    cliente: actualizadoRow[1],
    hotel: actualizadoRow[2],
    totalVenta: totalVenta,
    saldo: nuevoSaldo,
    fechaLimite: actualizadoRow[4]
  });

  return { success: true, pdfUrl: urlPdf, data: { folio: folio, cliente: actualizadoRow[1], monto: montoPago, tipo: datos.tipo, saldo: nuevoSaldo, total: totalVenta, fecha: fechaPago } };
}

/**
 * Obtiene el historial de pagos de un folio.
 */
function obtenerHistorialPagos(folio) {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.filter(row => row[1] == folio).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h.replace(/\s+/g, '_').toLowerCase()] = row[i]);
    return obj;
  });
}
