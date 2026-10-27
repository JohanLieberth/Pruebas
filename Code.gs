/**
 * App de Registro - Tarjeta de Mujeres (Mujeres Seguras, Mérida, Yucatán)
 * Código del Servidor (Code.gs)
 */

// Nombres de las hojas en la base de datos de Google Sheets
const SHEETS = {
  CONFIG: 'Config',
  BLOQUEADAS: 'CURPs_Bloqueadas',
  REGISTROS: 'Registros',
  UBICACIONES: 'Ubicaciones'
};

/**
 * Función Principal de Enrutamiento doGet
 */
function doGet(e) {
  // Inicializar base de datos si no existe
  inicializarBaseDatos();

  let vista = (e && e.parameter && e.parameter.v) ? e.parameter.v.toLowerCase() : 'index';

  let templateName = 'Index';
  let title = 'Tarjeta de Mujeres — Mujeres Seguras, Mérida, Yucatán';

  if (vista === 'registro') {
    templateName = 'Registro';
    title = 'Formulario de Registro — Tarjeta de Mujeres';
  } else if (vista === 'admin') {
    templateName = 'Admin';
    title = 'Panel Administrador — Tarjeta de Mujeres';
  }

  const template = HtmlService.createTemplateFromFile(templateName);
  template.scriptUrl = getScriptUrl();

  return template.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Obtiene la URL ejecutable del Web App
 */
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    return '';
  }
}

/**
 * Obtiene o crea la Hoja de Cálculo asociada
 */
function getSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const properties = PropertiesService.getScriptProperties();
    const ssId = properties.getProperty('SPREADSHEET_ID');
    if (ssId) {
      try {
        ss = SpreadsheetApp.openById(ssId);
      } catch (e) {
        ss = null;
      }
    }
    if (!ss) {
      ss = SpreadsheetApp.create('BD_Mujeres_Seguras_Merida');
      properties.setProperty('SPREADSHEET_ID', ss.getId());
    }
  }
  return ss;
}

/**
 * Inicialización Automática de la Base de Datos en Google Sheets
 */
