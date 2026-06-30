/**
 * Gestión de Pagos (Abonos).
 */

function registrarPago(datos = {}) {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_HOJA_VENTAS);
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
  const totalVenta = parseFloat(row[3]);
  const montoPago = parseFloat(datos.monto);
  const fechaPago = datos.fecha || new Date();

  let colMonto, colFecha;

  if (datos.tipo === "Anticipo") {
    colMonto = 6; // Col F
    colFecha = 7; // Col G
  } else if (!row[7]) { // Si Abono 1 está vacío
    colMonto = 8; // Col H
    colFecha = 9; // Col I
  } else if (!row[9]) { // Si Abono 2 está vacío
    colMonto = 10; // Col J
    colFecha = 11; // Col K
  } else {
    throw new Error("Límite de abonos alcanzado para esta venta (Máximo 2 abonos después del anticipo).");
  }

  sheet.getRange(rowIndex, colMonto).setValue(montoPago);
  sheet.getRange(rowIndex, colFecha).setValue(fechaPago);

  // Recalcular Totales
  const actualizadoRow = sheet.getRange(rowIndex, 1, 1, 15).getValues()[0];
  const nuevoTotalCobrado = (parseFloat(actualizadoRow[5]) || 0) +
                            (parseFloat(actualizadoRow[7]) || 0) +
                            (parseFloat(actualizadoRow[9]) || 0);
  const nuevoSaldo = totalVenta - nuevoTotalCobrado;

  sheet.getRange(rowIndex, 12).setValue(nuevoTotalCobrado); // Col L
  sheet.getRange(rowIndex, 13).setValue(nuevoSaldo);        // Col M

  // Cambiar estado si ya está pagado
  if (nuevoSaldo <= 0) {
    sheet.getRange(rowIndex, 15).setValue("Pagado");
  }

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

  return { success: true, pdfUrl: urlPdf };
}
