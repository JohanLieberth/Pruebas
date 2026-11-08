/**
 * Usuarios.gs - Gestión de usuarios clientes, responsables solidarios y usuarios administrativos
 */

var Usuarios = {

  /**
   * Registra un nuevo usuario cliente (Normal o Taller)
   * Valida correo único, genera hash+salt, opcionalmente guarda responsable solidario
   * y envía correo de bienvenida con credenciales
   */
  registrarUsuario: function(datos) {
    if (!datos) throw new Error('Datos de registro no proporcionados');

    var tipoUsuario = (datos.tipoUsuario || CONFIG.TIPOS_CLIENTE.NORMAL).trim();
    if (tipoUsuario !== CONFIG.TIPOS_CLIENTE.NORMAL && tipoUsuario !== CONFIG.TIPOS_CLIENTE.TALLER) {
      throw new Error('Tipo de usuario inválido. Debe ser Normal o Taller.');
    }

    var nombre = (datos.nombre || datos.nombreORazonSocial || '').trim();
    if (!nombre || nombre.length < 3) {
      throw new Error('El nombre o razón social es obligatorio (mínimo 3 caracteres).');
    }

    var email = (datos.correo || datos.email || '').trim().toLowerCase();
    if (!Utils.isValidEmail(email)) {
      throw new Error('El correo electrónico no tiene un formato válido.');
    }

    var telefono = (datos.telefono || '').trim();
    if (!Utils.isValidPhone(telefono)) {
      throw new Error('El teléfono es obligatorio y debe contener al menos 8 dígitos.');
    }

    var password = String(datos.password || datos.contrasena || '');
    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    // Usar LockService para prevenir registros duplicados concurrentes
    return Utils.withScriptLock(function() {
      var existente = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'Correo', email);
      if (existente) {
        throw new Error('Ya existe una cuenta registrada con el correo: ' + email);
      }

      var salt = Utils.generateSalt(16);
      var hash = Utils.hashPassword(password, salt);
      var userId = Utils.generateId('USR');
      var nowStr = Utils.formatDateTime();

      var nuevoUsuario = {
        IDUsuario: userId,
        TipoUsuario: tipoUsuario,
        NombreORazonSocial: nombre,
        Correo: email,
        Telefono: telefono,
        PasswordHash: hash,
        PasswordSalt: salt,
        PuntosActuales: 0,
        Activo: 'SI',
        FechaRegistro: nowStr,
        UltimoAcceso: nowStr,
        CorreoVerificado: 'NO',
        Notas: datos.notas || ''
      };

      Utils.appendRecord(CONFIG.SHEETS.USUARIOS, nuevoUsuario);

      // Si viene responsable solidario opcional en el registro
      var idResponsableCreado = null;
      if (datos.responsable && datos.responsable.nombre) {
        idResponsableCreado = Usuarios.agregarResponsable(userId, datos.responsable);
      }

      // Enviar correo con credenciales (una sola vez)
      try {
        Correos.enviarCorreoRegistro({
          destinatario: email,
          nombre: nombre,
          tipoUsuario: tipoUsuario,
          password: password,
          telefono: telefono
        });
      } catch (errCorreo) {
        Logger.log('Advertencia: No se pudo enviar el correo de registro: ' + errCorreo.message);
      }

      Utils.logAction('REGISTRO_USUARIO', 'Usuario registrado: ' + email + ' (' + tipoUsuario + ')', email);

      // Iniciar sesión automáticamente y devolver token
      var sessionInfo = Auth.createSessionToken({
        userId: userId,
        email: email,
        name: nombre,
        role: tipoUsuario === CONFIG.TIPOS_CLIENTE.TALLER ? 'ClienteTaller' : 'ClienteNormal',
        tipoUsuario: tipoUsuario
      });

      return Utils.success({
        token: sessionInfo.token,
        userId: userId,
        name: nombre,
        email: email,
        tipoUsuario: tipoUsuario,
        puntosActuales: 0,
        responsableId: idResponsableCreado
      }, 'Registro exitoso. Se ha enviado un correo con tus datos de acceso.');
    });
  },

  /**
   * Agrega un responsable solidario a un cliente
   */
  agregarResponsable: function(idUsuario, datosResp) {
    if (!idUsuario) throw new Error('ID de usuario requerido');
    if (!datosResp || !datosResp.nombre) throw new Error('El nombre del responsable solidario es requerido');

    var respId = Utils.generateId('RSP');
    var nuevoResp = {
      IDResponsable: respId,
      IDUsuario: idUsuario,
      Nombre: String(datosResp.nombre).trim(),
      Telefono: String(datosResp.telefono || '').trim(),
      Correo: String(datosResp.correo || '').trim().toLowerCase(),
      Relacion: String(datosResp.relacion || 'Responsable Autorizado').trim(),
      Activo: 'SI',
      FechaRegistro: Utils.formatDateTime()
    };

    Utils.appendRecord(CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS, nuevoResp);
    return respId;
  },

  /**
   * Obtiene los responsables de un usuario
   */
  obtenerResponsablesDeUsuario: function(idUsuario) {
    if (!idUsuario) return [];
    var all = Utils.findAllRecordsBy(CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS, 'IDUsuario', idUsuario);
    return all.filter(function(r) { return String(r.Activo).toUpperCase() === 'SI'; });
  },

  /**
   * Crea un usuario administrativo o técnico
   */
  crearUsuarioAdmin: function(datos, solicitanteSession) {
    if (!datos) throw new Error('Datos requeridos');

    var rol = (datos.rol || '').trim();
    if (rol !== CONFIG.ROLES.ADMINISTRADOR && rol !== CONFIG.ROLES.RECEPCION && rol !== CONFIG.ROLES.TECNICO) {
      throw new Error('Rol inválido. Debe ser Administrador, Recepcion o Tecnico.');
    }

    var nombre = (datos.nombre || '').trim();
    if (!nombre) throw new Error('El nombre es obligatorio.');

    var email = (datos.correo || datos.email || '').trim().toLowerCase();
    if (!Utils.isValidEmail(email)) throw new Error('Correo electrónico inválido.');

    var password = String(datos.password || datos.contrasena || '');
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

    return Utils.withScriptLock(function() {
      var existente = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS_ADMIN, 'Correo', email);
      if (existente) {
        throw new Error('Ya existe un usuario administrativo con el correo ' + email);
      }

      var salt = Utils.generateSalt(16);
      var hash = Utils.hashPassword(password, salt);
      var prefijoId = (rol === CONFIG.ROLES.ADMINISTRADOR) ? 'ADM' : ((rol === CONFIG.ROLES.RECEPCION) ? 'REC' : 'TEC');
      var adminId = Utils.generateId(prefijoId);

      var nuevoAdmin = {
        IDAdmin: adminId,
        Nombre: nombre,
        Correo: email,
        Telefono: (datos.telefono || '').trim(),
        PasswordHash: hash,
        PasswordSalt: salt,
        Rol: rol,
        Activo: 'SI',
        FechaCreacion: Utils.formatDateTime(),
        CreadoPor: solicitanteSession ? solicitanteSession.email : 'Sistema'
      };

      Utils.appendRecord(CONFIG.SHEETS.USUARIOS_ADMIN, nuevoAdmin);
      Utils.logAction('CREAR_USUARIO_ADMIN', 'Usuario creado: ' + email + ' (' + rol + ')', solicitanteSession ? solicitanteSession.email : 'Sistema');

      return Utils.success({
        idAdmin: adminId,
        nombre: nombre,
        correo: email,
        rol: rol
      }, 'Usuario ' + rol + ' creado exitosamente.');
    });
  },

  /**
   * Lista usuarios administrativos (sin hashes)
   */
  listarUsuariosAdmin: function() {
    var users = Utils.getAllRecords(CONFIG.SHEETS.USUARIOS_ADMIN);
    return users.map(function(u) {
      return {
        idAdmin: u.IDAdmin,
        nombre: u.Nombre,
        correo: u.Correo,
        telefono: u.Telefono,
        rol: u.Rol,
        activo: u.Activo,
        fechaCreacion: u.FechaCreacion,
        creadoPor: u.CreadoPor
      };
    });
  },

  /**
   * Cambia el estado activo/inactivo de un usuario admin/técnico
   */
  cambiarEstadoAdmin: function(idAdmin, nuevoEstado, solicitanteSession) {
    var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS_ADMIN, 'IDAdmin', idAdmin);
    if (!user) throw new Error('Usuario administrativo no encontrado');

    Utils.updateRecordRow(CONFIG.SHEETS.USUARIOS_ADMIN, user._rowIndex, {
      Activo: nuevoEstado ? 'SI' : 'NO'
    });

    Utils.logAction('CAMBIO_ESTADO_ADMIN', 'Usuario ' + user.Correo + ' cambiado a ' + (nuevoEstado ? 'SI' : 'NO'), solicitanteSession.email);
    return Utils.success(null, 'Estado actualizado correctamente');
  },

  /**
   * Busca clientes por criterio (para autocompletado en creación de orden y NFC)
   */
  buscarClientes: function(query) {
    if (!query) return [];
    var q = Utils.normalizeText(query);
    var clientes = Utils.getAllRecords(CONFIG.SHEETS.USUARIOS);
    var filtrados = clientes.filter(function(c) {
      return (
        Utils.normalizeText(c.NombreORazonSocial).indexOf(q) !== -1 ||
        Utils.normalizeText(c.Correo).indexOf(q) !== -1 ||
        Utils.normalizeText(c.Telefono).indexOf(q) !== -1 ||
        Utils.normalizeText(c.IDUsuario).indexOf(q) !== -1
      );
    });

    return filtrados.slice(0, 15).map(function(c) {
      return {
        idUsuario: c.IDUsuario,
        nombre: c.NombreORazonSocial,
        correo: c.Correo,
        telefono: c.Telefono,
        tipoUsuario: c.TipoUsuario,
        puntosActuales: Number(c.PuntosActuales) || 0,
        activo: c.Activo
      };
    });
  },

  /**
   * Lista técnicos activos para combos de asignación
   */
  listarTecnicosActivos: function() {
    var admins = Utils.getAllRecords(CONFIG.SHEETS.USUARIOS_ADMIN);
    return admins.filter(function(a) {
      return (a.Rol === CONFIG.ROLES.TECNICO || a.Rol === CONFIG.ROLES.ADMINISTRADOR) && String(a.Activo).toUpperCase() === 'SI';
    }).map(function(a) {
      return {
        idAdmin: a.IDAdmin,
        nombre: a.Nombre,
        correo: a.Correo,
        rol: a.Rol
      };
    });
  }
};