function inicializarBaseDatos() {
  const ss = getSpreadsheet();

  // 1. Hoja Config
  let sheetConfig = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(SHEETS.CONFIG);
    sheetConfig.appendRow(['Clave', 'Valor']);
    const defaultConfig = [
      ['FECHA_INICIO', '2025-01-01T00:00'],
      ['FECHA_FIN', '2025-12-31T23:59'],
      ['MODO', 'auto'], // auto / manual
      ['ABIERTO', 'SI'], // SI / NO
      ['ADMIN_USER', 'admin'],
      ['ADMIN_PASS', 'admin123'],
      ['CONTACTO_EMAIL', 'contacto@mujeresseguras.merida.gob.mx'],
      ['CONTACTO_TELEFONO', '999 924 4000']
    ];
    sheetConfig.getRange(2, 1, defaultConfig.length, 2).setValues(defaultConfig);
  }

  // 2. Hoja CURPs_Bloqueadas
  let sheetBloqueadas = ss.getSheetByName(SHEETS.BLOQUEADAS);
  if (!sheetBloqueadas) {
    sheetBloqueadas = ss.insertSheet(SHEETS.BLOQUEADAS);
    sheetBloqueadas.appendRow(['CURP', 'Motivo', 'FechaBloqueo']);
  }

  // 3. Hoja Registros
  let sheetRegistros = ss.getSheetByName(SHEETS.REGISTROS);
  if (!sheetRegistros) {
    sheetRegistros = ss.insertSheet(SHEETS.REGISTROS);
    sheetRegistros.appendRow([
      'ID', 'CURP', 'Email', 'NombreCompleto', 'TipoUbicacion',
      'ColoniaComisaria', 'Calle', 'Numero', 'CodigoPostal', 'DireccionCompleta',
      'INE_URL', 'Comprobante_URL', 'Estatus', 'Observaciones', 'NoTarjetaAsignada',
      'LugarEntrega', 'FechaHoraEntrega', 'FechaRegistro', 'UltimaActualizacion'
    ]);
  }

  // 4. Hoja Ubicaciones
  let sheetUbicaciones = ss.getSheetByName(SHEETS.UBICACIONES);
  if (!sheetUbicaciones) {
    sheetUbicaciones = ss.insertSheet(SHEETS.UBICACIONES);
    sheetUbicaciones.appendRow(['Tipo', 'Nombre']);

    // Catálogo inicial de Mérida y comisarías
    const ubicacionesIniciales = [
      // Comisarías de Mérida
      ['Comisaría', 'Caucel'],
      ['Comisaría', 'Chablekal'],
      ['Comisaría', 'Cholul'],
      ['Comisaría', 'Chuburná de Hidalgo (Comisaría)'],
      ['Comisaría', 'Cosgaya'],
      ['Comisaría', 'Dzununcán'],
      ['Comisaría', 'Komchén'],
      ['Comisaría', 'Molas'],
      ['Comisaría', 'San Antonio Xluch'],
      ['Comisaría', 'San José Tzal'],
      ['Comisaría', 'Sitpach'],
      ['Comisaría', 'Temozón Norte'],
      ['Comisaría', 'Tixcacal'],
      ['Comisaría', 'Xcanatún'],
      ['Comisaría', 'Yaxché Casares'],
      // Colonias urbanas de Mérida
      ['Colonia', 'Altabrisa'],
      ['Colonia', 'Benito Juárez Norte'],
      ['Colonia', 'Campestre'],
      ['Colonia', 'Centro'],
      ['Colonia', 'Chuburná de Hidalgo'],
      ['Colonia', 'Ciudad Caucel'],
      ['Colonia', 'García Ginerés'],
      ['Colonia', 'Itzimná'],
      ['Colonia', 'Kalia'],
      ['Colonia', 'Las Américas'],
      ['Colonia', 'Los Pinos'],
      ['Colonia', 'Montebello'],
      ['Colonia', 'Nueva Mulsay'],
      ['Colonia', 'San Ramón Norte'],
      ['Colonia', 'Vergel']
    ];
    sheetUbicaciones.getRange(2, 1, ubicacionesIniciales.length, 2).setValues(ubicacionesIniciales);
  }

  // Eliminar hoja por defecto si se crearon otras
  let defaultSheet = ss.getSheetByName('Hoja1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }
}

/**
 * Obtiene la configuración guardada como Objeto Clave-Valor
 */
function getConfigMap() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      config[String(data[i][0]).trim()] = data[i][1];
    }
  }
  return config;
}

/**
 * MÓDULO 4: Validar Periodo / Control de Acceso
 */
function validarPeriodo() {
  try {
    const config = getConfigMap();
    const modo = config.MODO || 'auto';
    const abiertoManual = config.ABIERTO || 'NO';
    const fechaInicioStr = config.FECHA_INICIO || '';
    const fechaFinStr = config.FECHA_FIN || '';

    let estaAbierto = false;
    let mensaje = '';

    if (modo === 'manual') {
      estaAbierto = (abiertoManual.toUpperCase() === 'SI');
      mensaje = estaAbierto ? 'El registro se encuentra abierto (modo manual).' : 'El periodo de registro no está disponible actualmente.';
    } else {
      // Modo automático por fechas
      const now = new Date();
      const inicio = fechaInicioStr ? new Date(fechaInicioStr) : null;
      const fin = fechaFinStr ? new Date(fechaFinStr) : null;

      if (inicio && fin) {
        if (now >= inicio && now <= fin) {
          estaAbierto = true;
          mensaje = 'El registro se encuentra abierto.';
        } else if (now < inicio) {
          estaAbierto = false;
          mensaje = `El periodo de registro no está disponible. Próxima apertura: ${formatearFechaLarga(inicio)}`;
        } else {
          estaAbierto = false;
          mensaje = `El periodo de registro ha concluido.`;
        }
      } else {
        estaAbierto = false;
        mensaje = 'Las fechas del periodo de registro no han sido configuradas.';
      }
    }

    return {
      abierto: estaAbierto,
      mensaje: mensaje,
      inicio: fechaInicioStr,
      fin: fechaFinStr,
      modo: modo,
      abiertoManual: abiertoManual
    };
  } catch (err) {
    return { abierto: false, mensaje: 'Error al verificar periodo: ' + err.toString() };
  }
}

