/**
 * Notificaciones.gs - Envío centralizado de correos, registros en Log_Notificaciones y recordatorios programados.
 */

/**
 * Función central para enviar notificación por correo al asignar un acuerdo a una subdirección.
 */
function enviarNotificacionAcuerdo(idAcuerdo) {
  try {
    var acuerdos = sheetToObjects(SHEETS.ACUERDOS);
    var acuerdo = acuerdos.find(function(a) { return a.ID_Acuerdo === idAcuerdo; });

    if (!acuerdo) {
      throw new Error("Acuerdo no encontrado para notificación: " + idAcuerdo);
    }

    var subdireccion = acuerdo.Subdirección_Asignada;
    if (!subdireccion) {
      console.log("Acuerdo " + idAcuerdo + " no tiene subdirección asignada. Omitiendo correo.");
      return { exito: false, mensaje: "Sin subdirección asignada." };
    }

    // Buscar usuarios activos de la subdirección (Rol Operador o Administrador)
    var usuarios = sheetToObjects(SHEETS.USUARIOS);
    var destinatarios = usuarios.filter(function(u) {
      var act = u.Activo ? u.Activo.toString().trim() : "";
      var sub = u.Subdirección ? u.Subdirección.toString().trim() : "";
      return (act === "Sí" || act === "Si" || act === "SI") && sub.toLowerCase() === subdireccion.toLowerCase();
    }).map(function(u) { return u.Correo; });

    if (destinatarios.length === 0) {
      console.warn("No hay usuarios activos registrados para la subdirección: " + subdireccion);
      registrarLogNotificacion(idAcuerdo, "SIN_DESTINATARIOS", "Nuevo acuerdo asignado - " + (acuerdo.Folio_Minuta || idAcuerdo), "Fallido: No hay usuarios activos en la subdirección.");
      return { exito: false, mensaje: "No hay usuarios en la subdirección." };
    }

    var folioTexto = acuerdo.Folio_Minuta ? acuerdo.Folio_Minuta : "Acuerdo Individual (" + idAcuerdo + ")";
    var prioridad = acuerdo.Prioridad || "Media";
    var asunto = "Nuevo acuerdo asignado – " + folioTexto + " – [" + prioridad + "]";

    var colorPrioridad = "#28a745"; // Baja - Verde
    if (prioridad === "Media") colorPrioridad = "#ffc107"; // Media - Amarillo
    if (prioridad === "Alta") colorPrioridad = "#dc3545"; // Alta - Rojo

    var appUrl = ScriptApp.getService().getUrl() || "#";

    var cuerpoHtml =
      "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f4f6f9;'>" +
        "<div style='max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border-top: 6px solid #1A237E;'>" +
          "<h2 style='color: #1A237E; margin-top: 0; font-size: 22px;'>🔔 Nuevo Acuerdo Asignado</h2>" +
          "<p style='font-size: 15px; color: #555;'>Se ha asignado un nuevo acuerdo a la <strong>" + subdireccion + "</strong>. A continuación los detalles:</p>" +

          "<table style='width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;'>" +
            "<tr><td style='padding: 10px; background: #f8f9fa; font-weight: bold; width: 30%; border-bottom: 1px solid #e9ecef;'>Folio / Origen:</td><td style='padding: 10px; background: #f8f9fa; border-bottom: 1px solid #e9ecef;'>" + folioTexto + " (" + acuerdo.Origen + ")</td></tr>" +
            "<tr><td style='padding: 10px; font-weight: bold; border-bottom: 1px solid #e9ecef;'>Prioridad:</td><td style='padding: 10px; border-bottom: 1px solid #e9ecef;'><span style='background-color:" + colorPrioridad + "; color:#fff; padding:3px 10px; border-radius:12px; font-weight:bold; font-size:12px;'>" + prioridad + "</span></td></tr>" +
            "<tr><td style='padding: 10px; background: #f8f9fa; font-weight: bold; border-bottom: 1px solid #e9ecef;'>Fecha Límite:</td><td style='padding: 10px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #d9534f;'>" + (acuerdo.Fecha_Límite || "No especificada") + "</td></tr>" +
            "<tr><td style='padding: 10px; font-weight: bold; border-bottom: 1px solid #e9ecef;'>Solicitante(s):</td><td style='padding: 10px; border-bottom: 1px solid #e9ecef;'>" + (acuerdo.Solicitantes || "N/A") + "</td></tr>" +
            "<tr><td style='padding: 10px; background: #f8f9fa; font-weight: bold; border-bottom: 1px solid #e9ecef;'>Responsable(s):</td><td style='padding: 10px; background: #f8f9fa; border-bottom: 1px solid #e9ecef;'>" + (acuerdo.Responsables || "N/A") + "</td></tr>" +
          "</table>" +

          "<div style='margin-top: 20px; padding: 15px; background: #eef2ff; border-left: 4px solid #1A237E; border-radius: 4px;'>" +
            "<strong style='color: #1A237E;'>Descripción del Acuerdo:</strong>" +
            "<p style='margin: 8px 0 0 0; font-size: 15px; line-height: 1.5;'>" + acuerdo.Descripción_Acuerdo + "</p>" +
          "</div>" +

          "<div style='margin-top: 30px; text-align: center;'>" +
            "<a href='" + appUrl + "' style='background-color: #1A237E; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;'>Acceder al Dashboard de Seguimiento</a>" +
          "</div>" +

          "<hr style='margin-top: 30px; border: 0; border-top: 1px solid #eee;' />" +
          "<p style='font-size: 12px; color: #888; text-align: center;'>Este es un correo automático generado por el Sistema de Seguimiento de Reuniones.</p>" +
        "</div>" +
      "</div>";

    destinatarios.forEach(function(correoDestino) {
      try {
        GmailApp.sendEmail(correoDestino, asunto, "", { htmlBody: cuerpoHtml });
        registrarLogNotificacion(idAcuerdo, correoDestino, asunto, "Enviado");
      } catch (eEnvio) {
        console.error("Error al enviar a " + correoDestino + ": " + eEnvio.toString());
        registrarLogNotificacion(idAcuerdo, correoDestino, asunto, "Fallido: " + eEnvio.toString());
      }
    });

    return { exito: true, destinatariosCount: destinatarios.length };

  } catch (e) {
    console.error("Error en enviarNotificacionAcuerdo: " + e.toString());
    registrarLogNotificacion(idAcuerdo, "ERROR_SISTEMA", "Error Notificación", "Error: " + e.toString());
    return { exito: false, error: e.toString() };
  }
}

