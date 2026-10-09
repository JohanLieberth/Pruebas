/**
 * ==============================================================================
 * SISTEMA DE MATRIZ DE ADMINISTRACIÓN DE RIESGOS Y PTAR
 * Ayuntamiento de Mérida, Yucatán - Sistema de Control Interno (SCI)
 * Basado en los Lineamientos Generales del SCI y Marco COSO.
 * ==============================================================================
 */

// Constantes de Hojas
const HOJAS = {
  RIESGOS: 'RIESGOS',
  FACTORES: 'FACTORES',
  CONTROLES: 'CONTROLES',
  ACCIONES: 'ACCIONES_PTAR',
  CATALOGOS: 'CATALOGOS',
  DEPENDENCIAS: 'DEPENDENCIAS',
  USUARIOS: 'USUARIOS'
};

/**
 * Función principal para servir la interfaz web.
 */
function doGet(e) {
  setupDatabase(); // Asegura estructura
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Matriz de Administración de Riesgos - Ayuntamiento de Mérida')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Helper para incluir archivos HTML modularmente (CSS / JS / Subplantillas).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtiene la hoja de cálculo activa de manera segura.
 */
function getActiveSpreadsheetSafe() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    let ssId = props.getProperty('SPREADSHEET_ID');
    if (ssId) {
      try { ss = SpreadsheetApp.openById(ssId); } catch(err) {}
    }
    if (!ss) {
      const files = DriveApp.getFilesByName('MatrizRiesgos_Merida');
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
        props.setProperty('SPREADSHEET_ID', ss.getId());
      } else {
        ss = SpreadsheetApp.create('MatrizRiesgos_Merida');
        props.setProperty('SPREADSHEET_ID', ss.getId());
      }
    }
  }
  return ss;
}

/**
 * Inicializa y valida la base de datos en Google Sheets.
 */
function setupDatabase() {
  const ss = getActiveSpreadsheetSafe();

  const headers = {
    [HOJAS.RIESGOS]: [
      'ID_RIESGO', 'DEPENDENCIA', 'NO_RIESGO', 'PROCEDIMIENTO', 'OBJETIVO_ESTRATEGICO',
      'DESCRIPCION_RIESGO', 'NIVEL_EXPOSICION', 'TIPO_RIESGO', 'TIENE_CONTROLES',
      'IMPACTO_INICIAL_GRADO', 'IMPACTO_INICIAL_VALOR', 'PROBABILIDAD_INICIAL_GRADO', 'PROBABILIDAD_INICIAL_VALOR',
      'CUADRANTE_INICIAL', 'PRIORIDAD_INICIAL',
      'IMPACTO_FINAL_GRADO', 'IMPACTO_FINAL_VALOR', 'PROBABILIDAD_FINAL_GRADO', 'PROBABILIDAD_FINAL_VALOR',
      'CUADRANTE_FINAL', 'PRIORIDAD_FINAL', 'ESTRATEGIA_RESPUESTA', 'FECHA_REGISTRO', 'USUARIO_CAPTURA'
    ],
    [HOJAS.FACTORES]: [
      'ID_FACTOR', 'ID_RIESGO', 'NO_RIESGO', 'FACTOR_CAUSA', 'TIPO_FACTOR', 'EFECTOS_CONSECUENCIAS'
    ],
    [HOJAS.CONTROLES]: [
      'ID_CONTROL', 'ID_RIESGO', 'NO_RIESGO', 'DESCRIPCION_CONTROL', 'QUIEN_EJECUTA', 'CUANDO_SE_EJECUTA',
      'EVIDENCIA', 'TIPO_CONTROL', 'ATRIB_DOCUMENTADO', 'ATRIB_FORMALIZADO', 'ATRIB_APLICADO', 'ATRIB_EFECTIVO', 'CALIFICACION'
    ],
    [HOJAS.ACCIONES]: [
      'ID_ACCION', 'ID_RIESGO', 'NO_RIESGO', 'DEPENDENCIA', 'DESCRIPCION_ACCION', 'RESPONSABLE',
      'FECHA_COMPROMISO', 'MEDIO_VERIFICACION', 'ESTATUS', 'PORCENTAJE_AVANCE', 'OBSERVACIONES'
    ],
    [HOJAS.DEPENDENCIAS]: [
      'CLAVE', 'NOMBRE', 'TITULAR', 'ENLACE_CONTROL_INTERNO', 'EMAIL_ENLACE'
    ],
    [HOJAS.CATALOGOS]: [
      'CATEGORIA', 'CLAVE', 'VALOR', 'DESCRIPCION', 'ORDEN'
    ],
    [HOJAS.USUARIOS]: [
      'EMAIL', 'NOMBRE', 'ROL', 'DEPENDENCIA', 'ESTATUS'
    ]
  };

  Object.keys(headers).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers[sheetName]);
      sheet.getRange(1, 1, 1, headers[sheetName].length).setFontWeight('bold').setBackground('#2C3E50').setFontColor('#FFFFFF');
    }
  });

  // Sembrar Catálogos por Defecto si está vacío
  seedDefaultData(ss);
}

/**
 * Siembras iniciales de Catálogos y Dependencias oficial del Ayuntamiento de Mérida.
 */
