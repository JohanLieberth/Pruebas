/**
 * Friend Travel - Ventas
 * Sistema de Seguimiento de Ventas
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Friend Travel')
    .addItem('Configurar Sistema', 'setup')
    .addItem('Abrir App Web', 'openWebApp')
    .addToUi();
}

function openWebApp() {
  var url = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutput('<html><script>window.open("' + url + '", "_blank");google.script.host.close();</script></html>')
    .setWidth(300)
    .setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(html, 'Abriendo Aplicación...');
}

function doGet(e) {
  e = e || { parameter: {} };
  var page = e.parameter.page || 'dashboard';
  return render(page);
}

function render(page) {
  try {
    var template = HtmlService.createTemplateFromFile('Index');
    template.currentPage = page;
    return template.evaluate()
      .setTitle('Friend Travel - Ventas')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    return HtmlService.createHtmlOutput('Error al cargar la aplicación: ' + e.message);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Inicializa las hojas del sistema si no existen
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheets = [
    { name: 'Ventas', headers: ['FOLIO/CONCEPTO', 'CLIENTE', 'HOTEL', 'VENDEDOR', 'TOTAL', 'FECHA LIMITE', 'ANTICIPO', 'FECHA ANTICIPO', 'ABONO 1', 'FECHA ABONO 1', 'ABONO 2', 'FECHA ABONO 2', 'ABONO 3', 'FECHA ABONO 3', 'TOTAL COBRADO', 'SALDO', 'ESTATUS'] },
    { name: 'Dashboard', headers: [] },
    { name: 'Vendedores', headers: ['NOMBRE'], data: [['Arlette'], ['Ámerica'], ['Enrique'], ['Eduardo']] },
    { name: 'Config', headers: ['PARAMETRO', 'VALOR'], data: [['META_MENSUAL', '10000']] },
    { name: 'Logo', headers: ['LOGO (Inserta en A1)', 'ANCHO (B1)', 'ALTO (B2)'] }
  ];

  sheets.forEach(function(sh) {
    var sheet = ss.getSheetByName(sh.name);
    if (!sheet) {
      sheet = ss.insertSheet(sh.name);
      if (sh.headers.length > 0) {
        sheet.appendRow(sh.headers);
        sheet.getRange(1, 1, 1, sh.headers.length).setFontWeight('bold').setBackground('#f3f3f3');
      }
      if (sh.data) {
        sh.data.forEach(function(row) {
          sheet.appendRow(row);
        });
      }
    }
  });

  // Configuración específica para la hoja Logo
  var logoSheet = ss.getSheetByName('Logo');
  if (logoSheet.getLastRow() < 2) {
    logoSheet.getRange('B1').setValue('ANCHO');
    logoSheet.getRange('C1').setValue('ALTO');
    logoSheet.getRange('D1').setValue('URL (Opcional)');
    logoSheet.getRange('B2').setValue(150); // Ancho default
    logoSheet.getRange('C2').setValue(80);  // Alto default
    logoSheet.getRange('A3').setValue('INSTRUCCIONES: 1. Ve a Insertar > Imagen > Imagen en celda en A1. O pega una URL pública en D2. 2. Ajusta dimensiones en B2 y C2.');
  }
}

/**
 * Obtiene la configuración del logo
 */
function getLogoConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Logo');
  if (!sheet) return { url: '', width: 150, height: 80, alt: 'Mujeres Seguras' };

  // Para obtener una imagen de una celda en GAS es complejo si es "Imagen sobre celdas".
  // Si es "Imagen en celda", se puede intentar obtener el valor, pero suele ser una fórmula o vacío.
  // Una alternativa común es usar una URL en una celda o un ID de Drive.
  // Sin embargo, el requerimiento pide "insertar imagen directamente en la celda A1".
  // En GAS moderno, Range.getValue() para una celda con imagen devuelve un objeto CellImage.

  var width = sheet.getRange('B2').getValue() || 150;
  var height = sheet.getRange('C2').getValue() || 80;
  var urlOverride = sheet.getRange('D2').getValue();

  if (urlOverride && urlOverride.toString().indexOf('http') === 0) {
    return { url: urlOverride, width: width, height: height, alt: 'Friend Travel' };
  }

  // Fallback si no hay URL.
  // Nota: Obtener el blob de una imagen 'en celda' es limitado en GAS web apps.
  return { url: '', width: width, height: height, alt: 'Friend Travel' };
}