/**
 * Formatea fechas para visualización del usuario
 */
function formatearFechaLarga(fecha) {
  if (!fecha) return '';
  const opciones = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(fecha).toLocaleDateString('es-MX', opciones);
}

/**
 * MÓDULO 2: Obtener catálogo de ubicaciones de Mérida
 */
function obtenerUbicaciones() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.UBICACIONES);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const result = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) {
        result.push({
          tipo: String(data[i][0]).trim(),
          nombre: String(data[i][1]).trim()
        });
      }
    }
    // Ordenar alfabéticamente
    result.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return result;
  } catch (e) {
    return [];
  }
}

/**
 * Anti-duplicados (cliente): Verificar CURP
 */
function verificarCurpDuplicada(curp) {
  if (!curp) return { existe: false };
  curp = curp.trim().toUpperCase();

  const ss = getSpreadsheet();

  // 1. En Registros
  const sheetReg = ss.getSheetByName(SHEETS.REGISTROS);
  if (sheetReg) {
    const dataReg = sheetReg.getDataRange().getValues();
    for (let i = 1; i < dataReg.length; i++) {
      if (String(dataReg[i][1]).trim().toUpperCase() === curp) {
        return { existe: true, motivo: 'Esta CURP ya cuenta con una solicitud de registro registrada.' };
      }
    }
  }

  // 2. En CURPs_Bloqueadas
  const sheetBloq = ss.getSheetByName(SHEETS.BLOQUEADAS);
  if (sheetBloq) {
    const dataBloq = sheetBloq.getDataRange().getValues();
    for (let i = 1; i < dataBloq.length; i++) {
      if (String(dataBloq[i][0]).trim().toUpperCase() === curp) {
        return { existe: true, motivo: 'Esta CURP ya cuenta con una Tarjeta de Mujeres asignada o bloqueada.' };
      }
    }
  }

  return { existe: false };
}

/**
 * Anti-duplicados (cliente): Verificar Email
 */
function verificarEmailDuplicado(email) {
  if (!email) return { existe: false };
  email = email.trim().toLowerCase();

  const ss = getSpreadsheet();
  const sheetReg = ss.getSheetByName(SHEETS.REGISTROS);
  if (sheetReg) {
    const dataReg = sheetReg.getDataRange().getValues();
    for (let i = 1; i < dataReg.length; i++) {
      if (String(dataReg[i][2]).trim().toLowerCase() === email) {
        return { existe: true };
      }
    }
  }
  return { existe: false };
}

/**
 * Anti-duplicados (servidor, obligatorio): Validación exhaustiva previa a guardar
 */
