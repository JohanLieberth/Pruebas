/**
 * Utilidades para manejo de Google Drive y Sheets.
 */
const DriveUtils = {

  /**
   * Obtiene el Spreadsheet por nombre o lo crea con la estructura inicial.
   */
  obtenerOCrearSpreadsheet: function(nombre) {
    const files = DriveApp.getFilesByName(nombre);
    while (files.hasNext()) {
      let file = files.next();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return SpreadsheetApp.open(file);
      }
    }

    {
      const ss = SpreadsheetApp.create(nombre);
      const sheet = ss.getSheets()[0];
      sheet.setName(nombre);

      // Estructura de columnas: A-M (13 columnas) + N (Agente)
      const headers = [
        "FOLIO/CONCEPTO", "CLIENTE", "HOTEL", "TOTAL", "FECHA LIMITE DE PAGO",
        "ANTICIPO", "FECHA", "ABONO 1", "FECHA 1", "ABONO 2", "FECHA 2",
        "TOTAL COBRADO", "SALDO", "AGENTE", "ESTADO"
      ];

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);

      // Dar formato a los encabezados
      sheet.getRange(1, 1, 1, headers.length)
           .setBackground("#1a3a5c")
           .setFontColor("#ffffff")
           .setFontWeight("bold");

      return ss;
    }
  },

  /**
   * Inicializa las hojas necesarias con sus encabezados.
   */
  inicializarHojas: function(ss) {
    const estructura = {
      "Ventas": ["FOLIO/CONCEPTO", "CLIENTE", "HOTEL", "TOTAL", "FECHA LIMITE DE PAGO", "ANTICIPO", "FECHA", "ABONO 1", "FECHA 1", "ABONO 2", "FECHA 2", "TOTAL COBRADO", "SALDO", "AGENTE", "ESTADO"],
      "Pagos": ["ID", "FOLIO/CONCEPTO", "FECHA", "MONTO", "METODO", "REFERENCIA", "ESTADO"],
      "Reportes": ["FECHA_REPORTE", "TIPO", "AGENTE", "TOTAL_VENTAS", "TOTAL_COBRADO", "PENDIENTE"],
      "Configuracion": ["PARAMETRO", "VALOR", "DESCRIPCION"],
      "Dashboard": ["KPI", "VALOR", "ULTIMA_ACTUALIZACION"]
    };

    for (let nombreHoja in estructura) {
      let sheet = ss.getSheetByName(nombreHoja);
      if (!sheet) {
        sheet = ss.insertSheet(nombreHoja);
      }

      const headers = estructura[nombreHoja];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);

      // Formato a encabezados
      sheet.getRange(1, 1, 1, headers.length)
           .setBackground("#1a3a5c")
           .setFontColor("#ffffff")
           .setFontWeight("bold");

      // Autoajustar columnas
      if (headers.length > 0) {
        sheet.autoResizeColumns(1, headers.length);
      }
    }

    // Borrar la Hoja1 por defecto si está vacía
    const defaultSheet = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
    if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
    }
  },

  /**
   * Crea una estructura de carpetas anidadas si no existen.
   */
  obtenerOCrearCarpeta: function(ruta) {
    const partes = ruta.split('/');
    let actual = DriveApp.getRootFolder();

    for (let i = 0; i < partes.length; i++) {
      const nombre = partes[i];
      const folders = actual.getFoldersByName(nombre);
      if (folders.hasNext()) {
        actual = folders.next();
      } else {
        actual = actual.createFolder(nombre);
      }
    }
    return actual;
  }
};
