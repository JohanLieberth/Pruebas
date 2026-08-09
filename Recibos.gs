/**
 * Generación de Recibos en PDF.
 */
const Recibos = {

  generarRecibo: function(folio, datos) {
    const files = DriveApp.getFilesByName(CONFIG.NOMBRE_HOJA_RECIBO_PLANTILLA);
    if (!files.hasNext()) {
      // Si no existe la plantilla, devolvemos un mensaje de aviso
      // En un entorno real, aquí se crearía una plantilla básica o se lanzaría un error
      return "#";
    }

    const ssPlantilla = SpreadsheetApp.open(files.next());
    const sheetOriginal = ssPlantilla.getSheetByName("Recibo") || ssPlantilla.getSheets()[0];

    // Crear una copia temporal del spreadsheet para llenar datos
    const ssTemp = SpreadsheetApp.create("Recibo_" + folio);
    const sheetCopia = sheetOriginal.copyTo(ssTemp);
    sheetCopia.setName("Recibo");
    ssTemp.deleteSheet(ssTemp.getSheets()[0]);

    // Llenar datos (Asumiendo celdas típicas de una plantilla, esto debe ajustarse a la plantilla real)
    // Ejemplo de mapeo:
    // B5: Cliente, B6: Folio, B7: Fecha, B8: Destino, B9: Total...

    // Nota: Dado que no tengo la posición exacta de las celdas en la plantilla del usuario,
    // uso marcadores de posición o lógica genérica.

    const placeholders = {
      "{{CLIENTE}}": datos.cliente,
      "{{FOLIO}}": folio,
      "{{FECHA}}": Utilities.formatDate(new Date(datos.fecha), "GMT-6", "dd/MM/yyyy"),
      "{{DESTINO}}": datos.hotel,
      "{{TOTAL}}": datos.totalVenta,
      "{{PAGO}}": datos.monto,
      "{{SALDO}}": datos.saldo,
      "{{FECHA_LIMITE}}": datos.fechaLimite
    };

    const range = sheetCopia.getDataRange();
    const values = range.getValues();

    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        let val = values[r][c];
        if (typeof val === 'string') {
          for (let key in placeholders) {
            if (val.includes(key)) {
              val = val.replace(key, placeholders[key]);
            }
          }
          sheetCopia.getRange(r + 1, c + 1).setValue(val);
        }
      }
    }

    // Exportar a PDF
    SpreadsheetApp.flush();
    const blob = ssTemp.getAs('application/pdf').setName("Recibo_" + folio + ".pdf");

    // Guardar en la carpeta de recibos
    let folderId = PropertiesService.getScriptProperties().getProperty('ID_CARPETA_RECIBOS');
    if (!folderId) {
      folderId = DriveUtils.obtenerOCrearCarpeta(CONFIG.NOMBRE_CARPETA_RECIBOS).getId();
    }
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);

    // Borrar temporal
    DriveApp.getFileById(ssTemp.getId()).setTrashed(true);

    return file.getUrl();
  }
};