/**
 * Registra un evento en la hoja Log_Notificaciones.
 */
function registrarLogNotificacion(idAcuerdo, correoDestino, asunto, estatusEnvio) {
  try {
    var sheet = getSheetSafe(SHEETS.LOG_NOTIFICACIONES);
    var idLog = generarIDUnico("LOG");
    var fechaEnvio = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([
      idLog,
      idAcuerdo || "",
      correoDestino || "",
      asunto || "",
      fechaEnvio,
      estatusEnvio || ""
    ]);
  } catch (e) {
    console.error("Error guardando Log_Notificaciones: " + e.toString());
  }
}

/**
 * Función para ejecutarse con un activador (trigger) diario.
 * Revisa acuerdos vencidos o próximos a vencer y envía alertas por correo.
 */
function enviarRecordatorioAcuerdosVencidos() {
  console.log("Ejecutando proceso de recordatorio de acuerdos vencidos...");
  var acuerdos = sheetToObjects(SHEETS.ACUERDOS);
  var usuarios = sheetToObjects(SHEETS.USUARIOS);

  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  var totalNotificados = 0;

  acuerdos.forEach(function(acuerdo) {
    if ((acuerdo.Estatus === "Pendiente" || acuerdo.Estatus === "En Proceso") && acuerdo.Fecha_Límite) {
      var partes = acuerdo.Fecha_Límite.split("-");
      if (partes.length === 3) {
        var fechaLimite = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
        fechaLimite.setHours(0, 0, 0, 0);

        var diffDias = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 3600 * 24));

        // Notificar si está vencido (diff < 0) o vence hoy (diff == 0) o en 2 días o menos (diff <= 2)
        if (diffDias <= 2) {
          var subdireccion = acuerdo.Subdirección_Asignada;
          var destinatarios = usuarios.filter(function(u) {
            var act = u.Activo ? u.Activo.toString().trim() : "";
            var sub = u.Subdirección ? u.Subdirección.toString().trim() : "";
            return (act === "Sí" || act === "Si" || act === "SI") &&
                   (sub.toLowerCase() === subdireccion.toLowerCase() || u.Rol === "Administrador");
          }).map(function(u) { return u.Correo; });

          if (destinatarios.length > 0) {
            var estadoTexto = diffDias < 0 ? "VENCIDO (" + Math.abs(diffDias) + " días)" : (diffDias === 0 ? "VENCE HOY" : "PRÓXIMO A VENCER (" + diffDias + " días)");
            var asunto = "⚠️ RECORDATORIO: Acuerdo " + estadoTexto + " – " + (acuerdo.Folio_Minuta || acuerdo.ID_Acuerdo);

            var cuerpoHtml =
              "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #fff5f5;'>" +
                "<div style='max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 25px; border-top: 6px solid #dc3545; box-shadow: 0 4px 10px rgba(0,0,0,0.05);'>" +
                  "<h2 style='color: #dc3545; margin-top:0;'>⚠️ Alerta de Acuerdo " + estadoTexto + "</h2>" +
                  "<p>El siguiente acuerdo asignado a la subdirección <strong>" + subdireccion + "</strong> requiere atención inmediata:</p>" +
                  "<ul>" +
                    "<li><strong>ID Acuerdo:</strong> " + acuerdo.ID_Acuerdo + "</li>" +
                    "<li><strong>Folio Minuta:</strong> " + (acuerdo.Folio_Minuta || "Individual") + "</li>" +
                    "<li><strong>Descripción:</strong> " + acuerdo.Descripción_Acuerdo + "</li>" +
                    "<li><strong>Fecha Límite:</strong> " + acuerdo.Fecha_Límite + "</li>" +
                    "<li><strong>Estatus Actual:</strong> " + acuerdo.Estatus + "</li>" +
                    "<li><strong>Responsable(s):</strong> " + (acuerdo.Responsables || "Sin especificar") + "</li>" +
                  "</ul>" +
                  "<p style='margin-top: 20px;'>Por favor ingresa al sistema para actualizar el estatus o agregar observaciones de seguimiento.</p>" +
                "</div>" +
              "</div>";

            destinatarios.forEach(function(correoDestino) {
              try {
                GmailApp.sendEmail(correoDestino, asunto, "", { htmlBody: cuerpoHtml });
                registrarLogNotificacion(acuerdo.ID_Acuerdo, correoDestino, asunto, "Recordatorio Enviado");
                totalNotificados++;
              } catch (e) {
                console.error("Error enviando recordatorio a " + correoDestino + ": " + e.toString());
              }
            });
          }
        }
      }
    }
  });

  return { exito: true, totalNotificados: totalNotificados };
}

/**
 * Obtiene la bitácora de notificaciones enviadas.
 */
function obtenerLogNotificaciones() {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado.");
  }
  return sheetToObjects(SHEETS.LOG_NOTIFICACIONES);
}