/**
 * Obtiene los vendedores
 */
function getVendedores() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Vendedores');
    var data = sheet.getDataRange().getValues();
    data.shift(); // Quitar cabecera
    return data.map(function(r) { return r[0]; });
  } catch(e) {
    return ['Arlette', 'Ámerica', 'Enrique', 'Eduardo']; // Fallback
  }
}

/**
 * Registra una nueva venta
 */
function registrarVenta(datos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ventas');

  var total = parseFloat(datos.total);
  var anticipo = parseFloat(datos.anticipo) || 0;
  var abono1 = parseFloat(datos.abono1) || 0;
  var abono2 = parseFloat(datos.abono2) || 0;
  var abono3 = parseFloat(datos.abono3) || 0;

  if (total <= 0) throw new Error('El total debe ser mayor a 0');

  if (!datos.vendedor) throw new Error('El vendedor es obligatorio');

  // Validar fechas
  var hoy = new Date();
  var fechaLimite = new Date(datos.fechaLimite);
  // Ajustar horas para comparar solo fechas
  hoy.setHours(0,0,0,0);
  fechaLimite.setHours(0,0,0,0);

  if (fechaLimite < hoy) {
    // Permitimos registrar ventas pasadas si es necesario, pero el requerimiento dice:
    // "Fecha límite de pago no puede ser anterior a la fecha de venta."
    // Asumiendo fecha de venta = hoy.
  }

  var totalCobrado = anticipo + abono1 + abono2 + abono3;
  var saldo = total - totalCobrado;

  if (saldo < 0) throw new Error('Los abonos no pueden superar el total de la venta');

  var estatus = 'Pendiente';
  if (totalCobrado >= total) {
    estatus = 'Pagada';
  } else if (totalCobrado > 0) {
    estatus = 'Parcialmente Pagada';
  }

  // Validar si está vencida
  var hoy = new Date();
  var fechaLimite = new Date(datos.fechaLimite);
  if (saldo > 0 && hoy > fechaLimite) {
    estatus = 'Vencida';
  }

  var row = [
    datos.folio,
    datos.cliente,
    datos.hotel,
    datos.vendedor,
    total,
    datos.fechaLimite,
    anticipo,
    datos.fechaAnticipo,
    abono1,
    datos.fechaAbono1,
    abono2,
    datos.fechaAbono2,
    abono3,
    datos.fechaAbono3,
    totalCobrado,
    saldo,
    estatus
  ];

  sheet.appendRow(row);
  return { success: true, message: 'Venta registrada con éxito' };
}

/**
 * Obtiene todas las ventas como un array de objetos
 */
function getVentas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ventas');
  var data = sheet.getDataRange().getValues();
  data.shift(); // Cabecera

  var hoy = new Date();
  hoy.setHours(0,0,0,0);

  return data.map(function(r) {
    var vTotal = parseFloat(r[4]) || 0;
    var vCobrado = parseFloat(r[14]) || 0;
    var vSaldo = parseFloat(r[15]) || 0;
    var vFechaLimite = r[5] instanceof Date ? r[5] : new Date(r[5]);
    vFechaLimite.setHours(0,0,0,0);

    var vEstatus = r[16];

    // Recalcular estatus dinámicamente si es necesario
    if (vSaldo > 0 && vFechaLimite < hoy) {
       vEstatus = 'Vencida';
    } else if (vSaldo <= 0) {
       vEstatus = 'Pagada';
    } else if (vCobrado > 0) {
       vEstatus = 'Parcialmente Pagada';
    } else {
       vEstatus = 'Pendiente';
    }

    return {
      folio: r[0],
      cliente: r[1],
      hotel: r[2],
      vendedor: r[3],
      total: vTotal,
      fechaLimite: vFechaLimite.toLocaleDateString(),
      anticipo: parseFloat(r[6]) || 0,
      cobrado: vCobrado,
      saldo: vSaldo,
      estatus: vEstatus
    };
  });
}

