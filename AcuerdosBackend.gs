/**
 * Acuerdos.gs - Gestión de acuerdos individuales, lista general, filtros, comentarios y actualización de estatus.
 */

/**
 * Registra un acuerdo individual (sin minuta).
 */
function guardarAcuerdoIndividual(acuerdo) {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado. Solo el Administrador puede registrar acuerdos individuales.");
  }

  if (!acuerdo || !acuerdo.Descripción_Acuerdo || !acuerdo.Descripción_Acuerdo.trim()) {
    throw new Error("La descripción del acuerdo es requerida.");
  }

  var idAcuerdo = generarIDUnico("ACU-IND");
  var fechaCreacion = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var tipo = acuerdo.Tipo || "Acuerdo";
  var fechaLimite = (tipo === "Acuerdo") ? (acuerdo.Fecha_Límite || "") : "";
  var subdireccion = acuerdo.Subdirección_Asignada || "";

  var sheet = getSheetSafe(SHEETS.ACUERDOS);
  sheet.appendRow([
    idAcuerdo,
    "", // Folio_Minuta vacío
    tipo,
    acuerdo.Descripción_Acuerdo.trim(),
    acuerdo.Prioridad || "Media",
    acuerdo.Solicitantes || "",
    acuerdo.Responsables || "",
    fechaLimite,
    subdireccion,
    "Pendiente",
    "Individual",
    correo,
    fechaCreacion,
    fechaCreacion
  ]);

  if (subdireccion) {
    try {
      enviarNotificacionAcuerdo(idAcuerdo);
    } catch (e) {
      console.error("Error al notificar acuerdo individual " + idAcuerdo + ": " + e.toString());
    }
  }

  return { exito: true, idAcuerdo: idAcuerdo, mensaje: "Acuerdo individual registrado correctamente." };
}

/**
 * Obtiene la lista completa de acuerdos (para Administrador).
 */
function obtenerTodosLosAcuerdos() {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado.");
  }
  return sheetToObjects(SHEETS.ACUERDOS);
}

/**
 * Obtiene los acuerdos filtrados para un Operador según su subdirección asignada.
 */
function obtenerAcuerdosPorSubdireccion(subdireccionFiltro) {
  var correo = Session.getActiveUser().getEmail();
  var rol = obtenerRolUsuario(correo);
  var subdireccionUsuario = subdireccionFiltro || obtenerSubdireccionUsuario(correo);

  var acuerdos = sheetToObjects(SHEETS.ACUERDOS);

  if (rol === "Administrador") {
    if (subdireccionFiltro) {
      return acuerdos.filter(function(a) {
        return a.Subdirección_Asignada.toLowerCase().trim() === subdireccionFiltro.toLowerCase().trim();
      });
    }
    return acuerdos;
  }

  // Si es Operador
  if (!subdireccionUsuario) return [];

  return acuerdos.filter(function(a) {
    return a.Subdirección_Asignada.toLowerCase().trim() === subdireccionUsuario.toLowerCase().trim();
  });
}

/**
 * Actualiza el estatus de un acuerdo (por Administrador u Operador).
 */
function actualizarEstatusAcuerdo(idAcuerdo, nuevoEstatus, comentario) {
  var correo = Session.getActiveUser().getEmail();
  if (!validarOperador(correo)) {
    throw new Error("Acceso denegado.");
  }

  var sheet = getSheetSafe(SHEETS.ACUERDOS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });

  var colID = headers.indexOf("ID_Acuerdo");
  var colEstatus = headers.indexOf("Estatus");
  var colFechaMod = headers.indexOf("Fecha_Modificación");

  var fechaActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  for (var i = 1; i < data.length; i++) {
    if (data[i][colID] && data[i][colID].toString().trim() === idAcuerdo) {
      sheet.getRange(i + 1, colEstatus + 1).setValue(nuevoEstatus);
      sheet.getRange(i + 1, colFechaMod + 1).setValue(fechaActual);

      if (comentario && comentario.trim()) {
        agregarComentarioSeguimiento(idAcuerdo, comentario.trim());
      }

      return { exito: true, mensaje: "Estatus de acuerdo actualizado a: " + nuevoEstatus };
    }
  }

  throw new Error("Acuerdo no encontrado: " + idAcuerdo);
}

/**
 * Agrega un comentario de seguimiento a un acuerdo.
 */
function agregarComentarioSeguimiento(idAcuerdo, comentarioTexto) {
  var correo = Session.getActiveUser().getEmail();
  var sheet = getSheetSafe(SHEETS.COMENTARIOS);
  var idComentario = generarIDUnico("CMT");
  var fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    idComentario,
    idAcuerdo,
    correo,
    fechaHora,
    comentarioTexto
  ]);

  return { exito: true, mensaje: "Comentario agregado correctamente." };
}

/**
 * Obtiene el historial de comentarios de un acuerdo.
 */
function obtenerComentariosAcuerdo(idAcuerdo) {
  var comentarios = sheetToObjects(SHEETS.COMENTARIOS);
  return comentarios.filter(function(c) {
    return c.ID_Acuerdo === idAcuerdo;
  });
}

/**
 * Reasigna la subdirección o edita un acuerdo desde el Dashboard de Administrador.
 */
