/**
 * Control Machete - Dashboard Metrics and Statistics
 */

function obtenerMetricasDashboard(token, loteID) {
  try {
    var session = requireAuth(token);

    var lotes = getSheetObjects('Lotes');
    var preguntas = getSheetObjects('Preguntas');
    var asignaciones = getSheetObjects('Asignaciones');
    var respuestas = getSheetObjects('Respuestas');
    var subdirecciones = getSheetObjects('Subdirecciones');

    var subMap = {};
    subdirecciones.forEach(function(s) { subMap[s.SubdireccionID] = s.Nombre; });

    // Filter by active lot if selected
    var filteredPreguntas = preguntas.filter(function(p) {
      var isAct = String(p.Activa).toUpperCase() === 'TRUE' || p.Activa === true;
      return isAct && (!loteID || p.LoteID === loteID);
    });

    var filteredAsig = asignaciones.filter(function(a) {
      var isAct = String(a.Activa).toUpperCase() === 'TRUE' || a.Activa === true;
      return isAct && (!loteID || a.LoteID === loteID);
    });

    var totalPreguntas = filteredPreguntas.length;
    var totalAsignaciones = filteredAsig.length;

    // Response maps
    var respMap = {};
    respuestas.forEach(function(r) {
      respMap[r.QuestionID + '_' + r.SubdireccionID] = r;
      if (!respMap[r.QuestionID]) respMap[r.QuestionID] = r;
    });

    var countPendientes = 0;
    var countEnviadas = 0;
    var countObservadas = 0;
    var countAceptadas = 0;

    var riesgoCounts = {
      'Alto': 0,
      'Medio': 0,
      'Bajo': 0,
      'No Aplica': 0
    };

    var subAvance = {};

    filteredAsig.forEach(function(a) {
      var r = respMap[a.QuestionID + '_' + a.SubdireccionID] || respMap[a.QuestionID] || {};
      var estado = r.EstadoRevision || 'Pendiente';
      var riesgo = r.NivelRiesgo || 'No Aplica';

      if (estado === 'Pendiente') countPendientes++;
      else if (estado === 'Enviada' || estado === 'En revisión') countEnviadas++;
      else if (estado === 'Observada') countObservadas++;
      else if (estado === 'Aceptada') countAceptadas++;

      if (riesgoCounts.hasOwnProperty(riesgo)) {
        riesgoCounts[riesgo]++;
      } else {
        riesgoCounts['No Aplica']++;
      }

      var subNombre = subMap[a.SubdireccionID] || 'N/A';
      if (!subAvance[subNombre]) {
        subAvance[subNombre] = { total: 0, respondidas: 0, aceptadas: 0 };
      }
      subAvance[subNombre].total++;
      if (estado !== 'Pendiente') subAvance[subNombre].respondidas++;
      if (estado === 'Aceptada') subAvance[subNombre].aceptadas++;
    });

    // Subdirectorate progress percentages
    var avanceSubdirecciones = [];
    for (var sName in subAvance) {
      var item = subAvance[sName];
      var pct = item.total > 0 ? Math.round((item.respondidas / item.total) * 100) : 0;
      avanceSubdirecciones.push({
        nombre: sName,
        total: item.total,
        respondidas: item.respondidas,
        aceptadas: item.aceptadas,
        porcentaje: pct
      });
    }

    var totalRespondidas = countEnviadas + countObservadas + countAceptadas;
    var porcentajeGeneral = totalAsignaciones > 0 ? Math.round((totalRespondidas / totalAsignaciones) * 100) : 0;

    return {
      success: true,
      data: {
        totalLotes: lotes.length,
        totalPreguntas: totalPreguntas,
        totalAsignaciones: totalAsignaciones,
        respondidas: totalRespondidas,
        pendientes: countPendientes,
        enviadas: countEnviadas,
        observadas: countObservadas,
        aceptadas: countAceptadas,
        porcentajeGeneral: porcentajeGeneral,
        distribucionRiesgo: riesgoCounts,
        avanceSubdirecciones: avanceSubdirecciones
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
