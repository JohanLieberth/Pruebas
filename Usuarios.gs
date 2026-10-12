/**
 * Control Machete - CRUD and Management for Usuarios
 */

function obtenerUsuarios(token) {
  try {
    requireAuth(token, 'administrador');
    var users = getSheetObjects('Usuarios');
    var subdirecciones = getSheetObjects('Subdirecciones');
    var subMap = {};
    subdirecciones.forEach(function(s) {
      subMap[s.SubdireccionID] = s.Nombre;
    });

    var safeUsers = users.map(function(u) {
      return {
        UsuarioID: u.UsuarioID,
        Email: u.Email,
        Nombre: u.Nombre,
        Rol: u.Rol,
        SubdireccionID: u.SubdireccionID,
        NombreSubdireccion: subMap[u.SubdireccionID] || 'N/A',
        Activo: String(u.Activo).toUpperCase() === 'TRUE' || u.Activo === true,
        FechaCreacion: u.FechaCreacion,
        FechaModificacion: u.FechaModificacion,
        CreadoPor: u.CreadoPor
      };
    });

    return { success: true, data: safeUsers };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function guardarUsuario(token, usuarioData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    if (!usuarioData.email || !usuarioData.nombre || !usuarioData.rol) {
      return { success: false, message: 'Todos los campos obligatorios deben ser completados.' };
    }

    var sheet = getSheetSafe('Usuarios');
    var users = getSheetObjects('Usuarios');
    var isEdit = !!usuarioData.usuarioID;

    // Check duplicate email
    for (var i = 0; i < users.length; i++) {
      if (users[i].Email.toLowerCase().trim() === usuarioData.email.toLowerCase().trim()) {
        if (!isEdit || users[i].UsuarioID !== usuarioData.usuarioID) {
          return { success: false, message: 'Ya existe un usuario registrado con este correo electrónico.' };
        }
      }
    }

    var now = new Date().toISOString();

    if (isEdit) {
      // Find row index to update
      var targetUser = null;
      for (var j = 0; j < users.length; j++) {
        if (users[j].UsuarioID === usuarioData.usuarioID) {
          targetUser = users[j];
          break;
        }
      }

      if (!targetUser) {
        return { success: false, message: 'El usuario especificado no fue encontrado.' };
      }

      var rowIndex = targetUser._rowIndex;

      // Update Password if provided
      var passwordHash = targetUser.PasswordHash;
      var salt = targetUser.Salt;
      if (usuarioData.password && usuarioData.password.trim() !== '') {
        salt = Utilities.getUuid();
        passwordHash = hashPasswordWithSalt(usuarioData.password.trim(), salt);
      }

      sheet.getRange(rowIndex, 2).setValue(usuarioData.email.trim());
      sheet.getRange(rowIndex, 3).setValue(usuarioData.nombre.trim());
      sheet.getRange(rowIndex, 4).setValue(passwordHash);
      sheet.getRange(rowIndex, 5).setValue(salt);
      sheet.getRange(rowIndex, 6).setValue(usuarioData.rol);
      sheet.getRange(rowIndex, 7).setValue(usuarioData.subdireccionID || '');
      sheet.getRange(rowIndex, 8).setValue(usuarioData.activo !== false);
      sheet.getRange(rowIndex, 10).setValue(now);

      logAccion(session.email, 'Editar Usuario', 'Usuario modificado: ' + usuarioData.email);
      return { success: true, message: 'Usuario actualizado correctamente.' };
    } else {
      if (!usuarioData.password || usuarioData.password.trim() === '') {
        return { success: false, message: 'La contraseña es requerida para nuevos usuarios.' };
      }

      var newID = 'USR-' + ('000' + (users.length + 1)).slice(-3);
      var newSalt = Utilities.getUuid();
      var newHash = hashPasswordWithSalt(usuarioData.password.trim(), newSalt);

      sheet.appendRow([
        newID,
        usuarioData.email.trim(),
        usuarioData.nombre.trim(),
        newHash,
        newSalt,
        usuarioData.rol,
        usuarioData.subdireccionID || '',
        usuarioData.activo !== false,
        now,
        now,
        session.email
      ]);

      logAccion(session.email, 'Crear Usuario', 'Nuevo usuario creado: ' + usuarioData.email);
      return { success: true, message: 'Usuario registrado exitosamente.' };
    }
  } catch (e) {
    return { success: false, message: 'Error al guardar usuario: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoUsuario(token, usuarioID, activo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    var users = getSheetObjects('Usuarios');
    var targetUser = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].UsuarioID === usuarioID) {
        targetUser = users[i];
        break;
      }
    }

    if (!targetUser) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    var sheet = getSheetSafe('Usuarios');
    sheet.getRange(targetUser._rowIndex, 8).setValue(activo);
    sheet.getRange(targetUser._rowIndex, 10).setValue(new Date().toISOString());

    logAccion(session.email, 'Cambiar Estado Usuario', 'Usuario ' + usuarioID + ' cambio estado a: ' + activo);
    return { success: true, message: 'Estado del usuario actualizado.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
