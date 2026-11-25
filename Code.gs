/**
 * SISTEMA DE ACUERDOS DE DIRECCIÓN - BACKEND (Code.gs)
 * Google Apps Script V8 Runtime
 */

// ==========================================
// CONSTANTES Y CONFIGURACIÓN
// ==========================================
const SPREADSHEET_ID_PROPERTY = 'ACUERDOS_SPREADSHEET_ID';

// Configuración de autenticación y sesiones.
const SESSION_PREFIX = 'AUTH_SESSION_';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const SESSION_CLEANUP_CACHE_KEY = 'AUTH_SESSION_CLEANUP';
const BOOTSTRAP_SECRET_PROPERTY = 'AUTH_BOOTSTRAP_SECRET';
const PASSWORD_HASH_PREFIX = 'sha256';
const PASSWORD_HASH_ITERATIONS = 10000;
const PASSWORD_GENERATED_LENGTH = 16;
const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_SEGUNDOS = 300;
const USER_STATE_CACHE_TTL = 60;

// Administrador principal. La contraseña de arranque se guarda únicamente
// como hash; no se almacena en texto plano en el código ni en la hoja.
const ADMIN_INICIAL_CORREO = 'sakurazukamori21@gmail.com';
const ADMIN_INICIAL_NOMBRE = 'Lalo';
const ADMIN_INICIAL_SUBDIRECCION = 'Subdirección de Mejora Regulatoria';
const ADMIN_INICIAL_HASH = 'sha256$10000$fdc260d5932a840170b49abb10ed568a$7a24b679adf49e18aa79861141a554e273c474dd23b8cf686fa38259f899fcde';

const HOJAS = {
  HOJA1: 'Hoja 1',
  PROYECTOS: 'Proyectos',
  MINUTAS: 'Minutas',
  ASISTENCIA: 'Asistencia',
  ORDEN_DEL_DIA: 'OrdenDelDia',
  ACUERDOS: 'Acuerdos',
  CATALOGOS: 'Catálogos',
  LOG_NOTIFICACIONES: 'Log_Notificaciones',
  COMENTARIOS_SEGUIMIENTO: 'Comentarios_Seguimiento',
  USUARIOS: 'Usuarios'
};

const ENCABEZADOS = {
  [HOJAS.HOJA1]: [],
  [HOJAS.PROYECTOS]: ['ID_Proyecto', 'Nombre_Proyecto', 'Descripción', 'Estatus', 'Fecha_Creación', 'Creado_Por', 'Etapa'],
  [HOJAS.MINUTAS]: ['Folio', 'ID_Proyecto', 'Etapa', 'Nombre_Reunión', 'Fecha', 'Lugar', 'Objetivos', 'Creado_Por', 'Fecha_Creación'],
  [HOJAS.ASISTENCIA]: ['ID_Asistencia', 'Folio_Minuta', 'Nombre', 'Dependencia_Area', 'Cargo', 'Correo Electrónico', 'Asistencia'],
  [HOJAS.ORDEN_DEL_DIA]: ['ID_Punto', 'Folio_Minuta', 'Número_Punto', 'Descripción_Punto'],
  [HOJAS.ACUERDOS]: ['ID_Acuerdo', 'Folio_Minuta', 'Tipo', 'Descripción_Acuerdo', 'Prioridad', 'Solicitantes', 'Responsables', 'Fecha_Límite', 'Subdirección_Asignada', 'Estatus', 'Origen', 'Creado_Por', 'Fecha_Creación', 'Fecha_Modificación', 'ID_Proyecto', 'Jefaturas_Asignadas'],
  [HOJAS.CATALOGOS]: ['Tipo', 'Valor', 'Padre'],
  [HOJAS.LOG_NOTIFICACIONES]: ['ID_Log', 'ID_Acuerdo', 'Correo_Destino', 'Asunto', 'Fecha_Envío', 'Estatus_Envío'],
  [HOJAS.COMENTARIOS_SEGUIMIENTO]: ['ID_Comentario', 'ID_Acuerdo', 'Usuario', 'Fecha_Hora', 'Comentario'],
  [HOJAS.USUARIOS]: ['Correo', 'Nombre', 'Rol', 'Subdirección', 'Activo', 'Jefatura_Departamento', 'Contrasena_Hash', 'Contrasena_Actualizada']
};

const ROLES = {
  ADMINISTRADOR: 'Administrador',
  OPERADOR: 'Operador',
  JEFATURA: 'Jefatura',
  LECTOR: 'Lector'
};

const ASISTENTES_PREDETERMINADOS = [
  { nombre: 'Lic. Mariana Gaber Fernández Montilla', cargo: 'Directora de Administración', correo: 'mariana.gaber@merida.gob.mx' },
  { nombre: 'C.P. Edith Verónica Aguilar Rivero', cargo: 'Jefa Despacho Administración', correo: 'edith.aguilar@merida.gob.mx' },
  { nombre: 'MTRO. Edgar Miguel Poot Delfino', cargo: 'Subdirector de Administración y Proveeduría', correo: 'edgar.poot@merida.gob.mx' },
  { nombre: 'M.A.D. Eric Gerardo Millet Corona', cargo: 'Subdirector de Servicios Internos', correo: 'eric.millet@merida.gob.mx' },
  { nombre: 'M.D.O. Wendy Leticia Rejón Barrancos', cargo: 'Subdirectora de Recursos Humanos', correo: 'wendy.rejon@merida.gob.mx' },
  { nombre: 'Mtra. Ana Carolina Hidalgo Ortiz', cargo: 'Subdirectora de Mejora Regulatoria', correo: 'ana.hidalgo@merida.gob.mx' },
  { nombre: 'Licda. María Cecilia Ruiz del Hoyo Cervera, Mtra.', cargo: 'Encargada de la Subdirección de Patrimonio Municipal', correo: 'maria.ruizdelhoyo@merida.gob.mx' },
  { nombre: 'Lic. Joaquín Gustavo Chan Espinosa', cargo: 'Subdirector de Ventanillas Únicas', correo: 'joaquin.chane@merida.gob.mx' }
];

const ORGANIGRAMA_COMPLETO = [
  // Subdirecciones y Jefatura directa de Dirección
  ['Subdirección', 'Jefa Despacho Administración', 'Dirección de Administración'],
  ['Subdirección', 'Subdirección de Administración y de Proveeduría', 'Dirección de Administración'],
  ['Subdirección', 'Subdirección de Servicios Internos', 'Dirección de Administración'],
  ['Subdirección', 'Subdirección de Recursos Humanos', 'Dirección de Administración'],
  ['Subdirección', 'Subdirección de Mejora Regulatoria', 'Dirección de Administración'],
  ['Subdirección', 'Subdirección de Patrimonio Municipal', 'Dirección de Administración'],
  ['Subdirección', 'Subdirección de Ventanilla Única', 'Dirección de Administración'],

  // Jefaturas dependientes de Subdirección de Administración y de Proveeduría
  ['Jefatura', 'Jefa de Almacén', 'Subdirección de Administración y de Proveeduría'],
  ['Jefatura', 'Jefe de Concursos Electrónicos', 'Subdirección de Administración y de Proveeduría'],
  ['Jefatura', 'Jefa Administrativa', 'Subdirección de Administración y de Proveeduría'],
  ['Jefatura', 'Jefa de Licitaciones', 'Subdirección de Administración y de Proveeduría'],
  ['Jefatura', 'Jefa de Contratación de Servicios', 'Subdirección de Administración y de Proveeduría'],
  ['Jefatura', 'Jefe de Seguimiento a Servicios', 'Subdirección de Administración y de Proveeduría'],
  ['Jefatura', 'Jefe de Atención y Control Interno', 'Subdirección de Administración y de Proveeduría'],

  // Jefaturas dependientes de Subdirección de Servicios Internos
  ['Jefatura', 'Jefa del Despacho del Subdirector', 'Subdirección de Servicios Internos'],
  ['Jefatura', 'Jefe de Conservación', 'Subdirección de Servicios Internos'],
  ['Jefatura', 'Jefa de Administración Interna', 'Subdirección de Servicios Internos'],
  ['Jefatura', 'Jefa Jurídico', 'Subdirección de Servicios Internos'],
  ['Jefatura', 'Jefa de Central de Mantenimiento Vehicular', 'Subdirección de Servicios Internos'],

  // Jefaturas dependientes de Subdirección de Recursos Humanos
  ['Jefatura', 'Jefa de Despacho de la Subdirección', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Jefa de Desarrollo Humano y Capacitación', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Jefa de Selección e Ingreso', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Jefa de Prestaciones', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Jefe de Servicios Médicos Administrativos', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Jefe de Central de Nóminas', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Jefa de Relaciones Laborales', 'Subdirección de Recursos Humanos'],
  ['Jefatura', 'Encargado del departamento de Jubilados y Pensionados', 'Subdirección de Recursos Humanos'],

  // Jefaturas dependientes de Subdirección de Mejora Regulatoria
  ['Jefatura', 'Jefe de Despacho de la Subdirección', 'Subdirección de Mejora Regulatoria'],
  ['Jefatura', 'Jefa de Calidad y Mejora Continua', 'Subdirección de Mejora Regulatoria'],
  ['Jefatura', 'Jefe de Proyectos de Innovación', 'Subdirección de Mejora Regulatoria'],
  ['Jefatura', 'Jefa de Mejora Regulatoria', 'Subdirección de Mejora Regulatoria'],

  // Jefaturas dependientes de Subdirección de Patrimonio Municipal
  ['Jefatura', 'Jefe de Control y Regularización de Inmuebles', 'Subdirección de Patrimonio Municipal'],
  ['Jefatura', 'Encargado del Departamento Control de Inventarios y Requisición Tipo mantenimiento', 'Subdirección de Patrimonio Municipal'],
  ['Jefatura', 'Departamento de Seguimiento a Contratos', 'Subdirección de Patrimonio Municipal'],

  // Jefaturas dependientes de Subdirección de Ventanilla Única
  ['Jefatura', 'Jefa de Control Interno', 'Subdirección de Ventanilla Única']
];

// ==========================================
// INICIALIZACIÓN Y CONFIGURACIÓN (setup)
// ==========================================
function setup() {
  const ss = getSpreadsheet();

  // 1. Crear hojas si no existen y colocar encabezados
  Object.keys(ENCABEZADOS).forEach(nombreHoja => {
    let sheet = ss.getSheetByName(nombreHoja);
    if (!sheet) {
      sheet = ss.insertSheet(nombreHoja);
    }
    const headers = ENCABEZADOS[nombreHoja];
    if (headers.length > 0) {
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0 || sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E0E0E0');
        sheet.setFrozenRows(1);
      } else {
        const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        headers.forEach((h) => {
          if (!currentHeaders.includes(h)) {
            const nextCol = sheet.getLastColumn() + 1;
            sheet.getRange(1, nextCol).setValue(h).setFontWeight('bold').setBackground('#E0E0E0');
          }
        });
      }
    }
  });

  // 2. Cargar catálogos iniciales
  poblarCatalogosOrganigrama(ss);

  // 3. Cargar usuarios iniciales con contraseñas temporales seguras
  const usrSheet = ss.getSheetByName(HOJAS.USUARIOS);
  if (usrSheet.getLastRow() <= 1) {
    const usuariosIniciales = [
      [ADMIN_INICIAL_CORREO, ADMIN_INICIAL_NOMBRE, ROLES.ADMINISTRADOR, ADMIN_INICIAL_SUBDIRECCION, 'Sí', ''],
      ['mariana.gaber@merida.gob.mx', 'Mariana Gaber Fernández Montilla', 'Administrador', 'Dirección de Administración', 'Sí', ''],
      ['ana.hidalgo@merida.gob.mx', 'Ana Carolina Hidalgo Ortiz', 'Operador', 'Subdirección de Mejora Regulatoria', 'Sí', ''],
      ['jefe.compras@merida.gob.mx', 'Carlos Jefe Compras', 'Jefatura', 'Subdirección de Administración y de Proveeduría', 'Sí', 'Jefa de Licitaciones']
    ];
    const credencialesIniciales = [];
    const filasUsuarios = usuariosIniciales.map(function (usuario, indice) {
      // El Administrador principal usa la contraseña de arranque fija. Sólo
      // se guarda su hash, nunca la contraseña en texto plano.
      if (indice === 0) {
        return usuario.concat([ADMIN_INICIAL_HASH, ahoraTexto()]);
      }
      const contrasenaTemporal = generarContrasenaTemporal();
      credencialesIniciales.push({ correo: usuario[0], contrasena: contrasenaTemporal });
      return usuario.concat([generarHashContrasena(contrasenaTemporal), ahoraTexto()]);
    });
    usrSheet.getRange(2, 1, filasUsuarios.length, ENCABEZADOS[HOJAS.USUARIOS].length).setValues(filasUsuarios);

    // Las contraseñas temporales sólo se muestran en el registro de ejecución
    // del editor (visible únicamente para el propietario del script).
    console.log('=== USUARIOS INICIALES ===');
    console.log('Administrador principal: ' + ADMIN_INICIAL_CORREO + ' (contraseña de arranque configurada).');
    console.log('Cambie esa contraseña después del primer ingreso.');
    console.log('=== CREDENCIALES TEMPORALES DEL RESTO DE USUARIOS ===');
    console.log('Guárdelas y distribúyalas por un canal seguro. No se volverán a mostrar.');
    credencialesIniciales.forEach(function (c) {
      console.log(c.correo + ' | ' + c.contrasena);
    });
  }

  // 4. Garantizar un secreto de arranque para la generación inicial de credenciales.
  // El secreto sólo es visible en Configuración del proyecto > Propiedades del script.
  const scriptProps = PropertiesService.getScriptProperties();
  if (!scriptProps.getProperty(BOOTSTRAP_SECRET_PROPERTY)) {
    scriptProps.setProperty(BOOTSTRAP_SECRET_PROPERTY, generarCadenaHex(32));
  }

  // 5. Recordatorios automáticos en background deshabilitados según instrucción
  eliminarTriggersRecordatorios();

  return 'Setup completado exitosamente. Ejecute ingresoInicialAdministrador_() desde el editor para obtener las credenciales de acceso inicial.';
}

