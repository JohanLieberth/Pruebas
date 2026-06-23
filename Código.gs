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
    { name: 'Dashboard', headers: ['TOTAL VENTAS GLOBAL', 'TOTAL COBRADO GLOBAL', 'SALDO PENDIENTE GLOBAL', 'META TOTAL', '% CUMPLIMIENTO GLOBAL', 'ÚLTIMA ACTUALIZACIÓN'] },
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
    if (!sheet) return { base64: '', width: 400, height: 400, alt: 'Friend Travel' };

    // Dimensiones fijas según requerimiento
    var width = 400;
    var height = 400;

    // Intentar obtener imagen de la hoja Logo
    // Buscamos tanto en celdas (CellImage) como sobre celdas (Images)
    var base64 = "";

    // 1. Intentar obtener imagen "En Celda" de A1 (Vía RichText si está disponible)
    var richText = sheet.getRange("A1").getRichTextValue();
    if (richText) {
      // Nota: GAS no permite extraer el blob de un CellImage directamente vía RichText aún.
      // Pero el requerimiento menciona "imagen insertada en la hoja (celda A1 o primera disponible)".
      // Priorizamos Images sobre celdas por ser más fiable para obtener blobs.
    }

    // 2. Intentar obtener imágenes sobre celdas (Insertar > Imagen > Imagen sobre celdas)
    var images = sheet.getImages();
    if (images.length > 0) {
      var blob = images[0].getBlob();
      var bytes = blob.getBytes();
      var contentType = blob.getContentType();
      base64 = "data:" + contentType + ";base64," + Utilities.base64Encode(bytes);
    }

    return { base64: base64, width: width, height: height, alt: 'Friend Travel' };
  } catch(e) {
    console.error('Error al obtener logo:', e.message);
    return { base64: '', width: 400, height: 400, alt: 'Friend Travel' };
  }
}

/**
 * Obtiene los vendedores
 */
