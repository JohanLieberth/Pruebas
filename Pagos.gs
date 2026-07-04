/**
 * Gestión de Pagos (Abonos).
 */

function registrarPago(datos = {}) {
  try {
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

    if (rowIndex === -1) {
      return { status: "not_found", message: "Venta no encontrada con folio: " + folio };
    }

    const row = data[rowIndex - 1];
    const cliente = row[1];
    const correoCliente = row[2];
    const totalVenta = parseFloat(row[4]);
    const montoPago = parseFloat(datos.monto);
    const fechaPago = datos.fecha ? new Date(datos.fecha) : new Date();

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
      return { status: "error", message: "Límite de abonos alcanzado para esta venta (Máximo 2 abonos después del anticipo)." };
    }

    const saldoAnterior = parseFloat(row[13]) || 0;

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
    const nuevoEstado = nuevoSaldo <= 0 ? "Pagado" : (nuevoTotalCobrado > 0 ? "Parcial" : "Pendiente");
    sheet.getRange(rowIndex, 16).setValue(nuevoEstado);

    // Registrar en hoja Pagos con el nuevo formato solicitado
    const numRecibo = "REC-" + Utilities.formatDate(new Date(), "GMT-6", "HHmmss");
    try {
      const pagosSheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
      // ["FECHA", "FOLIO VENTA", "CLIENTE", "MONTO PAGADO", "METODO", "SALDO ANTERIOR", "NUEVO SALDO", "NUMERO RECIBO"]
      pagosSheet.appendRow([fechaPago, folio, cliente, montoPago, datos.tipo, saldoAnterior, nuevoSaldo, numRecibo]);
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

    // Enviar Correo de Confirmación
    if (correoCliente) {
      try {
        enviarCorreoConfirmacionPago({
          cliente: cliente,
          correo: correoCliente,
          folio: folio,
          monto: montoPago,
          fecha: fechaPago,
          saldoAnterior: saldoAnterior,
          nuevoSaldo: nuevoSaldo,
          metodo: datos.tipo
        });
      } catch(e) { console.error("Error al enviar correo de pago", e); }
    }

    // Generar PDF
    const urlPdf = Recibos.generarRecibo(folio, {
      tipo: datos.tipo,
      monto: montoPago,
      fecha: fechaPago,
      cliente: actualizadoRow[1],
      hotel: actualizadoRow[3], // Col D: HOTEL tras Col C: CORREO
      totalVenta: totalVenta,
      saldo: nuevoSaldo,
      fechaLimite: actualizadoRow[5] // Col F: FECHA LIMITE
    });

    return {
      status: "success",
      success: true,
      pdfUrl: urlPdf,
      message: "Pago registrado correctamente. Nuevo saldo: $" + nuevoSaldo.toLocaleString(),
      data: {
        folio: folio,
        cliente: cliente,
        correo: correoCliente,
        monto: montoPago,
        tipo: datos.tipo,
        saldo: nuevoSaldo,
        total: totalVenta,
        fecha: fechaPago.toISOString(),
        numRecibo: numRecibo
      }
    };
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}

/**
 * Envía correo de confirmación de pago.
 */
function enviarCorreoConfirmacionPago(d) {
  const subject = "Confirmación de Pago Recibido - " + d.folio;
  const body = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #1a3a5c;">FriendTravel - Confirmación de Pago</h2>
      <p>Estimado/a <strong>${d.cliente}</strong>,</p>
      <p>Hemos registrado correctamente tu pago.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 5px;"><strong>Folio Venta:</strong></td><td>${d.folio}</td></tr>
        <tr><td style="padding: 5px;"><strong>Monto Pagado:</strong></td><td>$${d.monto.toLocaleString()}</td></tr>
        <tr><td style="padding: 5px;"><strong>Fecha:</strong></td><td>${d.fecha.toLocaleDateString()}</td></tr>
        <tr><td style="padding: 5px;"><strong>Método/Tipo:</strong></td><td>${d.metodo}</td></tr>
        <tr><td style="padding: 5px;"><strong>Saldo Anterior:</strong></td><td>$${d.saldoAnterior.toLocaleString()}</td></tr>
        <tr><td style="padding: 5px; color: #d9534f;"><strong>Nuevo Saldo:</strong></td><td style="color: #d9534f; font-weight: bold;">$${d.nuevoSaldo.toLocaleString()}</td></tr>
      </table>
      <p style="margin-top: 20px;">¡Gracias por tu preferencia!</p>
      <p>Atentamente,<br>El equipo de FriendTravel</p>
    </div>
  `;

  GmailApp.sendEmail(d.correo, subject, "", { htmlBody: body });
}

/**
 * Obtiene el historial de pagos de un folio.
 */
function obtenerHistorialPagos(folio) {
  try {
    const ssId = getSpreadsheetId();
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_PAGOS);
    if (!sheet) return { status: "error", message: "No se encontró la pestaña de pagos", data: [] };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: "success", data: [] };
    const headers = data.shift();

    const historial = data.filter(row => row[1] == folio).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h.replace(/\s+/g, '_').toLowerCase()] = row[i]);
      return obj;
    });

    return { status: "success", data: historial };
  } catch (error) {
    return { status: "error", message: error.toString(), data: [] };
  }
}
