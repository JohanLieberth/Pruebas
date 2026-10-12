/**
 * Control Machete - Individual and Bulk Question Assignments
 */

function obtenerAsignaciones(token, loteID) {
  try {
    var session = requireAuth(token);
    var asignaciones = getSheetObjects('Asignaciones');
    var subdirecciones = getSheetObjects('Subdirecciones');
    var preguntas = getSheetObjects('Preguntas');

    var subMap = {};
    subdirecciones.forEach(function(s) { subMap[s.SubdireccionID] = s.Nombre; });

    var pregMap = {};
    preguntas.forEach(function(p) { pregMap[p.QuestionID] = p; });

    var filtered = asignaciones;
    if (loteID) {
      filtered = asignaciones.filter(function(a) { return a.LoteID === loteID; });
    }

    var result = filtered.map(function(a) {
      var p = pregMap[a.QuestionID] || {};
      return {
        AsignacionID: a.AsignacionID,
        QuestionID: a.QuestionID,
        LoteID: a.LoteID,
        SubdireccionID: a.SubdireccionID,
        NombreSubdireccion: subMap[a.SubdireccionID] || 'N/A',
        No: p.No || '',
        Categoria: p.Categoria || '',
        Subcategoria: p.Subcategoria || '',
        Pregunta: p.Pregunta || '',
        Activa: String(a.Activa).toUpperCase() === 'TRUE' || a.Activa === true,
        FechaAsignacion: a.FechaAsignacion,
        AsignadoPor: a.AsignadoPor
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function asignarPreguntasMasivas(token, loteID, questionIDs, subdireccionIDs) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var session = requireAuth(token, 'administrador');

    if (!loteID || !Array.isArray(questionIDs) || questionIDs.length === 0 || !Array.isArray(subdireccionIDs) || subdireccionIDs.length === 0) {
      return { success: false, message: 'Parámetros incompletos. Debe seleccionar al menos una pregunta y una subdirección.' };
    }

    var sheet = getSheetSafe('Asignaciones');
    var existing = getSheetObjects('Asignaciones');
    var count = existing.length;
    var now = new Date().toISOString();
    var createdCount = 0;

    questionIDs.forEach(function(qId) {
      subdireccionIDs.forEach(function(subId) {
        // Check if already assigned & active
        var found = false;
        for (var i = 0; i < existing.length; i++) {
          if (existing[i].QuestionID === qId && existing[i].SubdireccionID === subId && existing[i].LoteID === loteID) {
            found = true;
            // Reactivate if disabled
            if (String(existing[i].Activa).toUpperCase() !== 'TRUE' && existing[i].Activa !== true) {
              sheet.getRange(existing[i]._rowIndex, 5).setValue(true);
              sheet.getRange(existing[i]._rowIndex, 6).setValue(now);
              sheet.getRange(existing[i]._rowIndex, 7).setValue(session.email);
            }
            break;
          }
        }

        if (!found) {
          count++;
          var asigID = 'ASIG-' + ('000' + count).slice(-3);
          sheet.appendRow([
            asigID,
            qId,
            loteID,
            subId,
            true,
            now,
            session.email
          ]);
          createdCount++;
        }
      });
    });

    logAccion(session.email, 'Asignación Masiva', 'Se crearon/actualizaron asignaciones para ' + questionIDs.length + ' preguntas en lote ' + loteID);
    return { success: true, message: 'Asignación completada con éxito. Registros procesados: ' + (createdCount > 0 ? createdCount : 'Actualizados existentes') };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoAsignacion(token, asignacionID, activa) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    var asignaciones = getSheetObjects('Asignaciones');
    var target = null;
    for (var i = 0; i < asignaciones.length; i++) {
      if (asignaciones[i].AsignacionID === asignacionID) {
        target = asignaciones[i];
        break;
      }
    }

    if (!target) {
      return { success: false, message: 'Asignación no encontrada.' };
    }

    var sheet = getSheetSafe('Asignaciones');
    sheet.getRange(target._rowIndex, 5).setValue(activa);

    logAccion(session.email, 'Cambiar Estado Asignación', 'Asignación ' + asignacionID + ' activa: ' + activa);
    return { success: true, message: 'Estado de asignación modificado.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