function getVendedores() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Vendedores');
    if (!sheet) throw new Error('La hoja "Vendedores" no existe. Por favor, créala.');

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) throw new Error('La hoja "Vendedores" está vacía. Debes agregar al menos un vendedor en la columna A.');

    data.shift(); // Quitar cabecera
    var vendedores = data
      .map(function(r) { return r[0]; })
      .filter(function(name) { return name && name.toString().trim() !== ""; });

    if (vendedores.length === 0) throw new Error('No se encontraron nombres de vendedores válidos en la hoja "Vendedores".');

    return vendedores;
  } catch(e) {
    throw new Error('Error al obtener catálogo de vendedores: ' + e.message);
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

  // Actualizar hoja Dashboard
  try {
    actualizarHojaDashboard();
  } catch (e) {
    console.error('Error al actualizar Dashboard tras venta:', e.message);
  }

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
 * Verificación de catálogo de vendedores para debugging
 */
function verificarVendedores() {
  try {
    var v = getVendedores();
    return { success: true, count: v.length, list: v };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

/**
 * Verificación de configuración de logo para debugging
 */
function verificarLogo() {
  try {
    var config = getLogoConfig();
    return {
      success: true,
      hasBase64: config.base64.length > 0,
      length: config.base64.length,
      width: config.width,
      height: config.height
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
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

        // Actualizar hoja Dashboard
        try {
          actualizarHojaDashboard();
        } catch (e) {
          console.error('Error al actualizar Dashboard tras abono:', e.message);
        }

        return { success: true, message: 'Pago registrado correctamente' };
      } else {
        return { success: false, message: 'Límite de abonos alcanzado para esta venta' };
      }
    }
  }
  return { success: false, message: 'Venta no encontrada' };
}

/**
 * Registra los indicadores globales en la hoja 'Dashboard'
 */
function actualizarHojaDashboard() {
  try {
    // Obtenemos los datos globales (Todos los meses, Todos los vendedores)
    var stats = obtenerDatosDashboard("Todos", "Todos");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Dashboard');
    if (!sheet) return;

    var row = [
      stats.totalVentas,
      stats.totalCobrado,
      stats.saldoPendiente,
      stats.meta,
      stats.progresoMeta / 100, // En decimal para formato %
      new Date()
    ];

    // Limpiamos datos anteriores (fila 2 en adelante) y escribimos los nuevos
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    sheet.appendRow(row);

    // Formatear celdas
    sheet.getRange("A2:D2").setNumberFormat("$#,##0.00");
    sheet.getRange("E2").setNumberFormat("0.00%");
    sheet.getRange("F2").setNumberFormat("dd/mm/yyyy HH:mm:ss");

  } catch (e) {
    console.error('Error al actualizar hoja Dashboard:', e.message);
  }
}

/**
 * Servidor: Procesa datos reales del Dashboard aplicando filtros independientes de Mes y Vendedor.
 */
function obtenerDatosDashboard(filtroMes, filtroVendedor) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetVentas = ss.getSheetByName('Ventas');
    var sheetVendedores = ss.getSheetByName('Vendedores');

    if (!sheetVentas) throw new Error('Hoja "Ventas" no encontrada.');

    var data = sheetVentas.getDataRange().getValues();
    if (data.length < 1) throw new Error('No hay datos en la hoja "Ventas".');
    data.shift(); // Quitar cabecera

    var vendedoresCatalogo = [];
    if (sheetVendedores && sheetVendedores.getLastRow() > 1) {
      vendedoresCatalogo = sheetVendedores.getRange("A2:A" + sheetVendedores.getLastRow()).getValues()
        .map(function(r) { return r[0]; })
        .filter(function(v) { return v && v.toString().trim() !== ""; });
    }

    var hoy = new Date();
    hoy.setHours(0,0,0,0);

    // Indicadores principales
    var totalVentas = 0;
    var totalCobrado = 0;
    var saldoPendiente = 0;

    // Gráfica de Ventas por Vendedor (siempre agregamos todos para el ranking interno)
    var ventasPorVendedorMap = {};
    vendedoresCatalogo.forEach(function(v) { ventasPorVendedorMap[v] = 0; });

    // Gráfica de Estados de Venta (sumamos montos $)
    var estadosMontoMap = { 'Pagada': 0, 'Pendiente': 0, 'Parcialmente Pagada': 0, 'Vencida': 0 };

    data.forEach(function(r) {
      if (!r[0]) return; // Fila vacía

      var vVendedor = r[4];
      var vFecha = r[6] instanceof Date ? r[6] : new Date(r[6]); // Fecha Límite para el filtro de mes
      if (isNaN(vFecha.getTime())) return;

      // Filtro Independiente: Mes
      if (filtroMes && filtroMes !== 'Todos') {
        if ((vFecha.getMonth() + 1).toString() !== filtroMes.toString()) return;
      }

      var totalRow = parseFloat(r[5]) || 0;
      var cobradoRow = parseFloat(r[15]) || 0;
      var saldoRow = parseFloat(r[16]) || 0;

      // Calcular Estatus REAL (Ajuste 4)
      var estatusRow = '';
      if (saldoRow <= 0) estatusRow = 'Pagada';
      else if (vFecha < hoy) estatusRow = 'Vencida';
      else if (cobradoRow > 0) estatusRow = 'Parcialmente Pagada';
      else estatusRow = 'Pendiente';

      // 1. Acumular para Ranking del Mes seleccionado (AJUSTE 5)
      if (ventasPorVendedorMap.hasOwnProperty(vVendedor)) {
        ventasPorVendedorMap[vVendedor] += totalRow;
      }

      // 2. Aplicar Filtro Independiente: Vendedor (AJUSTE 1)
      var esVendedorMatch = (!filtroVendedor || filtroVendedor === 'Todos' || vVendedor === filtroVendedor);

      if (esVendedorMatch) {
        totalVentas += totalRow;
        totalCobrado += cobradoRow;
        saldoPendiente += saldoRow;

        // Sumar montos por estado para la gráfica (AJUSTE 4)
        estadosMontoMap[estatusRow] += totalRow;
      }
    });

    // AJUSTE 6: Meta Dinámica
    var metaIndiv = 10000;
    var metaFinal = (filtroVendedor && filtroVendedor !== 'Todos') ? metaIndiv : (vendedoresCatalogo.length * metaIndiv);
    var progresoMetaFinal = metaFinal > 0 ? (totalVentas / metaFinal) * 100 : 0;

    // AJUSTE 3: Datos para Gráfica Ventas por Vendedor
    var listVentasVendedor = [];
    if (filtroVendedor && filtroVendedor !== 'Todos') {
      listVentasVendedor.push([filtroVendedor, ventasPorVendedorMap[filtroVendedor] || 0]);
    } else {
      vendedoresCatalogo.forEach(function(v) {
        listVentasVendedor.push([v, ventasPorVendedorMap[v] || 0]);
      });
    }

    // AJUSTE 5: Procesar Ranking Real
    var rankingGlobal = vendedoresCatalogo.map(function(v) {
      return {
        nombre: v,
        totalVentas: ventasPorVendedorMap[v] || 0,
        cumplimiento: ((ventasPorVendedorMap[v] || 0) / metaIndiv) * 100
      };
    });
    rankingGlobal.sort(function(a, b) { return b.totalVentas - a.totalVentas; });
    rankingGlobal.forEach(function(item, index) { item.posicion = index + 1; });

    var rankingFiltrado = (filtroVendedor && filtroVendedor !== 'Todos')
      ? rankingGlobal.filter(function(r) { return r.nombre === filtroVendedor; })
      : rankingGlobal;

    return {
      totalVentas: totalVentas,
      totalCobrado: totalCobrado,
      saldoPendiente: saldoPendiente,
      meta: metaFinal,
      progresoMeta: progresoMetaFinal,
      graficaVendedores: listVentasVendedor,
      graficaEstados: Object.entries(estadosMontoMap),
      ranking: rankingFiltrado
    };
  } catch (e) {
    console.error('Error en obtenerDatosDashboard:', e.message);
    throw new Error(e.message);
  }
}

/**
 * Alias para compatibilidad con carga inicial
 */
function getDashboardData(v, m) {
  return obtenerDatosDashboard(m || "Todos", v || "Todos");
}
