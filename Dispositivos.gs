/**
 * Dispositivos.gs - Gestión de estatus, diagnósticos, técnicos, costos y entregas parciales
 */

var Dispositivos = {

  /**
   * Actualiza el estatus de un dispositivo con validaciones estrictas de rol
   * Si es Técnico: solo Pendiente, En reparación, Pruebas, Listo
   * Si es Administrador: todos (incluyendo Entregado y Cancelado)
   */
  cambiarEstatus: function(idDispositivo, nuevoEstatus, comentario, session) {
    if (!idDispositivo) throw new Error('ID de dispositivo requerido');
    if (!nuevoEstatus) throw new Error('Nuevo estatus requerido');

    var esAdmin = (session.role === CONFIG.ROLES.ADMINISTRADOR || session.role === CONFIG.ROLES.RECEPCION);
    var esTecnico = (session.role === CONFIG.ROLES.TECNICO);

    if (!esAdmin && !esTecnico) {
      throw new Error('No tienes permisos para modificar el estatus de un dispositivo');
    }

    // Validar estatus permitidos según el rol
    if (esTecnico) {
      if (CONFIG.ESTATUS_TECNICO.indexOf(nuevoEstatus) === -1) {
        throw new Error('Como técnico solo puedes establecer los estatus: ' + CONFIG.ESTATUS_TECNICO.join(', '));
      }
    } else {
      if (CONFIG.ESTATUS_TODOS.indexOf(nuevoEstatus) === -1) {
        throw new Error('Estatus no válido: ' + nuevoEstatus);
      }
    }

    return Utils.withScriptLock(function() {
      var dev = Utils.findRecordBy(CONFIG.SHEETS.DISPOSITIVOS, 'IDDispositivo', idDispositivo);
      if (!dev) throw new Error('Dispositivo no encontrado');

      // Si es técnico, debe estar asignado a él
      if (esTecnico) {
        if (dev.IDTecnicoAsignado !== session.userId &&
            dev.TecnicoAsignado.toLowerCase() !== session.name.toLowerCase() &&
            dev.TecnicoAsignado.toLowerCase() !== session.email.toLowerCase()) {
          throw new Error('Acceso denegado: Este dispositivo no está asignado a tu usuario.');
        }
      }

      var estatusAnterior = dev.Estatus;
      if (estatusAnterior === nuevoEstatus) {
        return Utils.success(null, 'El dispositivo ya tiene el estatus ' + nuevoEstatus);
      }

      var nowStr = Utils.formatDateTime();
      var updates = {
        Estatus: nuevoEstatus,
        FechaHoraEstatus: nowStr
      };

      if (nuevoEstatus === CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO) {
        updates.FechaEntrega = nowStr;
        updates.EntregadoParcial = 'SI';
      }

      Utils.updateRecordRow(CONFIG.SHEETS.DISPOSITIVOS, dev._rowIndex, updates);

      // Registrar en HistorialEstatus
      Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_ESTATUS, {
        IDHistorial: Utils.generateId('HST'),
        IDDispositivo: idDispositivo,
        IDOrden: dev.IDOrden,
        EstatusAnterior: estatusAnterior,
        EstatusNuevo: nuevoEstatus,
        Comentario: comentario || ('Cambio de estatus a ' + nuevoEstatus),
        UsuarioCambio: session.email,
        RolUsuario: session.role,
        FechaHora: nowStr
      });

      // Recalcular el estado general de la orden
      Dispositivos.recalcularEstadoOrden(dev.IDOrden);

      // Si la transición es a "Listo" y el estatus anterior no era "Listo", notificar al cliente por correo
      if (nuevoEstatus === CONFIG.ESTATUS_DISPOSITIVO.LISTO && estatusAnterior !== CONFIG.ESTATUS_DISPOSITIVO.LISTO) {
        try {
          var ordenAsociada = Utils.findRecordBy(CONFIG.SHEETS.ORDENES_SERVICIO, 'IDOrden', dev.IDOrden);
          if (ordenAsociada) {
            // Combinar dev con updates para pasar los datos más recientes
            var devActualizado = Object.assign({}, dev, updates);
            Correos.enviarCorreoDispositivoListo(devActualizado, ordenAsociada);
          }
        } catch (errNotifListo) {
          Logger.log('Advertencia: No se pudo enviar notificación de equipo listo: ' + errNotifListo.message);
        }
      }

      Utils.logAction('CAMBIO_ESTATUS', 'Dispositivo ' + idDispositivo + ' pasó de ' + estatusAnterior + ' a ' + nuevoEstatus, session.email);

      return Utils.success({
        idDispositivo: idDispositivo,
        estatusNuevo: nuevoEstatus,
        fechaHoraEstatus: nowStr
      }, 'Estatus actualizado a ' + nuevoEstatus);
    });
  },

  /**
   * Modifica costos de un dispositivo (estimado y/o final) y audita en HistorialCostos
   * Solo Administrador
   */
  modificarCosto: function(idDispositivo, nuevoCostoEstimado, nuevoCostoFinal, motivo, session) {
    if (!idDispositivo) throw new Error('ID de dispositivo requerido');
    if (!motivo || motivo.trim().length < 3) {
      throw new Error('Es obligatorio especificar el motivo del cambio de costo (mínimo 3 caracteres).');
    }

    return Utils.withScriptLock(function() {
      var dev = Utils.findRecordBy(CONFIG.SHEETS.DISPOSITIVOS, 'IDDispositivo', idDispositivo);
      if (!dev) throw new Error('Dispositivo no encontrado');

      var costoEstimadoActual = Number(dev.CostoEstimado) || 0;
      var costoFinalActual = dev.CostoFinal !== '' ? Number(dev.CostoFinal) : null;
      var costoAnteriorAplicado = (costoFinalActual !== null) ? costoFinalActual : costoEstimadoActual;

      var updates = {};
      if (nuevoCostoEstimado !== undefined && nuevoCostoEstimado !== null && nuevoCostoEstimado !== '') {
        updates.CostoEstimado = Math.max(0, Number(nuevoCostoEstimado) || 0);
      }
      if (nuevoCostoFinal !== undefined && nuevoCostoFinal !== null && nuevoCostoFinal !== '') {
        updates.CostoFinal = Math.max(0, Number(nuevoCostoFinal) || 0);
      } else if (nuevoCostoFinal === '') {
        updates.CostoFinal = '';
      }

      Utils.updateRecordRow(CONFIG.SHEETS.DISPOSITIVOS, dev._rowIndex, updates);

      var costoNuevoAplicado = (updates.CostoFinal !== undefined && updates.CostoFinal !== '') ?
        updates.CostoFinal : (updates.CostoEstimado !== undefined ? updates.CostoEstimado : costoAnteriorAplicado);

      var nowStr = Utils.formatDateTime();

      // Guardar en HistorialCostos
      Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_COSTOS, {
        IDHistorialCosto: Utils.generateId('HCS'),
        IDDispositivo: idDispositivo,
        CostoAnterior: costoAnteriorAplicado,
        CostoNuevo: costoNuevoAplicado,
        Motivo: motivo.trim(),
        UsuarioCambio: session.email,
        FechaHora: nowStr
      });

      // Recalcular totales de la orden de servicio
      Dispositivos.recalcularEstadoOrden(dev.IDOrden);

      Utils.logAction('MODIFICAR_COSTO', 'Costo de ' + idDispositivo + ' cambiado de $' + costoAnteriorAplicado + ' a $' + costoNuevoAplicado + '. Motivo: ' + motivo, session.email);

      return Utils.success({
        idDispositivo: idDispositivo,
        costoEstimado: updates.CostoEstimado !== undefined ? updates.CostoEstimado : costoEstimadoActual,
        costoFinal: updates.CostoFinal !== undefined ? updates.CostoFinal : (costoFinalActual || ''),
        totalACobrar: costoNuevoAplicado
      }, 'Costo actualizado e ingresado al historial de auditoría.');
    });
  },

  /**
   * Realiza la entrega parcial de un dispositivo individual
   * Marca Estatus="Entregado", FechaEntrega=now, EntregadoParcial="SI",
   * actualiza TotalCobrado y Saldo, y recalcula el Estado general de la orden
   */
  entregarDispositivoParcial: function(idDispositivo, comentario, session) {
    if (!idDispositivo) throw new Error('ID de dispositivo requerido');

    return Utils.withScriptLock(function() {
      var dev = Utils.findRecordBy(CONFIG.SHEETS.DISPOSITIVOS, 'IDDispositivo', idDispositivo);
      if (!dev) throw new Error('Dispositivo no encontrado');

      if (dev.Estatus === CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO) {
        throw new Error('Este dispositivo ya fue marcado como Entregado anteriormente.');
      }

      var nowStr = Utils.formatDateTime();
      var updates = {
        Estatus: CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO,
        FechaHoraEstatus: nowStr,
        FechaEntrega: nowStr,
        EntregadoParcial: 'SI'
      };

      Utils.updateRecordRow(CONFIG.SHEETS.DISPOSITIVOS, dev._rowIndex, updates);

      // Historial
      Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_ESTATUS, {
        IDHistorial: Utils.generateId('HST'),
        IDDispositivo: idDispositivo,
        IDOrden: dev.IDOrden,
        EstatusAnterior: dev.Estatus,
        EstatusNuevo: CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO,
        Comentario: comentario || 'Entrega parcial individual de equipo al cliente',
        UsuarioCambio: session.email,
        RolUsuario: session.role,
        FechaHora: nowStr
      });

      // Recalcular orden
      var ordenInfo = Dispositivos.recalcularEstadoOrden(dev.IDOrden);

      Utils.logAction('ENTREGA_PARCIAL', 'Dispositivo ' + idDispositivo + ' entregado individualmente. Orden: ' + dev.FolioOrden, session.email);

      return Utils.success({
        idDispositivo: idDispositivo,
        estatus: CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO,
        fechaEntrega: nowStr,
        ordenActualizada: ordenInfo
      }, 'Dispositivo marcado como entregado satisfactoriamente.');
    });
  },

  /**
   * Actualiza diagnóstico, asignación de técnico u observaciones generales
   */
  actualizarDetallesDispositivo: function(idDispositivo, datos, session) {
    if (!idDispositivo) throw new Error('ID de dispositivo requerido');

    return Utils.withScriptLock(function() {
      var dev = Utils.findRecordBy(CONFIG.SHEETS.DISPOSITIVOS, 'IDDispositivo', idDispositivo);
      if (!dev) throw new Error('Dispositivo no encontrado');

      var updates = {};
      if (datos.diagnostico !== undefined) updates.Diagnostico = String(datos.diagnostico).trim();
      if (datos.fallaReportada !== undefined) updates.FallaReportada = String(datos.fallaReportada).trim();
      if (datos.observaciones !== undefined) updates.Observaciones = String(datos.observaciones).trim();

      // Asignación de técnico (solo admin)
      if (datos.idTecnicoAsignado !== undefined && session.role === CONFIG.ROLES.ADMINISTRADOR) {
        updates.IDTecnicoAsignado = datos.idTecnicoAsignado;
        updates.TecnicoAsignado = datos.tecnicoAsignado || '';
      }

      Utils.updateRecordRow(CONFIG.SHEETS.DISPOSITIVOS, dev._rowIndex, updates);
      return Utils.success(updates, 'Datos del dispositivo actualizados.');
    });
  },

  /**
   * Recalcula el Estado de la Orden (Abierta, Parcial, Completada, Cancelada)
   * y los importes totales: TotalEstimado, TotalCobrado, Saldo
   */
  recalcularEstadoOrden: function(idOrden) {
    var orden = Utils.findRecordBy(CONFIG.SHEETS.ORDENES_SERVICIO, 'IDOrden', idOrden);
    if (!orden) return null;

    var dispositivos = Utils.findAllRecordsBy(CONFIG.SHEETS.DISPOSITIVOS, 'IDOrden', idOrden);
    if (dispositivos.length === 0) return orden;

    var totalOrden = 0;
    var totalCobrado = 0;
    var countEntregados = 0;
    var countCancelados = 0;
    var countTotal = dispositivos.length;

    for (var i = 0; i < dispositivos.length; i++) {
      var d = dispositivos[i];
      var costo = (d.CostoFinal !== '' && d.CostoFinal !== null && d.CostoFinal !== undefined) ?
        Number(d.CostoFinal) : Number(d.CostoEstimado || 0);

      if (d.Estatus !== CONFIG.ESTATUS_DISPOSITIVO.CANCELADO) {
        totalOrden += costo;
      }

      if (d.Estatus === CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO) {
        countEntregados++;
        totalCobrado += costo;
      } else if (d.Estatus === CONFIG.ESTATUS_DISPOSITIVO.CANCELADO) {
        countCancelados++;
      }
    }

    var saldo = Math.max(0, totalOrden - totalCobrado);

    // Determinar estado de la orden
    var nuevoEstadoOrden = CONFIG.ESTADOS_ORDEN.ABIERTA;
    if (countCancelados === countTotal) {
      nuevoEstadoOrden = CONFIG.ESTADOS_ORDEN.CANCELADA;
    } else if (countEntregados + countCancelados === countTotal) {
      nuevoEstadoOrden = CONFIG.ESTADOS_ORDEN.COMPLETADA;
    } else if (countEntregados > 0) {
      nuevoEstadoOrden = CONFIG.ESTADOS_ORDEN.PARCIAL;
    } else {
      nuevoEstadoOrden = CONFIG.ESTADOS_ORDEN.ABIERTA;
    }

    var updates = {
      EstadoOrden: nuevoEstadoOrden,
      TotalEstimado: totalOrden,
      TotalCobrado: totalCobrado,
      Saldo: saldo,
      FechaActualizacion: Utils.formatDateTime()
    };

    Utils.updateRecordRow(CONFIG.SHEETS.ORDENES_SERVICIO, orden._rowIndex, updates);

    return {
      idOrden: idOrden,
      folio: orden.Folio,
      estadoOrden: nuevoEstadoOrden,
      totalEstimado: totalOrden,
      totalCobrado: totalCobrado,
      saldo: saldo
    };
  },

  /**
   * Lista los dispositivos asignados al técnico en sesión con buscador por folio, cliente, teléfono, serie
   */
  listarDispositivosParaTecnico: function(session, filtroTexto) {
    var dispositivos = Utils.getAllRecords(CONFIG.SHEETS.DISPOSITIVOS);
    var ordenes = Utils.getAllRecords(CONFIG.SHEETS.ORDENES_SERVICIO);

    var ordenesMap = {};
    for (var i = 0; i < ordenes.length; i++) {
      ordenesMap[ordenes[i].IDOrden] = ordenes[i];
    }

    // Filtrar solo los asignados al técnico
    var asignados = dispositivos.filter(function(d) {
      return (
        d.IDTecnicoAsignado === session.userId ||
        (d.TecnicoAsignado && d.TecnicoAsignado.toLowerCase() === session.name.toLowerCase()) ||
        (d.TecnicoAsignado && d.TecnicoAsignado.toLowerCase() === session.email.toLowerCase())
      );
    });

    var q = filtroTexto ? Utils.normalizeText(filtroTexto) : '';

    var filtrados = asignados.filter(function(d) {
      var ord = ordenesMap[d.IDOrden] || {};

      if (!q) return true;

      if (Utils.normalizeText(d.FolioOrden).indexOf(q) !== -1) return true;
      if (Utils.normalizeText(d.NumeroSerie).indexOf(q) !== -1) return true;
      if (Utils.normalizeText(d.Modelo).indexOf(q) !== -1) return true;
      if (Utils.normalizeText(d.Marca).indexOf(q) !== -1) return true;
      if (Utils.normalizeText(ord.NombreCliente).indexOf(q) !== -1) return true;
      if (Utils.normalizeText(ord.TelefonoContacto).indexOf(q) !== -1) return true;

      return false;
    });

    return filtrados.map(function(d) {
      var ord = ordenesMap[d.IDOrden] || {};
      var costo = (d.CostoFinal !== '' && d.CostoFinal !== null && d.CostoFinal !== undefined) ?
        Number(d.CostoFinal) : Number(d.CostoEstimado || 0);

      return {
        idDispositivo: d.IDDispositivo,
        idOrden: d.IDOrden,
        folioOrden: d.FolioOrden,
        clienteNombre: ord.NombreCliente || 'N/A',
        clienteTelefono: ord.TelefonoContacto || 'N/A',
        tipoDispositivo: d.TipoDispositivo,
        marca: d.Marca,
        modelo: d.Modelo,
        numeroSerie: d.NumeroSerie,
        fallaReportada: d.FallaReportada,
        diagnostico: d.Diagnostico,
        estatus: d.Estatus,
        costoEstimado: Number(d.CostoEstimado) || 0,
        costoFinal: d.CostoFinal !== '' ? Number(d.CostoFinal) : '',
        totalACobrar: costo,
        fechaRecepcion: d.FechaRecepcion,
        fechaHoraEstatus: d.FechaHoraEstatus,
        observaciones: d.Observaciones
      };
    });
  },

  /**
   * Obtiene el historial de estatus y costos de un dispositivo
   */
  obtenerHistorialesDispositivo: function(idDispositivo) {
    var estatusHist = Utils.findAllRecordsBy(CONFIG.SHEETS.HISTORIAL_ESTATUS, 'IDDispositivo', idDispositivo);
    var costosHist = Utils.findAllRecordsBy(CONFIG.SHEETS.HISTORIAL_COSTOS, 'IDDispositivo', idDispositivo);

    return {
      historialEstatus: estatusHist.sort(function(a, b) { return (b.FechaHora || '').localeCompare(a.FechaHora || ''); }),
      historialCostos: costosHist.sort(function(a, b) { return (b.FechaHora || '').localeCompare(a.FechaHora || ''); })
    };
  }
};

