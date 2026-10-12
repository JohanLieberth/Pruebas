/**
 * Control Machete - CRUD and Management for Subdirecciones
 */

function obtenerSubdirecciones(token) {
  try {
    var session = requireAuth(token);
    var list = getSheetObjects('Subdirecciones');

    var data = list.map(function(s) {
      return {
        SubdireccionID: s.SubdireccionID,
        Nombre: s.Nombre,
        Activa: String(s.Activa).toUpperCase() === 'TRUE' || s.Activa === true,
        FechaCreacion: s.FechaCreacion
      };
    });

    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function guardarSubdireccion(token, subdireccionData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    if (!subdireccionData.nombre || subdireccionData.nombre.trim() === '') {
      return { success: false, message: 'El nombre de la subdirección es obligatorio.' };
    }

    var sheet = getSheetSafe('Subdirecciones');
    var list = getSheetObjects('Subdirecciones');
    var isEdit = !!subdireccionData.subdireccionID;

    // Check duplicate name
    for (var i = 0; i < list.length; i++) {
      if (list[i].Nombre.toLowerCase().trim() === subdireccionData.nombre.toLowerCase().trim()) {
        if (!isEdit || list[i].SubdireccionID !== subdireccionData.subdireccionID) {
          return { success: false, message: 'Ya existe una subdirección con ese nombre.' };
        }
      }
    }

    if (isEdit) {
      var target = null;
      for (var j = 0; j < list.length; j++) {
        if (list[j].SubdireccionID === subdireccionData.subdireccionID) {
          target = list[j];
          break;
        }
      }

      if (!target) {
        return { success: false, message: 'Subdirección no encontrada.' };
      }

      sheet.getRange(target._rowIndex, 2).setValue(subdireccionData.nombre.trim());
      sheet.getRange(target._rowIndex, 3).setValue(subdireccionData.activa !== false);

      logAccion(session.email, 'Editar Subdirección', 'Subdirección editada: ' + subdireccionData.nombre);
      return { success: true, message: 'Subdirección actualizada exitosamente.' };
    } else {
      var newID = 'SUB-' + ('000' + (list.length + 1)).slice(-3);
      sheet.appendRow([
        newID,
        subdireccionData.nombre.trim(),
        subdireccionData.activa !== false,
        new Date().toISOString()
      ]);

      logAccion(session.email, 'Crear Subdirección', 'Nueva subdirección agregada: ' + subdireccionData.nombre);
      return { success: true, message: 'Subdirección creada exitosamente.' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoSubdireccion(token, subdireccionID, activa) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var session = requireAuth(token, 'administrador');

    var list = getSheetObjects('Subdirecciones');
    var target = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].SubdireccionID === subdireccionID) {
        target = list[i];
        break;
      }
    }

    if (!target) {
      return { success: false, message: 'Subdirección no encontrada.' };
    }

    var sheet = getSheetSafe('Subdirecciones');
    sheet.getRange(target._rowIndex, 3).setValue(activa);

    logAccion(session.email, 'Cambiar Estado Subdirección', 'Subdirección ' + subdireccionID + ' activa: ' + activa);
    return { success: true, message: 'Estado de subdirección modificado.' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
