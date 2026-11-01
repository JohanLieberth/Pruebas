/**
 * Auth.gs - Manejo de autenticación, hash/salt, sesiones y roles
 */

var Auth = {

  /**
   * Genera y almacena un token de sesión criptográfico con CacheService y PropertiesService
   */
  createSessionToken: function(userPayload) {
    var token = 'TK-' + Utilities.getUuid() + '-' + (new Date().getTime()).toString(36);
    var sessionData = {
      token: token,
      userId: userPayload.userId,
      email: userPayload.email,
      name: userPayload.name,
      role: userPayload.role, // 'ClienteNormal', 'ClienteTaller', 'Administrador', 'Tecnico'
      tipoUsuario: userPayload.tipoUsuario || '',
      createdAt: new Date().getTime(),
      expiresAt: new Date().getTime() + (CONFIG.SESSION_TIMEOUT_SECONDS * 1000)
    };

    var payloadStr = JSON.stringify(sessionData);

    // Guardar en CacheService para acceso ultrarrápido
    try {
      var cache = CacheService.getScriptCache();
      cache.put('SESSION_' + token, payloadStr, CONFIG.SESSION_TIMEOUT_SECONDS);
    } catch (e) {
      Logger.log('Error guardando en CacheService: ' + e.message);
    }

    // Como respaldo duradero en UserProperties o ScriptProperties
    try {
      var props = PropertiesService.getScriptProperties();
      props.setProperty('SESS_' + token, payloadStr);
    } catch (e2) {
      Logger.log('Error guardando sesión en PropertiesService: ' + e2.message);
    }

    return {
      token: token,
      userId: userPayload.userId,
      email: userPayload.email,
      name: userPayload.name,
      role: userPayload.role,
      tipoUsuario: userPayload.tipoUsuario || '',
      expiresAt: sessionData.expiresAt
    };
  },

  /**
   * Valida un token de sesión y retorna la información del usuario autenticado
   */
  validateSession: function(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Sesión no válida o no proporcionada. Por favor inicia sesión nuevamente.');
    }

    var payloadStr = null;

    // 1. Intentar desde CacheService
    try {
      var cache = CacheService.getScriptCache();
      payloadStr = cache.get('SESSION_' + token);
    } catch (e) {
      // ignore
    }

    // 2. Si no está en cache, buscar en PropertiesService
    if (!payloadStr) {
      try {
        var props = PropertiesService.getScriptProperties();
        payloadStr = props.getProperty('SESS_' + token);
      } catch (e2) {
        // ignore
      }
    }

    if (!payloadStr) {
      throw new Error('Tu sesión ha expirado o no es válida. Inicia sesión de nuevo.');
    }

    var session = JSON.parse(payloadStr);
    var now = new Date().getTime();
    if (session.expiresAt && now > session.expiresAt) {
      Auth.invalidateSession(token);
      throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    }

    return session;
  },

  /**
   * Destruye una sesión
   */
  invalidateSession: function(token) {
    if (!token) return;
    try {
      var cache = CacheService.getScriptCache();
      cache.remove('SESSION_' + token);
    } catch (e) {}

    try {
      var props = PropertiesService.getScriptProperties();
      props.deleteProperty('SESS_' + token);
    } catch (e2) {}
  },

  /**
   * Exige que la sesión sea válida y pertenezca a uno de los roles permitidos
   */
  requireRole: function(token, allowedRoles) {
    var session = Auth.validateSession(token);
    if (!Array.isArray(allowedRoles)) {
      allowedRoles = [allowedRoles];
    }
    if (allowedRoles.indexOf(session.role) === -1) {
      throw new Error('Acceso denegado: No tienes permisos suficientes para realizar esta acción (Rol requerido: ' + allowedRoles.join(', ') + ').');
    }
    return session;
  },

  /**
   * Login para clientes (Normal / Taller)
   */
  loginUsuario: function(email, password) {
    if (!email || !password) {
      return Utils.error('Por favor ingresa tu correo y contraseña.');
    }
    var cleanEmail = String(email).trim().toLowerCase();
    var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'Correo', cleanEmail);
    if (!user) {
      return Utils.error('Credenciales incorrectas o usuario no registrado.');
    }

    if (String(user.Activo).toUpperCase() !== 'SI') {
      return Utils.error('Tu cuenta se encuentra inactiva. Contacta al taller para asistencia.');
    }

    var computedHash = Utils.hashPassword(password, user.PasswordSalt);
    if (computedHash !== user.PasswordHash) {
      return Utils.error('Credenciales incorrectas o usuario no registrado.');
    }

    // Actualizar último acceso
    Utils.updateRecordRow(CONFIG.SHEETS.USUARIOS, user._rowIndex, {
      UltimoAcceso: Utils.formatDateTime()
    });

    var sessionInfo = Auth.createSessionToken({
      userId: user.IDUsuario,
      email: user.Correo,
      name: user.NombreORazonSocial,
      role: user.TipoUsuario === CONFIG.TIPOS_CLIENTE.TALLER ? 'ClienteTaller' : 'ClienteNormal',
      tipoUsuario: user.TipoUsuario
    });

    Utils.logAction('LOGIN_USUARIO', 'Login de usuario: ' + cleanEmail, cleanEmail);

    return Utils.success({
      token: sessionInfo.token,
      userId: user.IDUsuario,
      name: user.NombreORazonSocial,
      email: user.Correo,
      tipoUsuario: user.TipoUsuario,
      puntosActuales: Number(user.PuntosActuales) || 0
    }, 'Bienvenido a PixelFix');
  },

  /**
   * Login para Administrativos y Técnicos
   */
  loginAdmin: function(email, password) {
    if (!email || !password) {
      return Utils.error('Por favor ingresa tu correo y contraseña.');
    }
    var cleanEmail = String(email).trim().toLowerCase();
    var admin = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS_ADMIN, 'Correo', cleanEmail);
    if (!admin) {
      return Utils.error('Credenciales incorrectas o usuario administrativo no registrado.');
    }

    if (String(admin.Activo).toUpperCase() !== 'SI') {
      return Utils.error('Este usuario administrativo se encuentra inactivo.');
    }

    var computedHash = Utils.hashPassword(password, admin.PasswordSalt);
    if (computedHash !== admin.PasswordHash) {
      return Utils.error('Credenciales incorrectas o usuario administrativo no registrado.');
    }

    var sessionInfo = Auth.createSessionToken({
      userId: admin.IDAdmin,
      email: admin.Correo,
      name: admin.Nombre,
      role: admin.Rol // 'Administrador' o 'Tecnico'
    });

    Utils.logAction('LOGIN_ADMIN', 'Inicio de sesión (' + admin.Rol + '): ' + cleanEmail, cleanEmail);

    return Utils.success({
      token: sessionInfo.token,
      userId: admin.IDAdmin,
      name: admin.Nombre,
      email: admin.Correo,
      role: admin.Rol
    }, 'Bienvenido al panel ' + admin.Rol);
  },

  /**
   * Logout universal
   */
  logout: function(token) {
    try {
      Auth.invalidateSession(token);
      return Utils.success(null, 'Sesión finalizada exitosamente');
    } catch (e) {
      return Utils.success(null, 'Sesión finalizada');
    }
  }
};

/** Funciones públicas expuestas a google.script.run **/

function apiLoginUsuario(email, password) {
  try {
    return Auth.loginUsuario(email, password);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiLoginAdmin(email, password) {
  try {
    return Auth.loginAdmin(email, password);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiLogout(token) {
  try {
    return Auth.logout(token);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiValidateSession(token) {
  try {
    var session = Auth.validateSession(token);
    return Utils.success(session);
  } catch (e) {
    return Utils.error(e.message, 'SESSION_INVALID');
  }
}
