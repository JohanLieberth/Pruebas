/**
 * Ordenes.gs - Gestión de órdenes de servicio, folios únicos multi-dispositivo y consultas
 */

var Ordenes = {

  /**
   * Genera el siguiente folio secuencial único con formato OS-YYYYMMDD-####
   * Usa LockService para prevenir duplicados en concurrencia
   */
  generarSiguienteFolio: function() {
    var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyyMMdd');
    var prefix = 'OS-' + todayStr + '-';

    var ordenes = Utils.getAllRecords(CONFIG.SHEETS.ORDENES_SERVICIO);
    var maxConsecutivo = 0;

    for (var i = 0; i < ordenes.length; i++) {
      var folio = String(ordenes[i].Folio || '').trim();
      if (folio.indexOf(prefix) === 0) {
        var numStr = folio.substring(prefix.length);
        var num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxConsecutivo) {
          maxConsecutivo = num;
        }
      }
    }

    var nextNum = maxConsecutivo + 1;
    var padded = ('0000' + nextNum).slice(-4);
    return prefix + padded;
  },

  /**
   * Crea una orden de servicio con múltiples dispositivos
   */
  crearOrden: function(payload, solicitanteSession) {
    if (!payload) throw new Error('Datos de la orden no proporcionados');

    var idUsuario = (payload.idUsuario || '').trim();
    var tipoUsuario = (payload.tipoUsuario || CONFIG.TIPOS_CLIENTE.NORMAL).trim();
    var nombreCliente = (payload.nombreCliente || '').trim();
    var correo = (payload.correoContacto || '').trim().toLowerCase();
    var telefono = (payload.telefonoContacto || '').trim();
    var idResponsable = (payload.idResponsable || '').trim();
    var observaciones = (payload.observaciones || '').trim();
    var dispositivos = payload.dispositivos;

    if (!nombreCliente) throw new Error('El nombre del cliente es obligatorio');
    if (!dispositivos || !Array.isArray(dispositivos) || dispositivos.length === 0) {
      throw new Error('La orden de servicio debe contener al menos un dispositivo.');
    }

    // Si el usuario existe en base de datos, validar y asociar
    if (idUsuario) {
      var userDb = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'IDUsuario', idUsuario);
      if (userDb) {
        tipoUsuario = userDb.TipoUsuario;
        if (!nombreCliente) nombreCliente = userDb.NombreORazonSocial;
        if (!correo) correo = userDb.Correo;
        if (!telefono) telefono = userDb.Telefono;
      }
    } else if (correo) {
      // Intentar vincular por correo si ya existe
      var userByMail = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'Correo', correo);
      if (userByMail) {
        idUsuario = userByMail.IDUsuario;
        tipoUsuario = userByMail.TipoUsuario;
      }
    }

    return Utils.withScriptLock(function() {
      var folio = Ordenes.generarSiguienteFolio();
      var idOrden = Utils.generateId('ORD');
      var nowStr = Utils.formatDateTime();

      var totalEstimado = 0;
      var dispositivosCreados = [];

      // Validar y preparar dispositivos
      for (var i = 0; i < dispositivos.length; i++) {
        var d = dispositivos[i];
        var tipoDisp = (d.tipoDispositivo || d.tipo || 'Consola').trim();
        var marca = (d.marca || '').trim();
        var modelo = (d.modelo || '').trim();
        var serie = (d.numeroSerie || d.serie || '').trim();
        var color = (d.color || '').trim();
        var accesorios = (d.accesorios || 'Sin accesorios').trim();
        var falla = (d.fallaReportada || d.falla || 'Diagnóstico general').trim();
        var costoEstimado = Number(d.costoEstimado) || 0;
        var idTecnico = (d.idTecnicoAsignado || '').trim();
        var tecnicoNombre = (d.tecnicoAsignado || '').trim();

        if (costoEstimado < 0) costoEstimado = 0;
        totalEstimado += costoEstimado;

        var idDispositivo = Utils.generateId('DEV');

        var dispObj = {
          IDDispositivo: idDispositivo,
          IDOrden: idOrden,
          FolioOrden: folio,
          TipoDispositivo: tipoDisp,
          Marca: marca,
          Modelo: modelo,
          NumeroSerie: serie,
          Color: color,
          Accesorios: accesorios,
          FallaReportada: falla,
          Diagnostico: d.diagnostico || 'En espera de revisión técnica inicial',
          Estatus: CONFIG.ESTATUS_DISPOSITIVO.PENDIENTE,
          IDTecnicoAsignado: idTecnico,
          TecnicoAsignado: tecnicoNombre,
          CostoEstimado: costoEstimado,
          CostoFinal: d.costoFinal !== undefined && d.costoFinal !== '' ? Number(d.costoFinal) : '',
          FechaRecepcion: nowStr,
          FechaHoraEstatus: nowStr,
          FechaEntrega: '',
          EntregadoParcial: 'NO',
          Observaciones: d.observaciones || ''
        };

        Utils.appendRecord(CONFIG.SHEETS.DISPOSITIVOS, dispObj);
        dispositivosCreados.push(dispObj);

        // Registrar estatus inicial en HistorialEstatus
        Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_ESTATUS, {
          IDHistorial: Utils.generateId('HST'),
          IDDispositivo: idDispositivo,
          IDOrden: idOrden,
          EstatusAnterior: 'Nuevo',
          EstatusNuevo: CONFIG.ESTATUS_DISPOSITIVO.PENDIENTE,
          Comentario: 'Recepción inicial del equipo en taller',
          UsuarioCambio: solicitanteSession ? solicitanteSession.email : 'Admin',
          RolUsuario: solicitanteSession ? solicitanteSession.role : 'Sistema',
          FechaHora: nowStr
        });

        // Registrar costo inicial en HistorialCostos si se estableció
        if (costoEstimado > 0) {
          Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_COSTOS, {
            IDHistorialCosto: Utils.generateId('HCS'),
            IDDispositivo: idDispositivo,
            CostoAnterior: 0,
            CostoNuevo: costoEstimado,
            Motivo: 'Presupuesto inicial estimado al ingreso',
            UsuarioCambio: solicitanteSession ? solicitanteSession.email : 'Admin',
            FechaHora: nowStr
          });
        }
      }

      // Registro principal de la orden
      var ordenObj = {
        IDOrden: idOrden,
        Folio: folio,
        IDUsuario: idUsuario,
        TipoUsuario: tipoUsuario,
        NombreCliente: nombreCliente,
        CorreoContacto: correo,
        TelefonoContacto: telefono,
        IDResponsable: idResponsable,
        EstadoOrden: CONFIG.ESTADOS_ORDEN.ABIERTA,
        Observaciones: observaciones,
        TotalEstimado: totalEstimado,
        TotalCobrado: 0,
        Saldo: totalEstimado,
        FechaCreacion: nowStr,
        FechaActualizacion: nowStr,
        CreadoPor: solicitanteSession ? solicitanteSession.email : 'Admin'
      };

      Utils.appendRecord(CONFIG.SHEETS.ORDENES_SERVICIO, ordenObj);

      // Enviar correo de alta de orden de servicio al cliente (con datos tipo ticket)
      try {
        if (correo) {
          Correos.enviarCorreoOrdenServicio(ordenObj, dispositivosCreados);
        }
      } catch (errCorreo) {
        Logger.log('Advertencia: No se pudo enviar correo de confirmación de orden: ' + errCorreo.message);
      }

      Utils.logAction('CREAR_ORDEN', 'Orden ' + folio + ' creada con ' + dispositivosCreados.length + ' dispositivos', solicitanteSession ? solicitanteSession.email : 'Admin');

      return Utils.success({
        idOrden: idOrden,
        folio: folio,
        totalEstimado: totalEstimado,
        dispositivosCount: dispositivosCreados.length
      }, 'Orden de servicio ' + folio + ' registrada con éxito.');
    });
  },

  /**
   * Lista todas las órdenes para el portal de administración con datos consolidados
   */
  listarOrdenesAdmin: function(filtroTexto, estadoFiltro) {
    var ordenes = Utils.getAllRecords(CONFIG.SHEETS.ORDENES_SERVICIO);
    var dispositivos = Utils.getAllRecords(CONFIG.SHEETS.DISPOSITIVOS);

    // Mapear dispositivos por orden
    var dispPorOrden = {};
    for (var i = 0; i < dispositivos.length; i++) {
      var d = dispositivos[i];
      var ordId = d.IDOrden;
      if (!dispPorOrden[ordId]) dispPorOrden[ordId] = [];
      dispPorOrden[ordId].push(d);
    }

    var q = filtroTexto ? Utils.normalizeText(filtroTexto) : '';
    var estado = estadoFiltro ? String(estadoFiltro).trim().toLowerCase() : '';

    var resultado = [];
    for (var j = 0; j < ordenes.length; j++) {
      var ord = ordenes[j];
      var listaDisp = dispPorOrden[ord.IDOrden] || [];

      // Filtro de estado
      if (estado && estado !== 'todos' && String(ord.EstadoOrden).toLowerCase() !== estado) {
        continue;
      }

      // Filtro de búsqueda (folio, cliente, teléfono, número de serie de sus dispositivos)
      if (q) {
        var match = false;
        if (Utils.normalizeText(ord.Folio).indexOf(q) !== -1) match = true;
        if (Utils.normalizeText(ord.NombreCliente).indexOf(q) !== -1) match = true;
        if (Utils.normalizeText(ord.TelefonoContacto).indexOf(q) !== -1) match = true;
        if (Utils.normalizeText(ord.CorreoContacto).indexOf(q) !== -1) match = true;

        if (!match) {
          for (var k = 0; k < listaDisp.length; k++) {
            var dev = listaDisp[k];
            if (Utils.normalizeText(dev.NumeroSerie).indexOf(q) !== -1 ||
                Utils.normalizeText(dev.Modelo).indexOf(q) !== -1 ||
                Utils.normalizeText(dev.Marca).indexOf(q) !== -1) {
              match = true;
              break;
            }
          }
        }

        if (!match) continue;
      }

      resultado.push({
        idOrden: ord.IDOrden,
        folio: ord.Folio,
        idUsuario: ord.IDUsuario,
        tipoUsuario: ord.TipoUsuario,
        nombreCliente: ord.NombreCliente,
        telefonoContacto: ord.TelefonoContacto,
        correoContacto: ord.CorreoContacto,
        estadoOrden: ord.EstadoOrden,
        totalEstimado: Number(ord.TotalEstimado) || 0,
        totalCobrado: Number(ord.TotalCobrado) || 0,
        saldo: Number(ord.Saldo) || 0,
        fechaCreacion: ord.FechaCreacion,
        fechaActualizacion: ord.FechaActualizacion,
        totalDispositivos: listaDisp.length,
        dispositivos: listaDisp
      });
    }

    // Ordenar de más reciente a más antigua
    resultado.sort(function(a, b) {
      return (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '');
    });

    return resultado;
  },

  /**
   * Obtiene el detalle completo de una orden con todos sus dispositivos e historial
   */
  obtenerDetalleOrden: function(idOrden) {
    if (!idOrden) throw new Error('ID de orden no proporcionado');

    var orden = Utils.findRecordBy(CONFIG.SHEETS.ORDENES_SERVICIO, 'IDOrden', idOrden);
    if (!orden) {
      // Intentar por folio
      orden = Utils.findRecordBy(CONFIG.SHEETS.ORDENES_SERVICIO, 'Folio', idOrden);
    }
    if (!orden) throw new Error('Orden de servicio no encontrada');

    var dispositivos = Utils.findAllRecordsBy(CONFIG.SHEETS.DISPOSITIVOS, 'IDOrden', orden.IDOrden);

    // Mapear dispositivos con total a cobrar individual
    var dispositivosDetalle = dispositivos.map(function(d) {
      var costo = (d.CostoFinal !== '' && d.CostoFinal !== null && d.CostoFinal !== undefined) ?
        Number(d.CostoFinal) : Number(d.CostoEstimado || 0);

      return {
        idDispositivo: d.IDDispositivo,
        idOrden: d.IDOrden,
        folioOrden: d.FolioOrden,
        tipoDispositivo: d.TipoDispositivo,
        marca: d.Marca,
        modelo: d.Modelo,
        numeroSerie: d.NumeroSerie,
        color: d.Color,
        accesorios: d.Accesorios,
        fallaReportada: d.FallaReportada,
        diagnostico: d.Diagnostico,
        estatus: d.Estatus,
        idTecnicoAsignado: d.IDTecnicoAsignado,
        tecnicoAsignado: d.TecnicoAsignado,
        costoEstimado: Number(d.CostoEstimado) || 0,
        costoFinal: d.CostoFinal !== '' ? Number(d.CostoFinal) : '',
        totalACobrar: costo,
        fechaRecepcion: d.FechaRecepcion,
        fechaHoraEstatus: d.FechaHoraEstatus,
        fechaEntrega: d.FechaEntrega,
        entregadoParcial: d.EntregadoParcial,
        observaciones: d.Observaciones
      };
    });

    return {
      orden: {
        idOrden: orden.IDOrden,
        folio: orden.Folio,
        idUsuario: orden.IDUsuario,
        tipoUsuario: orden.TipoUsuario,
        nombreCliente: orden.NombreCliente,
        correoContacto: orden.CorreoContacto,
        telefonoContacto: orden.TelefonoContacto,
        idResponsable: orden.IDResponsable,
        estadoOrden: orden.EstadoOrden,
        observaciones: orden.Observaciones,
        totalEstimado: Number(orden.TotalEstimado) || 0,
        totalCobrado: Number(orden.TotalCobrado) || 0,
        saldo: Number(orden.Saldo) || 0,
        fechaCreacion: orden.FechaCreacion,
        fechaActualizacion: orden.FechaActualizacion,
        creadoPor: orden.CreadoPor
      },
      dispositivos: dispositivosDetalle
    };
  },

  /**
   * Consulta pública de estatus sin registro (filtrada por folio, correo, teléfono o número de serie)
   * Devuelve sólo información no sensible
   */
  consultarPublica: function(criterio) {
    if (!criterio || typeof criterio !== 'string') {
      throw new Error('Ingresa un folio, correo, teléfono o número de serie.');
    }

    var q = Utils.normalizeText(criterio);
    if (q.length < 3) {
      throw new Error('El término de búsqueda debe tener al menos 3 caracteres.');
    }

    var ordenes = Utils.getAllRecords(CONFIG.SHEETS.ORDENES_SERVICIO);
    var dispositivos = Utils.getAllRecords(CONFIG.SHEETS.DISPOSITIVOS);

    var matchingOrdenIds = {};

    // 1. Buscar en órdenes
    for (var i = 0; i < ordenes.length; i++) {
      var o = ordenes[i];
      if (
        Utils.normalizeText(o.Folio) === q ||
        Utils.normalizeText(o.Folio).indexOf(q) !== -1 ||
        Utils.normalizeText(o.CorreoContacto) === q ||
        Utils.normalizeText(o.TelefonoContacto).replace(/\D/g, '') === q.replace(/\D/g, '')
      ) {
        matchingOrdenIds[o.IDOrden] = true;
      }
    }

    // 2. Buscar en dispositivos por número de serie
    for (var j = 0; j < dispositivos.length; j++) {
      var dev = dispositivos[j];
      if (Utils.normalizeText(dev.NumeroSerie) === q || Utils.normalizeText(dev.NumeroSerie).indexOf(q) !== -1) {
        matchingOrdenIds[dev.IDOrden] = true;
      }
    }

    var ids = Object.keys(matchingOrdenIds);
    if (ids.length === 0) {
      return [];
    }

    var resultados = [];
    for (var k = 0; k < ids.length; k++) {
      var ordId = ids[k];
      var ord = null;
      for (var x = 0; x < ordenes.length; x++) {
        if (ordenes[x].IDOrden === ordId) {
          ord = ordenes[x];
          break;
        }
      }
      if (!ord) continue;

      var devs = dispositivos.filter(function(d) { return d.IDOrden === ordId; });

      var devsPublicos = devs.map(function(d) {
        var estaListo = (d.Estatus === CONFIG.ESTATUS_DISPOSITIVO.LISTO);
        var estaEntregado = (d.Estatus === CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO);

        return {
          tipoDispositivo: d.TipoDispositivo,
          marca: d.Marca,
          modelo: d.Modelo,
          numeroSerie: d.NumeroSerie ? (d.NumeroSerie.substring(0, 3) + '****' + d.NumeroSerie.slice(-3)) : 'N/A',
          fallaReportada: d.FallaReportada,
          estatus: d.Estatus,
          fechaHoraEstatus: d.FechaHoraEstatus,
          fechaRecepcion: d.FechaRecepcion,
          estaListo: estaListo,
          estaEntregado: estaEntregado,
          mensajePublico: estaListo ? '¡Tu equipo está listo para entrega!' :
                          (estaEntregado ? 'Equipo entregado' : 'Tu equipo está en proceso de atención en taller.')
        };
      });

      // Primer nombre del cliente para confirmación visual sin revelar apellido completo ni datos sensibles
      var primerNombre = (ord.NombreCliente || '').split(' ')[0] || 'Cliente';

      resultados.push({
        folio: ord.Folio,
        clienteNombreParcial: primerNombre,
        estadoOrden: ord.EstadoOrden,
        fechaCreacion: ord.FechaCreacion,
        dispositivos: devsPublicos
      });
    }

    return resultados;
  },

  /**
   * Obtiene las órdenes completas de un usuario cliente autenticado
   */
  obtenerOrdenesDeUsuario: function(idUsuario, emailUsuario) {
    var ordenes = Utils.getAllRecords(CONFIG.SHEETS.ORDENES_SERVICIO);
    var dispositivos = Utils.getAllRecords(CONFIG.SHEETS.DISPOSITIVOS);

    var cleanMail = emailUsuario ? emailUsuario.trim().toLowerCase() : '';

    var misOrdenes = ordenes.filter(function(o) {
      return (idUsuario && o.IDUsuario === idUsuario) ||
             (cleanMail && String(o.CorreoContacto || '').trim().toLowerCase() === cleanMail);
    });

    return misOrdenes.map(function(o) {
      var devs = dispositivos.filter(function(d) { return d.IDOrden === o.IDOrden; });
      return {
        idOrden: o.IDOrden,
        folio: o.Folio,
        estadoOrden: o.EstadoOrden,
        totalEstimado: Number(o.TotalEstimado) || 0,
        totalCobrado: Number(o.TotalCobrado) || 0,
        saldo: Number(o.Saldo) || 0,
        fechaCreacion: o.FechaCreacion,
        dispositivos: devs.map(function(d) {
          var costo = (d.CostoFinal !== '' && d.CostoFinal !== null && d.CostoFinal !== undefined) ?
            Number(d.CostoFinal) : Number(d.CostoEstimado || 0);
          return {
            idDispositivo: d.IDDispositivo,
            tipoDispositivo: d.TipoDispositivo,
            marca: d.Marca,
            modelo: d.Modelo,
            numeroSerie: d.NumeroSerie,
            fallaReportada: d.FallaReportada,
            diagnostico: d.Diagnostico,
            estatus: d.Estatus,
            costo: costo,
            fechaHoraEstatus: d.FechaHoraEstatus,
            entregadoParcial: d.EntregadoParcial
          };
        })
      };
    });
  }
};

/** Funciones públicas API **/

function apiCrearOrden(token, payload) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Ordenes.crearOrden(payload, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiListarOrdenesAdmin(token, filtroTexto, estadoFiltro) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    var list = Ordenes.listarOrdenesAdmin(filtroTexto, estadoFiltro);
    return Utils.success(list);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiObtenerDetalleOrden(token, idOrden) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.TECNICO, 'ClienteNormal', 'ClienteTaller']);
    var detalle = Ordenes.obtenerDetalleOrden(idOrden);
    return Utils.success(detalle);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiConsultarPublica(criterio) {
  try {
    var resultados = Ordenes.consultarPublica(criterio);
    return Utils.success(resultados);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiObtenerMisOrdenes(token) {
  try {
    var session = Auth.validateSession(token);
    var ordenes = Ordenes.obtenerOrdenesDeUsuario(session.userId, session.email);
    return Utils.success(ordenes);
  } catch (e) {
    return Utils.error(e.message);
  }
}