function validarDuplicados(curp, email) {
  curp = (curp || '').trim().toUpperCase();
  email = (email || '').trim().toLowerCase();

  const ss = getSpreadsheet();
  const sheetReg = ss.getSheetByName(SHEETS.REGISTROS);
  const sheetBloq = ss.getSheetByName(SHEETS.BLOQUEADAS);

  // Check 1: CURP en CURPs_Bloqueadas
  if (sheetBloq) {
    const dataBloq = sheetBloq.getDataRange().getValues();
    for (let i = 1; i < dataBloq.length; i++) {
      if (String(dataBloq[i][0]).trim().toUpperCase() === curp) {
        return { duplicado: true, mensaje: 'Esta CURP ya cuenta con una tarjeta asignada previamente o está bloqueada.' };
      }
    }
  }

  // Check 2, 3 y 4 en Registros
  if (sheetReg) {
    const dataReg = sheetReg.getDataRange().getValues();
    let curpExistente = false;
    let emailExistente = false;

    for (let i = 1; i < dataReg.length; i++) {
      const regCurp = String(dataReg[i][1]).trim().toUpperCase();
      const regEmail = String(dataReg[i][2]).trim().toLowerCase();

      if (regCurp === curp) curpExistente = true;
      if (regEmail === email) emailExistente = true;

      if (regCurp === curp && regEmail === email) {
        return { duplicado: true, mensaje: 'Esta CURP y correo electrónico ya se encuentran registrados.' };
      }
      if (regCurp === curp && regEmail !== email) {
        return { duplicado: true, mensaje: 'Los datos proporcionados ya están asociados a un registro existente (CURP registrada con otro correo).' };
      }
      if (regEmail === email && regCurp !== curp) {
        return { duplicado: true, mensaje: 'Los datos proporcionados ya están asociados a un registro existente (Correo registrado con otra CURP).' };
      }
    }
  }

  return { duplicado: false };
}

/**
 * MÓDULO 2: Guardar Registro en Google Sheets y Google Drive
 */