function eliminarTriggersRecordatorios() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'procesarRecordatorios') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function poblarCatalogosOrganigrama(ss) {
  const catSheet = ss.getSheetByName(HOJAS.CATALOGOS);
  const rows = catSheet.getLastRow() > 1 ? catSheet.getRange(2, 1, catSheet.getLastRow() - 1, catSheet.getLastColumn()).getValues() : [];

  const catalogosExistentes = new Set(rows.map(r => `${String(r[0]).trim()}|${String(r[1]).trim()}`));

  const nuevosRegistros = [];

  const basicos = [
    ['Dependencia', 'Dirección de Administración', ''],
    ['Dependencia', 'Dirección de Tecnologías', ''],
    ['Dependencia', 'Dirección de Gobernación', ''],
    ['Etapa', 'Planeación', ''],
    ['Etapa', 'Ejecución', ''],
    ['Etapa', 'Seguimiento', ''],
    ['Etapa', 'Cierre', ''],
    ['Prioridad', 'Alta', ''],
    ['Prioridad', 'Media', ''],
    ['Prioridad', 'Baja', ''],
    ['Estatus', 'Pendiente', ''],
    ['Estatus', 'En Proceso', ''],
    ['Estatus', 'Cumplido', ''],
    ['Estatus', 'Cancelado']
  ];

  basicos.forEach(b => {
    const key = `${b[0]}|${b[1]}`;
    if (!catalogosExistentes.has(key)) {
      nuevosRegistros.push(b);
      catalogosExistentes.add(key);
    }
  });

  ORGANIGRAMA_COMPLETO.forEach(item => {
    const key = `${item[0]}|${item[1]}`;
    if (!catalogosExistentes.has(key)) {
      nuevosRegistros.push([item[0], item[1], item[2]]);
      catalogosExistentes.add(key);
    }
  });

  if (nuevosRegistros.length > 0) {
    catSheet.getRange(catSheet.getLastRow() + 1, 1, nuevosRegistros.length, 3).setValues(nuevosRegistros);
  }
}

// ==========================================
// MANEJO DE BD Y SHEETS
// ==========================================
function getSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty(SPREADSHEET_ID_PROPERTY);
    if (id) {
      ss = SpreadsheetApp.openById(id);
    } else {
      const files = DriveApp.getFilesByName('Sistema_Acuerdos_Direccion_BD');
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
        props.setProperty(SPREADSHEET_ID_PROPERTY, ss.getId());
      } else {
        ss = SpreadsheetApp.create('Sistema_Acuerdos_Direccion_BD');
        props.setProperty(SPREADSHEET_ID_PROPERTY, ss.getId());
      }
    }
  }
  return ss;
}

function getSheetData(nombreHoja) {
  const sheet = getSpreadsheet().getSheetByName(nombreHoja);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data.map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = formatDate(val);
      }
      obj[h] = val !== undefined && val !== null ? val : '';
    });
    return obj;
  });
}

function formatDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return dateObj;
  const timeZone = Session.getScriptTimeZone() || 'America/Merida';
  return Utilities.formatDate(dateObj, timeZone, 'yyyy-MM-dd HH:mm:ss');
}

function ahoraTexto() {
  const timeZone = Session.getScriptTimeZone() || 'America/Merida';
  return Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss');
}

function formatDateShort(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') {
    if (dateObj.includes('T')) return dateObj.split('T')[0];
    if (dateObj.includes(' ')) return dateObj.split(' ')[0];
    return dateObj;
  }
  if (dateObj instanceof Date) {
    const timeZone = Session.getScriptTimeZone() || 'America/Merida';
    return Utilities.formatDate(dateObj, timeZone, 'yyyy-MM-dd');
  }
  return String(dateObj);
}