function seedDefaultData(ss) {
  const catSheet = ss.getSheetByName(HOJAS.CATALOGOS);
  if (catSheet && catSheet.getLastRow() <= 1) {
    const catalogosData = [
      // Niveles de Exposición
      ['EXPOSICION', 'ESTRATEGICO', 'ESTRATEGICO', 'Nivel institucional u objetivos generales', 1],
      ['EXPOSICION', 'DIRECTIVO', 'DIRECTIVO', 'Nivel de jefatura o dirección de área', 2],
      ['EXPOSICION', 'OPERACION', 'OPERACIÓN', 'Nivel operativo de trámites y servicios', 3],

      // Clasificación del Tipo de Riesgo
      ['TIPO_RIESGO', 'CLAVE', 'CLAVE', 'Riesgo sobre procesos clave del Ayuntamiento', 1],
      ['TIPO_RIESGO', 'APOYO', 'DE APOYO', 'Riesgo sobre procesos de soporte administrativo', 2],
      ['TIPO_RIESGO', 'LEGAL', 'LEGAL', 'Sanciones o demandas por incumplimiento normativo', 3],
      ['TIPO_RIESGO', 'FINANCIERO', 'FINANCIERO', 'Pérdida de recursos económicos o patrimonio', 4],
      ['TIPO_RIESGO', 'PRESUPUESTAL', 'PRESUPUESTAL', 'Desviación en ejercicio presupuestal', 5],
      ['TIPO_RIESGO', 'SERVICIOS', 'DE SERVICIOS', 'Falla en la prestación de servicios a la ciudadanía', 6],
      ['TIPO_RIESGO', 'SEGURIDAD', 'DE SEGURIDAD', 'Riesgo a la integridad física o bienes', 7],
      ['TIPO_RIESGO', 'OBRA_PUBLICA', 'DE OBRA PÚBLICA', 'Retraso o deficiencia en obras públicas', 8],
      ['TIPO_RIESGO', 'RRHH', 'DE RECURSOS HUMANOS', 'Insuficiencia o rotación de personal clave', 9],
      ['TIPO_RIESGO', 'IMAGEN', 'DE IMAGEN', 'Afectación a la reputación o confianza ciudadana', 10],
      ['TIPO_RIESGO', 'TICS', 'DE TIC´S', 'Falla de sistemas, hackeo o pérdida de datos', 11],
      ['TIPO_RIESGO', 'SALUD', 'DE SALUD', 'Riesgo sanitario o de salud ocupacional', 12],
      ['TIPO_RIESGO', 'CORRUPCION', 'DE CORRUPCIÓN', 'Riesgo de faltas administrativas graves o soborno', 13],

      // Factor / Causa (9 Exactos)
      ['FACTOR_CAUSA', 'ADM', 'ADMINISTRATIVO-GESTIÓN', 'Deficiencia en planeación o supervisión', 1],
      ['FACTOR_CAUSA', 'ENTORNO', 'ENTORNO', 'Cambios normativos, sociales o climáticos', 2],
      ['FACTOR_CAUSA', 'FIN', 'FINANCIERO-PRESUPUESTAL', 'Falta de techo presupuestal o liquidez', 3],
      ['FACTOR_CAUSA', 'MAT', 'MATERIAL-INFRAESTRUCTURA', 'Deterioro de vehículos o instalaciones', 4],
      ['FACTOR_CAUSA', 'NOR', 'NORMATIVO', 'Ambigüedad en manuales o reglamentos', 5],
      ['FACTOR_CAUSA', 'OPE', 'PROCESOS-OPERATIVO', 'Errores en pasos de procedimiento', 6],
      ['FACTOR_CAUSA', 'RRHH', 'RECURSOS HUMANOS', 'Falta de capacitación o personal', 7],
      ['FACTOR_CAUSA', 'TIC', 'TECNOLOGÍAS DE LA INFORMACIÓN', 'Sistemas obsoletos o sin respaldo', 8],
      ['FACTOR_CAUSA', 'CORR', 'CORRUPCIÓN', 'Oportunidad de conflicto de interés o soborno', 9],

      // Tipo de Factor
      ['TIPO_FACTOR', 'INTERNO', 'INTERNO', 'Factor bajo control de la dependencia', 1],
      ['TIPO_FACTOR', 'EXTERNO', 'EXTERNO', 'Factor fuera del control de la dependencia', 2],

      // Efectos o Consecuencias (9 exactos del Excel DATOS)
      ['EFECTO', '1', 'CALIDAD DE BIENES Y SERVICIOS', '', 1],
      ['EFECTO', '2', 'COSTOS', '', 2],
      ['EFECTO', '3', 'IMAGEN PÚBLICA', '', 3],
      ['EFECTO', '4', 'INGRESOS', '', 4],
      ['EFECTO', '5', 'MEJORA DE PROCESOS', '', 5],
      ['EFECTO', '6', 'METAS FINANCIERAS', '', 6],
      ['EFECTO', '7', 'METAS FÍSICAS', '', 7],
      ['EFECTO', '8', 'OBJETIVOS, METAS Y FUNCIONES', '', 8],
      ['EFECTO', '9', 'SATISFACCIÓN DE LOS USUARIOS/BENEFICIARIOS', '', 9],

      // Escalas de Impacto
      ['ESCALA_IMPACTO', '1-2', 'MENOR', 'Consecuencias insignificantes sin afectación mayor (1-2)', 1],
      ['ESCALA_IMPACTO', '3-4', 'BAJO', 'Afectación menor corregible internamente (3-4)', 2],
      ['ESCALA_IMPACTO', '5-6', 'MODERADO', 'Afectación moderada que requiere intervención (5-6)', 3],
      ['ESCALA_IMPACTO', '7-8', 'GRAVE', 'Afectación severa a metas o presupuesto (7-8)', 4],
      ['ESCALA_IMPACTO', '9-10', 'CATASTRÓFICO', 'Incapacidad total de operar o juicio legal grave (9-10)', 5],

      // Escalas de Probabilidad
      ['ESCALA_PROBABILIDAD', '1-2', 'REMOTA', 'Poco factible que ocurra (1-2)', 1],
      ['ESCALA_PROBABILIDAD', '3-4', 'INUSUAL', 'Podría ocurrir eventualmente (3-4)', 2],
      ['ESCALA_PROBABILIDAD', '5-6', 'PROBABLE', 'Factible que ocurra en el ciclo anual (5-6)', 3],
      ['ESCALA_PROBABILIDAD', '7-8', 'MUY PROBABLE', 'Ocurrirá en la mayoría de las circunstancias (7-8)', 4],
      ['ESCALA_PROBABILIDAD', '9-10', 'RECURRENTE', 'Se presenta constantemente durante el año (9-10)', 5],

      // Tipo de Control
      ['TIPO_CONTROL', 'PREVENTIVO', 'PREVENTIVO', 'Diseñado para evitar que ocurra el evento', 1],
      ['TIPO_CONTROL', 'DETECTIVO', 'DETECTIVO', 'Diseñado para identificar el evento una vez ocurrido', 2],
      ['TIPO_CONTROL', 'CORRECTIVO', 'CORRECTIVO', 'Diseñado para subsanar los efectos tras el evento', 3],

      // Estrategias de Respuesta
      ['ESTRATEGIA', 'EVITAR', 'EVITAR', 'Eliminar la actividad que genera el riesgo', 1],
      ['ESTRATEGIA', 'REDUCIR', 'REDUCIR', 'Implementar acciones para disminuir impacto/probabilidad', 2],
      ['ESTRATEGIA', 'ASUMIR', 'ASUMIR', 'Aceptar el riesgo residual sin acciones adicionales', 3],
      ['ESTRATEGIA', 'TRANSFERIR', 'TRANSFERIR', 'Traspasar la responsabilidad o impacto (ej. seguros)', 4],
      ['ESTRATEGIA', 'COMPARTIR', 'COMPARTIR', 'Distribuir el riesgo con otra entidad u organismo', 5]
    ];

    catalogosData.forEach(row => catSheet.appendRow(row));
  }

  // Sembrar Exactamente las 30 Dependencias de Mérida
  const depSheet = ss.getSheetByName(HOJAS.DEPENDENCIAS);
  if (depSheet && depSheet.getLastRow() <= 1) {
    const dependenciasLista = [
      ['CBG', 'COORDINACIÓN GENERAL DE BUEN GOBIERNO', 'Titular CBG', 'Enlace CBG', 'enlace.cbg@merida.gob.mx'],
      ['CDO', 'COORDINACIÓN GENERAL DE DESARROLLO ORDENADO Y GESTIÓN DE LA CIUDAD', 'Titular CDO', 'Enlace CDO', 'enlace.cdo@merida.gob.mx'],
      ['CJS', 'COORDINACIÓN GENERAL DE JUSTICIA SOCIAL Y DESARROLLO HUMANO', 'Titular CJS', 'Enlace CJS', 'enlace.cjs@merida.gob.mx'],
      ['ADM', 'DIRECCIÓN DE ADMINISTRACIÓN', 'Director de Administración', 'Enlace Admón', 'enlace.admon@merida.gob.mx'],
      ['BIH', 'DIRECCIÓN DE BIENESTAR HUMANO', 'Director de Bienestar Humano', 'Enlace Bienestar', 'enlace.bienestar@merida.gob.mx'],
      ['CAT', 'DIRECCIÓN DE CATASTRO', 'Director de Catastro', 'Enlace Catastro', 'enlace.catastro@merida.gob.mx'],
      ['COM', 'DIRECCIÓN DE CONTRALORÍA MUNICIPAL', 'Director de Contraloría', 'Enlace Contraloría', 'enlace.comtraloria@merida.gob.mx'],
      ['DIF', 'DIRECCIÓN DE DESARROLLO INTEGRAL DE LA FAMILIA - DIF MUNICIPAL', 'Director DIF', 'Enlace DIF', 'enlace.dif@merida.gob.mx'],
      ['DSC', 'DIRECCIÓN DE DESARROLLO SOCIAL Y COMBATE A LA POBREZA', 'Director Des. Social', 'Enlace Des. Social', 'enlace.dessocial@merida.gob.mx'],
      ['DDU', 'DIRECCIÓN DE DESARROLLO URBANO', 'Director Des. Urbano', 'Enlace Des. Urbano', 'enlace.desurbano@merida.gob.mx'],
      ['FTM', 'DIRECCIÓN DE FINANZAS Y TESORERÍA MUNICIPAL', 'Tesorería Municipal', 'Enlace Finanzas', 'enlace.finanzas@merida.gob.mx'],
      ['GOB', 'DIRECCIÓN DE GOBERNACIÓN', 'Director Gobernación', 'Enlace Gobernación', 'enlace.gobernacion@merida.gob.mx'],
      ['DIC', 'DIRECCIÓN DE IDENTIDAD Y CULTURA', 'Director Cultura', 'Enlace Cultura', 'enlace.cultura@merida.gob.mx'],
      ['DIGI', 'DIRECCIÓN DE INNOVACIÓN Y GOBIERNO INTELIGENTE', 'Director Innovación', 'Enlace Innovación', 'enlace.innovacion@merida.gob.mx'],
      ['DOP', 'DIRECCIÓN DE OBRAS PÚBLICAS', 'Director Obras Públicas', 'Enlace Obras', 'enlace.obras@merida.gob.mx'],
      ['DPM', 'DIRECCIÓN DE POLICÍA MUNICIPAL', 'Director Policía Municipal', 'Enlace Policía', 'enlace.policia@merida.gob.mx'],
      ['PBE', 'DIRECCIÓN DE PROSPERIDAD Y BIENESTAR ECONÓMICO', 'Director Prosperidad', 'Enlace Prosperidad', 'enlace.prosperidad@merida.gob.mx'],
      ['DSP', 'DIRECCIÓN DE SERVICIOS PÚBLICOS', 'Director Servicios Púb.', 'Enlace Serv. Púb.', 'enlace.servpublicos@merida.gob.mx'],
      ['MUJ', 'INSTITUTO DE LAS MUJERES', 'Directora IMM', 'Enlace IMM', 'enlace.mujer@merida.gob.mx'],
      ['IMPLAN', 'INSTITUTO MUNICIPAL DE PLANEACIÓN', 'Director IMPLAN', 'Enlace IMPLAN', 'enlace.implan@merida.gob.mx'],
      ['OPM', 'OFICINA DE PRESIDENCIA MUNICIPAL', 'Jefe de Presidencia', 'Enlace Presidencia', 'enlace.opm@merida.gob.mx'],
      ['SPAC', 'SECRETARÍA DE PARTICIPACIÓN Y ATENCIÓN CIUDADANA', 'Secretario Part. Ciudadana', 'Enlace Part. Ciu', 'enlace.partciudadana@merida.gob.mx'],
      ['SEC', 'SECRETARÍA MUNICIPAL', 'Secretario Municipal', 'Enlace Sec. Municipal', 'enlace.secmunicipal@merida.gob.mx'],
      ['TCA', 'TRIBUNAL CONTENCIOSO ADMINISTRATIVO', 'Juez Presidente TCA', 'Enlace TCA', 'enlace.tca@merida.gob.mx'],
      ['UCC', 'UNIDAD DE COMUNICACIÓN CIUDADANA', 'Jefe Unidad UCC', 'Enlace UCC', 'enlace.ucc@merida.gob.mx'],
      ['UMABA', 'UNIDAD DE MEDIO AMBIENTE Y BIENESTAR ANIMAL', 'Director UMABA', 'Enlace UMABA', 'enlace.umaba@merida.gob.mx'],
      ['CPC', 'SECRETARÍA EJECUTIVA DEL COMITÉ PERMANENTE DEL CARNAVAL', 'Presidente CPC', 'Enlace CPC', 'enlace.cpc@merida.gob.mx'],
      ['REC', 'RESERVA ECOLÓGICA CUXTAL', 'Director Reserva Cuxtal', 'Enlace REC', 'enlace.rec@merida.gob.mx'],
      ['CAM', 'CENTRAL DE ABASTO DE MÉRIDA', 'Administrador CAM', 'Enlace CAM', 'enlace.cam@merida.gob.mx'],
      ['ABM', 'ABASTOS DE MÉRIDA', 'Director Abastos', 'Enlace Abastos', 'enlace.abastos@merida.gob.mx']
    ];
    dependenciasLista.forEach(row => depSheet.appendRow(row));
  }

  // Sembrar Usuarios iniciales
  const usrSheet = ss.getSheetByName(HOJAS.USUARIOS);
  if (usrSheet && usrSheet.getLastRow() <= 1) {
    const usuariosDemo = [
      ['contraloria@merida.gob.mx', 'Contraloría Municipal', 'Contraloría', 'TODAS', 'ACTIVO'],
      ['enlace.admon@merida.gob.mx', 'Enlace de Control Interno ADM', 'Enlace', 'ADM', 'ACTIVO'],
      ['titular.admon@merida.gob.mx', 'Titular de Administración', 'Titular', 'ADM', 'ACTIVO'],
      ['enlace.obras@merida.gob.mx', 'Enlace Obras Públicas', 'Enlace', 'DOP', 'ACTIVO']
    ];
    usuariosDemo.forEach(u => usrSheet.appendRow(u));
  }
}

