/**
 * Proyectos.gs - Módulo para la gestión de proyectos.
 */

/**
 * Obtiene todos los proyectos registrados.
 */
function listarProyectos() {
  return sheetToObjects(SHEETS.PROYECTOS);
}

/**
 * Obtiene solo los proyectos activos.
 */
function listarProyectosActivos() {
  var proyectos = sheetToObjects(SHEETS.PROYECTOS);
  return proyectos.filter(function(p) {
    return p.Estatus === "Activo";
  });
}

/**
 * Guarda o actualiza un proyecto.
 */
function guardarProyecto(proyecto) {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado. Solo el Administrador puede crear o editar proyectos.");
  }

  if (!proyecto || !proyecto.Nombre_Proyecto || !proyecto.Nombre_Proyecto.trim()) {
    throw new Error("El nombre del proyecto es obligatorio.");
  }

  var sheet = getSheetSafe(SHEETS.PROYECTOS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });

  var colID = headers.indexOf("ID_Proyecto");
  var colNombre = headers.indexOf("Nombre_Proyecto");

  var idProyecto = proyecto.ID_Proyecto ? proyecto.ID_Proyecto.trim() : "";
  var nombreNuevo = proyecto.Nombre_Proyecto.trim();

  // Validar duplicados por nombre
  for (var i = 1; i < data.length; i++) {
    var rowID = data[i][colID] ? data[i][colID].toString().trim() : "";
    var rowNombre = data[i][colNombre] ? data[i][colNombre].toString().trim() : "";

    if (rowNombre.toLowerCase() === nombreNuevo.toLowerCase()) {
      if (!idProyecto || rowID !== idProyecto) {
        throw new Error("Ya existe un proyecto registrado con el nombre: " + nombreNuevo);
      }
    }
  }

  var fechaCreacion = proyecto.Fecha_Creación || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var creadoPor = proyecto.Creado_Por || correo;
  var estatus = proyecto.Estatus || "Activo";
  var descripcion = proyecto.Descripción || "";

  if (idProyecto) {
    // Editar existente
    for (var j = 1; j < data.length; j++) {
      if (data[j][colID] && data[j][colID].toString().trim() === idProyecto) {
        sheet.getRange(j + 1, 1, 1, 6).setValues([[
          idProyecto,
          nombreNuevo,
          descripcion,
          estatus,
          fechaCreacion,
          creadoPor
        ]]);
        return { exito: true, mensaje: "Proyecto actualizado correctamente.", id: idProyecto };
      }
    }
  }

  // Nuevo proyecto
  var nuevoID = generarIDUnico("PRY");
  sheet.appendRow([
    nuevoID,
    nombreNuevo,
    descripcion,
    estatus,
    fechaCreacion,
    creadoPor
  ]);

  return { exito: true, mensaje: "Proyecto registrado correctamente.", id: nuevoID };
}