// ==========================================
// GENERACIÓN DE IDS Y UNICIDAD
// ==========================================
function generarRandomStr(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

function generarIDUnico(nombreHoja, prefijo, numColumna = 1) {
  const sheet = getSpreadsheet().getSheetByName(nombreHoja);
  const data = sheet.getLastRow() > 1 ? sheet.getRange(2, numColumna, sheet.getLastRow() - 1, 1).getValues() : [];
  const idsExistentes = new Set(data.map(r => String(r[0])));

  let idCandidate = '';
  let counter = 1;
  do {
    const rand = generarRandomStr(8);
    const num = String(counter).padStart(3, '0');
    idCandidate = `${prefijo}-${rand}-${num}`;
    counter++;
  } while (idsExistentes.has(idCandidate));

  return idCandidate;
}

function generarFolioMinutaAnual() {
  const sheet = getSpreadsheet().getSheetByName(HOJAS.MINUTAS);
  const currentYear = new Date().getFullYear();
  const prefixYear = `MIN-${currentYear}-`;

  let maxSeq = 0;
  if (sheet.getLastRow() > 1) {
    const folios = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    folios.forEach(r => {
      const folioStr = String(r[0] || '');
      if (folioStr.startsWith(prefixYear)) {
        const parts = folioStr.split('-');
        if (parts.length === 3) {
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    });
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefixYear}${nextSeq}`;
}

// ==========================================
// AUTENTICACIÓN Y SESIÓN
// ==========================================
// Contexto de la ejecución actual. google.script.run ejecuta una sola acción
// por petición, por lo que este valor nunca se comparte entre usuarios ni
// entre peticiones concurrentes.
let TOKEN_SESION_ACTUAL = null;
let ACCIONES_CLIENTE_MAP = null;

/**
 * Punto de entrada único para las llamadas del cliente. Inyecta el token de
 * sesión en el contexto de la ejecución y sólo permite acciones explícitas.
 */
function ejecutarAccion(nombreAccion, args, token) {
  const acciones = obtenerAccionesCliente();
  if (!Object.prototype.hasOwnProperty.call(acciones, nombreAccion)) {
    throw new Error('Acción no permitida.');
  }
  TOKEN_SESION_ACTUAL = (typeof token === 'string' && token.trim()) ? token.trim() : null;
  try {
    return acciones[nombreAccion].apply(null, Array.isArray(args) ? args : []);
  } finally {
    TOKEN_SESION_ACTUAL = null;
  }
}

function obtenerAccionesCliente() {
  if (!ACCIONES_CLIENTE_MAP) {
    ACCIONES_CLIENTE_MAP = {
      login: login,
      logout: logout,
      obtenerSesion: obtenerSesion,
      listarProyectos: listarProyectos,
      crearProyecto: crearProyecto,
      actualizarProyecto: actualizarProyecto,
      cambiarEtapaProyecto: cambiarEtapaProyecto,
      obtenerCatalogos: obtenerCatalogos,
      obtenerKPIsDashboard: obtenerKPIsDashboard,
      obtenerKPIsAdminDashboard: obtenerKPIsAdminDashboard,
      listarAcuerdos: listarAcuerdos,
      obtenerAcuerdo: obtenerAcuerdo,
      crearAcuerdo: crearAcuerdo,
      actualizarAcuerdo: actualizarAcuerdo,
      agregarComentario: agregarComentario,
      enviarRecordatorioManualAcuerdo: enviarRecordatorioManualAcuerdo,
      listarMinutas: listarMinutas,
      obtenerMinuta: obtenerMinuta,
      crearMinuta: crearMinuta,
      actualizarMinuta: actualizarMinuta,
      enviarMinutaPorCorreo: enviarMinutaPorCorreo,
      listarUsuarios: listarUsuarios,
      guardarUsuario: guardarUsuario,
      eliminarUsuario: eliminarUsuario,
      restablecerContrasena: restablecerContrasena,
      generarCredencialesUsuariosExistentes: generarCredencialesUsuariosExistentes,
      guardarCatalogoItem: guardarCatalogoItem,
      eliminarCatalogoItem: eliminarCatalogoItem
    };
  }
  return ACCIONES_CLIENTE_MAP;
}

// --- Utilidades de sesión ---
function generarTokenSesion() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function guardarSesion(token, sesion) {
  PropertiesService.getScriptProperties().setProperty(SESSION_PREFIX + token, JSON.stringify(sesion));
}

function leerSesionPorToken(token) {
  if (!token) return null;
  const raw = PropertiesService.getScriptProperties().getProperty(SESSION_PREFIX + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function eliminarSesionPorToken(token) {
  if (!token) return;
  PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + token);
}

function eliminarSesionesDeUsuario(email) {
  const emailNorm = normalizarCorreo(email);
  if (!emailNorm) return;
  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  Object.keys(todas).forEach(function (clave) {
    if (clave.indexOf(SESSION_PREFIX) !== 0) return;
    try {
      const sesion = JSON.parse(todas[clave]);
      if (sesion && normalizarCorreo(sesion.email) === emailNorm) {
        props.deleteProperty(clave);
      }
    } catch (e) {
      props.deleteProperty(clave);
    }
  });
}

function limpiarSesionesExpiradas() {
  const cache = CacheService.getScriptCache();
  if (cache.get(SESSION_CLEANUP_CACHE_KEY)) return;
  cache.put(SESSION_CLEANUP_CACHE_KEY, '1', 3600);

  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  const ahora = Date.now();
  Object.keys(todas).forEach(function (clave) {
    if (clave.indexOf(SESSION_PREFIX) !== 0) return;
    let eliminar = false;
    try {
      const sesion = JSON.parse(todas[clave]);
      if (!sesion || !sesion.loginTime || (ahora - Number(sesion.loginTime)) > SESSION_TTL_MS) {
        eliminar = true;
      }
    } catch (e) {
      eliminar = true;
    }
    if (eliminar) props.deleteProperty(clave);
  });
}

// --- Utilidades de usuarios ---
function normalizarCorreo(email) {
  return String(email || '').trim().toLowerCase();
}

function esUsuarioActivo(usuario) {
  if (!usuario) return false;
  const estado = String(usuario.Activo || '').trim().toUpperCase();
  return estado === 'SÍ' || estado === 'SI';
}

function obtenerEncabezados(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
}

function indiceEncabezados(headers) {
  const indice = {};
  headers.forEach(function (h, i) {
    if (h) indice[h] = i;
  });
  return indice;
}

function asegurarEncabezadosUsuarios(sheet) {
  const headers = ENCABEZADOS[HOJAS.USUARIOS];
  const lastCol = sheet.getLastColumn();
  const actuales = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];
  let siguienteCol = lastCol + 1;

  headers.forEach(function (header) {
    if (actuales.indexOf(header) === -1) {
      sheet.getRange(1, siguienteCol).setValue(header).setFontWeight('bold').setBackground('#E0E0E0');
      actuales.push(header);
      siguienteCol++;
    }
  });
}

function obtenerHojaUsuarios() {
  const sheet = getSpreadsheet().getSheetByName(HOJAS.USUARIOS);
  if (!sheet) {
    throw new Error('La hoja de Usuarios no existe. Ejecute setup() para inicializar el sistema.');
  }
  asegurarEncabezadosUsuarios(sheet);
  return sheet;
}

function obtenerUsuarioVigente(email) {
  const emailNorm = normalizarCorreo(email);
  if (!emailNorm) return null;

  const cache = CacheService.getScriptCache();
  const cacheKey = 'USER_STATE_' + emailNorm;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const usuarios = getSheetData(HOJAS.USUARIOS);
  const usuario = usuarios.find(function (u) {
    return normalizarCorreo(u.Correo) === emailNorm;
  }) || null;

  if (usuario) {
    cache.put(cacheKey, JSON.stringify(usuario), USER_STATE_CACHE_TTL);
  }
  return usuario;
}

function invalidarCacheUsuario(email) {
  CacheService.getScriptCache().remove('USER_STATE_' + normalizarCorreo(email));
}

// --- Utilidades de contraseñas ---
function generarCadenaHex(longitud) {
  let salida = '';
  while (salida.length < longitud) {
    salida += Utilities.getUuid().replace(/-/g, '');
  }
  return salida.substring(0, longitud);
}

function bytesAHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = (bytes[i] + 256) % 256;
    hex += ('0' + b.toString(16)).slice(-2);
  }
  return hex;
}

function derivarHashContrasena(contrasena, salt, iteraciones) {
  let bytes = Utilities.newBlob(salt + ':' + contrasena).getBytes();
  for (let i = 0; i < iteraciones; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  }
  return bytesAHex(bytes);
}

function generarHashContrasena(contrasena) {
  const salt = generarCadenaHex(32);
  const hash = derivarHashContrasena(contrasena, salt, PASSWORD_HASH_ITERATIONS);
  return PASSWORD_HASH_PREFIX + '$' + PASSWORD_HASH_ITERATIONS + '$' + salt + '$' + hash;
}

function verificarContrasena(contrasena, hashAlmacenado) {
  if (!contrasena || !hashAlmacenado) return false;
  const partes = String(hashAlmacenado).split('$');
  if (partes.length !== 4 || partes[0] !== PASSWORD_HASH_PREFIX) return false;
  const iteraciones = parseInt(partes[1], 10);
  if (!iteraciones || iteraciones < 1000 || iteraciones > 100000) return false;
  const calculado = derivarHashContrasena(contrasena, partes[2], iteraciones);
  return compararTiempoConstante(calculado, partes[3]);
}

function compararTiempoConstante(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (sa.length !== sb.length) return false;
  let diferencia = 0;
  for (let i = 0; i < sa.length; i++) {
    diferencia |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  }
  return diferencia === 0;
}

function aleatorioEntero(max) {
  if (max <= 0) return 0;
  const hex = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
  return parseInt(hex, 16) % max;
}

function elegirAleatorio(cadena) {
  return cadena.charAt(aleatorioEntero(cadena.length));
}

function generarContrasenaTemporal(longitud) {
  const len = longitud || PASSWORD_GENERATED_LENGTH;
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const numeros = '23456789';
  const especiales = '!@#$%&*?-_';
  const todos = mayusculas + minusculas + numeros + especiales;

  const caracteres = [
    elegirAleatorio(mayusculas),
    elegirAleatorio(minusculas),
    elegirAleatorio(numeros),
    elegirAleatorio(especiales)
  ];
  while (caracteres.length < len) {
    caracteres.push(elegirAleatorio(todos));
  }
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = aleatorioEntero(i + 1);
    const tmp = caracteres[i];
    caracteres[i] = caracteres[j];
    caracteres[j] = tmp;
  }
  return caracteres.join('');
}

// --- Control de intentos de acceso ---
function verificarBloqueoLogin(emailNorm) {
  const cache = CacheService.getScriptCache();
  const intentos = parseInt(cache.get('LOGIN_FAIL_' + emailNorm) || '0', 10);
  if (intentos >= LOGIN_MAX_INTENTOS) {
    throw new Error('Demasiados intentos fallidos. Intente de nuevo en unos minutos.');
  }
}

function registrarIntentoFallido(emailNorm) {
  const cache = CacheService.getScriptCache();
  const clave = 'LOGIN_FAIL_' + emailNorm;
  const intentos = parseInt(cache.get(clave) || '0', 10) + 1;
  cache.put(clave, String(intentos), LOGIN_BLOQUEO_SEGUNDOS);
}

function limpiarIntentosFallidos(emailNorm) {
  CacheService.getScriptCache().remove('LOGIN_FAIL_' + emailNorm);
}

// --- API de autenticación ---
function login(email, password) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Ingrese un correo electrónico válido.');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Ingrese su contraseña.');
  }

  const emailNorm = normalizarCorreo(email);
  verificarBloqueoLogin(emailNorm);

  obtenerHojaUsuarios();
  const usuarios = getSheetData(HOJAS.USUARIOS);
  const user = usuarios.find(function (u) {
    return normalizarCorreo(u.Correo) === emailNorm;
  });

  if (!user) {
    registrarIntentoFallido(emailNorm);
    throw new Error('Usuario o contraseña incorrectos.');
  }

  const hashAlmacenado = String(user.Contrasena_Hash || '').trim();
  if (!hashAlmacenado) {
    throw new Error('Su cuenta aún no tiene una contraseña configurada. Contacte al administrador.');
  }

  if (!verificarContrasena(password, hashAlmacenado)) {
    registrarIntentoFallido(emailNorm);
    throw new Error('Usuario o contraseña incorrectos.');
  }

  if (!esUsuarioActivo(user)) {
    throw new Error('Usuario inactivo. Contacte al administrador.');
  }

  limpiarIntentosFallidos(emailNorm);

  // Si el navegador tenía una sesión anterior, se invalida antes de emitir la nueva.
  eliminarSesionPorToken(TOKEN_SESION_ACTUAL);

  const token = generarTokenSesion();
  const sesionObj = {
    email: String(user.Correo).trim(),
    nombre: String(user.Nombre).trim(),
    rol: String(user.Rol).trim(),
    subdireccion: String(user.Subdirección).trim(),
    jefaturaDepartamento: String(user.Jefatura_Departamento || '').trim(),
    loginTime: Date.now()
  };

  guardarSesion(token, sesionObj);
  limpiarSesionesExpiradas();

  return Object.assign({}, sesionObj, { token: token });
}

function logout() {
  eliminarSesionPorToken(TOKEN_SESION_ACTUAL);
  TOKEN_SESION_ACTUAL = null;
  return true;
}

/**
 * Restaura la sesión del navegador actual. Requiere el token que el cliente
 * conserva en sessionStorage; sin token no se adopta ninguna sesión.
 */
function obtenerSesion() {
  const token = TOKEN_SESION_ACTUAL;
  if (!token) return null;
  try {
    const sesion = validarSesion();
    return Object.assign({}, sesion, { token: token });
  } catch (e) {
    return null;
  }
}

/**
 * Única fuente de verdad para autorizar una petición. Valida el token contra
 * el registro de sesiones y refresca rol/estado desde la hoja de Usuarios.
 */
function validarSesion() {
  const token = TOKEN_SESION_ACTUAL;
  if (!token) {
    throw new Error('Sesión no válida o expirada. Por favor inicie sesión.');
  }

  const sesion = leerSesionPorToken(token);
  if (!sesion || !sesion.email) {
    eliminarSesionPorToken(token);
    throw new Error('Sesión no válida o expirada. Por favor inicie sesión.');
  }

  const loginTime = Number(sesion.loginTime || 0);
  if (!loginTime || (Date.now() - loginTime) > SESSION_TTL_MS) {
    eliminarSesionPorToken(token);
    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
  }

  const usuario = obtenerUsuarioVigente(sesion.email);
  if (!usuario || !esUsuarioActivo(usuario)) {
    eliminarSesionPorToken(token);
    throw new Error('Su cuenta ya no está activa. Contacte al administrador.');
  }

  return {
    email: String(usuario.Correo).trim(),
    nombre: String(usuario.Nombre).trim(),
    rol: String(usuario.Rol).trim(),
    subdireccion: String(usuario.Subdirección).trim(),
    jefaturaDepartamento: String(usuario.Jefatura_Departamento || '').trim(),
    loginTime: loginTime
  };
}

// ==========================================
// ROUTING Y RECURSOS WEB
// ==========================================
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Sistema de Acuerdos de Dirección')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

// ==========================================
// FILTROS DE VISIBILIDAD DE INFORMACIÓN
// ==========================================

function esInvolucradoString(cadenaMultivalor, email) {
  if (!cadenaMultivalor || !email) return false;
  const list = String(cadenaMultivalor).toLowerCase().split(',').map(s => s.trim());
  return list.includes(String(email).toLowerCase());
}

function esInvolucradoMultiVal(cadenaMultivalor, valorBuscado) {
  if (!cadenaMultivalor || !valorBuscado) return false;
  const list = String(cadenaMultivalor).toLowerCase().split(',').map(s => s.trim());
  return list.includes(String(valorBuscado).toLowerCase().trim());
}

// A. PROYECTOS
function listarProyectos() {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.OPERADOR) {
    return [];
  }

  const proyectos = getSheetData(HOJAS.PROYECTOS);
  if (sesion.rol === ROLES.ADMINISTRADOR) {
    return proyectos;
  }

  const minutas = getSheetData(HOJAS.MINUTAS);
  const acuerdos = getSheetData(HOJAS.ACUERDOS);

  const foliosMinutasVisibles = new Set();
  minutas.forEach(m => {
    if (String(m.Creado_Por).trim().toLowerCase() === sesion.email.toLowerCase()) {
      foliosMinutasVisibles.add(String(m.Folio).trim());
    }
  });

  const asistencia = getSheetData(HOJAS.ASISTENCIA);
  asistencia.forEach(a => {
    const correoVal = a['Correo Electrónico'] || a.Correo || '';
    if (esInvolucradoString(a.Nombre, sesion.nombre) || esInvolucradoString(correoVal, sesion.email)) {
      foliosMinutasVisibles.add(String(a.Folio_Minuta).trim());
    }
  });

  const idsProyectosConMinuta = new Set();
  minutas.forEach(m => {
    if (foliosMinutasVisibles.has(String(m.Folio).trim())) {
      idsProyectosConMinuta.add(String(m.ID_Proyecto).trim());
    }
  });

  const idsProyectosConAcuerdo = new Set();
  acuerdos.forEach(a => {
    const subMatch = esInvolucradoMultiVal(a.Subdirección_Asignada, sesion.subdireccion);
    const jefMatch = sesion.jefaturaDepartamento ? esInvolucradoMultiVal(a.Jefaturas_Asignadas, sesion.jefaturaDepartamento) : false;
    const creadorMatch = String(a.Creado_Por).trim().toLowerCase() === sesion.email.toLowerCase();
    const respMatch = esInvolucradoString(a.Responsables, sesion.email);
    const solMatch = esInvolucradoString(a.Solicitantes, sesion.email);

    if (subMatch || jefMatch || creadorMatch || respMatch || solMatch) {
      const projId = a.ID_Proyecto || (a.Folio_Minuta ? minutas.find(m => String(m.Folio).trim() === String(a.Folio_Minuta).trim())?.ID_Proyecto : '');
      if (projId) idsProyectosConAcuerdo.add(String(projId).trim());
    }
  });

  return proyectos.filter(p => {
    const idP = String(p.ID_Proyecto).trim();
    const esCreador = String(p.Creado_Por).trim().toLowerCase() === sesion.email.toLowerCase();
    return esCreador || idsProyectosConMinuta.has(idP) || idsProyectosConAcuerdo.has(idP);
  });
}

// B. MINUTAS
function listarMinutas(filtros) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.OPERADOR) {
    return [];
  }

  let minutas = getSheetData(HOJAS.MINUTAS);
  const asistencia = getSheetData(HOJAS.ASISTENCIA);

  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    const foliosAsistidos = new Set();
    asistencia.forEach(a => {
      const correoVal = a['Correo Electrónico'] || a.Correo || '';
      if (esInvolucradoString(a.Nombre, sesion.nombre) || esInvolucradoString(correoVal, sesion.email)) {
        foliosAsistidos.add(String(a.Folio_Minuta).trim());
      }
    });

    minutas = minutas.filter(m => {
      const creadorMatch = String(m.Creado_Por).trim().toLowerCase() === sesion.email.toLowerCase();
      const asistioMatch = foliosAsistidos.has(String(m.Folio).trim());
      return creadorMatch || asistioMatch;
    });
  }

  if (filtros) {
    if (filtros.idProyecto) {
      minutas = minutas.filter(m => String(m.ID_Proyecto).trim() === String(filtros.idProyecto).trim());
    }
    if (filtros.etapa) {
      minutas = minutas.filter(m => String(m.Etapa).trim() === String(filtros.etapa).trim());
    }
    if (filtros.busqueda) {
      const q = String(filtros.busqueda).toLowerCase();
      minutas = minutas.filter(m =>
        String(m.Folio).toLowerCase().includes(q) ||
        String(m.Nombre_Reunión).toLowerCase().includes(q) ||
        String(m.Lugar).toLowerCase().includes(q) ||
        String(m.Objetivos).toLowerCase().includes(q)
      );
    }
  }

  return minutas;
}

function obtenerMinuta(folio) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.OPERADOR) {
    throw new Error('Acceso no permitido para el rol Operador.');
  }

  const minutas = listarMinutas();
  const minuta = minutas.find(m => String(m.Folio).trim() === String(folio).trim());
  if (!minuta) return null;

  const asistenciaRaw = getSheetData(HOJAS.ASISTENCIA).filter(a => String(a.Folio_Minuta).trim() === String(folio).trim());
  const asistencia = asistenciaRaw.map(a => {
    const correoVal = a['Correo Electrónico'] || a.Correo || '';
    const asistioVal = a.Asistencia !== undefined && a.Asistencia !== '' ? a.Asistencia : (a.Assitencia !== undefined && a.Assitencia !== '' ? a.Assitencia : (a.Asistio !== undefined ? a.Asistio : 'Sí'));
    const depVal = a.Dependencia_Area || a.Dependencia || a.Area || '';
    return {
      ID_Asistencia: a.ID_Asistencia || '',
      Folio_Minuta: a.Folio_Minuta || folio,
      Nombre: a.Nombre || '',
      Cargo: a.Cargo || '',
      Correo: correoVal,
      Dependencia_Area: depVal,
      Asistencia: asistioVal,
      Asistio: asistioVal
    };
  });

  const ordenDelDia = getSheetData(HOJAS.ORDEN_DEL_DIA).filter(o => String(o.Folio_Minuta).trim() === String(folio).trim());
  const acuerdos = listarAcuerdos().filter(a => String(a.Folio_Minuta).trim() === String(folio).trim());

  return {
    minuta,
    asistencia,
    ordenDelDia,
    acuerdos
  };
}

// C. ACUERDOS
function listarAcuerdos(filtros) {
  const sesion = validarSesion();
  let acuerdos = getSheetData(HOJAS.ACUERDOS);

  if (sesion.rol === ROLES.JEFATURA) {
    acuerdos = acuerdos.filter(a => {
      const jefMatch = sesion.jefaturaDepartamento ? esInvolucradoMultiVal(a.Jefaturas_Asignadas, sesion.jefaturaDepartamento) : false;
      const respMatch = esInvolucradoString(a.Responsables, sesion.email);
      const creadorMatch = String(a.Creado_Por).trim().toLowerCase() === sesion.email.toLowerCase();
      return jefMatch || respMatch || creadorMatch;
    });
  } else if (sesion.rol !== ROLES.ADMINISTRADOR) {
    acuerdos = acuerdos.filter(a => {
      const subMatch = esInvolucradoMultiVal(a.Subdirección_Asignada, sesion.subdireccion);
      const creadorMatch = String(a.Creado_Por).trim().toLowerCase() === sesion.email.toLowerCase();
      const respMatch = esInvolucradoString(a.Responsables, sesion.email);
      const solMatch = esInvolucradoString(a.Solicitantes, sesion.email);
      return subMatch || creadorMatch || respMatch || solMatch;
    });
  }

  if (filtros) {
    if (filtros.estatus) {
      acuerdos = acuerdos.filter(a => String(a.Estatus).trim() === String(filtros.estatus).trim());
    }
    if (filtros.prioridad) {
      acuerdos = acuerdos.filter(a => String(a.Prioridad).trim() === String(filtros.prioridad).trim());
    }
    if (filtros.subdireccion) {
      acuerdos = acuerdos.filter(a => esInvolucradoMultiVal(a.Subdirección_Asignada, filtros.subdireccion));
    }
    if (filtros.jefatura) {
      acuerdos = acuerdos.filter(a => esInvolucradoMultiVal(a.Jefaturas_Asignadas, filtros.jefatura));
    }
    if (filtros.idProyecto) {
      acuerdos = acuerdos.filter(a => String(a.ID_Proyecto).trim() === String(filtros.idProyecto).trim());
    }
    if (filtros.origen) {
      acuerdos = acuerdos.filter(a => String(a.Origen).trim() === String(filtros.origen).trim());
    }
    if (filtros.folioMinuta) {
      acuerdos = acuerdos.filter(a => String(a.Folio_Minuta).trim() === String(filtros.folioMinuta).trim());
    }
    if (filtros.busqueda) {
      const q = String(filtros.busqueda).toLowerCase();
      acuerdos = acuerdos.filter(a =>
        String(a.ID_Acuerdo).toLowerCase().includes(q) ||
        String(a.Descripción_Acuerdo).toLowerCase().includes(q) ||
        String(a.Responsables).toLowerCase().includes(q) ||
        String(a.Solicitantes).toLowerCase().includes(q)
      );
    }
    if (filtros.fechaDesde) {
      acuerdos = acuerdos.filter(a => formatDateShort(a.Fecha_Límite) >= filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      acuerdos = acuerdos.filter(a => formatDateShort(a.Fecha_Límite) <= filtros.fechaHasta);
    }
  }

  return acuerdos;
}

function obtenerAcuerdo(idAcuerdo) {
  const acuerdos = listarAcuerdos();
  const acuerdo = acuerdos.find(a => String(a.ID_Acuerdo).trim() === String(idAcuerdo).trim());
  if (!acuerdo) return null;

  const sesion = validarSesion();
  const comentarios = getSheetData(HOJAS.COMENTARIOS_SEGUIMIENTO).filter(c => String(c.ID_Acuerdo).trim() === String(idAcuerdo).trim());
  const notificaciones = getSheetData(HOJAS.LOG_NOTIFICACIONES).filter(l => String(l.ID_Acuerdo).trim() === String(idAcuerdo).trim());

  return {
    acuerdo,
    comentarios,
    notificaciones
  };
}

// ==========================================
// OPERACIONES CRUD DE NEGOCIO
// ==========================================

// --- PROYECTOS ---
function crearProyecto(data) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Acción no permitida para su rol.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJAS.PROYECTOS);
    const idP = generarIDUnico(HOJAS.PROYECTOS, 'PRY');
    const now = formatDate(new Date());

    const headers = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim()) : ENCABEZADOS[HOJAS.PROYECTOS];
    let etapaIdx = headers.indexOf('Etapa');
    if (etapaIdx === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Etapa').setFontWeight('bold').setBackground('#E0E0E0');
    }

    const newRow = [
      idP,
      data.nombreProyecto || '',
      data.descripcion || '',
      data.estatus || 'Activo',
      now,
      sesion.email,
      data.etapa || 'Planeación'
    ];

    sheet.appendRow(newRow);
    return { success: true, idProyecto: idP, message: 'Proyecto creado correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

function actualizarProyecto(idProyecto, data) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Acción no permitida para su rol.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJAS.PROYECTOS);
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(idProyecto).trim()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Proyecto no encontrado.');
    }

    let etapaIdx = headers.indexOf('Etapa');
    if (etapaIdx === -1 && data.etapa !== undefined) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Etapa').setFontWeight('bold').setBackground('#E0E0E0');
      etapaIdx = sheet.getLastColumn() - 1;
    }

    const setColVal = (colName, val) => {
      let idx = headers.indexOf(colName);
      if (idx !== -1) {
        sheet.getRange(rowIndex, idx + 1).setValue(val);
      }
    };

    if (data.nombreProyecto !== undefined) setColVal('Nombre_Proyecto', data.nombreProyecto);
    if (data.descripcion !== undefined) setColVal('Descripción', data.descripcion);
    if (data.estatus !== undefined) setColVal('Estatus', data.estatus);
    if (data.etapa !== undefined) {
      if (etapaIdx !== -1) {
        sheet.getRange(rowIndex, etapaIdx + 1).setValue(data.etapa);
      }
    }

    return { success: true, message: 'Proyecto actualizado correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEtapaProyecto(idProyecto, nuevaEtapa) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Solo el Administrador puede modificar la etapa del proyecto.');
  }
  if (!nuevaEtapa || !nuevaEtapa.trim()) {
    throw new Error('Debe especificar una etapa válida.');
  }
  return actualizarProyecto(idProyecto, { etapa: nuevaEtapa.trim() });
}

// --- MINUTAS Y SUS COMPONENTES ---
function crearMinuta(data) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Acción no permitida para su rol.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = getSpreadsheet();
    const minSheet = ss.getSheetByName(HOJAS.MINUTAS);
    const folio = generarFolioMinutaAnual();
    const now = formatDate(new Date());

    const newMinutaRow = [
      folio,
      data.idProyecto || '',
      data.etapa || 'Planeación',
      data.nombreReunion || '',
      data.fecha || formatDateShort(new Date()),
      data.lugar || '',
      data.objetivos || '',
      sesion.email,
      now
    ];
    minSheet.appendRow(newMinutaRow);

    guardarAsistenciaMinuta(ss, folio, data.asistencia);

    if (Array.isArray(data.ordenDelDia) && data.ordenDelDia.length > 0) {
      const oddSheet = ss.getSheetByName(HOJAS.ORDEN_DEL_DIA);
      data.ordenDelDia.forEach((odd, idx) => {
        const idOdd = generarIDUnico(HOJAS.ORDEN_DEL_DIA, 'ODD');
        const numPunto = odd.numeroPunto || (idx + 1).toFixed(1);
        oddSheet.appendRow([idOdd, folio, numPunto, odd.descripcionPunto || '']);
      });
    }

    if (Array.isArray(data.acuerdos) && data.acuerdos.length > 0) {
      data.acuerdos.forEach(acu => {
        acu.folioMinuta = folio;
        acu.origen = 'Minuta';
        if (!acu.idProyecto) acu.idProyecto = data.idProyecto || '';
        crearAcuerdoInterno(acu, sesion, ss);
      });
    }

    return { success: true, folio: folio, message: 'Minuta guardada con éxito.' };
  } finally {
    lock.releaseLock();
  }
}

function actualizarMinuta(folio, data) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Acción no permitida para su rol.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = getSpreadsheet();
    const minSheet = ss.getSheetByName(HOJAS.MINUTAS);
    const rows = minSheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(folio).trim()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Minuta no encontrada.');
    }

    if (data.idProyecto !== undefined) minSheet.getRange(rowIndex, 2).setValue(data.idProyecto);
    if (data.etapa !== undefined) minSheet.getRange(rowIndex, 3).setValue(data.etapa);
    if (data.nombreReunion !== undefined) minSheet.getRange(rowIndex, 4).setValue(data.nombreReunion);
    if (data.fecha !== undefined) minSheet.getRange(rowIndex, 5).setValue(data.fecha);
    if (data.lugar !== undefined) minSheet.getRange(rowIndex, 6).setValue(data.lugar);
    if (data.objetivos !== undefined) minSheet.getRange(rowIndex, 7).setValue(data.objetivos);

    if (Array.isArray(data.asistencia)) {
      eliminarRegistrosHijo(HOJAS.ASISTENCIA, 2, folio);
      guardarAsistenciaMinuta(ss, folio, data.asistencia);
    }

    if (Array.isArray(data.ordenDelDia)) {
      eliminarRegistrosHijo(HOJAS.ORDEN_DEL_DIA, 2, folio);
      const oddSheet = ss.getSheetByName(HOJAS.ORDEN_DEL_DIA);
      data.ordenDelDia.forEach((odd, idx) => {
        const idOdd = generarIDUnico(HOJAS.ORDEN_DEL_DIA, 'ODD');
        const numPunto = odd.numeroPunto || (idx + 1).toFixed(1);
        oddSheet.appendRow([idOdd, folio, numPunto, odd.descripcionPunto || '']);
      });
    }

    // Sincronizar acuerdos derivados si fueron provistos en data
    if (Array.isArray(data.acuerdos)) {
      const acuSheet = ss.getSheetByName(HOJAS.ACUERDOS);
      const existingAcuerdos = getSheetData(HOJAS.ACUERDOS).filter(a => String(a.Folio_Minuta).trim() === String(folio).trim());
      const existingIds = new Set(existingAcuerdos.map(a => String(a.ID_Acuerdo).trim()));

      data.acuerdos.forEach(acu => {
        if (acu.idAcuerdo && existingIds.has(String(acu.idAcuerdo).trim())) {
          actualizarAcuerdo(acu.idAcuerdo, acu);
        } else {
          acu.folioMinuta = folio;
          acu.origen = 'Minuta';
          if (!acu.idProyecto) acu.idProyecto = data.idProyecto || '';
          crearAcuerdoInterno(acu, sesion, ss);
        }
      });
    }

    return { success: true, message: 'Minuta actualizada correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

function guardarAsistenciaMinuta(ss, folio, asistenciaArray) {
  if (!Array.isArray(asistenciaArray) || asistenciaArray.length === 0) return;
  const astSheet = ss.getSheetByName(HOJAS.ASISTENCIA);
  const headers = astSheet.getLastColumn() > 0 ? astSheet.getRange(1, 1, 1, astSheet.getLastColumn()).getValues()[0] : ENCABEZADOS[HOJAS.ASISTENCIA];

  asistenciaArray.forEach(ast => {
    const idAst = ast.idAsistencia || generarIDUnico(HOJAS.ASISTENCIA, 'AST');
    const row = [];
    headers.forEach(h => {
      const hNorm = String(h).trim().toLowerCase();
      if (hNorm === 'id_asistencia') {
        row.push(idAst);
      } else if (hNorm === 'folio_minuta') {
        row.push(folio);
      } else if (hNorm === 'nombre') {
        row.push(ast.nombre || '');
      } else if (hNorm === 'cargo') {
        row.push(ast.cargo || '');
      } else if (hNorm === 'dependencia_area' || hNorm === 'dependencia' || hNorm === 'area') {
        row.push(ast.dependenciaArea || ast.dependencia || '');
      } else if (hNorm.includes('correo')) {
        row.push(ast.correo || ast['correo electrónico'] || '');
      } else if (hNorm.includes('asist')) {
        row.push(ast.asistio ? 'Sí' : 'No');
      } else {
        row.push('');
      }
    });
    astSheet.appendRow(row);
  });
}

function eliminarRegistrosHijo(nombreHoja, colFolioIndex, folioMinuta) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(nombreHoja);
  if (sheet.getLastRow() <= 1) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colFolioIndex - 1]).trim() === String(folioMinuta).trim()) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ==========================================
// CENTRALIZADOR ÚNICO DE ENVÍO DE CORREO
// ==========================================
function enviarCorreoCentralizado({ to, subject, body, idAcuerdo = '', attachments = [] }) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName(HOJAS.LOG_NOTIFICACIONES);
  const idLog = generarIDUnico(HOJAS.LOG_NOTIFICACIONES, 'LOG');
  const now = formatDate(new Date());

  if (!to || typeof to !== 'string' || !to.trim()) {
    logSheet.appendRow([
      idLog,
      idAcuerdo || 'GENERAL',
      'SIN_DESTINATARIOS',
      subject,
      now,
      'Fallido: Sin destinatarios especificados'
    ]);
    return { success: false, reason: 'Sin destinatarios' };
  }

  const mailOptions = {
    to: to.trim(),
    subject: subject,
    body: body
  };
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  try {
    MailApp.sendEmail(mailOptions);
    logSheet.appendRow([
      idLog,
      idAcuerdo || 'GENERAL',
      to.trim(),
      subject,
      now,
      'Enviado'
    ]);
    return { success: true, destinatarios: to.trim() };
  } catch (err) {
    logSheet.appendRow([
      idLog,
      idAcuerdo || 'GENERAL',
      to.trim(),
      subject,
      now,
      `Fallido: ${err.message}`
    ]);
    return { success: false, error: err.message };
  }
}

// --- ACCIÓN (a): ENVIAR MINUTA POR CORREO (PDF) ---
function enviarMinutaPorCorreo(folio) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.OPERADOR || sesion.rol === ROLES.JEFATURA) {
    throw new Error('Acción no permitida para su rol.');
  }

  const ss = getSpreadsheet();
  const det = obtenerMinuta(folio);
  if (!det || !det.minuta) {
    throw new Error('No se encontró la minuta especificada.');
  }

  const m = det.minuta;
  const asistencia = det.asistencia || [];
  const ordenDelDia = det.ordenDelDia || [];
  const acuerdos = det.acuerdos || [];

  const correosSet = new Set();
  asistencia.forEach(a => {
    const asistioVal = a.Asistencia !== undefined ? a.Asistencia : (a.Asistio !== undefined ? a.Asistio : 'Sí');
    const esPresente = (asistioVal === 'Sí' || asistioVal === 'SI' || asistioVal === true || asistioVal === 'VERDADERO' || asistioVal === '1');
    const emailVal = a.Correo || a['Correo Electrónico'] || '';
    if (esPresente && emailVal && String(emailVal).includes('@')) {
      correosSet.add(String(emailVal).trim());
    }
  });

  if (correosSet.size === 0) {
    throw new Error('No hay asistentes confirmados (con Asistencia = "Sí") que tengan correo registrado en esta minuta.');
  }

  const destinatariosStr = Array.from(correosSet).join(', ');

  let htmlAsistientes = '';
  asistencia.forEach(a => {
    const asistioVal = a.Asistencia !== undefined ? a.Asistencia : (a.Asistio !== undefined ? a.Asistio : 'Sí');
    const correoVal = a.Correo || a['Correo Electrónico'] || '';
    htmlAsistientes += `<tr>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.Nombre}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.Cargo}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${correoVal}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${asistioVal}</td>
    </tr>`;
  });

  let htmlODD = '';
  ordenDelDia.forEach(o => {
    htmlODD += `<tr>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${o.Número_Punto}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${o.Descripción_Punto}</td>
    </tr>`;
  });

  let htmlAcuerdos = '';
  acuerdos.forEach(a => {
    htmlAcuerdos += `<tr>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.ID_Acuerdo}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.Tipo}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.Descripción_Acuerdo}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.Subdirección_Asignada}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${a.Responsables}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${formatDateShort(a.Fecha_Límite)}</td>
    </tr>`;
  });

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
        h2 { color: #2b4c7e; border-bottom: 2px solid #2b4c7e; padding-bottom: 5px; }
        h4 { color: #2b4c7e; margin-top: 20px; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th { background-color: #f2f2f2; color: #333; padding: 6px; border: 1px solid #ccc; text-align: left; }
        .info-table td { padding: 4px 8px; }
      </style>
    </head>
    <body>
      <h2>Minuta de Reunión: ${m.Folio}</h2>
      <table class="info-table" style="margin-bottom: 15px;">
        <tr><td><strong>Nombre de Reunión:</strong> ${m.Nombre_Reunión}</td><td><strong>Etapa:</strong> ${m.Etapa}</td></tr>
        <tr><td><strong>Fecha:</strong> ${m.Fecha}</td><td><strong>Lugar:</strong> ${m.Lugar}</td></tr>
        <tr><td colspan="2"><strong>Objetivos:</strong> ${m.Objetivos || 'N/A'}</td></tr>
      </table>

      <h4>1. Lista de Asistencia</h4>
      <table>
        <thead>
          <tr><th>Nombre</th><th>Cargo</th><th>Correo</th><th>Asistió</th></tr>
        </thead>
        <tbody>
          ${htmlAsistientes || '<tr><td colspan="4">Sin asistentes registrados</td></tr>'}
        </tbody>
      </table>

      <h4>2. Orden del Día</h4>
      <table>
        <thead>
          <tr><th style="width: 80px;">Punto</th><th>Descripción</th></tr>
        </thead>
        <tbody>
          ${htmlODD || '<tr><td colspan="2">Sin puntos del orden del día</td></tr>'}
        </tbody>
      </table>

      <h4>3. Acuerdos Derivados</h4>
      <table>
        <thead>
          <tr><th>ID</th><th>Tipo</th><th>Descripción</th><th>Subdirección</th><th>Responsables</th><th>Fecha Límite</th></tr>
        </thead>
        <tbody>
          ${htmlAcuerdos || '<tr><td colspan="6">Sin acuerdos derivados</td></tr>'}
        </tbody>
      </table>

      <br><br>
      <div style="font-size: 10px; color: #777; text-align: center;">
        Generado por el Sistema de Acuerdos de Dirección — H. Ayuntamiento de Mérida
      </div>
    </body>
    </html>
  `;

  const pdfBlob = Utilities.newBlob(htmlBody, 'text/html', `Minuta_${m.Folio}.html`).getAs('application/pdf').setName(`Minuta_${m.Folio}.pdf`);

  const asunto = `Minuta de Reunión – ${m.Folio} – ${m.Nombre_Reunión}`;
  const cuerpoTexto = `Estimado(a),\n\nAdjunto encontrará la Minuta de Reunión ${m.Folio} ("${m.Nombre_Reunión}") en formato PDF para su consulta y archivo.\n\nAtentamente,\nSistema de Acuerdos de Dirección`;

  // Invocar ÚNICAMENTE a través del centralizador
  const res = enviarCorreoCentralizado({
    to: destinatariosStr,
    subject: asunto,
    body: cuerpoTexto,
    idAcuerdo: m.Folio,
    attachments: [pdfBlob]
  });

  if (!res.success) {
    throw new Error(res.error || 'Error al enviar correo de minuta');
  }

  return { success: true, destinatarios: destinatariosStr, message: `Minuta ${m.Folio} enviada exitosamente a asistentes confirmados: ${destinatariosStr}` };
}