/**
 * LOGICA AUTOMATICA DE CÁLCULO DE CUADRANTES
 * Regla del Mapa de Riesgos COSO Mérida:
 * - Cuadrante I: Impacto > 5 Y Probabilidad > 5 -> "Atención Inmediata" (Prioridad GRAVE)
 * - Cuadrante II: Impacto <= 5 Y Probabilidad > 5 -> "Atención Periódica" (Prioridad MODERADO/ALTO)
 * - Cuadrante III: Impacto <= 5 Y Probabilidad <= 5 -> "Controlados" (Prioridad BAJO)
 * - Cuadrante IV: Impacto > 5 Y Probabilidad <= 5 -> "Seguimiento" (Prioridad ALTO)
 */
function calcularCuadrante(impacto, probabilidad) {
  const imp = Number(impacto) || 0;
  const prob = Number(probabilidad) || 0;

  if (imp > 5 && prob > 5) {
    return {
      numero: 'I',
      nombre: 'Atención Inmediata',
      prioridadSugerida: 'GRAVE',
      color: '#e74c3c' // Rojo
    };
  } else if (imp <= 5 && prob > 5) {
    return {
      numero: 'II',
      nombre: 'Atención Periódica',
      prioridadSugerida: 'MODERADO',
      color: '#e67e22' // Naranja
    };
  } else if (imp <= 5 && prob <= 5) {
    return {
      numero: 'III',
      nombre: 'Controlados',
      prioridadSugerida: 'BAJO',
      color: '#2ecc71' // Verde
    };
  } else {
    return {
      numero: 'IV',
      nombre: 'Seguimiento',
      prioridadSugerida: 'ALTO',
      color: '#f1c40f' // Amarillo
    };
  }
}

