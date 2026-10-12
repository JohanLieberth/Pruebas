/**
 * Control Machete - Submissions, Review, Risk Calculation & Drive Attachments
 */

/**
 * Calculates residual risk level automatically based on answer response value.
 */
function calcularNivelRiesgo(respuesta) {
  if (!respuesta) return 'No Aplica';
  var val = String(respuesta).trim().toLowerCase();
  if (val === 'sí' || val === 'si') return 'Bajo';
  if (val === 'parcial') return 'Medio';
  if (val === 'no') return 'Alto';
  if (val === 'no aplica') return 'No Aplica';
  return 'No Aplica';
}

/**
 * Retrieves questions assigned to current user's subdirectorate (or all if admin)
 */
function obtenerPreguntasOperativo(token) {
  try {
    var session = requireAuth(token);
    var preguntas = getSheetObjects('Preguntas');
    var asignaciones = getSheetObjects('Asignaciones');
    var respuestas = getSheetObjects('Respuestas');

    var isOp = session.rol === 'operativo';
    var userSubID = session.subdireccionID;

    // Filter active assignments for user's subdirectorate
    var assignedQuestionIDs = [];
    asignaciones.forEach(function(a) {
      if ((String(a.Activa).toUpperCase() === 'TRUE' || a.Activa === true)) {
        if (!isOp || a.SubdireccionID === userSubID) {
          if (assignedQuestionIDs.indexOf(a.QuestionID) === -1) {
            assignedQuestionIDs.push(a.QuestionID);
          }
        }
      }
    });

    var activePreguntas = preguntas.filter(function(p) {
      var isAct = String(p.Activa).toUpperCase() === 'TRUE' || p.Activa === true;
      return isAct && (!isOp || assignedQuestionIDs.indexOf(p.QuestionID) !== -1);
    });

    // Map existing responses
    var respMap = {};
    respuestas.forEach(function(r) {
      if (!isOp || r.SubdireccionID === userSubID) {
        respMap[r.QuestionID] = r;
      }
    });

    var result = activePreguntas.map(function(p) {
      var resp = respMap[p.QuestionID] || {};
      return {
        QuestionID: p.QuestionID,
        LoteID: p.LoteID,
        No: p.No,
        Categoria: p.Categoria,
        Subcategoria: p.Subcategoria,
        Pregunta: p.Pregunta,
        FundamentoLegal: p.FundamentoLegal,
        SubdireccionID: userSubID || resp.SubdireccionID || '',
        RespuestaID: resp.RespuestaID || '',
        Respuesta: resp.Respuesta || '',
        EvidenciaTextual: resp.EvidenciaTextual || '',
        EvidenciaDocumental: resp.EvidenciaDocumental || '',
        Observaciones: resp.Observaciones || '',
        NivelRiesgo: resp.NivelRiesgo || '',
        EstadoRevision: resp.EstadoRevision || 'Pendiente',
        ObservacionAdmin: resp.ObservacionAdmin || '',
        FechaUltimaModificacion: resp.FechaUltimaModificacion || ''
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Handles Base64 file uploads to Google Drive folder "Evidencias Auditorias"
 */
function guardarArchivoDrive(base64Data, fileName, mimeType) {
  try {
    var folderName = 'Evidencias Auditorias';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl(),
      name: file.getName()
    };
  } catch (e) {
    console.error('Error al guardar archivo en Drive: ' + e.message);
    return { success: false, message: 'Error al subir archivo a Drive: ' + e.message };
  }
}

/**
 * Saves response as draft or submitted response from operative user
 */
function guardarRespuestaOperativo(token, respuestaData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var session = requireAuth(token);

    if (!respuestaData.questionID) {
      return { success: false, message: 'QuestionID es requerido.' };
    }

    var sheet = getSheetSafe('Respuestas');
    var respuestas = getSheetObjects('Respuestas');
    var now = new Date().toISOString();
    var subID = session.subdireccionID || respuestaData.subdireccionID || '';

    // Auto calculate residual risk
    var nivelRiesgo = calcularNivelRiesgo(respuestaData.respuesta);
    var estadoRevision = respuestaData.esBorrador ? 'En revisión' : 'Enviada';

    // Check if response record already exists for this question + subdirectorate
    var existingResp = null;
    for (var i = 0; i < respuestas.length; i++) {
      if (respuestas[i].QuestionID === respuestaData.questionID && (!subID || respuestas[i].SubdireccionID === subID)) {
        existingResp = respuestas[i];
        break;
      }
    }

    if (existingResp) {
      var rIndex = existingResp._rowIndex;

      // Merge EvidenciaDocumental if provided
      var evidenciaDoc = respuestaData.evidenciaDocumental || existingResp.EvidenciaDocumental || '';

      sheet.getRange(rIndex, 5).setValue(respuestaData.respuesta || '');
      sheet.getRange(rIndex, 6).setValue(respuestaData.evidenciaTextual || '');
      sheet.getRange(rIndex, 7).setValue(evidenciaDoc);
      sheet.getRange(rIndex, 8).setValue(respuestaData.observaciones || '');
      sheet.getRange(rIndex, 9).setValue(nivelRiesgo);
      sheet.getRange(rIndex, 10).setValue(session.nombre + ' (' + session.email + ')');
      sheet.getRange(rIndex, 12).setValue(now);
      sheet.getRange(rIndex, 13).setValue(estadoRevision);

      logAccion(session.email, 'Guardar Respuesta', 'Respuesta actualizada para ' + respuestaData.questionID + ' (Estado: ' + estadoRevision + ')');
      return { success: true, message: respuestaData.esBorrador ? 'Borrador guardado con éxito.' : 'Respuesta enviada exitosamente.' };
    } else {
      var newID = 'RESP-' + ('000' + (respuestas.length + 1)).slice(-3);

      sheet.appendRow([
        newID,
        respuestaData.questionID,
        subID,
        session.usuarioID,
        respuestaData.respuesta || '',
        respuestaData.evidenciaTextual || '',
        respuestaData.evidenciaDocumental || '',
        respuestaData.observaciones || '',
        nivelRiesgo,
        session.nombre + ' (' + session.email + ')',
        now,
        now,
        estadoRevision,
        '',
        '',
        ''
      ]);

      logAccion(session.email, 'Crear Respuesta', 'Nueva respuesta creada para ' + respuestaData.questionID + ' (Estado: ' + estadoRevision + ')');
      return { success: true, message: respuestaData.esBorrador ? 'Borrador guardado con éxito.' : 'Respuesta enviada exitosamente.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieves full responses tracking table for Administrator with filters
 */
function obtenerSeguimientoRespuestas(token, loteID) {
  try {
    var session = requireAuth(token, 'administrador');
    var preguntas = getSheetObjects('Preguntas');
    var subdirecciones = getSheetObjects('Subdirecciones');
    var respuestas = getSheetObjects('Respuestas');
    var asignaciones = getSheetObjects('Asignaciones');

    var subMap = {};
    subdirecciones.forEach(function(s) { subMap[s.SubdireccionID] = s.Nombre; });

    var pregMap = {};
    preguntas.forEach(function(p) { pregMap[p.QuestionID] = p; });

    var respMap = {};
    respuestas.forEach(function(r) {
      respMap[r.QuestionID + '_' + r.SubdireccionID] = r;
      // also map by QuestionID fallback
      if (!respMap[r.QuestionID]) respMap[r.QuestionID] = r;
    });

    var activeAsig = asignaciones.filter(function(a) {
      return (String(a.Activa).toUpperCase() === 'TRUE' || a.Activa === true) && (!loteID || a.LoteID === loteID);
    });

    var result = activeAsig.map(function(a) {
      var p = pregMap[a.QuestionID] || {};
      var r = respMap[a.QuestionID + '_' + a.SubdireccionID] || respMap[a.QuestionID] || {};

      return {
        QuestionID: a.QuestionID,
        LoteID: a.LoteID,
        SubdireccionID: a.SubdireccionID,
        NombreSubdireccion: subMap[a.SubdireccionID] || 'N/A',
        No: p.No || '',
        Categoria: p.Categoria || '',
        Subcategoria: p.Subcategoria || '',
        Pregunta: p.Pregunta || '',
        FundamentoLegal: p.FundamentoLegal || '',
        RespuestaID: r.RespuestaID || '',
        Respuesta: r.Respuesta || 'Sin responder',
        EvidenciaTextual: r.EvidenciaTextual || '',
        EvidenciaDocumental: r.EvidenciaDocumental || '',
        Observaciones: r.Observaciones || '',
        NivelRiesgo: r.NivelRiesgo || 'No Aplica',
        UsuarioQueRespondio: r.UsuarioQueRespondio || 'N/A',
        FechaCreacion: r.FechaCreacion || '',
        FechaUltimaModificacion: r.FechaUltimaModificacion || '',
        EstadoRevision: r.EstadoRevision || 'Pendiente',
        ObservacionAdmin: r.ObservacionAdmin || '',
        RevisadoPor: r.RevisadoPor || '',
        FechaRevision: r.FechaRevision || ''
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Reviews response (Observar o Aceptar)
 */
function revisarRespuestaAdmin(token, revisionData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    if (!revisionData.questionID || !revisionData.estado) {
      return { success: false, message: 'QuestionID y estado son requeridos.' };
    }

    var sheet = getSheetSafe('Respuestas');
    var respuestas = getSheetObjects('Respuestas');
    var now = new Date().toISOString();

    var targetResp = null;
    for (var i = 0; i < respuestas.length; i++) {
      if (respuestas[i].QuestionID === revisionData.questionID) {
        if (!revisionData.subdireccionID || respuestas[i].SubdireccionID === revisionData.subdireccionID) {
          targetResp = respuestas[i];
          break;
        }
      }
    }

    if (!targetResp) {
      // Create record if admin accepts/observes prior to explicit submission
      var newID = 'RESP-' + ('000' + (respuestas.length + 1)).slice(-3);
      sheet.appendRow([
        newID,
        revisionData.questionID,
        revisionData.subdireccionID || '',
        '',
        '',
        '',
        '',
        '',
        'No Aplica',
        '',
        now,
        now,
        revisionData.estado,
        revisionData.observacionAdmin || '',
        session.email,
        now
      ]);
    } else {
      var rIdx = targetResp._rowIndex;
      sheet.getRange(rIdx, 12).setValue(now);
      sheet.getRange(rIdx, 13).setValue(revisionData.estado);
      sheet.getRange(rIdx, 14).setValue(revisionData.observacionAdmin || '');
      sheet.getRange(rIdx, 15).setValue(session.email);
      sheet.getRange(rIdx, 16).setValue(now);
    }

    logAccion(session.email, 'Revisar Respuesta', 'Pregunta ' + revisionData.questionID + ' cambiada a ' + revisionData.estado);
    return { success: true, message: 'Respuesta marcada como ' + revisionData.estado + ' correctamente.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