// --- ACUERDOS ---
function crearAcuerdo(data) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.LECTOR || sesion.rol === ROLES.JEFATURA) {
    throw new Error('No tiene permisos para crear acuerdos.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    return crearAcuerdoInterno(data, sesion, ss);
  } finally {
    lock.releaseLock();
  }
}

function obtenerJefaturasPermitidasParaSubdirecciones(subdireccionesCadena) {
  if (!subdireccionesCadena) return [];
  const subsArray = String(subdireccionesCadena).split(',').map(s => s.trim().toLowerCase());
  const catData = getSheetData(HOJAS.CATALOGOS);
  const jefs = [];
  catData.forEach(item => {
    if (String(item.Tipo).trim() === 'Jefatura') {
      const padreNorm = String(item.Padre || '').trim().toLowerCase();
      if (subsArray.includes(padreNorm)) {
        jefs.push(String(item.Valor).trim());
      }
    }
  });
  return jefs;
}

function crearAcuerdoInterno(data, sesion, ss) {
  const acuSheet = ss.getSheetByName(HOJAS.ACUERDOS);
  const origen = data.origen === 'Minuta' ? 'Minuta' : 'Individual';
  const prefijo = origen === 'Minuta' ? 'ACU' : 'ACU-IND';
  const idAcuerdo = generarIDUnico(HOJAS.ACUERDOS, prefijo);
  const now = formatDate(new Date());

  let subAsignadaStr = '';
  let jefAsignadasStr = '';

  const catData = getSheetData(HOJAS.CATALOGOS);
  const subsValidasCatalogo = catData.filter(c => String(c.Tipo).trim() === 'Subdirección').map(c => String(c.Valor).trim());

  if (sesion.rol === ROLES.ADMINISTRADOR) {
    const subsRecibidas = Array.isArray(data.subdireccionAsignada) ? data.subdireccionAsignada : (data.subdireccionAsignada ? String(data.subdireccionAsignada).split(',').map(s => s.trim()) : []);
    const subsValidas = subsRecibidas.filter(s => subsValidasCatalogo.includes(s));
    subAsignadaStr = subsValidas.join(', ');

    const jefsPermitidas = obtenerJefaturasPermitidasParaSubdirecciones(subAsignadaStr);
    const jefsRecibidas = Array.isArray(data.jefaturasAsignadas) ? data.jefaturasAsignadas : (data.jefaturasAsignadas ? String(data.jefaturasAsignadas).split(',').map(s => s.trim()) : []);
    const jefsValidas = jefsRecibidas.filter(j => jefsPermitidas.includes(j));
    jefAsignadasStr = jefsValidas.join(', ');
  } else if (sesion.rol === ROLES.OPERADOR) {
    // Operador puede asignar a subdirecciones del catálogo; si no selecciona ninguna, por defecto se usa su subdirección
    const subsRecibidas = Array.isArray(data.subdireccionAsignada) ? data.subdireccionAsignada : (data.subdireccionAsignada ? String(data.subdireccionAsignada).split(',').map(s => s.trim()) : []);
    const subsValidas = subsRecibidas.filter(s => subsValidasCatalogo.includes(s));
    subAsignadaStr = subsValidas.length > 0 ? subsValidas.join(', ') : (sesion.subdireccion || '');

    const jefsPermitidas = obtenerJefaturasPermitidasParaSubdirecciones(subAsignadaStr);
    const jefsRecibidas = Array.isArray(data.jefaturasAsignadas) ? data.jefaturasAsignadas : (data.jefaturasAsignadas ? String(data.jefaturasAsignadas).split(',').map(s => s.trim()) : []);
    const jefsValidas = jefsRecibidas.filter(j => jefsPermitidas.includes(j));
    jefAsignadasStr = jefsValidas.join(', ');
  }

  const headers = acuSheet.getLastColumn() > 0 ? acuSheet.getRange(1, 1, 1, acuSheet.getLastColumn()).getValues()[0] : ENCABEZADOS[HOJAS.ACUERDOS];

  const row = [];
  headers.forEach(h => {
    const hNorm = String(h).trim().toLowerCase();
    if (hNorm === 'id_acuerdo') row.push(idAcuerdo);
    else if (hNorm === 'folio_minuta') row.push(origen === 'Minuta' ? (data.folioMinuta || '') : '');
    else if (hNorm === 'tipo') row.push(data.tipo || 'Acuerdo');
    else if (hNorm === 'descripción_acuerdo' || hNorm === 'descripcion_acuerdo') row.push(data.descripcionAcuerdo || '');
    else if (hNorm === 'prioridad') row.push(data.prioridad || 'Media');
    else if (hNorm === 'solicitantes') row.push(data.solicitantes || '');
    else if (hNorm === 'responsables') row.push(data.responsables || '');
    else if (hNorm === 'fecha_límite' || hNorm === 'fecha_limite') row.push(data.fechaLimite || formatDateShort(new Date()));
    else if (hNorm === 'subdirección_asignada' || hNorm === 'subdireccion_asignada') row.push(subAsignadaStr);
    else if (hNorm === 'estatus') row.push(data.estatus || 'Pendiente');
    else if (hNorm === 'origen') row.push(origen);
    else if (hNorm === 'creado_por') row.push(sesion.email);
    else if (hNorm === 'fecha_creación' || hNorm === 'fecha_creacion') row.push(now);
    else if (hNorm === 'fecha_modificación' || hNorm === 'fecha_modificacion') row.push(now);
    else if (hNorm === 'id_proyecto') row.push(data.idProyecto || '');
    else if (hNorm === 'jefaturas_asignadas') row.push(jefAsignadasStr);
    else row.push('');
  });

  acuSheet.appendRow(row);

  // NOTA: No se envían correos en creación conforme a la instrucción de restringir a los 3 casos

  return { success: true, idAcuerdo: idAcuerdo, message: 'Acuerdo creado correctamente.' };
}

