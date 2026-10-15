/**
 * Minutas.gs - Módulo para la creación y gestión de minutas con asistencia, orden del día y acuerdos.
 */

/**
 * Genera un folio consecutivo anual en formato MIN-YYYY-NNN (ej. MIN-2025-001).
 */
function generarFolioMinuta() {
  var sheet = getSheetSafe(SHEETS.MINUTAS);
  var data = sheet.getDataRange().getValues();
  var yearActual = new Date().getFullYear().toString();
  var maxConsecutivo = 0;

  if (data.length > 1) {
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var colFolio = headers.indexOf("Folio");

    for (var i = 1; i < data.length; i++) {
      var folio = data[i][colFolio] ? data[i][colFolio].toString().trim() : "";
      if (folio && folio.indexOf("MIN-" + yearActual) === 0) {
        var partes = folio.split("-");
        if (partes.length >= 3) {
          var num = parseInt(partes[2], 10);
          if (!isNaN(num) && num > maxConsecutivo) {
            maxConsecutivo = num;
          }
        }
      }
    }
  }

  var siguienteConsecutivo = (maxConsecutivo + 1).toString().padStart(3, '0');
  return "MIN-" + yearActual + "-" + siguienteConsecutivo;
}

/**
 * Guarda una minuta completa con asistencia, orden del día y acuerdos.
 */
function guardarMinuta(datos) {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado. Solo el Administrador puede registrar minutas.");
  }

  if (!datos || !datos.datosGenerales) {
    throw new Error("Estructura de minuta inválida.");
  }

  var dg = datos.datosGenerales;
  if (!dg.ID_Proyecto || !dg.Nombre_Reunión || !dg.Fecha) {
    throw new Error("Completa los campos requeridos de la minuta (Proyecto, Nombre de Reunión y Fecha).");
  }

  var folio = dg.Folio || generarFolioMinuta();
  var fechaCreacion = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  // 1. Guardar Minuta Principal
  var sheetMinutas = getSheetSafe(SHEETS.MINUTAS);
  sheetMinutas.appendRow([
    folio,
    dg.ID_Proyecto,
    dg.Etapa || "",
    dg.Dependencia || "",
    dg.Subdirección || "",
    dg.Nombre_Reunión,
    dg.Fecha,
    dg.Lugar || "",
    dg.Objetivos || "",
    correo,
    fechaCreacion
  ]);

  // 2. Guardar Asistencia
  var asistenciaGuardada = [];
  if (datos.asistencia && datos.asistencia.length > 0) {
    var sheetAsist = getSheetSafe(SHEETS.ASISTENCIA);
    datos.asistencia.forEach(function(a) {
      if (a.Nombre && a.Nombre.trim()) {
        var idAsist = generarIDUnico("AST");
        sheetAsist.appendRow([
          idAsist,
          folio,
          a.Nombre.trim(),
          a.Dependencia_Area || "",
          a.Cargo || ""
        ]);
        asistenciaGuardada.push({ id: idAsist, nombre: a.Nombre.trim() });
      }
    });
  }

  // 3. Guardar Orden del Día
  if (datos.ordenDelDia && datos.ordenDelDia.length > 0) {
    var sheetOrden = getSheetSafe(SHEETS.ORDEN_DEL_DIA);
    datos.ordenDelDia.forEach(function(punto, index) {
      if (punto.Descripción_Punto && punto.Descripción_Punto.trim()) {
        var idPunto = generarIDUnico("ODD");
        sheetOrden.appendRow([
          idPunto,
          folio,
          index + 1,
          punto.Descripción_Punto.trim()
        ]);
      }
    });
  }

  // 4. Guardar Acuerdos
  var acuerdosCreados = [];
  if (datos.acuerdos && datos.acuerdos.length > 0) {
    var sheetAcuerdos = getSheetSafe(SHEETS.ACUERDOS);
    datos.acuerdos.forEach(function(ac) {
      if (ac.Descripción_Acuerdo && ac.Descripción_Acuerdo.trim()) {
        var idAcuerdo = generarIDUnico("ACU");
        var tipo = ac.Tipo || "Acuerdo";
        var fechaLimite = (tipo === "Acuerdo") ? (ac.Fecha_Límite || "") : "";
        var subdireccion = ac.Subdirección_Asignada || "";
        var solicitantes = Array.isArray(ac.Solicitantes) ? ac.Solicitantes.join("; ") : (ac.Solicitantes || "");
        var responsables = Array.isArray(ac.Responsables) ? ac.Responsables.join("; ") : (ac.Responsables || "");

        sheetAcuerdos.appendRow([
          idAcuerdo,
          folio,
          tipo,
          ac.Descripción_Acuerdo.trim(),
          ac.Prioridad || "Media",
          solicitantes,
          responsables,
          fechaLimite,
          subdireccion,
          "Pendiente",
          "Minuta",
          correo,
          fechaCreacion,
          fechaCreacion
        ]);

        acuerdosCreados.push(idAcuerdo);

        // Notificar si está asignado a subdirección
        if (subdireccion) {
          try {
            enviarNotificacionAcuerdo(idAcuerdo);
          } catch (errNotif) {
            console.error("Error al enviar notificación para acuerdo " + idAcuerdo + ": " + errNotif.toString());
          }
        }
      }
    });
  }

  return {
    exito: true,
    folio: folio,
    mensaje: "Minuta " + folio + " registrada exitosamente con " + acuerdosCreados.length + " acuerdos."
  };
}

/**
 * Obtiene la lista completa de minutas registradas.
 */
function listarMinutas() {
  return sheetToObjects(SHEETS.MINUTAS);
}

/**
 * Obtiene el detalle completo de una minuta dada su folio.
 */
function obtenerDetalleMinuta(folio) {
  var minutas = sheetToObjects(SHEETS.MINUTAS);
  var minuta = minutas.find(function(m) { return m.Folio === folio; });

  if (!minuta) throw new Error("Minuta no encontrada: " + folio);

  var asistencias = sheetToObjects(SHEETS.ASISTENCIA).filter(function(a) { return a.Folio_Minuta === folio; });
  var ordenDelDia = sheetToObjects(SHEETS.ORDEN_DEL_DIA).filter(function(o) { return o.Folio_Minuta === folio; });
  var acuerdos = sheetToObjects(SHEETS.ACUERDOS).filter(function(ac) { return ac.Folio_Minuta === folio; });

  return {
    minuta: minuta,
    asistencias: asistencias,
    ordenDelDia: ordenDelDia,
    acuerdos: acuerdos
  };
}