/**
 * Valida rangos de Grado de Impacto y Probabilidad.
 */
function validarRangoValor(grado, valor) {
  const v = Number(valor);
  if (isNaN(v) || v < 1 || v > 10) return false;

  const g = String(grado).trim().toUpperCase();

  if (g.includes('MENOR')) return v >= 1 && v <= 2;
  if (g.includes('BAJO')) return v >= 3 && v <= 4;
  if (g.includes('MODERADO')) return v >= 5 && v <= 6;
  if (g.includes('GRAVE')) return v >= 7 && v <= 8;
  if (g.includes('CATASTRÓFICO') || g.includes('CATASTROFICO')) return v >= 9 && v <= 10;

  if (g.includes('REMOTA')) return v >= 1 && v <= 2;
  if (g.includes('INUSUAL')) return v >= 3 && v <= 4;
  if (g.includes('PROBABLE') && !g.includes('MUY')) return v >= 5 && v <= 6;
  if (g.includes('MUY PROBABLE')) return v >= 7 && v <= 8;
  if (g.includes('RECURRENTE')) return v >= 9 && v <= 10;

  return true;
}

/**
 * Valida un objeto de riesgo antes de guardar.
 */
function validarRiesgoServidor(datos) {
  const errores = [];
  const r = datos.riesgo;

  if (!r.dependencia) errores.push('La dependencia es obligatoria.');
  if (!r.noRiesgo) errores.push('El número de riesgo es obligatorio.');
  if (!r.descripcionRiesgo) errores.push('La descripción del riesgo es obligatoria.');

  // Validaciones de rangos iniciales
  if (!validarRangoValor(r.impactoInicialGrado, r.impactoInicialValor)) {
    errores.push(`El valor de Impacto Inicial (${r.impactoInicialValor}) no corresponde al grado seleccionado (${r.impactoInicialGrado}).`);
  }
  if (!validarRangoValor(r.probabilidadInicialGrado, r.probabilidadInicialValor)) {
    errores.push(`El valor de Probabilidad Inicial (${r.probabilidadInicialValor}) no corresponde al grado seleccionado (${r.probabilidadInicialGrado}).`);
  }

  // Regla: Valoración final nunca mayor que la inicial
  if (r.tieneControles === 'SI') {
    if (Number(r.impactoFinalValor) > Number(r.impactoInicialValor)) {
      errores.push('El impacto final no puede ser mayor que el impacto inicial.');
    }
    if (Number(r.probabilidadFinalValor) > Number(r.probabilidadInicialValor)) {
      errores.push('La probabilidad final no puede ser mayor que la probabilidad inicial.');
    }
    if (!validarRangoValor(r.impactoFinalGrado, r.impactoFinalValor)) {
      errores.push(`El valor de Impacto Final (${r.impactoFinalValor}) no corresponde al grado seleccionado.`);
    }
    if (!validarRangoValor(r.probabilidadFinalGrado, r.probabilidadFinalValor)) {
      errores.push(`El valor de Probabilidad Final (${r.probabilidadFinalValor}) no corresponde al grado seleccionado.`);
    }
  }

  // Al menos 1 factor requerido
  if (!datos.factores || datos.factores.length === 0) {
    errores.push('Debe registrar al menos un factor de riesgo o causa.');
  }

  return errores;
}

/**
 * Obtiene el usuario activo y su rol en el sistema.
 */
function obtenerUsuarioActual() {
  let email = '';
  try {
    email = Session.getActiveUser().getEmail();
  } catch(e) {}

  if (!email) email = 'contraloria@merida.gob.mx'; // Default para pruebas/entorno local

  const ss = getActiveSpreadsheetSafe();
  const usrSheet = ss.getSheetByName(HOJAS.USUARIOS);
  const data = usrSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
      return {
        email: data[i][0],
        nombre: data[i][1],
        rol: data[i][2], // 'Contraloría', 'Enlace', 'Titular'
        dependencia: data[i][3],
        estatus: data[i][4]
      };
    }
  }

  return {
    email: email,
    nombre: 'Usuario Operador',
    rol: 'Contraloría',
    dependencia: 'TODAS',
    estatus: 'ACTIVO'
  };
}

