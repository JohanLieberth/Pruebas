/**
 * Procesamiento de datos para Reportes y Dashboard.
 */

function obtenerKPIsGlobales() {
  const ventas = obtenerVentas();

  let totalVendido = 0;
  let totalCobrado = 0;
  let saldoPendiente = 0;
  let numVentas = ventas.length;

  ventas.forEach(v => {
    totalVendido += parseFloat(v.total) || 0;
    totalCobrado += parseFloat(v.total_cobrado) || 0;
    saldoPendiente += parseFloat(v.saldo) || 0;
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

function obtenerReportePorAgente(agente) {
  const ventas = obtenerVentas();
  const filtradas = ventas.filter(v => v.agente === agente);

  let stats = {
    totalVendido: filtradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0),
    totalCobrado: filtradas.reduce((acc, v) => acc + (parseFloat(v.total_cobrado) || 0), 0),
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
