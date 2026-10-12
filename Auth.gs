/**
 * Control Machete - Authentication and Session Management
 */

function hashPasswordWithSalt(password, salt) {
  var saltedStr = password + salt;
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedStr, Utilities.Charset.UTF_8);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteStr = byteVal.toString(16);
    if (byteStr.length == 1) byteStr = '0' + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

function login(email, password) {
  try {
    if (!email || !password) {
      return { success: false, message: 'Correo y contraseña son requeridos.' };
    }

    var users = getSheetObjects('Usuarios');
    var targetUser = null;

    for (var i = 0; i < users.length; i++) {
      if (String(users[i].Email).toLowerCase().trim() === String(email).toLowerCase().trim()) {
        targetUser = users[i];
        break;
      }
    }

    if (!targetUser) {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }

    if (targetUser.Activo === false || String(targetUser.Activo).toUpperCase() === 'FALSE') {
      return { success: false, message: 'La cuenta de usuario se encuentra desactivada.' };
    }

    var computedHash = hashPasswordWithSalt(password, targetUser.Salt);
    if (computedHash !== targetUser.PasswordHash) {
      return { success: false, message: 'Usuario o contraseña incorrectos.' };
    }

    // Generate Session Token
    var token = Utilities.getUuid();
    var sessionData = {
      usuarioID: targetUser.UsuarioID,
      email: targetUser.Email,
      nombre: targetUser.Nombre,
      rol: targetUser.Rol,
      subdireccionID: targetUser.SubdireccionID,
      createdAt: new Date().getTime()
    };

    // Store in CacheService (TTL 21600 seconds = 6 hours)
    var cache = CacheService.getScriptCache();
    cache.put('SESSION_' + token, JSON.stringify(sessionData), 21600);

    logAccion(targetUser.Email, 'Login', 'Inicio de sesión exitoso');

    return {
      success: true,
      token: token,
      usuario: {
        usuarioID: targetUser.UsuarioID,
        email: targetUser.Email,
        nombre: targetUser.Nombre,
        rol: targetUser.Rol,
        subdireccionID: targetUser.SubdireccionID
      }
    };
  } catch (e) {
    console.error('Error en login: ' + e.message);
    return { success: false, message: 'Error interno de autenticación: ' + e.message };
  }
}

function validateSessionToken(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var sessionStr = cache.get('SESSION_' + token);
  if (!sessionStr) return null;

  try {
    return JSON.parse(sessionStr);
  } catch (e) {
    return null;
  }
}

function logout(token) {
  if (!token) return { success: true };
  var cache = CacheService.getScriptCache();
  var sessionStr = cache.get('SESSION_' + token);
  if (sessionStr) {
    try {
      var session = JSON.parse(sessionStr);
      logAccion(session.email, 'Logout', 'Cierre de sesión');
    } catch(e) {}
    cache.remove('SESSION_' + token);
  }
  return { success: true, message: 'Sesión cerrada exitosamente.' };
}

function requireAuth(token, requiredRole) {
  var session = validateSessionToken(token);
  if (!session) {
    throw new Error('Sesión no válida o expirada. Por favor vuelva a iniciar sesión.');
  }

  if (requiredRole) {
    if (Array.isArray(requiredRole)) {
      if (requiredRole.indexOf(session.rol) === -1) {
        throw new Error('Acceso denegado: No tiene permisos suficientes.');
      }
    } else if (session.rol !== requiredRole) {
      throw new Error('Acceso denegado: Se requiere rol ' + requiredRole);
    }
  }

  return session;
}
