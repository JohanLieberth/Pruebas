/**
 * Control Machete - CRUD, CSV/JSON Bulk Import and Status Toggle for Preguntas
 */

function obtenerPreguntasPorLote(token, loteID) {
  try {
    var session = requireAuth(token);
    var preguntas = getSheetObjects('Preguntas');

    var filtered = preguntas;
    if (loteID) {
      filtered = preguntas.filter(function(p) {
        return p.LoteID === loteID;
      });
    }

    var data = filtered.map(function(p) {
      return {
        QuestionID: p.QuestionID,
        LoteID: p.LoteID,
        No: p.No,
        Categoria: p.Categoria,
        Subcategoria: p.Subcategoria,
        Pregunta: p.Pregunta,
        FundamentoLegal: p.FundamentoLegal,
        Activa: String(p.Activa).toUpperCase() === 'TRUE' || p.Activa === true,
        FechaCreacion: p.FechaCreacion,
        FechaModificacion: p.FechaModificacion
      };
    });

    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function guardarPregunta(token, preguntaData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    if (!preguntaData.loteID || !preguntaData.pregunta || preguntaData.pregunta.trim() === '') {
      return { success: false, message: 'LoteID y Pregunta son campos obligatorios.' };
    }

    var sheet = getSheetSafe('Preguntas');
    var preguntas = getSheetObjects('Preguntas');
    var isEdit = !!preguntaData.questionID;
    var now = new Date().toISOString();

    if (isEdit) {
      var target = null;
      for (var i = 0; i < preguntas.length; i++) {
        if (preguntas[i].QuestionID === preguntaData.questionID) {
          target = preguntas[i];
          break;
        }
      }

      if (!target) {
        return { success: false, message: 'Pregunta no encontrada.' };
      }

      sheet.getRange(target._rowIndex, 3).setValue(preguntaData.no || target.No);
      sheet.getRange(target._rowIndex, 4).setValue(preguntaData.categoria || '');
      sheet.getRange(target._rowIndex, 5).setValue(preguntaData.subcategoria || '');
      sheet.getRange(target._rowIndex, 6).setValue(preguntaData.pregunta.trim());
      sheet.getRange(target._rowIndex, 7).setValue(preguntaData.fundamentoLegal || '');
      sheet.getRange(target._rowIndex, 8).setValue(preguntaData.activa !== false);
      sheet.getRange(target._rowIndex, 10).setValue(now);

      logAccion(session.email, 'Editar Pregunta', 'Pregunta ' + preguntaData.questionID + ' actualizada.');
      return { success: true, message: 'Pregunta actualizada exitosamente.' };
    } else {
      // Find count of questions in this lot to construct ID e.g. LOTE-001-001
      var lotePreguntas = preguntas.filter(function(p) { return p.LoteID === preguntaData.loteID; });
      var seq = lotePreguntas.length + 1;
      var newID = preguntaData.loteID + '-' + ('000' + seq).slice(-3);
      var numero = preguntaData.no || seq;

      sheet.appendRow([
        newID,
        preguntaData.loteID,
        numero,
        preguntaData.categoria || '',
        preguntaData.subcategoria || '',
        preguntaData.pregunta.trim(),
        preguntaData.fundamentoLegal || '',
        preguntaData.activa !== false,
        now,
        now
      ]);

      logAccion(session.email, 'Crear Pregunta', 'Nueva pregunta creada: ' + newID);
      return { success: true, message: 'Pregunta agregada exitosamente.', questionID: newID };
    }
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function importarPreguntas(token, loteID, preguntasList) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var session = requireAuth(token, 'administrador');

    if (!loteID) {
      return { success: false, message: 'Debe especificar el LoteID para la importación.' };
    }

    if (!Array.isArray(preguntasList) || preguntasList.length === 0) {
      return { success: false, message: 'No se encontraron preguntas válidas para importar.' };
    }

    var sheet = getSheetSafe('Preguntas');
    var existingPreguntas = getSheetObjects('Preguntas');
    var lotePreguntas = existingPreguntas.filter(function(p) { return p.LoteID === loteID; });
    var startSeq = lotePreguntas.length + 1;
    var now = new Date().toISOString();
    var insertedCount = 0;

    preguntasList.forEach(function(p, index) {
      if (!p.pregunta || String(p.pregunta).trim() === '') return;

      var seq = startSeq + insertedCount;
      var newID = loteID + '-' + ('000' + seq).slice(-3);
      var num = p.no || seq;

      sheet.appendRow([
        newID,
        loteID,
        num,
        p.categoria || p.Componente || '',
        p.subcategoria || p.Principio || '',
        String(p.pregunta).trim(),
        p.fundamentoLegal || p.FundamentoLegal || '',
        true,
        now,
        now
      ]);

      insertedCount++;
    });

    logAccion(session.email, 'Importar Preguntas', 'Se importaron ' + insertedCount + ' preguntas al lote ' + loteID);
    return { success: true, message: 'Se importaron con éxito ' + insertedCount + ' preguntas.' };
  } catch (e) {
    return { success: false, message: 'Error en importación: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoPregunta(token, questionID, activa) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    var preguntas = getSheetObjects('Preguntas');
    var target = null;
    for (var i = 0; i < preguntas.length; i++) {
      if (preguntas[i].QuestionID === questionID) {
        target = preguntas[i];
        break;
      }
    }

    if (!target) {
      return { success: false, message: 'Pregunta no encontrada.' };
    }

    var sheet = getSheetSafe('Preguntas');
    sheet.getRange(target._rowIndex, 8).setValue(activa);
    sheet.getRange(target._rowIndex, 10).setValue(new Date().toISOString());

    logAccion(session.email, 'Cambiar Estado Pregunta', 'Pregunta ' + questionID + ' activa: ' + activa);
    return { success: true, message: 'Estado de pregunta modificado.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
