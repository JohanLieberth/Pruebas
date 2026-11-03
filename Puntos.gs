/**
 * Puntos.gs - Programa de fidelidad de clientes, catálogo de recompensas y panel NFC
 */

var Puntos = {

  /**
   * Obtiene el catálogo de recompensas activas
   */
  obtenerCatalogoRecompensas: function() {
    var recs = Utils.getAllRecords(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
    var activas = recs.filter(function(r) { return String(r.Activo).toUpperCase() === 'SI'; });

    activas.sort(function(a, b) {
      var ordA = Number(a.Orden) || 999;
      var ordB = Number(b.Orden) || 999;
      if (ordA !== ordB) return ordA - ordB;
      return (Number(a.PuntosRequeridos) || 0) - (Number(b.PuntosRequeridos) || 0);
    });

    return activas.map(function(r) {
      return {
        idRecompensa: r.IDRecompensa,
        nombre: r.Nombre,
        puntosRequeridos: Number(r.PuntosRequeridos) || 0,
        descripcion: r.Descripcion,
        activo: r.Activo,
        orden: Number(r.Orden) || 1
      };
    });
  },

  /**
   * Obtiene el resumen de puntos de un usuario y sus movimientos
   */

  /**
   * Lista todas las recompensas para el Administrador (activas e inactivas)
   */
  listarTodasRecompensasAdmin: function() {
    var recs = Utils.getAllRecords(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
    recs.sort(function(a, b) {
      var ordA = Number(a.Orden) || 999;
      var ordB = Number(b.Orden) || 999;
      if (ordA !== ordB) return ordA - ordB;
      return (Number(a.PuntosRequeridos) || 0) - (Number(b.PuntosRequeridos) || 0);
    });

    return recs.map(function(r) {
      return {
        idRecompensa: r.IDRecompensa,
        nombre: r.Nombre,
        puntosRequeridos: Number(r.PuntosRequeridos) || 0,
        descripcion: r.Descripcion,
        activo: String(r.Activo || 'SI').toUpperCase() === 'SI' ? 'SI' : 'NO',
        orden: Number(r.Orden) || 1
      };
    });
  },

  /**
   * Guarda o actualiza una recompensa en la base de datos (Persistente en Sheet RecompensasPuntos)
   * Si viene idRecompensa existente, actualiza; si no, crea una nueva con ID único REC-XXX.
   */
  guardarRecompensa: function(datos, session) {
    if (!datos) throw new Error('Datos de recompensa requeridos');

    var nombre = String(datos.nombre || '').trim();
    if (!nombre || nombre.length < 3) {
      throw new Error('El nombre de la recompensa es obligatorio (mínimo 3 caracteres).');
    }

    var puntos = parseInt(datos.puntosRequeridos, 10);
    if (isNaN(puntos) || puntos <= 0) {
      throw new Error('El costo en puntos debe ser un número entero mayor a 0.');
    }

    var descripcion = String(datos.descripcion || '').trim();
    var activo = String(datos.activo || 'SI').trim().toUpperCase() === 'SI' ? 'SI' : 'NO';
    var orden = parseInt(datos.orden, 10);
    if (isNaN(orden) || orden < 1) orden = 1;

    var idRecompensa = datos.idRecompensa ? String(datos.idRecompensa).trim() : '';

    return Utils.withScriptLock(function() {
      var sheet = getSheet(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
      var recExistente = idRecompensa ? Utils.findRecordBy(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, 'IDRecompensa', idRecompensa) : null;

      if (recExistente) {
        var updates = {
          Nombre: nombre,
          PuntosRequeridos: puntos,
          Descripcion: descripcion,
          Activo: activo,
          Orden: orden
        };
        Utils.updateRecordRow(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, recExistente._rowIndex, updates);
        Utils.logAction('EDITAR_RECOMPENSA', 'Recompensa ' + idRecompensa + ' (' + nombre + ') actualizada por ' + session.email, session.email);

        return Utils.success({
          idRecompensa: idRecompensa,
          nombre: nombre,
          puntosRequeridos: puntos,
          descripcion: descripcion,
          activo: activo,
          orden: orden
        }, 'Recompensa "' + nombre + '" actualizada con éxito.');
      } else {
        var allRecs = Utils.getAllRecords(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
        var maxNum = 0;
        for (var i = 0; i < allRecs.length; i++) {
          var idStr = String(allRecs[i].IDRecompensa || '').trim();
          var match = idStr.match(/^REC-(\d+)$/i);
          if (match) {
            var n = parseInt(match[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
        var nextNum = maxNum + 1;
        var nuevoId = 'REC-' + ('000' + nextNum).slice(-3);

        var nuevoRegistro = {
          IDRecompensa: nuevoId,
          Nombre: nombre,
          PuntosRequeridos: puntos,
          Descripcion: descripcion,
          Activo: activo,
          Orden: orden
        };

        Utils.appendRecord(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, nuevoRegistro);
        Utils.logAction('CREAR_RECOMPENSA', 'Recompensa ' + nuevoId + ' (' + nombre + ') creada por ' + session.email, session.email);

        return Utils.success(nuevoRegistro, 'Nueva recompensa "' + nombre + '" creada con éxito.');
      }
    });
  },

  /**
   * Cambia el estado Activo (SI / NO) de una recompensa existente
   */
  cambiarEstadoRecompensa: function(idRecompensa, nuevoEstadoActivo, session) {
    if (!idRecompensa) throw new Error('ID de recompensa requerido');
    var estado = nuevoEstadoActivo ? 'SI' : 'NO';

    return Utils.withScriptLock(function() {
      var rec = Utils.findRecordBy(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, 'IDRecompensa', idRecompensa);
      if (!rec) throw new Error('Recompensa no encontrada');

      Utils.updateRecordRow(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, rec._rowIndex, { Activo: estado });
      Utils.logAction('CAMBIO_ESTADO_RECOMPENSA', 'Recompensa ' + idRecompensa + ' cambiada a ' + estado + ' por ' + session.email, session.email);

      return Utils.success({ idRecompensa: idRecompensa, activo: estado }, 'Estado de la recompensa actualizado a ' + estado);
    });
  },

  obtenerPuntosYMovimientos: function(idUsuario) {
    if (!idUsuario) throw new Error('ID de usuario requerido');

    var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'IDUsuario', idUsuario);
    if (!user) throw new Error('Usuario no encontrado');

    var movimientos = Utils.findAllRecordsBy(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS, 'IDUsuario', idUsuario);
    movimientos.sort(function(a, b) {
      return (b.FechaHora || '').localeCompare(a.FechaHora || '');
    });

    var catalogo = Puntos.obtenerCatalogoRecompensas();

    return {
      idUsuario: user.IDUsuario,
      nombre: user.NombreORazonSocial,
      correo: user.Correo,
      telefono: user.Telefono,
      puntosActuales: Number(user.PuntosActuales) || 0,
      movimientos: movimientos.map(function(m) {
        return {
          idMovimiento: m.IDMovimiento,
          tipoMovimiento: m.TipoMovimiento,
          puntos: Number(m.Puntos) || 0,
          saldoAnterior: Number(m.SaldoAnterior) || 0,
          saldoNuevo: Number(m.SaldoNuevo) || 0,
          motivo: m.Motivo,
          fechaHora: m.FechaHora,
          usuarioAdmin: m.UsuarioAdmin
        };
      }),
      catalogoRecompensas: catalogo
    };
  },

  /**
   * Asigna puntos a un usuario (por compras, reparaciones o cortesía)
   * Usa LockService para prevenir carreras en el saldo
   */
  asignarPuntos: function(idUsuario, puntosAñadir, motivo, idOrden, idDispositivo, adminSession) {
    var pts = parseInt(puntosAñadir, 10);
    if (isNaN(pts) || pts <= 0) {
      throw new Error('La cantidad de puntos a asignar debe ser un número entero mayor a 0.');
    }
    if (!motivo || motivo.trim().length < 3) {
      throw new Error('Se requiere un motivo para la asignación de puntos.');
    }

    return Utils.withScriptLock(function() {
      var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'IDUsuario', idUsuario);
      if (!user) throw new Error('Usuario no encontrado');

      var saldoAnterior = Number(user.PuntosActuales) || 0;
      var saldoNuevo = saldoAnterior + pts;
      var nowStr = Utils.formatDateTime();

      // Actualizar puntos del usuario
      Utils.updateRecordRow(CONFIG.SHEETS.USUARIOS, user._rowIndex, {
        PuntosActuales: saldoNuevo
      });

      // Registrar movimiento
      var movId = Utils.generateId('MOV');
      Utils.appendRecord(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS, {
        IDMovimiento: movId,
        IDUsuario: idUsuario,
        Correo: user.Correo,
        Telefono: user.Telefono,
        TipoMovimiento: CONFIG.TIPOS_MOVIMIENTO_PUNTOS.ASIGNACION,
        Puntos: pts,
        SaldoAnterior: saldoAnterior,
        SaldoNuevo: saldoNuevo,
        Motivo: motivo.trim(),
        IDOrden: idOrden || '',
        IDDispositivo: idDispositivo || '',
        UsuarioAdmin: adminSession ? adminSession.email : 'Admin',
        FechaHora: nowStr
      });

      Utils.logAction('ASIGNAR_PUNTOS', 'Asignados +' + pts + ' puntos a ' + user.Correo + '. Nuevo saldo: ' + saldoNuevo, adminSession ? adminSession.email : 'Admin');

      return Utils.success({
        idUsuario: idUsuario,
        puntosAsignados: pts,
        saldoAnterior: saldoAnterior,
        saldoNuevo: saldoNuevo
      }, 'Se asignaron +' + pts + ' puntos exitosamente al cliente.');
    });
  },

  /**
   * Realiza el canje de puntos por una recompensa del catálogo
   * Valida saldo suficiente y no permite saldo negativo
   */
  canjearPuntos: function(idUsuario, idRecompensa, motivoOpcional, adminSession) {
    if (!idUsuario) throw new Error('ID de usuario requerido');
    if (!idRecompensa) throw new Error('ID de recompensa requerida');

    return Utils.withScriptLock(function() {
      var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'IDUsuario', idUsuario);
      if (!user) throw new Error('Usuario no encontrado');

      var recompensa = Utils.findRecordBy(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, 'IDRecompensa', idRecompensa);
      if (!recompensa) throw new Error('Recompensa no encontrada');
      if (String(recompensa.Activo).toUpperCase() !== 'SI') {
        throw new Error('Esta recompensa ya no se encuentra activa en el catálogo.');
      }

      var puntosRequeridos = Number(recompensa.PuntosRequeridos) || 0;
      var saldoActual = Number(user.PuntosActuales) || 0;

      if (saldoActual < puntosRequeridos) {
        throw new Error('Saldo de puntos insuficiente. El cliente tiene ' + saldoActual + ' puntos y requiere ' + puntosRequeridos + ' puntos.');
      }

      var saldoNuevo = saldoActual - puntosRequeridos;
      var nowStr = Utils.formatDateTime();

      // Actualizar puntos del usuario
      Utils.updateRecordRow(CONFIG.SHEETS.USUARIOS, user._rowIndex, {
        PuntosActuales: saldoNuevo
      });

      var motivoFinal = 'Canje de recompensa: ' + recompensa.Nombre + (motivoOpcional ? ' (' + motivoOpcional + ')' : '');

      // Registrar movimiento
      var movId = Utils.generateId('MOV');
      Utils.appendRecord(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS, {
        IDMovimiento: movId,
        IDUsuario: idUsuario,
        Correo: user.Correo,
        Telefono: user.Telefono,
        TipoMovimiento: CONFIG.TIPOS_MOVIMIENTO_PUNTOS.CANJE,
        Puntos: -puntosRequeridos,
        SaldoAnterior: saldoActual,
        SaldoNuevo: saldoNuevo,
        Motivo: motivoFinal,
        IDOrden: '',
        IDDispositivo: '',
        UsuarioAdmin: adminSession ? adminSession.email : 'Admin',
        FechaHora: nowStr
      });

      Utils.logAction('CANJE_PUNTOS', 'Canje de ' + puntosRequeridos + ' pts por ' + recompensa.Nombre + ' para ' + user.Correo + '. Nuevo saldo: ' + saldoNuevo, adminSession ? adminSession.email : 'Admin');

      return Utils.success({
        idUsuario: idUsuario,
        recompensaNombre: recompensa.Nombre,
        puntosCanjeados: puntosRequeridos,
        saldoAnterior: saldoActual,
        saldoNuevo: saldoNuevo
      }, 'Canje exitoso de "' + recompensa.Nombre + '". Se descontaron ' + puntosRequeridos + ' puntos.');
    });
  },

  /**
   * Asocia una etiqueta NFC física (código UID) a un usuario cliente
   */
  asociarEtiquetaNFC: function(idUsuario, codigoNFC, adminSession) {
    if (!idUsuario) throw new Error('ID de usuario requerido');
    if (!codigoNFC) throw new Error('Código NFC requerido');

    var nfcLimpio = String(codigoNFC).trim().toUpperCase().replace(/[^0-9A-F:]/g, '');
    if (nfcLimpio.length < 4) {
      throw new Error('El código o UID de la tarjeta NFC no es válido.');
    }

    return Utils.withScriptLock(function() {
      var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'IDUsuario', idUsuario);
      if (!user) throw new Error('Usuario no encontrado');

      // Desactivar asociaciones previas de este código si existían
      var existentes = Utils.findAllRecordsBy(CONFIG.SHEETS.ETIQUETAS_NFC, 'CodigoNFC', nfcLimpio);
      for (var i = 0; i < existentes.length; i++) {
        Utils.updateRecordRow(CONFIG.SHEETS.ETIQUETAS_NFC, existentes[i]._rowIndex, { Activo: 'NO' });
      }

      // Desactivar tarjetas previas activas de este usuario
      var tarjetasUsuario = Utils.findAllRecordsBy(CONFIG.SHEETS.ETIQUETAS_NFC, 'IDUsuario', idUsuario);
      for (var j = 0; j < tarjetasUsuario.length; j++) {
        Utils.updateRecordRow(CONFIG.SHEETS.ETIQUETAS_NFC, tarjetasUsuario[j]._rowIndex, { Activo: 'NO' });
      }

      var idNfc = Utils.generateId('NFC');
      var nowStr = Utils.formatDateTime();

      var nuevaAsociacion = {
        IDNFC: idNfc,
        CodigoNFC: nfcLimpio,
        IDUsuario: idUsuario,
        Activo: 'SI',
        FechaAsignacion: nowStr,
        AsignadoPor: adminSession ? adminSession.email : 'Admin'
      };

      Utils.appendRecord(CONFIG.SHEETS.ETIQUETAS_NFC, nuevaAsociacion);

      Utils.logAction('ASIGNAR_NFC', 'Tarjeta NFC ' + nfcLimpio + ' asignada al usuario ' + user.Correo, adminSession ? adminSession.email : 'Admin');

      return Utils.success({
        idNfc: idNfc,
        codigoNFC: nfcLimpio,
        usuario: user.NombreORazonSocial,
        correo: user.Correo
      }, 'Etiqueta NFC vinculada con éxito al cliente.');
    });
  },

  /**
   * Busca y obtiene el cliente asociado a una tarjeta NFC por su código UID
   */
  buscarClientePorNFC: function(codigoNFC) {
    if (!codigoNFC) throw new Error('Código NFC no proporcionado');

    var nfcLimpio = String(codigoNFC).trim().toUpperCase().replace(/[^0-9A-F:]/g, '');
    var nfcRec = Utils.findRecordBy(CONFIG.SHEETS.ETIQUETAS_NFC, 'CodigoNFC', nfcLimpio);

    if (!nfcRec || String(nfcRec.Activo).toUpperCase() !== 'SI') {
      throw new Error('No hay ningún cliente activo vinculado con este código NFC (' + nfcLimpio + ').');
    }

    var user = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'IDUsuario', nfcRec.IDUsuario);
    if (!user) throw new Error('El usuario asociado a esta tarjeta no existe o fue eliminado.');

    var detalle = Puntos.obtenerPuntosYMovimientos(user.IDUsuario);
    detalle.codigoNFC = nfcLimpio;
    detalle.fechaAsignacionNFC = nfcRec.FechaAsignacion;

    return detalle;
  }
};

/** Funciones públicas API **/

function apiObtenerCatalogoRecompensas() {
  try {
    return Utils.success(Puntos.obtenerCatalogoRecompensas());
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiListarRecompensasAdmin(token) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Utils.success(Puntos.listarTodasRecompensasAdmin());
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiGuardarRecompensa(token, datos) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Puntos.guardarRecompensa(datos, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiCambiarEstadoRecompensa(token, idRecompensa, nuevoEstadoActivo) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Puntos.cambiarEstadoRecompensa(idRecompensa, nuevoEstadoActivo, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}


function apiObtenerMisPuntos(token) {
  try {
    var session = Auth.validateSession(token);
    var res = Puntos.obtenerPuntosYMovimientos(session.userId);
    return Utils.success(res);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiObtenerPuntosUsuarioAdmin(token, idUsuario) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    var res = Puntos.obtenerPuntosYMovimientos(idUsuario);
    return Utils.success(res);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiAsignarPuntos(token, idUsuario, puntos, motivo, idOrden, idDispositivo) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Puntos.asignarPuntos(idUsuario, puntos, motivo, idOrden, idDispositivo, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiCanjearPuntos(token, idUsuario, idRecompensa, motivo) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Puntos.canjearPuntos(idUsuario, idRecompensa, motivo, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiAsociarEtiquetaNFC(token, idUsuario, codigoNFC) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Puntos.asociarEtiquetaNFC(idUsuario, codigoNFC, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiBuscarClientePorNFC(token, codigoNFC) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    var res = Puntos.buscarClientePorNFC(codigoNFC);
    return Utils.success(res);
  } catch (e) {
    return Utils.error(e.message);
  }
}