/** Funciones públicas API **/

function apiCambiarEstatusDispositivo(token, idDispositivo, nuevoEstatus, comentario) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.RECEPCION, CONFIG.ROLES.TECNICO]);
    return Dispositivos.cambiarEstatus(idDispositivo, nuevoEstatus, comentario, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiModificarCostoDispositivo(token, idDispositivo, nuevoCostoEstimado, nuevoCostoFinal, motivo) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR]);
    return Dispositivos.modificarCosto(idDispositivo, nuevoCostoEstimado, nuevoCostoFinal, motivo, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiEntregarDispositivoParcial(token, idDispositivo, comentario) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.RECEPCION]);
    return Dispositivos.entregarDispositivoParcial(idDispositivo, comentario, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiActualizarDetallesDispositivo(token, idDispositivo, datos) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.RECEPCION, CONFIG.ROLES.TECNICO]);
    return Dispositivos.actualizarDetallesDispositivo(idDispositivo, datos, session);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiListarDispositivosTecnico(token, filtroTexto) {
  try {
    var session = Auth.requireRole(token, [CONFIG.ROLES.TECNICO, CONFIG.ROLES.ADMINISTRADOR]);
    var list = Dispositivos.listarDispositivosParaTecnico(session, filtroTexto);
    return Utils.success(list);
  } catch (e) {
    return Utils.error(e.message);
  }
}

function apiObtenerHistorialesDispositivo(token, idDispositivo) {
  try {
    Auth.requireRole(token, [CONFIG.ROLES.ADMINISTRADOR, CONFIG.ROLES.RECEPCION, CONFIG.ROLES.TECNICO, 'ClienteNormal', 'ClienteTaller']);
    var res = Dispositivos.obtenerHistorialesDispositivo(idDispositivo);
    return Utils.success(res);
  } catch (e) {
    return Utils.error(e.message);
  }
}
