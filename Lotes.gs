/**
 * Control Machete - CRUD for Lotes
 */

function obtenerLotes(token) {
  try {
    var session = requireAuth(token);
    var lotes = getSheetObjects('Lotes');
    var preguntas = getSheetObjects('Preguntas');

    var result = lotes.map(function(l) {
      var totalPreguntas = preguntas.filter(function(p) {
        return p.LoteID === l.LoteID;
      }).length;

      return {
        LoteID: l.LoteID,
        NombreLote: l.NombreLote,
        Descripcion: l.Descripcion,
        Activo: String(l.Activo).toUpperCase() === 'TRUE' || l.Activo === true,
        FechaCreacion: l.FechaCreacion,
        CreadoPor: l.CreadoPor,
        TotalPreguntas: totalPreguntas
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function guardarLote(token, loteData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    if (!loteData.nombreLote || loteData.nombreLote.trim() === '') {
      return { success: false, message: 'El nombre del lote es obligatorio.' };
    }

    var sheet = getSheetSafe('Lotes');
    var lotes = getSheetObjects('Lotes');
    var isEdit = !!loteData.loteID;

    if (isEdit) {
      var target = null;
      for (var i = 0; i < lotes.length; i++) {
        if (lotes[i].LoteID === loteData.loteID) {
          target = lotes[i];
          break;
        }
      }

      if (!target) {
        return { success: false, message: 'Lote no encontrado.' };
      }

      sheet.getRange(target._rowIndex, 2).setValue(loteData.nombreLote.trim());
      sheet.getRange(target._rowIndex, 3).setValue(loteData.descripcion || '');
      sheet.getRange(target._rowIndex, 4).setValue(loteData.activo !== false);

      logAccion(session.email, 'Editar Lote', 'Lote editado: ' + loteData.nombreLote);
      return { success: true, message: 'Lote actualizado exitosamente.', loteID: loteData.loteID };
    } else {
      var newID = 'LOTE-' + ('000' + (lotes.length + 1)).slice(-3);
      sheet.appendRow([
        newID,
        loteData.nombreLote.trim(),
        loteData.descripcion || '',
        loteData.activo !== false,
        new Date().toISOString(),
        session.email
      ]);

      logAccion(session.email, 'Crear Lote', 'Nuevo lote creado: ' + loteData.nombreLote + ' (' + newID + ')');
      return { success: true, message: 'Lote creado exitosamente.', loteID: newID };
    }
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoLote(token, loteID, activo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    var lotes = getSheetObjects('Lotes');
    var target = null;
    for (var i = 0; i < lotes.length; i++) {
      if (lotes[i].LoteID === loteID) {
        target = lotes[i];
        break;
      }
    }

    if (!target) {
      return { success: false, message: 'Lote no encontrado.' };
    }

    var sheet = getSheetSafe('Lotes');
    sheet.getRange(target._rowIndex, 4).setValue(activo);

    logAccion(session.email, 'Cambiar Estado Lote', 'Lote ' + loteID + ' estado activo: ' + activo);
    return { success: true, message: 'Estado del lote modificado correctamente.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