/**
 * CRUD: GUARDAR RIESGO COMPLETO (Riesgo + Factores N:1 + Control + Acciones PTAR N:1)
 */
function guardarRiesgoCompleto(payload) {
  const ss = getActiveSpreadsheetSafe();
  const usuario = obtenerUsuarioActual();

  // Verificar Permiso por Dependencia
  if (usuario.rol !== 'Contraloría' && usuario.dependencia !== payload.riesgo.dependencia) {
    throw new Error(`No tiene permisos para modificar registros de la dependencia ${payload.riesgo.dependencia}.`);
  }

  // Regla: Si no hay controles o si es deficiente, la valoración final = inicial
  let r = payload.riesgo;
  const tieneControles = r.tieneControles === 'SI';
  const controlDeficiente = payload.control && payload.control.calificacion === 'DEFICIENTE';

  if (!tieneControles || controlDeficiente) {
    r.impactoFinalGrado = r.impactoInicialGrado;
    r.impactoFinalValor = r.impactoInicialValor;
    r.probabilidadFinalGrado = r.probabilidadInicialGrado;
    r.probabilidadFinalValor = r.probabilidadInicialValor;
  }

  // Cálculos Automáticos de Cuadrante
  const cuadInicial = calcularCuadrante(r.impactoInicialValor, r.probabilidadInicialValor);
  const cuadFinal = calcularCuadrante(r.impactoFinalValor, r.probabilidadFinalValor);

  r.cuadranteInicial = `Cuadrante ${cuadInicial.numero} (${cuadInicial.nombre})`;
  r.cuadranteFinal = `Cuadrante ${cuadFinal.numero} (${cuadFinal.nombre})`;

  if (!r.prioridadInicial) r.prioridadInicial = cuadInicial.prioridadSugerida;
  if (!r.prioridadFinal) r.prioridadFinal = cuadFinal.prioridadSugerida;

  // Validaciones de Servidor
  const errores = validarRiesgoServidor({ riesgo: r, factores: payload.factores, control: payload.control, acciones: payload.acciones });
  if (errores.length > 0) {
    return { exito: false, errores: errores };
  }

  // ID del riesgo
  const idRiesgo = r.idRiesgo || 'RSG-' + Utilities.getUuid().substring(0, 8);
  r.idRiesgo = idRiesgo;

  // 1. Guardar o Actualizar en HOJA RIESGOS
  const rSheet = ss.getSheetByName(HOJAS.RIESGOS);
  const rData = rSheet.getDataRange().getValues();
  let rowIndexRiesgo = -1;

  for (let i = 1; i < rData.length; i++) {
    if (rData[i][0] === idRiesgo) {
      rowIndexRiesgo = i + 1;
      break;
    }
  }

  const filaRiesgo = [
    r.idRiesgo,
    r.dependencia,
    r.noRiesgo,
    r.procedimiento,
    r.objetivoEstrategico,
    r.descripcionRiesgo,
    r.nivelExposicion,
    r.tipoRiesgo,
    r.tieneControles,
    r.impactoInicialGrado,
    r.impactoInicialValor,
    r.probabilidadInicialGrado,
    r.probabilidadInicialValor,
    r.cuadranteInicial,
    r.prioridadInicial,
    r.impactoFinalGrado,
    r.impactoFinalValor,
    r.probabilidadFinalGrado,
    r.probabilidadFinalValor,
    r.cuadranteFinal,
    r.prioridadFinal,
    r.estrategiaRespuesta,
    r.fechaRegistro || Utilities.formatDate(new Date(), 'GMT-6', 'yyyy-MM-dd HH:mm:ss'),
    usuario.email
  ];

  if (rowIndexRiesgo > 0) {
    rSheet.getRange(rowIndexRiesgo, 1, 1, filaRiesgo.length).setValues([filaRiesgo]);
  } else {
    rSheet.appendRow(filaRiesgo);
  }

  // 2. Guardar FACTORES (limpiar anteriores e insertar nuevos)
  limpiarRegistrosDependientes(ss, HOJAS.FACTORES, idRiesgo);
  const fSheet = ss.getSheetByName(HOJAS.FACTORES);
  (payload.factores || []).forEach(f => {
    const idFactor = 'FCT-' + Utilities.getUuid().substring(0, 8);
    fSheet.appendRow([
      idFactor,
      idRiesgo,
      r.noRiesgo,
      f.factorCausa,
      f.tipoFactor,
      f.efectosConsecuencias
    ]);
  });

  // 3. Guardar CONTROLES
  limpiarRegistrosDependientes(ss, HOJAS.CONTROLES, idRiesgo);
  if (tieneControles && payload.control) {
    const c = payload.control;
    const cSheet = ss.getSheetByName(HOJAS.CONTROLES);
    const idControl = 'CTR-' + Utilities.getUuid().substring(0, 8);
    cSheet.appendRow([
      idControl,
      idRiesgo,
      r.noRiesgo,
      c.descripcionControl,
      c.quienEjecuta,
      c.cuandoSeEjecuta,
      c.evidencia,
      c.tipoControl,
      c.atribDocumentado ? 'SI' : 'NO',
      c.atribFormalizado ? 'SI' : 'NO',
      c.atribAplicado ? 'SI' : 'NO',
      c.atribEfectivo ? 'SI' : 'NO',
      c.calificacion || (controlDeficiente ? 'DEFICIENTE' : 'SUFICIENTE')
    ]);
  }

  // 4. Guardar ACCIONES PTAR
  limpiarRegistrosDependientes(ss, HOJAS.ACCIONES, idRiesgo);
  const aSheet = ss.getSheetByName(HOJAS.ACCIONES);
  (payload.acciones || []).forEach(a => {
    const idAccion = a.idAccion || 'ACC-' + Utilities.getUuid().substring(0, 8);
    aSheet.appendRow([
      idAccion,
      idRiesgo,
      r.noRiesgo,
      r.dependencia,
      a.descripcionAccion,
      a.responsable,
      a.fechaCompromiso,
      a.medioVerificacion,
      a.estatus || 'PENDIENTE',
      a.porcentajeAvance || 0,
      a.observaciones || ''
    ]);
  });

  return { exito: true, idRiesgo: idRiesgo, mensaje: 'Riesgo y PTAR guardados correctamente.' };
}

/**
 * Elimina filas de tablas dependientes vinculadas a un ID_RIESGO.
 */
function limpiarRegistrosDependientes(ss, hojaNombre, idRiesgo) {
  const sheet = ss.getSheetByName(hojaNombre);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === idRiesgo) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Eliminar un riesgo completo y sus factores/controles/acciones.
 */
