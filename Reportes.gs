/**
 * Procesamiento de datos para Reportes y Dashboard.
 */

function obtenerKPIsGlobales() {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_REPORTES);
  if (!sheet) return { totalVendido: 0, totalCobrado: 0, saldoPendiente: 0, numVentas: 0 };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { totalVendido: 0, totalCobrado: 0, saldoPendiente: 0, numVentas: 0 };

  data.shift(); // Encabezados

  let totalVendido = 0;
  let totalCobrado = 0;
  let saldoPendiente = 0;
  let numVentas = data.length;

  data.forEach(v => {
    totalVendido += parseFloat(v[4]) || 0; // Col E: TOTAL
    totalCobrado += parseFloat(v[5]) || 0; // Col F: COBRADO
    saldoPendiente += parseFloat(v[6]) || 0; // Col G: SALDO
  });

  return {
    totalVendido: totalVendido,
    totalCobrado: totalCobrado,
    saldoPendiente: saldoPendiente,
    numVentas: numVentas
  };
}

function obtenerDatosGraficaAgentes() {
  const ventas = obtenerVentas();
  const agentes = CONFIG.AGENTES_PERMITIDOS;

  let resultados = agentes.map(agente => {
    const ventasAgente = ventas.filter(v => v.agente === agente);
    const total = ventasAgente.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    return {
      agente: agente,
      total: total,
      meta: CONFIG.META_MENSUAL_AGENTE,
      cumplido: total >= CONFIG.META_MENSUAL_AGENTE,
      porcentaje: (total / CONFIG.META_MENSUAL_AGENTE) * 100
    };
  });

  return resultados;
}

function obtenerReportePorAgente(agente = "") {
  const ssId = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(CONFIG.NOMBRE_TAB_REPORTES);
  if (!sheet) return { stats: { totalVendido: 0, totalCobrado: 0, saldoPendiente: 0, numVentas: 0, meta: CONFIG.META_MENSUAL_AGENTE, porcentaje: 0, metaAlcanzada: false }, ventas: [] };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { stats: { totalVendido: 0, totalCobrado: 0, saldoPendiente: 0, numVentas: 0, meta: CONFIG.META_MENSUAL_AGENTE, porcentaje: 0, metaAlcanzada: false }, ventas: [] };

  const headers = data.shift();

  const filtradas = data.filter(v => !agente || agente === "Global" || v[7] === agente).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h.replace(/\s+/g, '_').toLowerCase()] = row[i]);
    return obj;
  });

  let stats = {
    totalVendido: filtradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0),
    totalCobrado: filtradas.reduce((acc, v) => acc + (parseFloat(v.cobrado) || 0), 0),
    saldoPendiente: filtradas.reduce((acc, v) => acc + (parseFloat(v.saldo) || 0), 0),
    numVentas: filtradas.length,
    meta: CONFIG.META_MENSUAL_AGENTE
  };

  stats.porcentaje = (stats.totalVendido / stats.meta) * 100;
  stats.metaAlcanzada = stats.totalVendido >= stats.meta;

  return {
    stats: stats,
    ventas: filtradas
  };
}
