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
    { name: 'Ventas', headers: ['FOLIO/CONCEPTO', 'CLIENTE', 'CORREO', 'HOTEL', 'VENDEDOR', 'TOTAL', 'FECHA LIMITE', 'ANTICIPO', 'FECHA ANTICIPO', 'ABONO 1', 'FECHA ABONO 1', 'ABONO 2', 'FECHA ABONO 2', 'ABONO 3', 'FECHA ABONO 3', 'TOTAL COBRADO', 'SALDO', 'ESTATUS'] },
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
    logoSheet.getRange('D1').setValue('URL DEL LOGO');
    logoSheet.getRange('B2').setValue(400); // Ancho default
    logoSheet.getRange('C2').setValue(400); // Alto default
    logoSheet.getRange('A3').setValue('INSTRUCCIONES: Pega el link directo del logo en la celda D2. El sistema lo mostrará a 400x400 por defecto.');
  }
}

/**
 * Obtiene la configuración del logo
 */
function getLogoConfig() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Logo');
    if (!sheet) return { url: '', width: 400, height: 400, alt: 'Friend Travel' };

    var width = sheet.getRange('B2').getValue() || 400;
    var height = sheet.getRange('C2').getValue() || 400;
    var url = sheet.getRange('D2').getValue();

    if (url && url.toString().indexOf('http') === 0) {
      return { url: url, width: width, height: height, alt: 'Friend Travel' };
    }
    return { url: '', width: width, height: height, alt: 'Friend Travel' };
  } catch(e) {
    return { url: '', width: 400, height: 400, alt: 'Friend Travel' };
  }
}

/**
 * Obtiene los vendedores
 */
function getVendedores() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Vendedores');
    if (!sheet) return ['Arlette', 'Ámerica', 'Enrique', 'Eduardo'];

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return ['Arlette', 'Ámerica', 'Enrique', 'Eduardo'];

    data.shift(); // Quitar cabecera
    return data
      .map(function(r) { return r[0]; })
      .filter(function(name) { return name && name.toString().trim() !== ""; });
  } catch(e) {
    console.error('Error al obtener vendedores:', e.message);
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
    datos.correo,
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
 * Función para enviar recordatorios de pago un día antes del vencimiento
 * Se debe configurar como activador (trigger) diario
 */
function enviarRecordatoriosPago() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ventas');
  var data = sheet.getDataRange().getValues();
  data.shift(); // Cabecera

  var mañana = new Date();
  mañana.setDate(mañana.getDate() + 1);
  mañana.setHours(0,0,0,0);

  var recordatoriosEnviados = 0;

  data.forEach(function(r) {
    var vCorreo = r[2];
    var vFechaLimite = r[6] instanceof Date ? r[6] : new Date(r[6]);
    vFechaLimite.setHours(0,0,0,0);
    var vSaldo = parseFloat(r[16]) || 0;
    var vCliente = r[1];
    var vFolio = r[0];

    if (vSaldo > 0 && vFechaLimite.getTime() === mañana.getTime() && vCorreo) {
      var asunto = 'Recordatorio de Pago - Friend Travel';
      var mensaje = 'Hola ' + vCliente + ',\n\n' +
                    'Te recordamos que tu fecha límite de pago para el concepto "' + vFolio + '" es el día de mañana.\n' +
                    'Tu saldo pendiente es de $' + vSaldo.toFixed(2) + ' MXN.\n\n' +
                    'Por favor, realiza tu pago a la brevedad para evitar inconvenientes.\n\n' +
                    'Atentamente,\n' +
                    'Equipo Friend Travel';

      MailApp.sendEmail(vCorreo, asunto, mensaje);
      recordatoriosEnviados++;
    }
  });

  return recordatoriosEnviados;
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
    var vTotal = parseFloat(r[5]) || 0;
    var vCobrado = parseFloat(r[15]) || 0;
    var vSaldo = parseFloat(r[16]) || 0;
    var vFechaLimite = r[6] instanceof Date ? r[6] : new Date(r[6]);
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
      correo: r[2],
      hotel: r[3],
      vendedor: r[4],
      total: vTotal,
      fechaLimite: vFechaLimite.toLocaleDateString(),
      anticipo: parseFloat(r[7]) || 0,
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
      var total = parseFloat(data[i][5]);
      var abono = parseFloat(datos.monto);
      var saldoActual = parseFloat(data[i][16]);

      if (abono > saldoActual) return { success: false, message: 'El abono no puede ser mayor al saldo pendiente ($' + saldoActual + ')' };

      // Buscar el siguiente campo de abono disponible (Abono 1, 2, o 3)
      // Columnas (ajustadas por nueva columna CORREO):
      // Abono 1: J(9), Abono 2: L(11), Abono 3: N(13)
      var colIdx = -1;
      if (!data[i][9]) colIdx = 10;
      else if (!data[i][11]) colIdx = 12;
      else if (!data[i][13]) colIdx = 14;

      if (colIdx != -1) {
        sheet.getRange(rowIdx, colIdx).setValue(abono);
        sheet.getRange(rowIdx, colIdx + 1).setValue(datos.fecha);

        var nuevoCobrado = (parseFloat(data[i][15]) || 0) + abono;
        var nuevoSaldo = total - nuevoCobrado;
        var nuevoEstatus = nuevoSaldo <= 0 ? 'Pagada' : 'Parcialmente Pagada';

        sheet.getRange(rowIdx, 16).setValue(nuevoCobrado); // Col P
        sheet.getRange(rowIdx, 17).setValue(nuevoSaldo);   // Col Q
        sheet.getRange(rowIdx, 18).setValue(nuevoEstatus); // Col R

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
    var vFecha = r[6] instanceof Date ? r[6] : new Date(r[6]);
    var vVendedor = r[4];

    // Aplicar filtros
    if (filtroVendedor && filtroVendedor !== 'Todos' && vVendedor !== filtroVendedor) return;
    if (filtroMes && filtroMes !== 'Todos') {
       if (vFecha.getMonth() + 1 != filtroMes) return;
    }

    var vTotal = parseFloat(r[5]) || 0;
    var vCobrado = parseFloat(r[15]) || 0;
    var vSaldo = parseFloat(r[16]) || 0;
    var vEstatus = r[17];

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