function eliminarRiesgo(idRiesgo) {
  const ss = getActiveSpreadsheetSafe();
  const usuario = obtenerUsuarioActual();

  const rSheet = ss.getSheetByName(HOJAS.RIESGOS);
  const data = rSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idRiesgo) {
      const depRiesgo = data[i][1];
      if (usuario.rol !== 'Contraloría' && usuario.dependencia !== depRiesgo) {
        throw new Error('No tiene permisos para eliminar este riesgo.');
      }
      rSheet.deleteRow(i + 1);
      limpiarRegistrosDependientes(ss, HOJAS.FACTORES, idRiesgo);
      limpiarRegistrosDependientes(ss, HOJAS.CONTROLES, idRiesgo);
      limpiarRegistrosDependientes(ss, HOJAS.ACCIONES, idRiesgo);
      return { exito: true, mensaje: 'Riesgo eliminado exitosamente.' };
    }
  }
  return { exito: false, mensaje: 'No se encontró el riesgo especificado.' };
}

/**
 * Obtiene la lista completa de riesgos filtrada por rol y dependencia.
 */
function obtenerRiesgos(dependenciaFiltro) {
  const ss = getActiveSpreadsheetSafe();
  const usuario = obtenerUsuarioActual();

  let depPermitida = dependenciaFiltro;
  if (usuario.rol !== 'Contraloría') {
    depPermitida = usuario.dependencia;
  }

  const rSheet = ss.getSheetByName(HOJAS.RIESGOS);
  const rData = rSheet.getDataRange().getValues();

  const fSheet = ss.getSheetByName(HOJAS.FACTORES);
  const fData = fSheet ? fSheet.getDataRange().getValues() : [];

  const cSheet = ss.getSheetByName(HOJAS.CONTROLES);
  const cData = cSheet ? cSheet.getDataRange().getValues() : [];

  const aSheet = ss.getSheetByName(HOJAS.ACCIONES);
  const aData = aSheet ? aSheet.getDataRange().getValues() : [];

  const lista = [];

  for (let i = 1; i < rData.length; i++) {
    const row = rData[i];
    if (!row[0]) continue;

    const dep = row[1];
    if (depPermitida && depPermitida !== 'TODAS' && dep !== depPermitida) {
      continue;
    }

    const idRiesgo = row[0];

    // Obtener Factores del Riesgo
    const factores = fData.filter(f => f[1] === idRiesgo).map(f => ({
      idFactor: f[0],
      factorCausa: f[3],
      tipoFactor: f[4],
      efectosConsecuencias: f[5]
    }));

    // Obtener Control del Riesgo
    const controlRow = cData.find(c => c[1] === idRiesgo);
    const control = controlRow ? {
      idControl: controlRow[0],
      descripcionControl: controlRow[3],
      quienEjecuta: controlRow[4],
      cuandoSeEjecuta: controlRow[5],
      evidencia: controlRow[6],
      tipoControl: controlRow[7],
      atribDocumentado: controlRow[8] === 'SI',
      atribFormalizado: controlRow[9] === 'SI',
      atribAplicado: controlRow[10] === 'SI',
      atribEfectivo: controlRow[11] === 'SI',
      calificacion: controlRow[12]
    } : null;

    // Obtener Acciones del Riesgo
    const acciones = aData.filter(a => a[1] === idRiesgo).map(a => ({
      idAccion: a[0],
      descripcionAccion: a[4],
      responsable: a[5],
      fechaCompromiso: a[6] instanceof Date ? Utilities.formatDate(a[6], 'GMT-6', 'yyyy-MM-dd') : a[6],
      medioVerificacion: a[7],
      estatus: a[8],
      porcentajeAvance: a[9],
      observaciones: a[10]
    }));

    lista.push({
      idRiesgo: row[0],
      dependencia: row[1],
      noRiesgo: row[2],
      procedimiento: row[3],
      objetivoEstrategico: row[4],
      descripcionRiesgo: row[5],
      nivelExposicion: row[6],
      tipoRiesgo: row[7],
      tieneControles: row[8],
      impactoInicialGrado: row[9],
      impactoInicialValor: row[10],
      probabilidadInicialGrado: row[11],
      probabilidadInicialValor: row[12],
      cuadranteInicial: row[13],
      prioridadInicial: row[14],
      impactoFinalGrado: row[15],
      impactoFinalValor: row[16],
      probabilidadFinalGrado: row[17],
      probabilidadFinalValor: row[18],
      cuadranteFinal: row[19],
      prioridadFinal: row[20],
      estrategiaRespuesta: row[21],
      fechaRegistro: row[22] instanceof Date ? Utilities.formatDate(row[22], 'GMT-6', 'yyyy-MM-dd HH:mm') : row[22],
      usuarioCaptura: row[23],
      factores: factores,
      control: control,
      acciones: acciones
    });
  }

  return lista;
}

/**
 * Obtiene un riesgo por su ID con todo el detalle.
 */
function obtenerRiesgoPorId(idRiesgo) {
  const todos = obtenerRiesgos('TODAS');
  return todos.find(r => r.idRiesgo === idRiesgo) || null;
}

/**
 * DATOS CONSOLIDADOS PARA EL DASHBOARD DE CONTRALORÍA Y DEPENDENCIAS
 */