function actualizarAcuerdo(idAcuerdo, data) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.LECTOR) {
    throw new Error('No tiene permisos para modificar acuerdos.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJAS.ACUERDOS);
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(idAcuerdo).trim()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Acuerdo no encontrado.');
    }

    const estatusIdx = headers.indexOf('Estatus');
    const estatusAnterior = estatusIdx !== -1 ? String(rows[rowIndex - 1][estatusIdx]).trim() : '';

    const setColValue = (colName, val) => {
      const idx = headers.indexOf(colName);
      if (idx !== -1) {
        sheet.getRange(rowIndex, idx + 1).setValue(val);
      }
    };

    if (sesion.rol === ROLES.OPERADOR) {
      if (data.estatus !== undefined) setColValue('Estatus', data.estatus);

      // Asignación de Subdirección(es) para el rol Operador
      let subOperadorActual = sheet.getRange(rowIndex, headers.indexOf('Subdirección_Asignada') + 1).getValue();
      if (data.subdireccionAsignada !== undefined) {
        const subsRecibidas = Array.isArray(data.subdireccionAsignada) ? data.subdireccionAsignada : (data.subdireccionAsignada ? String(data.subdireccionAsignada).split(',').map(s => s.trim()) : []);
        const catData = getSheetData(HOJAS.CATALOGOS);
        const subsValidasCatalogo = catData.filter(c => String(c.Tipo).trim() === 'Subdirección').map(c => String(c.Valor).trim());
        const subsFinales = subsRecibidas.filter(s => subsValidasCatalogo.includes(s));
        if (subsFinales.length > 0) {
          subOperadorActual = subsFinales.join(', ');
          setColValue('Subdirección_Asignada', subOperadorActual);
        }
      }

      if (data.jefaturasAsignadas !== undefined) {
        const jefsPermitidas = obtenerJefaturasPermitidasParaSubdirecciones(subOperadorActual || sesion.subdireccion);
        const jefsRecibidas = Array.isArray(data.jefaturasAsignadas) ? data.jefaturasAsignadas : (data.jefaturasAsignadas ? String(data.jefaturasAsignadas).split(',').map(s => s.trim()) : []);
        const jefsValidas = jefsRecibidas.filter(j => jefsPermitidas.includes(j));
        setColValue('Jefaturas_Asignadas', jefsValidas.join(', '));
      }
    } else if (sesion.rol === ROLES.JEFATURA) {
      if (data.estatus !== undefined) setColValue('Estatus', data.estatus);
    } else if (sesion.rol === ROLES.ADMINISTRADOR) {
      if (data.tipo !== undefined) setColValue('Tipo', data.tipo);
      if (data.descripcionAcuerdo !== undefined) setColValue('Descripción_Acuerdo', data.descripcionAcuerdo);
      if (data.prioridad !== undefined) setColValue('Prioridad', data.prioridad);
      if (data.solicitantes !== undefined) setColValue('Solicitantes', data.solicitantes);
      if (data.responsables !== undefined) setColValue('Responsables', data.responsables);
      if (data.fechaLimite !== undefined) setColValue('Fecha_Límite', data.fechaLimite);
      if (data.subdireccionAsignada !== undefined) {
        const subStr = Array.isArray(data.subdireccionAsignada) ? data.subdireccionAsignada.join(', ') : data.subdireccionAsignada;
        setColValue('Subdirección_Asignada', subStr);
      }
      if (data.estatus !== undefined) setColValue('Estatus', data.estatus);
      if (data.idProyecto !== undefined) setColValue('ID_Proyecto', data.idProyecto);
      if (data.jefaturasAsignadas !== undefined) {
        const jefStr = Array.isArray(data.jefaturasAsignadas) ? data.jefaturasAsignadas.join(', ') : data.jefaturasAsignadas;
        setColValue('Jefaturas_Asignadas', jefStr);
      }
    }

    const now = formatDate(new Date());
    setColValue('Fecha_Modificación', now);

    // REGISTRO DE CAMBIO DE ESTATUS EN COMENTARIOS_SEGUIMIENTO
    const estatusNuevo = data.estatus !== undefined ? String(data.estatus).trim() : estatusAnterior;
    if (estatusNuevo && estatusNuevo !== estatusAnterior) {
      registrarEventoCambioEstatus(idAcuerdo, estatusAnterior, estatusNuevo, sesion.email, now, ss);

      // ACCIÓN (b): Cuando un acuerdo cambie su estatus a "Cumplido", enviar correo
      if (estatusNuevo === 'Cumplido') {
        notificarAcuerdoCumplido(idAcuerdo, ss);
      }
    }

    return { success: true, message: 'Acuerdo actualizado correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

function registrarEventoCambioEstatus(idAcuerdo, estatusAnterior, estatusNuevo, usuario, fechaHora, ss) {
  try {
    const sheetCom = ss.getSheetByName(HOJAS.COMENTARIOS_SEGUIMIENTO);
    const idCom = generarIDUnico(HOJAS.COMENTARIOS_SEGUIMIENTO, 'COM');
    const textoEvento = `[EVENTO_ESTATUS] Cambio de estatus: "${estatusAnterior || 'Sin estatus'}" ➔ "${estatusNuevo}"`;
    sheetCom.appendRow([
      idCom,
      idAcuerdo,
      usuario,
      fechaHora,
      textoEvento
    ]);
  } catch (err) {
    console.error('Error al registrar evento de cambio de estatus:', err);
  }
}

// --- ACCIÓN (b): Notificar únicamente cuando el estatus cambia a "Cumplido" ---
function notificarAcuerdoCumplido(idAcuerdo, ss) {
  const acuerdos = getSheetData(HOJAS.ACUERDOS);
  const acuerdo = acuerdos.find(a => String(a.ID_Acuerdo).trim() === String(idAcuerdo).trim());
  if (!acuerdo) return;

  const usuarios = getSheetData(HOJAS.USUARIOS);
  const subAsignadas = String(acuerdo.Subdirección_Asignada || '').split(',').map(s => s.trim());
  const jefAsignadas = String(acuerdo.Jefaturas_Asignadas || '').split(',').map(s => s.trim());

  const correosSet = new Set();

  usuarios.forEach(u => {
    const matchSub = subAsignadas.includes(String(u.Subdirección).trim());
    const matchJef = u.Jefatura_Departamento && jefAsignadas.includes(String(u.Jefatura_Departamento).trim());
    if ((matchSub || matchJef) && (String(u.Activo).trim().toUpperCase() === 'SÍ' || String(u.Activo).trim().toUpperCase() === 'SI')) {
      correosSet.add(String(u.Correo).trim());
    }
  });

  if (acuerdo.Responsables) {
    String(acuerdo.Responsables).split(',').map(s => s.trim()).forEach(r => {
      if (r.includes('@')) correosSet.add(r);
    });
  }

  if (acuerdo.Creado_Por && acuerdo.Creado_Por.includes('@')) {
    correosSet.add(String(acuerdo.Creado_Por).trim());
  }

  if (correosSet.size === 0) return;

  const destinatariosStr = Array.from(correosSet).join(', ');
  const asunto = `✅ Acuerdo Cumplido – ${acuerdo.ID_Acuerdo} – [${acuerdo.Prioridad}]`;
  const cuerpo = `
Estimado(a) equipo,

El siguiente acuerdo ha sido marcado como CUMPLIDO:

• ID / Folio: ${acuerdo.ID_Acuerdo} ${acuerdo.Folio_Minuta ? '(' + acuerdo.Folio_Minuta + ')' : ''}
• Descripción: ${acuerdo.Descripción_Acuerdo}
• Subdirección(es): ${acuerdo.Subdirección_Asignada}
• Jefatura(s): ${acuerdo.Jefaturas_Asignadas || 'Ninguna'}
• Responsables: ${acuerdo.Responsables}
• Fecha de Cierre: ${formatDateShort(new Date())}

Atentamente,
Sistema de Acuerdos de Dirección
  `.trim();

  enviarCorreoCentralizado({
    to: destinatariosStr,
    subject: asunto,
    body: cuerpo,
    idAcuerdo: idAcuerdo
  });
}

// --- COMENTARIOS DE SEGUIMIENTO ---
function agregarComentario(idAcuerdo, comentario) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.LECTOR) {
    throw new Error('Los usuarios Lectores no pueden añadir comentarios.');
  }

  if (!comentario || !comentario.trim()) {
    throw new Error('El comentario no puede estar vacío.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJAS.COMENTARIOS_SEGUIMIENTO);
    const idCom = generarIDUnico(HOJAS.COMENTARIOS_SEGUIMIENTO, 'COM');
    const now = formatDate(new Date());

    sheet.appendRow([
      idCom,
      idAcuerdo,
      sesion.email,
      now,
      comentario.trim()
    ]);

    return { success: true, idComentario: idCom, message: 'Comentario agregado.' };
  } finally {
    lock.releaseLock();
  }
}

// --- ACCIÓN (c): ENVIAR RECORDATORIO MANUAL DESDE DETALLE DE ACUERDO ---
function enviarRecordatorioManualAcuerdo(idAcuerdo) {
  const sesion = validarSesion();
  if (sesion.rol === ROLES.JEFATURA || sesion.rol === ROLES.LECTOR) {
    throw new Error('No tiene permisos para enviar recordatorios de acuerdos.');
  }

  const ss = getSpreadsheet();
  const acuerdos = getSheetData(HOJAS.ACUERDOS);
  const acuerdo = acuerdos.find(a => String(a.ID_Acuerdo).trim() === String(idAcuerdo).trim());
  if (!acuerdo) throw new Error('Acuerdo no encontrado.');

  const usuarios = getSheetData(HOJAS.USUARIOS);
  const subAsignadas = String(acuerdo.Subdirección_Asignada || '').split(',').map(s => s.trim());
  const jefAsignadas = String(acuerdo.Jefaturas_Asignadas || '').split(',').map(s => s.trim());

  const correosSet = new Set();

  usuarios.forEach(u => {
    const matchSub = subAsignadas.includes(String(u.Subdirección).trim());
    const matchJef = u.Jefatura_Departamento && jefAsignadas.includes(String(u.Jefatura_Departamento).trim());
    if ((matchSub || matchJef) && (String(u.Activo).trim().toUpperCase() === 'SÍ' || String(u.Activo).trim().toUpperCase() === 'SI')) {
      correosSet.add(String(u.Correo).trim());
    }
  });

  if (acuerdo.Responsables) {
    const listResp = String(acuerdo.Responsables).split(',').map(s => s.trim());
    listResp.forEach(r => {
      if (r.includes('@')) correosSet.add(r);
    });
  }

  const asunto = `⚠️ RECORDATORIO DE ACUERDO: ${acuerdo.ID_Acuerdo} – [${acuerdo.Prioridad}]`;

  if (correosSet.size === 0) {
    throw new Error('No hay usuarios activos registrados en las subdirecciones/jefaturas asignadas como responsables.');
  }

  const destinatariosStr = Array.from(correosSet).join(', ');
  const cuerpo = `
⚠️ RECORDATORIO MANUAL DE SEGUIMIENTO DE ACUERDO

• ID Acuerdo: ${acuerdo.ID_Acuerdo}
• Folio Minuta: ${acuerdo.Folio_Minuta || 'Individual'}
• Descripción: ${acuerdo.Descripción_Acuerdo}
• Subdirección Asignada: ${acuerdo.Subdirección_Asignada}
• Jefaturas Asignadas: ${acuerdo.Jefaturas_Asignadas || 'Ninguna'}
• Responsables: ${acuerdo.Responsables}
• Prioridad: ${acuerdo.Prioridad}
• Estatus Actual: ${acuerdo.Estatus}
• Fecha Límite: ${formatDateShort(acuerdo.Fecha_Límite)}

Estimados responsables, se les solicita atentamente revisar el avance de este acuerdo.

Atentamente,
Sistema de Acuerdos de Dirección
  `.trim();

  // Enviar ÚNICAMENTE a través del centralizador
  const res = enviarCorreoCentralizado({
    to: destinatariosStr,
    subject: asunto,
    body: cuerpo,
    idAcuerdo: idAcuerdo
  });

  if (!res.success) {
    throw new Error(res.error || 'Error al enviar recordatorio');
  }

  const now = formatDate(new Date());
  registrarEventoRecordatorio(idAcuerdo, sesion.email, now, ss, destinatariosStr);

  return { success: true, message: `Recordatorio enviado a los responsables (${destinatariosStr}).` };
}

function registrarEventoRecordatorio(idAcuerdo, usuario, fechaHora, ss, destinatarios) {
  try {
    const sheetCom = ss.getSheetByName(HOJAS.COMENTARIOS_SEGUIMIENTO);
    const idCom = generarIDUnico(HOJAS.COMENTARIOS_SEGUIMIENTO, 'COM');
    const textoEvento = `[EVENTO_RECORDATORIO] Recordatorio enviado a responsables: ${destinatarios}`;
    sheetCom.appendRow([
      idCom,
      idAcuerdo,
      usuario,
      fechaHora,
      textoEvento
    ]);
  } catch (err) {
    console.error('Error al registrar evento de recordatorio:', err);
  }
}

// ==========================================
// GESTIÓN DE USUARIOS Y CATÁLOGOS (ADMIN)
// ==========================================

function publicoDeUsuario(usuario) {
  return {
    Correo: String(usuario.Correo || '').trim(),
    Nombre: String(usuario.Nombre || '').trim(),
    Rol: String(usuario.Rol || '').trim(),
    Subdirección: String(usuario.Subdirección || '').trim(),
    Activo: String(usuario.Activo || '').trim(),
    Jefatura_Departamento: String(usuario.Jefatura_Departamento || '').trim(),
    TieneContrasena: !!String(usuario.Contrasena_Hash || '').trim()
  };
}

function listarUsuarios() {
  const sesion = validarSesion();
  const usuarios = getSheetData(HOJAS.USUARIOS).map(publicoDeUsuario);
  if (sesion.rol === ROLES.ADMINISTRADOR) {
    return usuarios;
  }
  return usuarios.filter(function (u) {
    return normalizarCorreo(u.Correo) === normalizarCorreo(sesion.email);
  });
}

function guardarUsuario(data) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Solo los Administradores pueden gestionar usuarios.');
  }
  if (!data || !data.correo || !String(data.correo).trim()) {
    throw new Error('El correo electrónico es obligatorio.');
  }

  const correoNorm = normalizarCorreo(data.correo);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNorm)) {
    throw new Error('Ingrese un correo electrónico válido.');
  }

  const rol = String(data.rol || ROLES.OPERADOR).trim();
  if (Object.values(ROLES).indexOf(rol) === -1) {
    throw new Error('Rol no válido.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = obtenerHojaUsuarios();
    const headers = obtenerEncabezados(sheet);
    const idx = indiceEncabezados(headers);
    const rows = sheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (normalizarCorreo(rows[i][idx.Correo]) === correoNorm) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      // Al editar nunca se tocan las columnas de contraseña.
      sheet.getRange(rowIndex, idx.Nombre + 1).setValue(data.nombre || '');
      sheet.getRange(rowIndex, idx.Rol + 1).setValue(rol);
      sheet.getRange(rowIndex, idx.Subdirección + 1).setValue(data.subdireccion || '');
      sheet.getRange(rowIndex, idx.Activo + 1).setValue(data.activo || 'Sí');
      sheet.getRange(rowIndex, idx.Jefatura_Departamento + 1).setValue(data.jefaturaDepartamento || '');
      invalidarCacheUsuario(correoNorm);

      if (String(data.activo || 'Sí').trim().toUpperCase() === 'NO') {
        eliminarSesionesDeUsuario(correoNorm);
      }
      return { success: true, message: 'Usuario actualizado correctamente.' };
    }

    const contrasenaTemporal = generarContrasenaTemporal();
    const fila = new Array(headers.length).fill('');
    fila[idx.Correo] = String(data.correo).trim();
    fila[idx.Nombre] = data.nombre || '';
    fila[idx.Rol] = rol;
    fila[idx.Subdirección] = data.subdireccion || '';
    fila[idx.Activo] = data.activo || 'Sí';
    fila[idx.Jefatura_Departamento] = data.jefaturaDepartamento || '';
    fila[idx.Contrasena_Hash] = generarHashContrasena(contrasenaTemporal);
    fila[idx.Contrasena_Actualizada] = ahoraTexto();
    sheet.appendRow(fila);
    invalidarCacheUsuario(correoNorm);

    return {
      success: true,
      message: 'Usuario registrado correctamente. Comparta la contraseña temporal por un canal seguro.',
      correo: String(data.correo).trim(),
      contrasenaTemporal: contrasenaTemporal
    };
  } finally {
    lock.releaseLock();
  }
}