function guardarRegistro(datos) {
  try {
    // 1. Validar Periodo
    const periodo = validarPeriodo();
    if (!periodo.abierto) {
      return { exito: false, mensaje: 'No es posible enviar el registro: ' + periodo.mensaje };
    }

    // 2. Validar Duplicados Servidor
    const checkDup = validarDuplicados(datos.curp, datos.email);
    if (checkDup.duplicado) {
      return { exito: false, mensaje: checkDup.mensaje };
    }

    // 3. Subir Documentos a Google Drive
    let ineUrl = '';
    let compUrl = '';

    const rootFolder = obtenerOCrearCarpetaPadre('MujeresSeguras_Docs');
    const userFolder = rootFolder.createFolder(datos.curp.trim().toUpperCase());

    if (datos.ineFile && datos.ineFile.bytes) {
      const ineBlob = Utilities.newBlob(
        Utilities.base64Decode(datos.ineFile.bytes),
        datos.ineFile.mimeType,
        'INE_' + datos.curp + '_' + datos.ineFile.name
      );
      const ineFileObj = userFolder.createFile(ineBlob);
      ineFileObj.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      ineUrl = ineFileObj.getUrl();
    }

    if (datos.comprobanteFile && datos.comprobanteFile.bytes) {
      const compBlob = Utilities.newBlob(
        Utilities.base64Decode(datos.comprobanteFile.bytes),
        datos.comprobanteFile.mimeType,
        'COMPROBANTE_' + datos.curp + '_' + datos.comprobanteFile.name
      );
      const compFileObj = userFolder.createFile(compBlob);
      compFileObj.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      compUrl = compFileObj.getUrl();
    }

    // 4. Generar ID y armar registro
    const folio = 'MS-' + Utilities.formatDate(new Date(), 'GMT-6', 'yyyyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
    const fechaHoraActual = Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd HH:mm:ss');
    const direccionCompleta = `${datos.calle || ''} No. ${datos.numero || 'S/N'}, ${datos.tipoUbicacion || ''} ${datos.coloniaComisaria || ''}, C.P. ${datos.codigoPostal || ''}, Mérida, Yucatán.`;

    const nuevaFila = [
      folio,
      datos.curp.trim().toUpperCase(),
      datos.email.trim().toLowerCase(),
      datos.nombreCompleto.trim(),
      datos.tipoUbicacion.trim(),
      datos.coloniaComisaria.trim(),
      datos.calle.trim(),
      datos.numero.trim(),
      datos.codigoPostal.trim(),
      direccionCompleta,
      ineUrl,
      compUrl,
      'PENDIENTE',
      '', // Observaciones
      '', // NoTarjetaAsignada
      '', // LugarEntrega
      '', // FechaHoraEntrega
      fechaHoraActual,
      fechaHoraActual
    ];

    const ss = getSpreadsheet();
    const sheetReg = ss.getSheetByName(SHEETS.REGISTROS);
    sheetReg.appendRow(nuevaFila);

    // 5. Enviar Correo de Confirmación
    enviarCorreo(datos.email.trim(), 'CONFIRMACION', {
      nombre: datos.nombreCompleto.trim(),
      folio: folio
    });

    return {
      exito: true,
      folio: folio,
      mensaje: '¡Tu registro ha sido enviado exitosamente!'
    };

  } catch (err) {
    return { exito: false, mensaje: 'Error al procesar el registro: ' + err.toString() };
  }
}

/**
 * Auxiliar para crear o recuperar carpetas en Google Drive
 */
function obtenerOCrearCarpetaPadre(nombreCarpeta) {
  const folders = DriveApp.getFoldersByName(nombreCarpeta);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(nombreCarpeta);
}

/**
 * MÓDULO 3: Autenticación Administrador
 */
function validarLogin(usuario, contrasena) {
  try {
    const config = getConfigMap();
    const adminUser = config.ADMIN_USER || 'admin';
    const adminPass = config.ADMIN_PASS || 'admin123';

    if (usuario === adminUser && contrasena === adminPass) {
      return { exito: true, mensaje: 'Acceso autorizado.' };
    } else {
      return { exito: false, mensaje: 'Usuario o contraseña incorrectos.' };
    }
  } catch (e) {
    return { exito: false, mensaje: 'Error de validación: ' + e.toString() };
  }
}

/**
 * MÓDULO 3.1: Obtener Registros para el Administrador
 */
function obtenerRegistros(usuario, contrasena) {
  const auth = validarLogin(usuario, contrasena);
  if (!auth.exito) {
    return { exito: false, mensaje: auth.mensaje };
  }

  try {
    const ss = getSpreadsheet();
    const sheetReg = ss.getSheetByName(SHEETS.REGISTROS);
    if (!sheetReg) return { exito: true, registros: [] };

    const data = sheetReg.getDataRange().getValues();
    const registros = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        registros.push({
          id: data[i][0],
          curp: data[i][1],
          email: data[i][2], // Solo lectura en admin
          nombreCompleto: data[i][3],
          tipoUbicacion: data[i][4],
          coloniaComisaria: data[i][5],
          calle: data[i][6],
          numero: data[i][7],
          codigoPostal: data[i][8],
          direccionCompleta: data[i][9],
          ineUrl: data[i][10],
          comprobanteUrl: data[i][11],
          estatus: data[i][12],
          observaciones: data[i][13],
          noTarjetaAsignada: data[i][14],
          lugarEntrega: data[i][15],
          fechaHoraEntrega: data[i][16],
          fechaRegistro: data[i][17],
          ultimaActualizacion: data[i][18]
        });
      }
    }

    return { exito: true, registros: registros };
  } catch (err) {
    return { exito: false, mensaje: 'Error al consultar registros: ' + err.toString() };
  }
}

/**
 * MÓDULO 3.2: Actualizar Estatus de Registro y Ejecutar Acciones
 */