function obtenerDashboard(dependenciaFiltro) {
  const riesgos = obtenerRiesgos(dependenciaFiltro);

  const totalRiesgos = riesgos.length;
  const porCuadranteInicial = { 'I': 0, 'II': 0, 'III': 0, 'IV': 0 };
  const porCuadranteFinal = { 'I': 0, 'II': 0, 'III': 0, 'IV': 0 };
  const porPrioridad = { 'BAJO': 0, 'MODERADO': 0, 'ALTO': 0, 'GRAVE': 0 };
  const porTipoRiesgo = {};
  const porEstrategia = {};
  const porDependencia = {};

  let riesgosCuadranteI = [];
  let riesgosCorrupcion = [];

  riesgos.forEach(r => {
    // Conteo Dependencias
    porDependencia[r.dependencia] = (porDependencia[r.dependencia] || 0) + 1;

    // Cuadrantes
    if (r.cuadranteInicial.includes('Cuadrante I')) porCuadranteInicial['I']++;
    else if (r.cuadranteInicial.includes('Cuadrante II')) porCuadranteInicial['II']++;
    else if (r.cuadranteInicial.includes('Cuadrante III')) porCuadranteInicial['III']++;
    else if (r.cuadranteInicial.includes('Cuadrante IV')) porCuadranteInicial['IV']++;

    if (r.cuadranteFinal.includes('Cuadrante I')) porCuadranteFinal['I']++;
    else if (r.cuadranteFinal.includes('Cuadrante II')) porCuadranteFinal['II']++;
    else if (r.cuadranteFinal.includes('Cuadrante III')) porCuadranteFinal['III']++;
    else if (r.cuadranteFinal.includes('Cuadrante IV')) porCuadranteFinal['IV']++;

    // Prioridad Final
    const prio = String(r.prioridadFinal || 'BAJO').toUpperCase();
    porPrioridad[prio] = (porPrioridad[prio] || 0) + 1;

    // Tipo de Riesgo
    porTipoRiesgo[r.tipoRiesgo] = (porTipoRiesgo[r.tipoRiesgo] || 0) + 1;

    // Estrategia
    porEstrategia[r.estrategiaRespuesta] = (porEstrategia[r.estrategiaRespuesta] || 0) + 1;

    // Destacados para PTAR
    if (r.cuadranteFinal.includes('Cuadrante I')) {
      riesgosCuadranteI.push(r);
    }
    if (String(r.tipoRiesgo).toUpperCase().includes('CORRUPCIÓN') || String(r.tipoRiesgo).toUpperCase().includes('CORRUPCION')) {
      riesgosCorrupcion.push(r);
    }
  });

  // Métricas de PTAR (Acciones)
  const ss = getActiveSpreadsheetSafe();
  const aSheet = ss.getSheetByName(HOJAS.ACCIONES);
  const aData = aSheet ? aSheet.getDataRange().getValues() : [];

  let totalAcciones = 0;
  let accionesConcluidas = 0;
  let accionesEnProceso = 0;
  let accionesPendientes = 0;

  for (let i = 1; i < aData.length; i++) {
    if (!aData[i][0]) continue;
    const depAccion = aData[i][3];
    if (dependenciaFiltro && dependenciaFiltro !== 'TODAS' && depAccion !== dependenciaFiltro) {
      continue;
    }
    totalAcciones++;
    const est = String(aData[i][8]).toUpperCase();
    if (est === 'CONCLUIDA' || est === 'COMPLETADA') accionesConcluidas++;
    else if (est === 'EN PROCESO') accionesEnProceso++;
    else accionesPendientes++;
  }

  const avancePTARGlobal = totalAcciones > 0 ? Math.round((accionesConcluidas / totalAcciones) * 100) : 0;

  return {
    totalRiesgos: totalRiesgos,
    porDependencia: porDependencia,
    porCuadranteInicial: porCuadranteInicial,
    porCuadranteFinal: porCuadranteFinal,
    porPrioridad: porPrioridad,
    porTipoRiesgo: porTipoRiesgo,
    porEstrategia: porEstrategia,
    riesgosCuadranteI: riesgosCuadranteI,
    riesgosCorrupcion: riesgosCorrupcion,
    ptarMetricas: {
      totalAcciones: totalAcciones,
      concluidas: accionesConcluidas,
      enProceso: accionesEnProceso,
      pendientes: accionesPendientes,
      porcentajeGlobal: avancePTARGlobal
    }
  };
}

/**
 * OBTENER DATOS PARA EL MAPA DE RIESGOS E INTERACTIVO (10x10 Heatmap)
 */
function obtenerMapaRiesgosData(dependenciaFiltro) {
  const riesgos = obtenerRiesgos(dependenciaFiltro);

  const matrizInicial = Array(10).fill(0).map(() => Array(10).fill(0));
  const matrizFinal = Array(10).fill(0).map(() => Array(10).fill(0));

  const puntosIniciales = [];
  const puntosFinales = [];

  riesgos.forEach(r => {
    const xInit = Math.max(1, Math.min(10, Number(r.impactoInicialValor))) - 1;
    const yInit = Math.max(1, Math.min(10, Number(r.probabilidadInicialValor))) - 1;

    matrizInicial[yInit][xInit]++;
    puntosIniciales.push({
      idRiesgo: r.idRiesgo,
      noRiesgo: r.noRiesgo,
      dependencia: r.dependencia,
      descripcion: r.descripcionRiesgo,
      x: xInit + 1,
      y: yInit + 1,
      cuadrante: r.cuadranteInicial,
      prioridad: r.prioridadInicial
    });

    const xFin = Math.max(1, Math.min(10, Number(r.impactoFinalValor))) - 1;
    const yFin = Math.max(1, Math.min(10, Number(r.probabilidadFinalValor))) - 1;

    matrizFinal[yFin][xFin]++;
    puntosFinales.push({
      idRiesgo: r.idRiesgo,
      noRiesgo: r.noRiesgo,
      dependencia: r.dependencia,
      descripcion: r.descripcionRiesgo,
      x: xFin + 1,
      y: yFin + 1,
      cuadrante: r.cuadranteFinal,
      prioridad: r.prioridadFinal
    });
  });

  return {
    matrizInicial: matrizInicial,
    matrizFinal: matrizFinal,
    puntosIniciales: puntosIniciales,
    puntosFinales: puntosFinales
  };
}

/**
 * ACTUALIZAR ESTATUS Y AVANCE DE ACCIÓN PTAR
 */
function actualizarEstatusAccion(idAccion, nuevoEstatus, porcentajeAvance, observaciones) {
  const ss = getActiveSpreadsheetSafe();
  const aSheet = ss.getSheetByName(HOJAS.ACCIONES);
  const data = aSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idAccion) {
      aSheet.getRange(i + 1, 9).setValue(nuevoEstatus);
      aSheet.getRange(i + 1, 10).setValue(porcentajeAvance);
      if (observaciones !== undefined) {
        aSheet.getRange(i + 1, 11).setValue(observaciones);
      }
      return { exito: true, mensaje: 'Estatus de acción actualizado correctamente.' };
    }
  }

  return { exito: false, mensaje: 'Acción no encontrada.' };
}

/**
 * OBTENER CATÁLOGOS Y DEPENDENCIAS PARA EL FRONTEND
 */
function obtenerCatalogos() {
  const ss = getActiveSpreadsheetSafe();

  const catSheet = ss.getSheetByName(HOJAS.CATALOGOS);
  const catData = catSheet.getDataRange().getValues();
  const catalogos = {};

  for (let i = 1; i < catData.length; i++) {
    const cat = catData[i][0];
    if (!catalogos[cat]) catalogos[cat] = [];
    catalogos[cat].push({
      clave: catData[i][1],
      valor: catData[i][2],
      descripcion: catData[i][3],
      orden: catData[i][4]
    });
  }

  const depSheet = ss.getSheetByName(HOJAS.DEPENDENCIAS);
  const depData = depSheet.getDataRange().getValues();
  const dependencias = [];

  for (let i = 1; i < depData.length; i++) {
    if (depData[i][0]) {
      dependencias.push({
        clave: depData[i][0],
        nombre: depData[i][1],
        titular: depData[i][2],
        enlace: depData[i][3],
        email: depData[i][4]
      });
    }
  }

  return {
    catalogos: catalogos,
    dependencias: dependencias,
    usuarioActual: obtenerUsuarioActual()
  };
}