/** Funciones públicas API **/

function apiRegistrarUsuario(datos) {
  try {
    return Usuarios.registrarUsuario(datos);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiCrearUsuarioAdmin(token, datos) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Usuarios.crearUsuarioAdmin(datos, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiListarUsuariosAdmin(token) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Utils.success(Usuarios.listarUsuariosAdmin());
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiCambiarEstadoAdmin(token, idAdmin, nuevoEstado) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Usuarios.cambiarEstadoAdmin(idAdmin, nuevoEstado, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiBuscarClientes(token, query) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.RECEPCION, CONFIG.ROLES.TECNICO]);
    return Utils.success(Usuarios.buscarClientes(query));
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiListarTecnicosActivos(token) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.RECEPCION, CONFIG.ROLES.TECNICO]);
    return Utils.success(Usuarios.listarTecnicosActivos());
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiObtenerResponsablesDeUsuario(token, idUsuario) {
  try {
    Auth.validateSession(token);
    return Utils.success(Usuarios.obtenerResponsablesDeUsuario(idUsuario));
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiAgregarResponsable(token, datos) {
  try {
    var session = Auth.validateSession(token);
    var idUsuario = (session.role === CONFIG.ROLES.ADMINISTRADOR && datos.idUsuario) ? datos.idUsuario : session.userId;
    var id = Usuarios.agregarResponsable(idUsuario, datos);
    return Utils.success({ idResponsable: id }, 'Responsable agregado exitosamente');
  } catch (e) {
    return Utils.error(e.message);
  }
}