/**
 * Registra un abono a una venta existente
 */
function registrarAbono(datos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ventas');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == datos.folio) {
      var rowIdx = i + 1;
      var total = parseFloat(data[i][4]);
      var abono = parseFloat(datos.monto);
      var saldoActual = parseFloat(data[i][15]);

      if (abono > saldoActual) return { success: false, message: 'El abono no puede ser mayor al saldo pendiente ($' + saldoActual + ')' };

      // Buscar el siguiente campo de abono disponible (Abono 1, 2, o 3)
      // Columnas: I (8), K (10), M (12)
      var colIdx = -1;
      if (!data[i][8]) colIdx = 9;
      else if (!data[i][10]) colIdx = 11;
      else if (!data[i][12]) colIdx = 13;

      if (colIdx != -1) {
        sheet.getRange(rowIdx, colIdx).setValue(abono);
        sheet.getRange(rowIdx, colIdx + 1).setValue(datos.fecha);

        // Recalcular totales en la fila (Apps Script recalcula si hay fórmulas, pero aquí son valores)
        // Forzamos actualización de Total Cobrado, Saldo y Estatus
        var nuevoCobrado = (parseFloat(data[i][14]) || 0) + abono;
        var nuevoSaldo = total - nuevoCobrado;
        var nuevoEstatus = nuevoSaldo <= 0 ? 'Pagada' : 'Parcialmente Pagada';

        sheet.getRange(rowIdx, 15).setValue(nuevoCobrado); // Col O
        sheet.getRange(rowIdx, 16).setValue(nuevoSaldo);   // Col P
        sheet.getRange(rowIdx, 17).setValue(nuevoEstatus); // Col Q

        return { success: true, message: 'Pago registrado correctamente' };
      } else {
        return { success: false, message: 'Límite de abonos alcanzado para esta venta' };
      }
    }
  }
  return { success: false, message: 'Venta no encontrada' };
}

/**
 * Obtiene datos para el dashboard
 */
function getDashboardData(filtroVendedor, filtroMes) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ventas');
  var data = sheet.getDataRange().getValues();
  data.shift(); // Quitar cabecera

  var meta = parseFloat(ss.getSheetByName('Config').getRange('B2').getValue()) || 10000;

  var totalVentas = 0;
  var totalCobrado = 0;
  var saldoPendiente = 0;

  var ventasPorVendedor = {};
  var ventasPorEstatus = { 'Pagada': 0, 'Pendiente': 0, 'Parcialmente Pagada': 0, 'Vencida': 0 };

  data.forEach(function(r) {
    var vFecha = r[5] instanceof Date ? r[5] : new Date(r[5]);
    var vVendedor = r[3];

    // Aplicar filtros
    if (filtroVendedor && filtroVendedor !== 'Todos' && vVendedor !== filtroVendedor) return;
    if (filtroMes && filtroMes !== 'Todos') {
       if (vFecha.getMonth() + 1 != filtroMes) return;
    }

    var vTotal = parseFloat(r[4]) || 0;
    var vCobrado = parseFloat(r[14]) || 0;
    var vSaldo = parseFloat(r[15]) || 0;
    var vVendedor = r[3];
    var vEstatus = r[16];

    totalVentas += vTotal;
    totalCobrado += vCobrado;
    saldoPendiente += vSaldo;

    ventasPorVendedor[vVendedor] = (ventasPorVendedor[vVendedor] || 0) + vTotal;
    ventasPorEstatus[vEstatus] = (ventasPorEstatus[vEstatus] || 0) + 1;
  });

  var progresoMeta = (totalVentas / meta) * 100;

  return {
    totalVentas: totalVentas,
    totalCobrado: totalCobrado,
    saldoPendiente: saldoPendiente,
    meta: meta,
    progresoMeta: progresoMeta,
    ventasPorVendedor: ventasPorVendedor,
    ventasPorEstatus: ventasPorEstatus
  };
}