function eliminarUsuario(email) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Solo los Administradores pueden eliminar usuarios.');
  }

  const correoNorm = normalizarCorreo(email);
  if (correoNorm === normalizarCorreo(sesion.email)) {
    throw new Error('No puede eliminar su propia cuenta activa.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = obtenerHojaUsuarios();
    const headers = obtenerEncabezados(sheet);
    const idx = indiceEncabezados(headers);
    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      if (normalizarCorreo(rows[i][idx.Correo]) === correoNorm) {
        sheet.deleteRow(i + 1);
        invalidarCacheUsuario(correoNorm);
        eliminarSesionesDeUsuario(correoNorm);
        return { success: true, message: 'Usuario eliminado.' };
      }
    }
    throw new Error('Usuario no encontrado.');
  } finally {
    lock.releaseLock();
  }
}

function restablecerContrasena(email) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Solo los Administradores pueden restablecer contraseñas.');
  }

  const correoNorm = normalizarCorreo(email);
  if (!correoNorm) {
    throw new Error('Correo electrónico no válido.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = obtenerHojaUsuarios();
    const headers = obtenerEncabezados(sheet);
    const idx = indiceEncabezados(headers);
    const rows = sheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (normalizarCorreo(rows[i][idx.Correo]) === correoNorm) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) {
      throw new Error('Usuario no encontrado.');
    }

    const contrasenaTemporal = generarContrasenaTemporal();
    sheet.getRange(rowIndex, idx.Contrasena_Hash + 1).setValue(generarHashContrasena(contrasenaTemporal));
    sheet.getRange(rowIndex, idx.Contrasena_Actualizada + 1).setValue(ahoraTexto());

    invalidarCacheUsuario(correoNorm);
    // Un restablecimiento invalida cualquier sesión abierta de ese usuario.
    eliminarSesionesDeUsuario(correoNorm);

    return {
      success: true,
      message: 'Contraseña restablecida. Comparta la contraseña temporal por un canal seguro.',
      correo: String(rows[rowIndex - 1][idx.Correo]).trim(),
      contrasenaTemporal: contrasenaTemporal
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Genera contraseñas para los usuarios que aún no tienen una (migración de
 * usuarios existentes). Puede ejecutarse desde la interfaz por un
 * Administrador o desde el editor del script para el arranque inicial.
 */
function generarCredencialesUsuariosExistentes(claveBootstrap) {
  const sesionAdmin = obtenerSesionAdministradorParaCredenciales();
  if (!sesionAdmin && !esClaveBootstrapValida(claveBootstrap)) {
    throw new Error('Solo los Administradores pueden generar credenciales.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = obtenerHojaUsuarios();
    const headers = obtenerEncabezados(sheet);
    const idx = indiceEncabezados(headers);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, message: 'No hay usuarios registrados.', credenciales: [] };
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    const credenciales = [];

    for (let i = 0; i < rows.length; i++) {
      const correo = String(rows[i][idx.Correo] || '').trim();
      if (!correo) continue;
      if (String(rows[i][idx.Contrasena_Hash] || '').trim()) continue;

      const contrasenaTemporal = generarContrasenaTemporal();
      const fila = i + 2;
      sheet.getRange(fila, idx.Contrasena_Hash + 1).setValue(generarHashContrasena(contrasenaTemporal));
      sheet.getRange(fila, idx.Contrasena_Actualizada + 1).setValue(ahoraTexto());

      credenciales.push({
        correo: correo,
        nombre: String(rows[i][idx.Nombre] || '').trim(),
        contrasena: contrasenaTemporal
      });
      invalidarCacheUsuario(correo);
    }

    if (credenciales.length === 0) {
      return { success: true, message: 'Todos los usuarios ya tienen una contraseña configurada.', credenciales: [] };
    }

    return {
      success: true,
      message: 'Se generaron ' + credenciales.length + ' credenciales temporales. Compártalas por un canal seguro.',
      credenciales: credenciales
    };
  } finally {
    lock.releaseLock();
  }
}

function obtenerSesionAdministradorParaCredenciales() {
  try {
    const sesion = validarSesion();
    return sesion.rol === ROLES.ADMINISTRADOR ? sesion : null;
  } catch (e) {
    return null;
  }
}

/**
 * Valida el secreto de arranque almacenado en las propiedades del script.
 * Permite generar las credenciales iniciales desde el editor sin depender de
 * la identidad que Google Apps Script reporta en la Web App.
 */
function esClaveBootstrapValida(claveBootstrap) {
  if (!claveBootstrap || typeof claveBootstrap !== 'string') return false;
  const esperada = PropertiesService.getScriptProperties().getProperty(BOOTSTRAP_SECRET_PROPERTY);
  if (!esperada) return false;
  return compararTiempoConstante(String(claveBootstrap).trim(), String(esperada).trim());
}

/**
 * Acceso inicial desde el editor del script.
 *
 * El nombre termina en guion bajo para que sea una función privada: el editor
 * puede ejecutarla, pero `google.script.run` no puede invocarla desde la Web
 * App. Garantiza el Administrador principal con su contraseña de arranque y
 * genera las contraseñas pendientes del resto de usuarios.
 */
function ingresoInicialAdministrador_() {
  const props = PropertiesService.getScriptProperties();
  let secreto = props.getProperty(BOOTSTRAP_SECRET_PROPERTY);
  if (!secreto) {
    secreto = generarCadenaHex(32);
    props.setProperty(BOOTSTRAP_SECRET_PROPERTY, secreto);
  }

  // Garantiza que el Administrador principal exista, esté activo y tenga la
  // contraseña de arranque configurada.
  asegurarAdministradorInicial_();

  const resultado = generarCredencialesUsuariosExistentes(secreto);
  const credenciales = (resultado.credenciales || []).slice();

  console.log('=== ACCESO INICIAL AL SISTEMA ===');
  console.log('Administrador principal: ' + ADMIN_INICIAL_CORREO);
  console.log('Contraseña de arranque configurada. Cámbiela después del primer ingreso.');
  if (credenciales.length > 0) {
    console.log('=== CREDENCIALES TEMPORALES DEL RESTO DE USUARIOS ===');
    credenciales.forEach(function (credencial) {
      console.log(credencial.correo + ' | ' + credencial.contrasena);
    });
  }

  return {
    success: true,
    message: 'Acceso inicial generado. Revise el registro de ejecución.',
    credenciales: credenciales
  };
}

/**
 * Garantiza que el Administrador principal exista con el rol, estado y hash
 * de arranque configurados. Si no existe, se inserta como primer usuario.
 */
function asegurarAdministradorInicial_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = obtenerHojaUsuarios();
    const headers = obtenerEncabezados(sheet);
    const idx = indiceEncabezados(headers);
    const rows = sheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (normalizarCorreo(rows[i][idx.Correo]) === normalizarCorreo(ADMIN_INICIAL_CORREO)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      const fila = new Array(headers.length).fill('');
      fila[idx.Correo] = ADMIN_INICIAL_CORREO;
      fila[idx.Nombre] = ADMIN_INICIAL_NOMBRE;
      fila[idx.Rol] = ROLES.ADMINISTRADOR;
      fila[idx.Subdirección] = ADMIN_INICIAL_SUBDIRECCION;
      fila[idx.Activo] = 'Sí';
      fila[idx.Jefatura_Departamento] = '';
      fila[idx.Contrasena_Hash] = ADMIN_INICIAL_HASH;
      fila[idx.Contrasena_Actualizada] = ahoraTexto();

      // Se inserta como primer usuario de la hoja.
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, headers.length).setValues([fila]);
      rowIndex = 2;
    } else {
      // Se conservan nombre y subdirección existentes; sólo se garantiza el
      // rol, el estado activo y la contraseña de arranque.
      sheet.getRange(rowIndex, idx.Rol + 1).setValue(ROLES.ADMINISTRADOR);
      sheet.getRange(rowIndex, idx.Activo + 1).setValue('Sí');
      sheet.getRange(rowIndex, idx.Contrasena_Hash + 1).setValue(ADMIN_INICIAL_HASH);
      sheet.getRange(rowIndex, idx.Contrasena_Actualizada + 1).setValue(ahoraTexto());
    }

    invalidarCacheUsuario(ADMIN_INICIAL_CORREO);
    eliminarSesionesDeUsuario(ADMIN_INICIAL_CORREO);
    return rowIndex;
  } finally {
    lock.releaseLock();
  }
}

