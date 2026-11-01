/**
 * Utils.gs - Funciones de utilidad, seguridad, formato, LockService y logging
 */

var Utils = {

  /**
   * Respuesta estándar exitosa
   */
  success: function(data, message) {
    return {
      success: true,
      data: (data !== undefined) ? data : null,
      message: message || 'Operación realizada exitosamente'
    };
  },

  /**
   * Respuesta estándar de error
   */
  error: function(message, code) {
    return {
      success: false,
      data: null,
      error: message || 'Ocurrió un error inesperado',
      code: code || 'ERROR_GENERAL'
    };
  },

  /**
   * Genera un UUID v4 o identificador único con prefijo
   */
  generateId: function(prefix) {
    var raw = Utilities.getUuid();
    return (prefix ? prefix + '-' : '') + raw.substring(0, 8) + '-' + raw.substring(9, 13);
  },

  /**
   * Formatea fecha actual a string local ISO/Legible: YYYY-MM-DD HH:mm:ss
   */
  formatDateTime: function(date) {
    var d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyy-MM-dd HH:mm:ss');
  },

  /**
   * Formatea fecha corta: YYYY-MM-DD
   */
  formatDateShort: function(date) {
    var d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyy-MM-dd');
  },

  /**
   * Genera una cadena de salt criptográfico aleatorio
   */
  generateSalt: function(length) {
    length = length || 16;
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    var salt = '';
    for (var i = 0; i < length; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  },

  /**
   * Genera hash SHA-256 de contraseña con salt
   */
  hashPassword: function(password, salt) {
    if (!password) throw new Error('Contraseña requerida para hashing');
    var input = String(password) + String(salt);
    var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
    var hashHex = '';
    for (var i = 0; i < rawHash.length; i++) {
      var byteVal = rawHash[i];
      if (byteVal < 0) byteVal += 256;
      var byteHex = byteVal.toString(16);
      if (byteHex.length === 1) byteHex = '0' + byteHex;
      hashHex += byteHex;
    }
    return hashHex;
  },

  /**
   * Valida email con formato estándar
   */
  isValidEmail: function(email) {
    if (!email || typeof email !== 'string') return false;
    var re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email.trim());
  },

  /**
   * Valida teléfono (al menos 8 dígitos numéricos)
   */
  isValidPhone: function(phone) {
    if (!phone) return false;
    var digits = String(phone).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  },

  /**
   * Limpia y normaliza cadenas de texto para búsqueda insensible a acentos/mayúsculas
   */
  normalizeText: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  },

  /**
   * Convierte una fila de encabezados y un array de filas en un array de objetos
   */
  sheetRowsToObjects: function(headers, rows) {
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      // Si la fila está totalmente vacía, saltar
      var isEmpty = true;
      for (var k = 0; k < row.length; k++) {
        if (row[k] !== '' && row[k] !== null && row[k] !== undefined) {
          isEmpty = false;
          break;
        }
      }
      if (isEmpty) continue;

      var obj = { _rowIndex: i + 2 }; // índice 1-based en el sheet (encabezado en fila 1)
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j];
        var val = row[j];
        if (val instanceof Date) {
          obj[key] = Utils.formatDateTime(val);
        } else {
          obj[key] = (val !== undefined && val !== null) ? val : '';
        }
      }
      result.push(obj);
    }
    return result;
  },

  /**
   * Lee una hoja completa y retorna array de objetos con sus nombres de columna
   */
  getAllRecords: function(nombreHoja) {
    var sheet = getSheet(nombreHoja);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];

    var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows = data.slice(1);
    return Utils.sheetRowsToObjects(headers, rows);
  },

  /**
   * Encuentra una fila por el valor de una columna y retorna objeto con _rowIndex
   */
  findRecordBy: function(nombreHoja, columnName, value) {
    var sheet = getSheet(nombreHoja);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return null;

    var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var colIdx = headers.indexOf(columnName);
    if (colIdx === -1) return null;

    var target = String(value).trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      var rowVal = String(data[i][colIdx] || '').trim().toLowerCase();
      if (rowVal === target) {
        var obj = { _rowIndex: i + 1 };
        for (var j = 0; j < headers.length; j++) {
          var val = data[i][j];
          obj[headers[j]] = (val instanceof Date) ? Utils.formatDateTime(val) : val;
        }
        return obj;
      }
    }
    return null;
  },

  /**
   * Encuentra múltiples filas por el valor de una columna
   */
  findAllRecordsBy: function(nombreHoja, columnName, value) {
    var records = Utils.getAllRecords(nombreHoja);
    var target = String(value).trim().toLowerCase();
    return records.filter(function(r) {
      return String(r[columnName] || '').trim().toLowerCase() === target;
    });
  },

  /**
   * Actualiza celdas de una fila en una hoja según un mapa de campos { Columna: NuevoValor }
   */
  updateRecordRow: function(nombreHoja, rowIndex, updates) {
    var sheet = getSheet(nombreHoja);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).trim();
    });

    for (var key in updates) {
      if (updates.hasOwnProperty(key)) {
        var colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(updates[key]);
        }
      }
    }
  },

  /**
   * Agrega un nuevo registro al final de la hoja respetando el orden de encabezados
   */
  appendRecord: function(nombreHoja, dataObj) {
    var sheet = getSheet(nombreHoja);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).trim();
    });

    var rowValues = [];
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      var val = (dataObj[h] !== undefined && dataObj[h] !== null) ? dataObj[h] : '';
      rowValues.push(val);
    }

    sheet.appendRow(rowValues);
    SpreadsheetApp.flush();
    return sheet.getLastRow();
  },

  /**
   * Ejecuta una función dentro de un Lock exclusivo con timeout seguro
   */
  withScriptLock: function(fn) {
    var lock = LockService.getScriptLock();
    var hasLock = false;
    try {
      hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
      if (!hasLock) {
        throw new Error('El sistema está ocupado procesando otra transacción concurrente. Por favor intenta de nuevo en unos segundos.');
      }
      return fn();
    } finally {
      if (hasLock) {
        try {
          lock.releaseLock();
        } catch (e) {
          // ignore
        }
      }
    }
  },

  /**
   * Registra un log en la hoja Logs
   */
  logAction: function(accion, detalle, usuario) {
    try {
      var entry = {
        IDLog: Utils.generateId('LOG'),
        Accion: accion,
        Detalle: typeof detalle === 'object' ? JSON.stringify(detalle) : String(detalle || ''),
        Usuario: usuario || 'Sistema',
        FechaHora: Utils.formatDateTime()
      };
      Utils.appendRecord(CONFIG.SHEETS.LOGS, entry);
    } catch (e) {
      Logger.log('Error escribiendo en hoja Logs: ' + e.message);
    }
  }
};
