/**
 * Usuarios.gs - Gestión de roles, autenticación y usuarios.
 */

/**
 * Obtiene el rol del usuario según su correo electrónico registrado.
 */
function obtenerRolUsuario(correo) {
  if (!correo) correo = Session.getActiveUser().getEmail();
  if (!correo) return "Sin Acceso";

  var emailNormalizado = correo.toLowerCase().trim();
  var sheet = getSheetSafe(SHEETS.USUARIOS);
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return "Sin Acceso";

  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var colCorreo = headers.indexOf("Correo");
  var colRol = headers.indexOf("Rol");
  var colActivo = headers.indexOf("Activo");

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var emailCell = row[colCorreo] ? row[colCorreo].toString().toLowerCase().trim() : "";
    var activoCell = row[colActivo] ? row[colActivo].toString().trim() : "";

    if (emailCell === emailNormalizado && (activoCell === "Sí" || activoCell === "Si" || activoCell === "SI")) {
      return row[colRol] ? row[colRol].toString().trim() : "Sin Acceso";
    }
  }

  return "Sin Acceso";
}

/**
 * Valida si el usuario actual es Administrador.
 */
function validarAdministrador(correo) {
  var rol = obtenerRolUsuario(correo);
  return rol === "Administrador";
}

/**
 * Valida si el usuario actual es Operador o Administrador.
 */
function validarOperador(correo) {
  var rol = obtenerRolUsuario(correo);
  return rol === "Operador" || rol === "Administrador";
}

/**
 * Obtiene la subdirección asociada al correo del usuario.
 */
function obtenerSubdireccionUsuario(correo) {
  if (!correo) correo = Session.getActiveUser().getEmail();
  var emailNormalizado = correo.toLowerCase().trim();
  var sheet = getSheetSafe(SHEETS.USUARIOS);
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return "";

  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var colCorreo = headers.indexOf("Correo");
  var colSubdireccion = headers.indexOf("Subdirección");
  var colActivo = headers.indexOf("Activo");

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var emailCell = row[colCorreo] ? row[colCorreo].toString().toLowerCase().trim() : "";
    var activoCell = row[colActivo] ? row[colActivo].toString().trim() : "";

    if (emailCell === emailNormalizado && (activoCell === "Sí" || activoCell === "Si" || activoCell === "SI")) {
      return row[colSubdireccion] ? row[colSubdireccion].toString().trim() : "";
    }
  }

  return "";
}

/**
 * Obtiene los detalles completos del usuario en sesión.
 */
function obtenerDatosUsuarioActual() {
  var correo = Session.getActiveUser().getEmail() || "";
  var rol = obtenerRolUsuario(correo);
  var subdireccion = obtenerSubdireccionUsuario(correo);

  var sheet = getSheetSafe(SHEETS.USUARIOS);
  var data = sheet.getDataRange().getValues();
  var nombre = correo;

  if (data.length > 1) {
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var colCorreo = headers.indexOf("Correo");
    var colNombre = headers.indexOf("Nombre");

    for (var i = 1; i < data.length; i++) {
      if (data[i][colCorreo] && data[i][colCorreo].toString().toLowerCase().trim() === correo.toLowerCase().trim()) {
        nombre = data[i][colNombre] ? data[i][colNombre].toString() : correo;
        break;
      }
    }
  }

  return {
    correo: correo,
    nombre: nombre,
    rol: rol,
    subdireccion: subdireccion
  };
}

/**
 * Obtiene la lista completa de usuarios (solo Administrador).
 */
function listarUsuarios() {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado. Solo el Administrador puede consultar los usuarios.");
  }
  return sheetToObjects(SHEETS.USUARIOS);
}

/**
 * Crea o actualiza un usuario.
 */
function guardarUsuario(usuario) {
  var correoSession = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correoSession)) {
    throw new Error("Acceso denegado. Solo el Administrador puede modificar usuarios.");
  }

  if (!usuario || !usuario.Correo || !usuario.Nombre || !usuario.Rol) {
    throw new Error("Por favor completa los campos obligatorios: Correo, Nombre y Rol.");
  }

  var sheet = getSheetSafe(SHEETS.USUARIOS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });

  var colCorreo = headers.indexOf("Correo");
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][colCorreo] && data[i][colCorreo].toString().toLowerCase().trim() === usuario.Correo.toLowerCase().trim()) {
      targetRow = i + 1;
      break;
    }
  }

  var rowData = [
    usuario.Correo.toLowerCase().trim(),
    usuario.Nombre.trim(),
    usuario.Rol.trim(),
    usuario.Subdirección ? usuario.Subdirección.trim() : "",
    usuario.Activo ? usuario.Activo.trim() : "Sí"
  ];

  if (targetRow > -1) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { exito: true, mensaje: "Usuario guardado correctamente." };
}

/**
 * Elimina o desactiva un usuario.
 */
function cambiarEstatusUsuario(correoUsuario, activo) {
  var correoSession = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correoSession)) {
    throw new Error("Acceso denegado.");
  }

  var sheet = getSheetSafe(SHEETS.USUARIOS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var colCorreo = headers.indexOf("Correo");
  var colActivo = headers.indexOf("Activo");

  for (var i = 1; i < data.length; i++) {
    if (data[i][colCorreo] && data[i][colCorreo].toString().toLowerCase().trim() === correoUsuario.toLowerCase().trim()) {
      sheet.getRange(i + 1, colActivo + 1).setValue(activo ? "Sí" : "No");
      return { exito: true, mensaje: "Estatus de usuario actualizado." };
    }
  }

  throw new Error("Usuario no encontrado.");
}