// --- CATÁLOGOS ---
function obtenerCatalogos() {
  validarSesion();
  const catData = getSheetData(HOJAS.CATALOGOS);
  const result = {
    Dependencia: [],
    Subdirección: [],
    Jefatura: [],
    Etapa: [],
    Prioridad: [],
    Estatus: [],
    Organigrama: []
  };

  catData.forEach(item => {
    const tipo = String(item.Tipo).trim();
    const valor = String(item.Valor).trim();
    const padre = String(item.Padre || '').trim();

    if (result[tipo] && valor) {
      if (!result[tipo].includes(valor)) {
        result[tipo].push(valor);
      }
    }

    if (tipo === 'Jefatura' && valor) {
      result.Organigrama.push({ jefatura: valor, subdireccion: padre });
    }
  });

  return result;
}

function guardarCatalogoItem(tipo, valor, padre = '') {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Solo los Administradores pueden modificar catálogos.');
  }

  if (!tipo || !valor || !valor.trim()) {
    throw new Error('Tipo y valor son obligatorios.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJAS.CATALOGOS);
    const rows = sheet.getDataRange().getValues();

    const valorNorm = valor.trim().toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === tipo && String(rows[i][1]).trim().toLowerCase() === valorNorm) {
        throw new Error('Ese valor ya existe en el catálogo.');
      }
    }

    sheet.appendRow([tipo, valor.trim(), padre ? padre.trim() : '']);
    return { success: true, message: 'Item agregado al catálogo.' };
  } finally {
    lock.releaseLock();
  }
}