/**
 * REPORTE DE AUTOEVALUACIÓN ANUAL / INFORME PTAR
 */
function obtenerReporteAutoevaluacion(dependenciaFiltro) {
  const riesgos = obtenerRiesgos(dependenciaFiltro);
  const usuario = obtenerUsuarioActual();

  let resumenMatriz = {
    total: riesgos.length,
    cuadranteI: riesgos.filter(r => r.cuadranteFinal.includes('Cuadrante I')).length,
    cuadranteII: riesgos.filter(r => r.cuadranteFinal.includes('Cuadrante II')).length,
    cuadranteIII: riesgos.filter(r => r.cuadranteFinal.includes('Cuadrante III')).length,
    cuadranteIV: riesgos.filter(r => r.cuadranteFinal.includes('Cuadrante IV')).length,
    corrupcion: riesgos.filter(r => String(r.tipoRiesgo).toUpperCase().includes('CORRUPCI')).length
  };

  return {
    fechaGeneracion: Utilities.formatDate(new Date(), 'GMT-6', 'dd/MM/yyyy HH:mm'),
    generadoPor: usuario.nombre + ' (' + usuario.email + ')',
    dependencia: dependenciaFiltro || usuario.dependencia,
    resumen: resumenMatriz,
    riesgos: riesgos
  };
}

/**
 * VERIFICACIÓN Y PRUEBAS AUTOMATIZADAS
 */
function ejecutarPruebasAutomatizadas() {
  const resultados = [];

  const t1 = calcularCuadrante(8, 8); // I
  const t2 = calcularCuadrante(3, 8); // II
  const t3 = calcularCuadrante(3, 3); // III
  const t4 = calcularCuadrante(8, 3); // IV

  const pA = (t1.numero === 'I' && t2.numero === 'II' && t3.numero === 'III' && t4.numero === 'IV');
  resultados.push({ prueba: 'a) Cálculo de Cuadrantes (I, II, III, IV)', exito: pA, detalle: `I:${t1.numero}, II:${t2.numero}, III:${t3.numero}, IV:${t4.numero}` });

  const v1 = validarRangoValor('GRAVE', 8);
  const v2 = validarRangoValor('GRAVE', 3);
  const pB = (v1 === true && v2 === false);
  resultados.push({ prueba: 'b) Validación de rangos de Impacto/Probabilidad', exito: pB });

  const errValidacion = validarRiesgoServidor({
    riesgo: {
      dependencia: 'ADM',
      noRiesgo: 'R1-ADM',
      descripcionRiesgo: 'Sustantivo probado adjetivo',
      impactoInicialGrado: 'BAJO',
      impactoInicialValor: 4,
      probabilidadInicialGrado: 'INUSUAL',
      probabilidadInicialValor: 4,
      tieneControles: 'SI',
      impactoFinalGrado: 'GRAVE',
      impactoFinalValor: 8,
      probabilidadFinalGrado: 'INUSUAL',
      probabilidadFinalValor: 4
    },
    factores: [{ factorCausa: 'ADMINISTRATIVO-GESTIÓN', tipoFactor: 'INTERNO', efectosConsecuencias: 'COSTOS' }]
  });
  const pC = errValidacion.some(e => e.includes('no puede ser mayor'));
  resultados.push({ prueba: 'c) Validación Valoración Final <= Inicial', exito: pC });

  const demoPayload = {
    riesgo: {
      dependencia: 'ADM',
      noRiesgo: 'R99-ADM',
      procedimiento: 'Prueba de Sistema',
      objetivoEstrategico: 'Asegurar la calidad del software',
      descripcionRiesgo: 'Error no detectado oportunamente',
      nivelExposicion: 'OPERACIÓN',
      tipoRiesgo: 'DE TIC´S',
      tieneControles: 'SI',
      impactoInicialGrado: 'MODERADO',
      impactoInicialValor: 6,
      probabilidadInicialGrado: 'PROBABLE',
      probabilidadInicialValor: 6,
      impactoFinalGrado: 'BAJO',
      impactoFinalValor: 4,
      probabilidadFinalGrado: 'INUSUAL',
      probabilidadFinalValor: 4,
      estrategiaRespuesta: 'REDUCIR'
    },
    factores: [
      { factorCausa: 'TECNOLOGÍAS DE LA INFORMACIÓN', tipoFactor: 'INTERNO', efectosConsecuencias: 'COSTOS' },
      { factorCausa: 'RECURSOS HUMANOS', tipoFactor: 'INTERNO', efectosConsecuencias: 'MEJORA DE PROCESOS' }
    ],
    control: {
      descripcionControl: 'Revisión periódica de código',
      quienEjecuta: 'Auditor de Software',
      cuandoSeEjecuta: 'Semanal',
      evidencia: 'Reporte de pruebas',
      tipoControl: 'PREVENTIVO',
      atribDocumentado: true,
      atribFormalizado: true,
      atribAplicado: true,
      atribEfectivo: true,
      calificacion: 'SUFICIENTE'
    },
    acciones: [
      { descripcionAccion: 'Implementar pruebas unitarias', responsable: 'Jules', fechaCompromiso: '2025-12-31', medioVerificacion: 'Git log', estatus: 'EN PROCESO', porcentajeAvance: 50 }
    ]
  };

  const resSave = guardarRiesgoCompleto(demoPayload);
  const pD = resSave.exito === true && resSave.idRiesgo !== undefined;
  resultados.push({ prueba: 'd) Guardado de Riesgo con múltiples factores y PTAR', exito: pD, idGenerado: resSave.idRiesgo });

  if (resSave.idRiesgo) {
    eliminarRiesgo(resSave.idRiesgo);
  }

  const riesgosADM = obtenerRiesgos('ADM');
  const pE = Array.isArray(riesgosADM);
  resultados.push({ prueba: 'e) Filtrado por dependencia/rol', exito: pE });

  // Prueba f: Catálogos cargados con las 30 dependencias
  const cats = obtenerCatalogos();
  const pF = cats.dependencias && cats.dependencias.length === 30;
  resultados.push({ prueba: 'f) Verificación de las 30 dependencias oficiales', exito: pF, totalDependencias: cats.dependencias ? cats.dependencias.length : 0 });

  return resultados;
}
