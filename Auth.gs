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
   * Obtiene dinámicamente un mapa de índices de columna por nombre normalizado para una hoja dada
   */
  getColumnIndexes: function(sheet) {
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return {};
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = {};
    for (var i = 0; i < headers.length; i++) {
      var rawName = String(headers[i] || '').trim();
      var normName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
      colMap[normName] = i; // 0-based index
      colMap[rawName] = i;
    }
    return colMap;
  },

  /**
   * Login para Administrativos y Técnicos (Staff / Admin)
   * Diagnostica y valida credenciales dinámicamente por nombre de columna (no por posición fija),
   * soportando hashes estándar, posibles columnas invertidas (hash en salt) o contraseñas
   * registradas manualmente en texto plano en el Sheet, migrándolas automáticamente a hash seguro.
   */
  loginAdmin: function(email, password) {
    if (!email || !password) {
      Logger.log('loginAdmin: Correo o contraseña no proporcionados.');
      return Utils.error('Por favor ingresa tu correo y contraseña.');
    }

    var cleanEmail = String(email).trim().toLowerCase();
    var cleanPassword = String(password);

    var sheet = null;
    try {
      sheet = getSheet(CONFIG.SHEETS.USUARIOS_ADMIN);
    } catch (eSheet) {
      Logger.log('loginAdmin ERROR: No se pudo abrir la hoja UsuariosAdmin: ' + eSheet.message);
      Utils.logAction('LOGIN_ADMIN_ERROR', 'Hoja UsuariosAdmin no accesible: ' + eSheet.message, cleanEmail);
      return Utils.error('Error de base de datos: hoja UsuariosAdmin no accesible.');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      Logger.log('loginAdmin: Hoja UsuariosAdmin vacía.');
      // Si la hoja está vacía y es el admin inicial, sembrar fallback inmediatamente
      if (cleanEmail === 'sakurazukamori21@gmail.com') {
        Auth.ensureInitialAdmin();
        return Auth.loginAdmin(email, password);
      }
      return Utils.error('Credenciales incorrectas o usuario administrativo no registrado.');
    }

    var colMap = Auth.getColumnIndexes(sheet);

    // Resolver índices de columnas por nombre normalizado
    var idxCorreo = colMap['correo'] !== undefined ? colMap['correo'] : (colMap['email'] !== undefined ? colMap['email'] : 2);
    var idxHash = colMap['passwordhash'] !== undefined ? colMap['passwordhash'] : (colMap['hash'] !== undefined ? colMap['hash'] : 4);
    var idxSalt = colMap['passwordsalt'] !== undefined ? colMap['passwordsalt'] : (colMap['salt'] !== undefined ? colMap['salt'] : 5);
    var idxRol = colMap['rol'] !== undefined ? colMap['rol'] : (colMap['role'] !== undefined ? colMap['role'] : 6);
    var idxActivo = colMap['activo'] !== undefined ? colMap['activo'] : 7;
    var idxNombre = colMap['nombre'] !== undefined ? colMap['nombre'] : 1;
    var idxId = colMap['idadmin'] !== undefined ? colMap['idadmin'] : 0;

    var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var adminRow = null;
    var rowIndex = -1;

    for (var r = 1; r < data.length; r++) {
      var rowEmail = String(data[r][idxCorreo] || '').trim().toLowerCase();
      if (rowEmail === cleanEmail) {
        adminRow = data[r];
        rowIndex = r + 1; // 1-based index
        break;
      }
    }

    // Si no se encontró por correo y es el correo del administrador principal fallback
    if (!adminRow && cleanEmail === 'sakurazukamori21@gmail.com') {
      Logger.log('loginAdmin: Admin principal sakurazukamori21@gmail.com no encontrado. Sembrando via ensureInitialAdmin()...');
      Auth.ensureInitialAdmin();
      // Reintentar lectura tras siembra
      data = sheet.getDataRange().getValues();
      for (var r2 = 1; r2 < data.length; r2++) {
        if (String(data[r2][idxCorreo] || '').trim().toLowerCase() === cleanEmail) {
          adminRow = data[r2];
          rowIndex = r2 + 1;
          break;
        }
      }
    }

    if (!adminRow) {
      Logger.log('loginAdmin: Usuario administrativo no encontrado por correo: ' + cleanEmail);
      Utils.logAction('LOGIN_ADMIN_FALLO', 'Usuario no encontrado: ' + cleanEmail, cleanEmail);
      return Utils.error('Credenciales incorrectas o usuario administrativo no registrado.');
    }

    var idAdmin = String(adminRow[idxId] || 'ADM-' + rowIndex);
    var nombre = String(adminRow[idxNombre] || 'Administrador');
    var rol = String(adminRow[idxRol] || CONFIG.ROLES.ADMINISTRADOR).trim();
    var activo = String(adminRow[idxActivo] || 'SI').trim().toUpperCase();
    var storedHash = String(adminRow[idxHash] || '').trim();
    var storedSalt = String(adminRow[idxSalt] || '').trim();

    if (activo !== 'SI') {
      Logger.log('loginAdmin: Usuario inactivo: ' + cleanEmail);
      Utils.logAction('LOGIN_ADMIN_INACTIVO', 'Usuario inactivo intentó acceder: ' + cleanEmail, cleanEmail);
      return Utils.error('Este usuario administrativo se encuentra inactivo.');
    }

    var credencialesValidas = false;
    var necesitaActualizarHash = false;
    var nuevoSaltParaGuardar = storedSalt;
    var nuevoHashParaGuardar = storedHash;

    // Caso 1: Hash SHA-256 estándar con salt (64 caracteres hexadecimales)
    if (storedHash.length === 64 && storedSalt) {
      var computedHash = Utils.hashPassword(cleanPassword, storedSalt);
      if (computedHash === storedHash) {
        credencialesValidas = true;
      }
    }

    // Caso 2: Columnas invertidas en el Sheet (PasswordSalt contiene el hash de 64 chars y PasswordHash contiene el salt)
    if (!credencialesValidas && storedSalt.length === 64 && storedHash) {
      var computedHashInv = Utils.hashPassword(cleanPassword, storedHash);
      if (computedHashInv === storedSalt) {
        credencialesValidas = true;
        Logger.log('loginAdmin: Detectadas columnas invertidas para ' + cleanEmail + '. Corrigiendo en el Sheet...');
        necesitaActualizarHash = true;
        nuevoHashParaGuardar = storedSalt;
        nuevoSaltParaGuardar = storedHash;
      }
    }

    // Caso 3: Contraseña registrada en texto plano directamente por el administrador en el Sheet
    if (!credencialesValidas) {
      if (storedHash === cleanPassword || storedSalt === cleanPassword) {
        credencialesValidas = true;
        Logger.log('loginAdmin: Detectada contraseña en texto plano en el Sheet para ' + cleanEmail + '. Hasheando automáticamente...');
        nuevoSaltParaGuardar = Utils.generateSalt(16);
        nuevoHashParaGuardar = Utils.hashPassword(cleanPassword, nuevoSaltParaGuardar);
        necesitaActualizarHash = true;
      }
    }

    // Si se necesitó corrección de hash o texto plano, persistir en el Sheet de inmediato
    if (credencialesValidas && necesitaActualizarHash) {
      try {
        var updates = {
          PasswordHash: nuevoHashParaGuardar,
          PasswordSalt: nuevoSaltParaGuardar
        };
        Utils.updateRecordRow(CONFIG.SHEETS.USUARIOS_ADMIN, rowIndex, updates);
        Logger.log('loginAdmin: Credenciales de ' + cleanEmail + ' migradas a SHA-256 + Salt seguro exitosamente.');
      } catch (errUpd) {
        Logger.log('Advertencia al migrar credenciales en Sheet: ' + errUpd.message);
      }
    }

    if (!credencialesValidas) {
      Logger.log('loginAdmin: Contraseña incorrecta para el usuario: ' + cleanEmail);
      Utils.logAction('LOGIN_ADMIN_PASSWORD_FAIL', 'Contraseña incorrecta para: ' + cleanEmail, cleanEmail);
      return Utils.error('Credenciales incorrectas o usuario administrativo no registrado.');
    }

    // Crear sesión y token seguro
    var sessionInfo = Auth.createSessionToken({
      userId: idAdmin,
      email: cleanEmail,
      name: nombre,
      role: rol
    });

    Utils.logAction('LOGIN_ADMIN_EXITO', 'Inicio de sesión (' + rol + '): ' + cleanEmail, cleanEmail);
    Logger.log('loginAdmin: Sesión exitosa para ' + cleanEmail + ' con rol ' + rol);

    return Utils.success({
      token: sessionInfo.token,
      userId: idAdmin,
      name: nombre,
      email: cleanEmail,
      role: rol
    }, 'Bienvenido al panel ' + rol);
  },

  /**
   * Garantiza la existencia del administrador principal inicial de forma estrictamente idempotente.
   * Si ya existe un registro con dicho correo, no sobrescribe su contraseña ni datos.
   */
  ensureInitialAdmin: function() {
    var adminEmail = 'sakurazukamori21@gmail.com';
    var adminPass = 'Monster123';
    var adminNombre = 'Administrador Principal';

    return Utils.withScriptLock(function() {
      var sheet = null;
      try {
        sheet = getSheet(CONFIG.SHEETS.USUARIOS_ADMIN);
      } catch (e) {
        Logger.log('ensureInitialAdmin: No se pudo obtener la hoja UsuariosAdmin: ' + e.message);
        return false;
      }

      var lastRow = sheet.getLastRow();
      var colMap = Auth.getColumnIndexes(sheet);
      var idxCorreo = colMap['correo'] !== undefined ? colMap['correo'] : 2;

      var data = lastRow > 1 ? sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues() : [];
      var existe = false;

      for (var r = 1; r < data.length; r++) {
        var rowEmail = String(data[r][idxCorreo] || '').trim().toLowerCase();
        if (rowEmail === adminEmail.toLowerCase()) {
          existe = true;
          break;
        }
      }

      if (!existe) {
        var salt = Utils.generateSalt(16);
        var hash = Utils.hashPassword(adminPass, salt);
        var idAdmin = Utils.generateId('ADM');
        var nowStr = Utils.formatDateTime();

        var nuevoAdmin = {
          IDAdmin: idAdmin,
          Nombre: adminNombre,
          Correo: adminEmail.toLowerCase(),
          Telefono: '5512345678',
          PasswordHash: hash,
          PasswordSalt: salt,
          Rol: CONFIG.ROLES.ADMINISTRADOR,
          Activo: 'SI',
          FechaCreacion: nowStr,
          CreadoPor: 'SetupInitialAdmin'
        };

        Utils.appendRecord(CONFIG.SHEETS.USUARIOS_ADMIN, nuevoAdmin);
        Logger.log('ensureInitialAdmin: Administrador inicial creado exitosamente (' + adminEmail + ')');
        Utils.logAction('ENSURE_INITIAL_ADMIN', 'Administrador inicial creado: ' + adminEmail, 'Sistema');
        return true;
      } else {
        Logger.log('ensureInitialAdmin: Administrador ' + adminEmail + ' ya existe. No se sobrescriben datos.');
        return false;
      }
    });
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

function ensureInitialAdmin() {
  return Auth.ensureInitialAdmin();
}