function actualizarEstatusRegistro(params) {
  const auth = validarLogin(params.usuario, params.contrasena);
  if (!auth.exito) {
    return { exito: false, mensaje: auth.mensaje };
  }

  try {
    const ss = getSpreadsheet();
    const sheetReg = ss.getSheetByName(SHEETS.REGISTROS);
    if (!sheetReg) return { exito: false, mensaje: 'Hoja de registros no encontrada.' };

    const data = sheetReg.getDataRange().getValues();
    let rowIndex = -1;
    let emailDestino = '';
    let nombreDestino = '';
    let curpRegistro = '';

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(params.id).trim()) {
        rowIndex = i + 1; // 1-indexed en Apps Script
        curpRegistro = data[i][1];
        emailDestino = data[i][2];
        nombreDestino = data[i][3];
        break;
      }
    }

    if (rowIndex === -1) {
      return { exito: false, mensaje: 'Registro no encontrado.' };
    }

    const fechaHoraActual = Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd HH:mm:ss');

    // Actualizar columnas según estatus
    sheetReg.getRange(rowIndex, 13).setValue(params.estatus); // Estatus
    sheetReg.getRange(rowIndex, 19).setValue(fechaHoraActual); // UltimaActualizacion

    if (params.estatus === 'OBSERVADO') {
      sheetReg.getRange(rowIndex, 14).setValue(params.observaciones || '');
      enviarCorreo(emailDestino, 'OBSERVACION', {
        nombre: nombreDestino,
        folio: params.id,
        observaciones: params.observaciones || ''
      });
    } else if (params.estatus === 'NO_APLICA') {
      sheetReg.getRange(rowIndex, 14).setValue(params.motivo || '');
      enviarCorreo(emailDestino, 'NO_APLICA', {
        nombre: nombreDestino,
        folio: params.id,
        motivo: params.motivo || ''
      });
    } else if (params.estatus === 'APROBADO') {
      sheetReg.getRange(rowIndex, 15).setValue(params.numeroTarjeta || '');
      sheetReg.getRange(rowIndex, 16).setValue(params.lugarEntrega || '');
      sheetReg.getRange(rowIndex, 17).setValue(params.fechaHoraEntrega || '');

      // Bloquear CURP para evitar duplicados futuros
      const sheetBloq = ss.getSheetByName(SHEETS.BLOQUEADAS);
      if (sheetBloq) {
        sheetBloq.appendRow([curpRegistro, 'Tarjeta Asignada ' + (params.numeroTarjeta || ''), fechaHoraActual]);
      }

      enviarCorreo(emailDestino, 'APROBACION', {
        nombre: nombreDestino,
        folio: params.id,
        numeroTarjeta: params.numeroTarjeta || '',
        lugarEntrega: params.lugarEntrega || '',
        fechaHoraEntrega: params.fechaHoraEntrega || ''
      });
    }

    return { exito: true, mensaje: 'Registro actualizado correctamente a estatus: ' + params.estatus };

  } catch (err) {
    return { exito: false, mensaje: 'Error al actualizar registro: ' + err.toString() };
  }
}

/**
 * MÓDULO 4: Guardar Configuración del Periodo
 */
function guardarConfiguracionPeriodo(params) {
  const auth = validarLogin(params.usuario, params.contrasena);
  if (!auth.exito) {
    return { exito: false, mensaje: auth.mensaje };
  }

  try {
    const ss = getSpreadsheet();
    const sheetConfig = ss.getSheetByName(SHEETS.CONFIG);
    if (!sheetConfig) return { exito: false, mensaje: 'Hoja de configuración no encontrada.' };

    const updates = {
      'FECHA_INICIO': params.fechaInicio || '',
      'FECHA_FIN': params.fechaFin || '',
      'MODO': params.modo || 'auto',
      'ABIERTO': params.abierto || 'NO'
    };

    const data = sheetConfig.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const clave = String(data[i][0]).trim();
      if (updates.hasOwnProperty(clave)) {
        sheetConfig.getRange(i + 1, 2).setValue(updates[clave]);
      }
    }

    return { exito: true, mensaje: 'Configuración del periodo guardada exitosamente.' };

  } catch (err) {
    return { exito: false, mensaje: 'Error al guardar configuración: ' + err.toString() };
  }
}

/**
 * MÓDULO 3.3 y 3.4: Sistema de Envío de Correos y Plantillas HTML
 */