function editarAcuerdoAdmin(datosAcuerdo) {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado. Solo Administradores pueden editar acuerdos.");
  }

  var sheet = getSheetSafe(SHEETS.ACUERDOS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });

  var colID = headers.indexOf("ID_Acuerdo");
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][colID] && data[i][colID].toString().trim() === datosAcuerdo.ID_Acuerdo) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) throw new Error("Acuerdo no encontrado.");

  var subdireccionAnterior = data[targetRow - 1][headers.indexOf("Subdirección_Asignada")];
  var subdireccionNueva = datosAcuerdo.Subdirección_Asignada || "";

  var colDesc = headers.indexOf("Descripción_Acuerdo");
  var colPrio = headers.indexOf("Prioridad");
  var colFechaLim = headers.indexOf("Fecha_Límite");
  var colSubdir = headers.indexOf("Subdirección_Asignada");
  var colEstatus = headers.indexOf("Estatus");
  var colFechaMod = headers.indexOf("Fecha_Modificación");

  sheet.getRange(targetRow, colDesc + 1).setValue(datosAcuerdo.Descripción_Acuerdo);
  sheet.getRange(targetRow, colPrio + 1).setValue(datosAcuerdo.Prioridad);
  sheet.getRange(targetRow, colFechaLim + 1).setValue(datosAcuerdo.Fecha_Límite || "");
  sheet.getRange(targetRow, colSubdir + 1).setValue(subdireccionNueva);
  sheet.getRange(targetRow, colEstatus + 1).setValue(datosAcuerdo.Estatus);
  sheet.getRange(targetRow, colFechaMod + 1).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"));

  // Notificar si cambió la subdirección y la nueva no está vacía
  if (subdireccionNueva && subdireccionNueva !== subdireccionAnterior) {
    try {
      enviarNotificacionAcuerdo(datosAcuerdo.ID_Acuerdo);
    } catch (e) {
      console.error("Error renotificando acuerdo: " + e.toString());
    }
  }

  return { exito: true, mensaje: "Acuerdo editado correctamente." };
}

/**
 * Permite al Operador solicitar seguimiento al Administrador por correo.
 */
function solicitarSeguimientoAdmin(idAcuerdo, motivo) {
  var correoOperador = Session.getActiveUser().getEmail();
  if (!validarOperador(correoOperador)) {
    throw new Error("Acceso denegado.");
  }

  var acuerdos = sheetToObjects(SHEETS.ACUERDOS);
  var acuerdo = acuerdos.find(function(a) { return a.ID_Acuerdo === idAcuerdo; });

  if (!acuerdo) throw new Error("Acuerdo no encontrado.");

  // Buscar todos los usuarios Administradores activos
  var usuarios = sheetToObjects(SHEETS.USUARIOS);
  var admins = usuarios.filter(function(u) {
    return u.Rol === "Administrador" && (u.Activo === "Sí" || u.Activo === "Si" || u.Activo === "SI");
  }).map(function(u) { return u.Correo; });

  if (admins.length === 0) {
    throw new Error("No hay Administradores activos registrados para recibir la solicitud.");
  }

  var asunto = "Solicitud de Seguimiento de Acuerdo: " + idAcuerdo;
  var cuerpoHtml =
    "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f8f9fa;'>" +
      "<div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border-top: 5px solid #1A237E;'>" +
        "<h2 style='color: #1A237E; margin-top: 0;'>Solicitud de Seguimiento</h2>" +
        "<p>El operador <strong>" + correoOperador + "</strong> ha solicitado seguimiento para el siguiente acuerdo:</p>" +
        "<table style='width: 100%; border-collapse: collapse; margin-top: 15px;'>" +
          "<tr><td style='padding: 8px; background: #eef2ff; font-weight: bold;'>ID Acuerdo:</td><td style='padding: 8px; background: #eef2ff;'>" + acuerdo.ID_Acuerdo + "</td></tr>" +
          "<tr><td style='padding: 8px; font-weight: bold;'>Folio Minuta:</td><td style='padding: 8px;'>" + (acuerdo.Folio_Minuta || "Acuerdo Individual") + "</td></tr>" +
          "<tr><td style='padding: 8px; background: #eef2ff; font-weight: bold;'>Descripción:</td><td style='padding: 8px; background: #eef2ff;'>" + acuerdo.Descripción_Acuerdo + "</td></tr>" +
          "<tr><td style='padding: 8px; font-weight: bold;'>Subdirección:</td><td style='padding: 8px;'>" + acuerdo.Subdirección_Asignada + "</td></tr>" +
          "<tr><td style='padding: 8px; background: #eef2ff; font-weight: bold;'>Estatus Actual:</td><td style='padding: 8px; background: #eef2ff;'>" + acuerdo.Estatus + "</td></tr>" +
        "</table>" +
        "<div style='margin-top: 20px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;'>" +
          "<strong>Motivo / Comentario del Operador:</strong><br/>" +
          "<p style='margin: 5px 0 0 0;'>" + motivo + "</p>" +
        "</div>" +
      "</div>" +
    "</div>";

  admins.forEach(function(adminEmail) {
    GmailApp.sendEmail(adminEmail, asunto, "", { htmlBody: cuerpoHtml });
  });

  agregarComentarioSeguimiento(idAcuerdo, "Solicitud de seguimiento enviada al Administrador. Motivo: " + motivo);

  return { exito: true, mensaje: "Solicitud de seguimiento enviada a los administradores (" + admins.join(", ") + ")." };
}
