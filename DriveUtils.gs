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
  },

  /**
   * Inicializa las hojas necesarias con sus encabezados.
   * Verifica existencia y crea si faltan.
   */
  inicializarHojas: function(ss) {
    if (!ss) return;

    // Estructura requerida por los requerimientos y la lógica existente
    const estructura = {
      "Ventas": ["FOLIO/CONCEPTO", "CLIENTE", "CORREO", "HOTEL", "TOTAL", "FECHA LIMITE DE PAGO", "ANTICIPO", "FECHA", "ABONO 1", "FECHA 1", "ABONO 2", "FECHA 2", "TOTAL COBRADO", "SALDO", "AGENTE", "ESTADO"],
      "Pagos": ["FECHA", "FOLIO VENTA", "CLIENTE", "MONTO PAGADO", "METODO", "SALDO ANTERIOR", "NUEVO SALDO", "NUMERO RECIBO"],
      "Reportes": ["FOLIO/CONCEPTO", "CLIENTE", "CORREO", "HOTEL", "TOTAL", "COBRADO", "SALDO", "AGENTE", "ESTADO"],
      "Configuracion": ["PARAMETRO", "VALOR", "DESCRIPCION"],
      "Dashboard": ["KPI", "VALOR", "ULTIMA_ACTUALIZACION"]
    };

    for (let nombreHoja in estructura) {
      try {
        let sheet = ss.getSheetByName(nombreHoja);
        if (!sheet) {
          sheet = ss.insertSheet(nombreHoja);
        }

        // Solo escribir encabezados si la hoja está vacía o para asegurar estructura en fila 1
        const headers = estructura[nombreHoja];
        const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];

        // Si la fila 1 no coincide con lo esperado, la sobreescribimos (respetando la restricción de creación)
        if (JSON.stringify(currentHeaders) !== JSON.stringify(headers)) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.setFrozenRows(1);

          // Inicializar Logo si es la hoja de configuración
          if (nombreHoja === "Configuracion") {
            const data = sheet.getDataRange().getValues();
            let logoFound = false;
            for (let i = 1; i < data.length; i++) {
              if (data[i][0] === "LOGO") { logoFound = true; break; }
            }
            if (!logoFound) {
              sheet.appendRow(["LOGO", "https://via.placeholder.com/150", "URL del logo de la empresa"]);
            }
          }

          // Formato a encabezados
          sheet.getRange(1, 1, 1, headers.length)
               .setBackground("#1a3a5c")
               .setFontColor("#ffffff")
               .setFontWeight("bold")
               .setHorizontalAlignment("center");

          // Autoajustar columnas
          if (headers.length > 0) {
            sheet.autoResizeColumns(1, headers.length);
          }
        }
      } catch (e) {
        console.error("Error inicializando hoja " + nombreHoja + ": " + e.message);
      }
    }

    // Borrar hojas por defecto vacías si hay más de una hoja
    const defaultSheets = ["Hoja 1", "Sheet1", "Hoja1"];
    defaultSheets.forEach(name => {
      let ds = ss.getSheetByName(name);
      if (ds && ds.getLastRow() === 0 && ss.getSheets().length > 1) {
        try { ss.deleteSheet(ds); } catch(e) {}
      }
    });
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