function eliminarCatalogoItem(tipo, valor) {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('Solo los Administradores pueden modificar catálogos.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJAS.CATALOGOS);
    const rows = sheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === tipo && String(rows[i][1]).trim() === valor) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Item eliminado del catálogo.' };
      }
    }
    throw new Error('Item no encontrado en el catálogo.');
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// DASHBOARD & KPIS
// ==========================================
function obtenerKPIsDashboard() {
  const sesion = validarSesion();
  const acuerdos = listarAcuerdos();
  const proyectos = listarProyectos();
  const minutas = listarMinutas();

  const totalProyectos = proyectos.length;
  const totalMinutas = minutas.length;
  const totalAcuerdos = acuerdos.length;

  let pendientes = 0;
  let enProceso = 0;
  let cumplidos = 0;
  let cancelados = 0;
  let porVencer = 0;
  let vencidos = 0;

  const hoyDate = new Date();
  hoyDate.setHours(0, 0, 0, 0);

  const porSubdireccion = {};
  const desglosePorSubdireccion = {};

  acuerdos.forEach(a => {
    const est = String(a.Estatus).trim();
    if (est === 'Pendiente') pendientes++;
    else if (est === 'En Proceso') enProceso++;
    else if (est === 'Cumplido') cumplidos++;
    else if (est === 'Cancelado') cancelados++;

    const subs = String(a.Subdirección_Asignada || 'Sin Asignar').split(',').map(s => s.trim()).filter(Boolean);
    const subsArray = subs.length > 0 ? subs : ['Sin Asignar'];

    subsArray.forEach(sub => {
      porSubdireccion[sub] = (porSubdireccion[sub] || 0) + 1;

      if (!desglosePorSubdireccion[sub]) {
        desglosePorSubdireccion[sub] = {
          subdireccion: sub,
          total: 0,
          atendidos: 0,
          enProceso: 0,
          pendientes: 0,
          cancelados: 0
        };
      }
      desglosePorSubdireccion[sub].total++;
      if (est === 'Cumplido') {
        desglosePorSubdireccion[sub].atendidos++;
      } else if (est === 'En Proceso') {
        desglosePorSubdireccion[sub].enProceso++;
      } else if (est === 'Pendiente') {
        desglosePorSubdireccion[sub].pendientes++;
      } else if (est === 'Cancelado') {
        desglosePorSubdireccion[sub].cancelados++;
      }
    });

    if (est === 'Pendiente' || est === 'En Proceso') {
      if (a.Fecha_Límite) {
        let fLim = new Date(a.Fecha_Límite);
        if (isNaN(fLim.getTime())) {
          const parts = String(a.Fecha_Límite).split('-');
          if (parts.length === 3) fLim = new Date(parts[0], parts[1] - 1, parts[2]);
        }
        if (!isNaN(fLim.getTime())) {
          fLim.setHours(0, 0, 0, 0);
          const diffMs = fLim.getTime() - hoyDate.getTime();
          const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

          if (diffDias < 0) {
            vencidos++;
          } else if (diffDias >= 0 && diffDias <= 3) {
            porVencer++;
          }
        }
      }
    }
  });

  return {
    totalProyectos,
    totalMinutas,
    totalAcuerdos,
    pendientes,
    enProceso,
    cumplidos,
    cancelados,
    porVencer,
    vencidos,
    porSubdireccion,
    desglosePorSubdireccion
  };
}

function obtenerKPIsAdminDashboard() {
  const sesion = validarSesion();
  if (sesion.rol !== ROLES.ADMINISTRADOR) {
    throw new Error('El Dashboard de Administración es exclusivo para el rol Administrador.');
  }

  const acuerdos = getSheetData(HOJAS.ACUERDOS);

  const respStats = {};

  acuerdos.forEach(a => {
    const est = String(a.Estatus).trim();
    const resps = String(a.Responsables || 'Sin Asignar').split(',').map(r => r.trim());

    resps.forEach(r => {
      if (!r) return;
      if (!respStats[r]) {
        respStats[r] = {
          responsable: r,
          totalAsignados: 0,
          cerrados: 0,
          pendientesEnProceso: 0,
          tiempoCumplimientoDiasSum: 0,
          tiempoCumplimientoCount: 0
        };
      }

      respStats[r].totalAsignados++;
      if (est === 'Cumplido') {
        respStats[r].cerrados++;

        if (a.Fecha_Creación && a.Fecha_Modificación) {
          const fCrea = new Date(a.Fecha_Creación);
          const fMod = new Date(a.Fecha_Modificación);
          if (!isNaN(fCrea.getTime()) && !isNaN(fMod.getTime()) && fMod >= fCrea) {
            const diffDias = (fMod.getTime() - fCrea.getTime()) / (1000 * 60 * 60 * 24);
            respStats[r].tiempoCumplimientoDiasSum += diffDias;
            respStats[r].tiempoCumplimientoCount++;
          }
        }
      } else if (est === 'Pendiente' || est === 'En Proceso') {
        respStats[r].pendientesEnProceso++;
      }
    });
  });

  const tablaProductividad = Object.values(respStats).map(st => {
    const eficiencia = st.totalAsignados > 0 ? Math.round((st.cerrados / st.totalAsignados) * 100) : 0;
    const tiempoPromedioDias = st.tiempoCumplimientoCount > 0 ? (st.tiempoCumplimientoDiasSum / st.tiempoCumplimientoCount).toFixed(1) : 'N/A';
    return {
      responsable: st.responsable,
      totalAsignados: st.totalAsignados,
      cerrados: st.cerrados,
      cargaActual: st.pendientesEnProceso,
      eficiencia: eficiencia,
      tiempoPromedioDias: tiempoPromedioDias
    };
  });

  const atendidosPorMes = {};
  acuerdos.forEach(a => {
    if (String(a.Estatus).trim() === 'Cumplido') {
      const fechaRef = a.Fecha_Modificación || a.Fecha_Creación;
      if (fechaRef) {
        let mesClave = 'S/F';
        if (typeof fechaRef === 'string') {
          mesClave = fechaRef.substring(0, 7);
        } else if (fechaRef instanceof Date) {
          mesClave = formatDateShort(fechaRef).substring(0, 7);
        }
        atendidosPorMes[mesClave] = (atendidosPorMes[mesClave] || 0) + 1;
      }
    }
  });

  const totalCerradosGeneral = acuerdos.filter(a => String(a.Estatus).trim() === 'Cumplido').length;
  const eficienciaGeneral = acuerdos.length > 0 ? Math.round((totalCerradosGeneral / acuerdos.length) * 100) : 0;

  return {
    tablaProductividad,
    atendidosPorMes,
    eficienciaGeneral,
    totalAcuerdosGeneral: acuerdos.length,
    totalCerradosGeneral
  };
}