function enviarCorreo(email, tipo, datos) {
  try {
    const config = getConfigMap();
    const contactoEmail = config.CONTACTO_EMAIL || 'contacto@mujeresseguras.merida.gob.mx';
    const contactoTelefono = config.CONTACTO_TELEFONO || '999 924 4000';

    let asunto = '';
    let cuerpoHtml = '';

    const folio = datos.folio || '';
    const nombre = datos.nombre || 'Beneficiaria';

    if (tipo === 'CONFIRMACION') {
      asunto = `Registro recibido — Tarjeta de Mujeres | Folio ${folio}`;
      cuerpoHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #4A148C; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">Tarjeta de Mujeres</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Mujeres Seguras — Mérida, Yucatán</p>
          </div>
          <div style="padding: 25px; color: #333333; line-height: 1.6;">
            <p>Estimada <strong>${nombre}</strong>,</p>
            <p>Agradecemos tu interés en el programa. Confirmamos que hemos recibido tu solicitud de registro de manera correcta.</p>
            <div style="background-color: #F3E5F5; border-left: 4px solid #7B1FA2; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #4A148C;"><strong>Tu Folio de Registro es:</strong></p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #311B92;">${folio}</p>
            </div>
            <p>Tu solicitud será revisada minuciosamente por el equipo correspondiente. Recibirás un correo electrónico posterior notificándote el resultado o las indicaciones a seguir.</p>
            <p>Te sugerimos conservar este número de folio para cualquier seguimiento o aclaración.</p>
            <br>
            <p style="margin: 0;">Atentamente,</p>
            <p style="margin: 0; font-weight: bold; color: #4A148C;">Equipo de Mujeres Seguras</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 5px 0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            <p style="margin: 0;">Para dudas o aclaraciones, contacta a: ${contactoEmail} | Tel: ${contactoTelefono}</p>
          </div>
        </div>
      `;
    } else if (tipo === 'OBSERVACION') {
      asunto = `Observación a tu registro — Tarjeta de Mujeres | Folio ${folio}`;
      cuerpoHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #7B1FA2; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">Tarjeta de Mujeres</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Mujeres Seguras — Mérida, Yucatán</p>
          </div>
          <div style="padding: 25px; color: #333333; line-height: 1.6;">
            <p>Estimada <strong>${nombre}</strong>,</p>
            <p>Al revisar tu solicitud de registro con folio <strong>${folio}</strong>, hemos detectado algunos puntos que requieren tu atención o corrección para poder continuar con el trámite.</p>
            <div style="background-color: #FFF3E0; border-left: 4px solid #EF6C00; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #E65100;"><strong>Detalle de las observaciones:</strong></p>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #333333;">${datos.observaciones || 'No se detallaron observaciones.'}</p>
            </div>
            <p><strong>Pasos para solventar tu registro:</strong></p>
            <ol style="padding-left: 20px; margin-bottom: 20px;">
              <li>Revisa detenidamente la observación indicada arriba.</li>
              <li>Ponte en contacto con nuestro equipo de atención a la brevedad para realizar las aclaraciones o correcciones necesarias.</li>
              <li>Te sugerimos responder dentro de un plazo de 5 días hábiles para mantener activa tu solicitud.</li>
            </ol>
            <p>Estamos para apoyarte en todo el proceso.</p>
            <br>
            <p style="margin: 0;">Atentamente,</p>
            <p style="margin: 0; font-weight: bold; color: #4A148C;">Equipo de Mujeres Seguras</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 5px 0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            <p style="margin: 0;">Para dudas o solventar observaciones, contacta a: ${contactoEmail} | Tel: ${contactoTelefono}</p>
          </div>
        </div>
      `;
    } else if (tipo === 'NO_APLICA') {
      asunto = `Resultado de tu solicitud — Tarjeta de Mujeres | Folio ${folio}`;
      cuerpoHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #311B92; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">Tarjeta de Mujeres</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Mujeres Seguras — Mérida, Yucatán</p>
          </div>
          <div style="padding: 25px; color: #333333; line-height: 1.6;">
            <p>Estimada <strong>${nombre}</strong>,</p>
            <p>Agradecemos sinceramente tu tiempo e interés en registrarte al programa Tarjeta de Mujeres.</p>
            <p>Tras la evaluación de tu solicitud con folio <strong>${folio}</strong>, lamentamos informarte que en esta ocasión no es posible otorgarte el beneficio conforme a los lineamientos del programa.</p>
            <div style="background-color: #FFEBEE; border-left: 4px solid #C62828; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #B71C1C;"><strong>Motivo:</strong></p>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #333333;">${datos.motivo || 'No cumple con los requisitos estipulados en la convocatoria.'}</p>
            </div>
            <p>Te invitamos a estar atenta a nuestras próximas convocatorias y programas de apoyo. Agradecemos enormemente tu participación.</p>
            <br>
            <p style="margin: 0;">Atentamente,</p>
            <p style="margin: 0; font-weight: bold; color: #4A148C;">Equipo de Mujeres Seguras</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 5px 0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            <p style="margin: 0;">Para dudas o aclarar información: ${contactoEmail} | Tel: ${contactoTelefono}</p>
          </div>
        </div>
      `;
    } else if (tipo === 'APROBACION') {
      asunto = `¡Tu Tarjeta de Mujeres está lista! | Folio ${folio}`;
      cuerpoHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #4A148C; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">¡Felicidades!</h2>
            <p style="margin: 5px 0 0 0; font-size: 16px;">Tarjeta de Mujeres — Mujeres Seguras</p>
          </div>
          <div style="padding: 25px; color: #333333; line-height: 1.6;">
            <p>Estimada <strong>${nombre}</strong>,</p>
            <p>Nos complace enormemente informarte que tu solicitud con folio <strong>${folio}</strong> ha sido <strong>APROBADA</strong>. ¡Te damos la más cordial bienvenida al programa Tarjeta de Mujeres!</p>

            <div style="background-color: #F3E5F5; border: 1px solid #CE93D8; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #4A148C; font-size: 18px; text-align: center;">Datos para la Entrega de tu Tarjeta</h3>
              <p style="margin: 8px 0;"><strong>No. de Tarjeta Asignada:</strong> <span style="color: #311B92; font-weight: bold;">${datos.numeroTarjeta}</span></p>
              <p style="margin: 8px 0;"><strong>Lugar de Entrega:</strong> ${datos.lugarEntrega}</p>
              <p style="margin: 8px 0;"><strong>Fecha y Hora:</strong> ${datos.fechaHoraEntrega}</p>
            </div>

            <p><strong>Documentos requeridos para recoger tu tarjeta:</strong></p>
            <ul style="padding-left: 20px;">
              <li>Identificación oficial (INE) en <strong>original y copia</strong>.</li>
              <li>Copia de este correo de confirmación o el número de folio <strong>${folio}</strong>.</li>
            </ul>
            <p style="background-color: #FFF8E1; padding: 10px; border-radius: 4px; font-size: 13px; color: #F57F17;">
              📌 <strong>Importante:</strong> La tarjeta es estrictamente personal e intransferible. Te solicitamos acudir de manera puntual en el horario asignado.
            </p>
            <p>¡Esperamos que disfrutes de todos los beneficios y convenios de tu Tarjeta de Mujeres!</p>
            <br>
            <p style="margin: 0;">Atentamente,</p>
            <p style="margin: 0; font-weight: bold; color: #4A148C;">Equipo de Mujeres Seguras</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0 0 5px 0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            <p style="margin: 0;">Para dudas o aclaraciones: ${contactoEmail} | Tel: ${contactoTelefono}</p>
          </div>
        </div>
      `;
    }

    if (email && asunto && cuerpoHtml) {
      MailApp.sendEmail({
        to: email,
        subject: asunto,
        htmlBody: cuerpoHtml
      });
    }

  } catch (err) {
    Logger.log('Error al enviar correo: ' + err.toString());
  }
}
