/**
 * Sistema de Control Documental - Ayuntamiento de Mérida
 * Código Servidor (Google Apps Script)
 *
 * Este script administra la estructura de la base de datos en Google Sheets,
 * las reglas de negocio, la generación concurrente de códigos con LockService,
 * las validaciones y auditorías, y la comunicación con el cliente web (HtmlService).
 */

// Global constant for sheet names
var SHEETS = {
  CATALOGOS: 'Catalogos',
  DOCUMENTOS: 'Documentos',
  FORMATOS: 'Formatos',
  BITACORA: 'Bitacora',
  CONFIG: 'Config',
  ERRORES_MIGRACION: 'ErroresMigracion'
};

/**
 * Función principal doGet para servir la Web App.
 */
function doGet(e) {
  inicializarBaseDeDatos();
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
      .setTitle('Sistema de Control Documental - Ayuntamiento de Mérida')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper para incluir fragmentos HTML en plantillas (si fuera necesario).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtiene el libro de trabajo activo de forma segura.
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Obtiene o crea una hoja específica dentro del Spreadsheet activo.
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#003366').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Inicializa la base de datos completa con hojas y catálogos semilla si no existen.
 */
function inicializarBaseDeDatos() {
  var ss = getSpreadsheet();

  // 1. Config
  var sheetConfig = getOrCreateSheet(SHEETS.CONFIG, ['correo_admin']);
  if (sheetConfig.getLastRow() === 1) {
    var currentUser = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
    if (currentUser) {
      sheetConfig.appendRow([currentUser]);
    }
  }

  // 2. Bitacora
  getOrCreateSheet(SHEETS.BITACORA, ['fecha', 'usuario', 'accion', 'tabla_afectada', 'codigo', 'campo', 'valor_anterior', 'valor_nuevo']);

  // 3. Documentos
  getOrCreateSheet(SHEETS.DOCUMENTOS, [
    'id_documento', 'codigo', 'tipo', 'nombre', 'direccion', 'subdireccion', 'departamento',
    'fecha_edicion', 'fecha_actualizacion', 'revision', 'num_formatos', 'estatus', 'difundido', 'creado_por', 'fecha_creacion'
  ]);

  // 4. Formatos
  getOrCreateSheet(SHEETS.FORMATOS, [
    'id_formato', 'codigo_documento', 'codigo_formato', 'nombre', 'revision', 'fecha_actualizacion', 'estatus'
  ]);

  // 5. Catalogos
  var sheetCat = ss.getSheetByName(SHEETS.CATALOGOS);
  if (!sheetCat) {
    sheetCat = ss.insertSheet(SHEETS.CATALOGOS);
    var headers = ['Direccion', 'SiglaDir', 'Subdireccion', 'SiglaSub', 'Departamento', 'SiglaArea', 'TipoDoc', 'Estatus'];
    sheetCat.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheetCat.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#003366').setFontColor('#FFFFFF');
    sheetCat.setFrozenRows(1);

    // Cargar datos semilla
    var catalogRows = obtenerDatosSemillaCatalogos();
    if (catalogRows.length > 0) {
      sheetCat.getRange(2, 1, catalogRows.length, catalogRows[0].length).setValues(catalogRows);
    }
  }
}

/**
 * Genera la lista exacta de datos semilla para la hoja "Catalogos".
 */
function obtenerDatosSemillaCatalogos() {
  // Lista de jerarquía (Direccion, SiglaDir, Subdireccion, SiglaSub, Departamento, SiglaArea)
  var jerarquia = [
    // ADMINISTRACIÓN (ADM)
    ['ADMINISTRACIÓN', 'ADM', 'Sin subdirección', '', 'Despacho', 'DES'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Despacho', 'ADP'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Almacén', 'ALM'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Concursos electrónicos', 'COE'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Administrativo', 'ADM'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Licitaciones', 'LIC'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Atención y Control Interno', 'ACI'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Seguimiento a servicios', 'SES'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Proveeduría', 'ADP', 'Contratación de servicios', 'COS'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Despacho', 'DES'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Selección e Ingreso', 'SEI'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Prestaciones', 'PRE'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Central de Nóminas', 'CEN'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Jubilados y Pensionados', 'JUP'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Relaciones Laborales', 'REL'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Servicios Médicos Administrativos', 'SMA'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Recursos Humanos', 'REH', 'Desarrollo Humano y Capacitación', 'DHC'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Servicios Internos', 'SEI', 'Despacho', 'DES'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Servicios Internos', 'SEI', 'Conservación', 'CON'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Servicios Internos', 'SEI', 'Central de Mantenimiento Vehicular', 'CMV'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Servicios Internos', 'SEI', 'Jurídico', 'JUR'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Mejora Regulatoria', 'MER', 'Proyectos de Innovación', 'PRI'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Mejora Regulatoria', 'MER', 'Calidad y Mejora Continua', 'CMC'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Mejora Regulatoria', 'MER', 'Mejora Regulatoria', 'MER'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Mejora Regulatoria', 'MER', 'Administrativo', 'ADM'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Ventanillas Únicas', 'VEU', 'Departamento de Ventanilla Única', 'VEU'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Patrimonio Municipal', 'PAT', 'Inventarios y Requisición tipo Mantenimiento', 'CIR'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Patrimonio Municipal', 'PAT', 'Control y Regularización de Inmuebles', 'CRI'],
    ['ADMINISTRACIÓN', 'ADM', 'Subdirección de Patrimonio Municipal', 'PAT', 'Seguimiento a Contratos', 'SEC'],

    // BIENESTAR HUMANO (BIH)
    ['BIENESTAR HUMANO', 'BIH', 'Sin subdirección', '', 'Despacho', 'DES'],
    ['BIENESTAR HUMANO', 'BIH', 'Sin subdirección', '', 'Comunicación', 'COM'],
    ['BIENESTAR HUMANO', 'BIH', 'Sin subdirección', '', 'Enlace Institucional', 'ENI'],
    ['BIENESTAR HUMANO', 'BIH', 'Sin subdirección', '', 'Protección y Atención a la Salud', 'PAS'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Administración', 'SAD', 'Despacho', 'SAD'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Administración', 'SAD', 'Administrativo', 'ADM'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Administración', 'SAD', 'Desarrollo Organizacional', 'DEO'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Administración', 'SAD', 'Jurídico', 'JUR'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Administración', 'SAD', 'Servicios Generales', 'SEG'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Deportes', 'SUD', 'Despacho', 'SUD'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Deportes', 'SUD', 'Comités Deportivos', 'COD'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Deportes', 'SUD', 'Promoción Deportiva', 'PRD'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Educación', 'SED', 'Despacho', 'SED'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Educación', 'SED', 'Apoyos Educativos', 'APE'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Educación', 'SED', 'Fortalecimiento Educativo', 'FOE'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Educación', 'SED', 'Bibliotecas', 'BIB'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Salud', 'SSL', 'Despacho', 'SSL'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Salud', 'SSL', 'Protección y Atención a la Salud', 'PAS'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Salud', 'SSL', 'Salud Mental', 'SAM'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Salud', 'SSL', 'Administrativo Salud', 'ADS'],
    ['BIENESTAR HUMANO', 'BIH', 'Subdirección de Salud', 'SSL', 'Vida Saludable', 'VIS'],

    // CENTRAL DE ABASTOS (CAM)
    ['CENTRAL DE ABASTOS', 'CAM', 'No aplica', '', 'Despacho', 'DES'],

    // COMUNICACIÓN CIUDADANA (COC)
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Sin subdirección', '', 'Despacho', 'DES'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Sin subdirección', '', 'Administrativo', 'ADM'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Sin subdirección', '', 'Comunicación Ciudadana', 'COC'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Medios', 'MED', 'Despacho', 'MED'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Medios', 'MED', 'Prensa', 'PRE'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Medios', 'MED', 'Monitoreo', 'MON'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Imagen Institucional', 'IMG', 'Despacho', 'IMG'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Imagen Institucional', 'IMG', 'Mercadotecnia', 'MER'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Imagen Institucional', 'IMG', 'Diseño Gráfico', 'DIG'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Subdirección de Imagen Institucional', 'IMG', 'Medios Audiovisuales', 'MEA'],
    ['COMUNICACIÓN CIUDADANA', 'COC', 'Secretaría Técnica de Enlace', 'STE', 'Despacho', 'STE'],

    // CONTRALORÍA MUNICIPAL (COM)
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Sin subdirección', '', 'Despacho', 'DES'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Sin subdirección', '', 'Administrativo', 'ADM'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Despacho', 'AUS'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Auditoría y Seguimiento', 'AUS'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Auditoría en Tecnologías de la Información', 'ATI'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Atención y Seguimiento a Auditorías Externas', 'ASA'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Normatividad y Responsabilidades', 'NOR'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Control Interno y Situación Patrimonial', 'CIS'],
    ['CONTRALORÍA MUNICIPAL', 'COM', 'Subdirección de Auditoría y Seguimiento de Actos de Fiscalización', 'AUS', 'Evaluación e Investigación Administrativa', 'EIA'],

    // CUXTAL (OPRC)
    ['CUXTAL', 'OPRC', 'Sin subdirección', '', 'Administración', 'ADM'],
    ['CUXTAL', 'OPRC', 'Sin subdirección', '', 'Operaciones', 'OPE'],

    // DIF (DIF)
    ['DIF', 'DIF', 'Sin subdirección', '', 'Despacho', 'DES'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Coordinación de Administración', 'ADM'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Coordinación de Calidad y Mejora Regulatoria', 'CMR'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Atención a Personas Mayores', 'APM'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Atención a Personas con Discapacidad', 'APD'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Atención a la Infancia', 'ATI'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Coordinación Jurídica', 'JUR'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Trabajo Social y Estudios Socioeconómicos', 'TSE'],
    ['DIF', 'DIF', 'Sin subdirección', '', 'Vinculación con Organizaciones de la Sociedad Civil', 'VOS'],

    // FINANZAS Y TESORERÍA (FTM)
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Ingresos', 'ING', 'Recaudación', 'REC'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Ingresos', 'ING', 'Administración Tributaria', 'ADT'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Ingresos', 'ING', 'Unidad Legal y Cobro Coactivo', 'ULC'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Ingresos', 'ING', 'Fiscalización', 'FIS'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Ingresos', 'ING', 'Cobranza', 'COB'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Ingresos', 'ING', 'Coordinación de Asistencia al Contribuyente', 'ASC'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Egresos', 'EGR', 'Despacho', 'EGR'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Egresos', 'EGR', 'Caja General', 'CAG'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Egresos', 'EGR', 'Verificación y Control de Cuentas por Pagar', 'VCC'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Egresos', 'EGR', 'Pagos Electrónicos', 'PAE'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Egresos', 'EGR', 'Análisis Técnico', 'ANT'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Política Tributaria', 'PTR', 'Análisis Técnico', 'ANT'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Presupuesto y Control del Gasto', 'PRE', 'Presupuestos', 'PRE'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Contabilidad y Administración', 'CAD', 'Administrativo', 'ADM'],
    ['FINANZAS Y TESORERÍA', 'FTM', 'Subdirección de Contabilidad y Administración', 'CAD', 'Contabilidad', 'CON'],

    // GOBERNACIÓN (GOB)
    ['GOBERNACIÓN', 'GOB', 'Sin subdirección', '', 'Despacho del Director', 'DIR'],
    ['GOBERNACIÓN', 'GOB', 'Sin subdirección', '', 'Gaceta Municipal', 'GAM'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Consejería Jurídica', 'COJ', 'Despacho', 'COJ'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Consejería Jurídica', 'COJ', 'Reglamentos y Legislación Municipal', 'RLM'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Gobernación', 'SGB', 'Despacho', 'SGB'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Gobernación', 'SGB', 'Espectáculos', 'ESP'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Gobernación', 'SGB', 'Estacionamientos', 'EST'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Gobernación', 'SGB', 'Predios Baldíos', 'PRB'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección de Gobernación', 'SGB', 'Protección Civil', 'PRC'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Jurídica', 'ASJ', 'Despacho', 'ASJ'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Jurídica', 'ASJ', 'Asuntos Contenciosos', 'ASC'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Jurídica', 'ASJ', 'Asuntos Penales', 'ASP'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Jurídica', 'ASJ', 'Contratos', 'CON'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Jurídica', 'ASJ', 'Derechos Humanos', 'DEH'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Operativa', 'SOP', 'Despacho', 'SOP'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Operativa', 'SOP', 'Asuntos Religiosos', 'ASR'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Operativa', 'SOP', 'Junta Municipal de Reclutamiento', 'JMR'],
    ['GOBERNACIÓN', 'GOB', 'Subdirección Operativa', 'SOP', 'Movilidad Urbana', 'MOU'],

    // INSTITUTO DE LAS MUJERES (MUJ)
    ['INSTITUTO DE LAS MUJERES', 'MUJ', 'Sin subdirección', '', 'Despacho', 'DIR'],
    ['INSTITUTO DE LAS MUJERES', 'MUJ', 'Sin subdirección', '', 'Administrativo', 'ADM'],
    ['INSTITUTO DE LAS MUJERES', 'MUJ', 'Subdirección de Atención a las Violencias', 'SAV', 'Despacho', 'SAV'],
    ['INSTITUTO DE LAS MUJERES', 'MUJ', 'Subdirección de Atención a las Violencias', 'SAV', 'Servicios Especializados en Atención a las Violencias', 'SEA'],
    ['INSTITUTO DE LAS MUJERES', 'MUJ', 'Subdirección de Atención a las Violencias', 'SAV', 'Desarrollo de las Mujeres en Comunidades con Perspectiva de Género', 'DMC'],
    ['INSTITUTO DE LAS MUJERES', 'MUJ', 'Subdirección de Atención a las Violencias', 'SAV', 'Programas y Proyectos Estratégicos en las Violencias y Género', 'PPE'],

    // OBRAS PÚBLICAS (OBP)
    ['OBRAS PÚBLICAS', 'OBP', 'Sin subdirección', '', 'Despacho', 'DIR'],
    ['OBRAS PÚBLICAS', 'OBP', 'Sin subdirección', '', 'Atención y Comunicación Social', 'ACS'],
    ['OBRAS PÚBLICAS', 'OBP', 'Sin subdirección', '', 'Electrificación y Agua Potable', 'EAP'],
    ['OBRAS PÚBLICAS', 'OBP', 'Sin subdirección', '', 'Obra Civil e Infraestructura', 'OCI'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Vías Terrestres', 'VIT', 'Despacho', 'VIT'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Vías Terrestres', 'VIT', 'Mantenimiento Vial', 'MAV'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Vías Terrestres', 'VIT', 'Mantenimiento Urbano', 'MAU'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Vías Terrestres', 'VIT', 'Construcción de Vialidades', 'COV'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Vías Terrestres', 'VIT', 'Administrativo VT', 'ADMV'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Administración', 'ADM', 'Despacho', 'ADM'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Administración', 'ADM', 'Administración Interna', 'ADI'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Administración', 'ADM', 'Gestión y Control de Obra', 'GCO'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Administración', 'ADM', 'Avance de Obra', 'AVO'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Administración', 'ADM', 'Auditoría Interna', 'SUI'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Planeación y Organización de Obras', 'PLO', 'Despacho', 'PLO'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Planeación y Organización de Obras', 'PLO', 'Presupuestos y Programas', 'PRP'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Planeación y Organización de Obras', 'PLO', 'Organización', 'ORG'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Planeación y Organización de Obras', 'PLO', 'Proyectos', 'PRO'],
    ['OBRAS PÚBLICAS', 'OBP', 'Subdirección de Planeación y Organización de Obras', 'PLO', 'Control y Gestión Presupuestal', 'CGP']
  ];

  var tipoDocList = [
    ['Política', 'PL'],
    ['Procedimiento', 'P'],
    ['Instructivo', 'I'],
    ['Manual', 'M'],
    ['Formato', 'F']
  ];

  var estatusList = ['Vigente', 'En revisión', 'Obsoleto'];

  var result = [];
  var maxRows = Math.max(jerarquia.length, tipoDocList.length, estatusList.length);

  for (var i = 0; i < maxRows; i++) {
    var jRow = jerarquia[i] || ['', '', '', '', '', ''];
    var tRow = tipoDocList[i] || ['', ''];
    var eVal = estatusList[i] || '';

    // Col A..F: Jerarquía, Col G: TipoDoc (Nombre / Sigla o Nombre), Col H: Estatus
    // Formato de TipoDoc en catálogo: Nombre (Sigla) o sólo Nombre, ej: Política (PL)
    var tipoDocFormatted = tRow[0] ? tRow[0] + ' (' + tRow[1] + ')' : '';

    result.push([
      jRow[0], jRow[1], jRow[2], jRow[3], jRow[4], jRow[5],
      tipoDocFormatted, eVal
    ]);
  }

  return result;
}

/**
 * Retorna el correo del usuario actual.
 */
function getCurrentUserEmail() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    email = Session.getEffectiveUser().getEmail();
  }
  return email || 'usuario@merida.gob.mx';
}

/**
 * Verifica si el usuario actual tiene permisos de Administrador.
 */
function esAdmin() {
  var userEmail = getCurrentUserEmail().toLowerCase().trim();
  var ss = getSpreadsheet();
  var sheetConfig = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheetConfig) return true; // Si no existe, permitir por defecto

  var data = sheetConfig.getDataRange().getValues();
  if (data.length <= 1) return true; // Si está vacía la lista, permitir al primer usuario

  for (var i = 1; i < data.length; i++) {
    var adminEmail = String(data[i][0]).toLowerCase().trim();
    if (adminEmail === userEmail) {
      return true;
    }
  }
  return false;
}

/**
 * Obtiene la información del usuario actual y su rol para la interfaz.
 */
function getUserRoleInfo() {
  return {
    email: getCurrentUserEmail(),
    esAdmin: esAdmin()
  };
}

/**
 * Registra una acción en la hoja "Bitacora".
 */
function registrarBitacora(accion, tablaAfectada, codigo, campo, valorAnterior, valorNuevo) {
  var sheetBit = getOrCreateSheet(SHEETS.BITACORA);
  var fecha = new Date();
  var usuario = getCurrentUserEmail();
  sheetBit.appendRow([
    fecha,
    usuario,
    accion,
    tablaAfectada,
    codigo || '',
    campo || '',
    valorAnterior !== undefined && valorAnterior !== null ? String(valorAnterior) : '',
    valorNuevo !== undefined && valorNuevo !== null ? String(valorNuevo) : ''
  ]);
}

/**
 * Carga el catálogo completo agrupado para el cliente.
 */
function getCatalogosData() {
  inicializarBaseDeDatos();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.CATALOGOS);
  var data = sheet.getDataRange().getValues();

  var direccionesMap = {};
  var tiposDocMap = {};
  var tiposDocList = [];
  var estatusList = [];

  for (var i = 1; i < data.length; i++) {
    var dir = String(data[i][0]).trim();
    var siglaDir = String(data[i][1]).trim();
    var sub = String(data[i][2]).trim();
    var siglaSub = String(data[i][3]).trim();
    var dep = String(data[i][4]).trim();
    var siglaArea = String(data[i][5]).trim();
    var tipoDoc = String(data[i][6]).trim();
    var estatus = String(data[i][7]).trim();

    if (dir) {
      if (!direccionesMap[dir]) {
        direccionesMap[dir] = {
          nombre: dir,
          sigla: siglaDir,
          subdirecciones: {}
        };
      }
      if (sub) {
        if (!direccionesMap[dir].subdirecciones[sub]) {
          direccionesMap[dir].subdirecciones[sub] = {
            nombre: sub,
            sigla: siglaSub,
            departamentos: []
          };
        }
        if (dep) {
          // Evitar duplicados de departamento
          var exists = direccionesMap[dir].subdirecciones[sub].departamentos.some(function(d) {
            return d.nombre === dep;
          });
          if (!exists) {
            direccionesMap[dir].subdirecciones[sub].departamentos.push({
              nombre: dep,
              sigla: siglaArea
            });
          }
        }
      }
    }

    if (tipoDoc && !tiposDocMap[tipoDoc]) {
      tiposDocMap[tipoDoc] = true;
      var match = tipoDoc.match(/^(.+)\s*\((.+)\)$/);
      if (match) {
        tiposDocList.push({ nombre: match[1].trim(), sigla: match[2].trim(), combo: tipoDoc });
      } else {
        tiposDocList.push({ nombre: tipoDoc, sigla: tipoDoc.substring(0, 2).toUpperCase(), combo: tipoDoc });
      }
    }

    if (estatus && estatusList.indexOf(estatus) === -1) {
      estatusList.push(estatus);
    }
  }

  return {
    direcciones: direccionesMap,
    tiposDoc: tiposDocList,
    estatus: estatusList
  };
}

/**
 * Mapeo de prefijos según el tipo de documento.
 */
function getPrefijoTipoDoc(tipoDocNombre) {
  var t = (tipoDocNombre || '').toLowerCase();
  if (t.indexOf('política') !== -1 || t.indexOf('politica') !== -1 || t === 'pl') return 'PL';
  if (t.indexOf('procedimiento') !== -1 || t === 'p') return 'P';
  if (t.indexOf('instructivo') !== -1 || t === 'i') return 'I';
  if (t.indexOf('manual') !== -1 || t === 'm') return 'M';
  if (t.indexOf('formato') !== -1 || t === 'f') return 'F';
  return 'DOC';
}

/**
 * Calcula la clave base del área (ej. ADM/LIC o OBP-GCO o ADM)
 */
function construirClaveArea(siglaDir, siglaArea) {
  siglaDir = (siglaDir || '').trim();
  siglaArea = (siglaArea || '').trim();

  if (!siglaArea || siglaArea === siglaDir) {
    return siglaDir;
  }
  return siglaDir + '/' + siglaArea;
}

/**
 * Calcula el siguiente correlativo y genera el código del documento con LockService.
 */
function calcularCodigoTentativo(tipoDoc, siglaDir, siglaArea) {
  var prefijo = getPrefijoTipoDoc(tipoDoc);
  var claveArea = construirClaveArea(siglaDir, siglaArea);
  var prefijoBusqueda = prefijo + '-' + claveArea + '-';

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('No se pudo obtener el bloqueo para calcular el código. Intente de nuevo.');
  }

  var maxCorrelativo = 0;
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.DOCUMENTOS);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var cod = String(data[i][1]).trim();
        if (cod.indexOf(prefijoBusqueda) === 0) {
          var partes = cod.split('-');
          var numStr = partes[partes.length - 1];
          var num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxCorrelativo) {
            maxCorrelativo = num;
          }
        }
      }
    }
  } finally {
    lock.releaseLock();
  }

  var nuevoNum = maxCorrelativo + 1;
  var numPadded = String(nuevoNum);
  while (numPadded.length < 3) {
    numPadded = '0' + numPadded;
  }

  return prefijoBusqueda + numPadded;
}

/**
 * Crea un nuevo documento en la base de datos.
 */
function crearDocumento(docData) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para crear documentos. Contacte al administrador.');
  }

  // Validación de revisión
  var revPattern = /^(NR)?\d{1,2}$/i;
  if (!revPattern.test(docData.revision)) {
    throw new Error('El formato de la revisión es inválido. Debe ser un entero de 1 o 2 dígitos, o comenzar con NR (ej. NR0, 1, 01, NR).');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('El sistema está ocupado procesando otra solicitud. Intente nuevamente.');
  }

  try {
    var codigoGenerado = calcularCodigoTentativo(docData.tipo, docData.siglaDir, docData.siglaArea);
    var ss = getSpreadsheet();
    var sheetDoc = getOrCreateSheet(SHEETS.DOCUMENTOS);

    var idDoc = 'DOC-' + new Date().getTime();
    var fechaEdicion = docData.fecha_edicion ? new Date(docData.fecha_edicion) : new Date();
    var fechaActualizacion = docData.fecha_actualizacion ? new Date(docData.fecha_actualizacion) : new Date();
    var fechaCreacion = new Date();
    var creadoPor = getCurrentUserEmail();

    sheetDoc.appendRow([
      idDoc,
      codigoGenerado,
      docData.tipo,
      docData.nombre,
      docData.direccion,
      docData.subdireccion,
      docData.departamento,
      fechaEdicion,
      fechaActualizacion,
      docData.revision,
      0, // num_formatos
      docData.estatus || 'Vigente',
      docData.difundido || 'No',
      creadoPor,
      fechaCreacion
    ]);

    registrarBitacora('ALTA', 'Documentos', codigoGenerado, 'REGISTRO_COMPLETO', '', docData.nombre);

    return {
      exito: true,
      codigo: codigoGenerado,
      id_documento: idDoc,
      mensaje: 'Documento registrado exitosamente con el código ' + codigoGenerado
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Recalcula y actualiza el campo num_formatos en la hoja Documentos para un código dado.
 */
function recalcularNumFormatos(codigoDocumento) {
  var ss = getSpreadsheet();
  var sheetDoc = ss.getSheetByName(SHEETS.DOCUMENTOS);
  var sheetForm = ss.getSheetByName(SHEETS.FORMATOS);
  if (!sheetDoc || !sheetForm) return;

  var dataForm = sheetForm.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < dataForm.length; i++) {
    var docRef = String(dataForm[i][1]).trim();
    var estatusForm = String(dataForm[i][6]).trim();
    if (docRef === codigoDocumento && estatusForm !== 'Obsoleto') {
      count++;
    }
  }

  var dataDoc = sheetDoc.getDataRange().getValues();
  for (var j = 1; j < dataDoc.length; j++) {
    if (String(dataDoc[j][1]).trim() === codigoDocumento) {
      sheetDoc.getRange(j + 1, 11).setValue(count); // Col 11: num_formatos
      break;
    }
  }
}

/**
 * Registra o crea un nuevo Formato asociado a un documento.
 */
function crearFormato(formatoData) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para agregar formatos. Contacte al administrador.');
  }

  var revPattern = /^(NR)?\d{1,2}$/i;
  if (!revPattern.test(formatoData.revision)) {
    throw new Error('Formato de revisión inválido.');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Sistema ocupado. Intente de nuevo.');
  }

  try {
    var ss = getSpreadsheet();
    var sheetForm = getOrCreateSheet(SHEETS.FORMATOS);
    var dataForm = sheetForm.getDataRange().getValues();

    // Generar código de formato F-{SiglaDir}/{SiglaArea}-{correlativo}
    // Basado en el documento padre o siglas proporcionadas
    var docCodigo = formatoData.codigo_documento;
    var maxFormCorrelativo = 0;

    for (var i = 1; i < dataForm.length; i++) {
      var codF = String(dataForm[i][2]).trim();
      var docF = String(dataForm[i][1]).trim();
      if (docF === docCodigo) {
        var partes = codF.split('-');
        var lastNum = parseInt(partes[partes.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxFormCorrelativo) {
          maxFormCorrelativo = lastNum;
        }
      }
    }

    var nextNum = maxFormCorrelativo + 1;
    var nextNumStr = String(nextNum);
    while (nextNumStr.length < 2) {
      nextNumStr = '0' + nextNumStr;
    }

    // Si el código de documento es ej. P-ADM/LIC-01, el formato será F-ADM/LIC-01-F01 o F-ADM/LIC-01-01
    // La regla indica patrón: F-{SiglaDir}/{SiglaArea}-{correlativo} o derivado del documento
    var partesDoc = docCodigo.split('-');
    var baseClave = partesDoc.slice(1, partesDoc.length - 1).join('-');
    var codigoFormatoGenerado = 'F-' + baseClave + '-' + partesDoc[partesDoc.length - 1] + '-F' + nextNumStr;

    var idFormato = 'FOR-' + new Date().getTime();
    var fechaAct = formatoData.fecha_actualizacion ? new Date(formatoData.fecha_actualizacion) : new Date();

    sheetForm.appendRow([
      idFormato,
      docCodigo,
      codigoFormatoGenerado,
      formatoData.nombre,
      formatoData.revision,
      fechaAct,
      formatoData.estatus || 'Vigente'
    ]);

    recalcularNumFormatos(docCodigo);
    registrarBitacora('ALTA', 'Formatos', codigoFormatoGenerado, 'REGISTRO_FORMATO', '', formatoData.nombre);

    return {
      exito: true,
      codigo_formato: codigoFormatoGenerado,
      mensaje: 'Formato registrado con código ' + codigoFormatoGenerado
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Consulta y lista todos los documentos con opción de filtros.
 */
function listarDocumentos(filtros) {
  inicializarBaseDeDatos();
  var ss = getSpreadsheet();
  var sheetDoc = ss.getSheetByName(SHEETS.DOCUMENTOS);
  if (!sheetDoc) return [];

  var data = sheetDoc.getDataRange().getValues();
  if (data.length <= 1) return [];

  filtros = filtros || {};
  var busqueda = (filtros.busqueda || '').toLowerCase().trim();
  var direccion = (filtros.direccion || '').trim();
  var estatus = (filtros.estatus || '').trim();
  var tipo = (filtros.tipo || '').trim();

  var resultados = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var doc = {
      id_documento: String(row[0]),
      codigo: String(row[1]),
      tipo: String(row[2]),
      nombre: String(row[3]),
      direccion: String(row[4]),
      subdireccion: String(row[5]),
      departamento: String(row[6]),
      fecha_edicion: row[7] instanceof Date ? Utilities.formatDate(row[7], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[7]),
      fecha_actualizacion: row[8] instanceof Date ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[8]),
      revision: String(row[9]),
      num_formatos: Number(row[10]) || 0,
      estatus: String(row[11]),
      difundido: String(row[12]),
      creado_por: String(row[13]),
      fecha_creacion: row[14] instanceof Date ? Utilities.formatDate(row[14], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(row[14]),
      fila: i + 1
    };

    // Aplicar Filtros
    if (direccion && doc.direccion !== direccion) continue;
    if (estatus && doc.estatus !== estatus) continue;
    if (tipo && doc.tipo !== tipo) continue;

    if (busqueda) {
      var matchCod = doc.codigo.toLowerCase().indexOf(busqueda) !== -1;
      var matchNom = doc.nombre.toLowerCase().indexOf(busqueda) !== -1;
      var matchDir = doc.direccion.toLowerCase().indexOf(busqueda) !== -1;
      var matchDep = doc.departamento.toLowerCase().indexOf(busqueda) !== -1;
      if (!matchCod && !matchNom && !matchDir && !matchDep) continue;
    }

    resultados.push(doc);
  }

  return resultados;
}

/**
 * Actualiza sólo los campos permitidos de un documento (edición inline o modal).
 * Bloquea estrictamente la modificación del código, dirección, subdirección y departamento.
 */
function actualizarDocumento(docData) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para modificar documentos. Se requiere rol Administrador.');
  }

  var revPattern = /^(NR)?\d{1,2}$/i;
  if (!revPattern.test(docData.revision)) {
    throw new Error('El formato de la revisión es inválido. Ejemplo de formato válido: 0, 1, 01, NR.');
  }

  var ss = getSpreadsheet();
  var sheetDoc = ss.getSheetByName(SHEETS.DOCUMENTOS);
  var data = sheetDoc.getDataRange().getValues();

  var filaEncontrada = -1;
  var rowActual = null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(docData.codigo).trim()) {
      filaEncontrada = i + 1;
      rowActual = data[i];
      break;
    }
  }

  if (filaEncontrada === -1) {
    throw new Error('No se encontró el documento con código ' + docData.codigo);
  }

  // Campos Permitidos a editar: nombre (col 4), fecha_edicion (col 8), fecha_actualizacion (col 9), revision (col 10), estatus (col 12), difundido (col 13)
  var cambios = [];

  if (rowActual[3] !== docData.nombre) {
    cambios.push({ campo: 'nombre', anterior: rowActual[3], nuevo: docData.nombre });
    sheetDoc.getRange(filaEncontrada, 4).setValue(docData.nombre);
  }

  var nFechaEdicion = new Date(docData.fecha_edicion);
  sheetDoc.getRange(filaEncontrada, 8).setValue(nFechaEdicion);

  var nFechaAct = new Date(docData.fecha_actualizacion);
  sheetDoc.getRange(filaEncontrada, 9).setValue(nFechaAct);

  if (String(rowActual[9]) !== String(docData.revision)) {
    cambios.push({ campo: 'revision', anterior: rowActual[9], nuevo: docData.revision });
    sheetDoc.getRange(filaEncontrada, 10).setValue(docData.revision);
  }

  if (String(rowActual[11]) !== String(docData.estatus)) {
    cambios.push({ campo: 'estatus', anterior: rowActual[11], nuevo: docData.estatus });
    sheetDoc.getRange(filaEncontrada, 12).setValue(docData.estatus);
  }

  if (String(rowActual[12]) !== String(docData.difundido)) {
    cambios.push({ campo: 'difundido', anterior: rowActual[12], nuevo: docData.difundido });
    sheetDoc.getRange(filaEncontrada, 13).setValue(docData.difundido);
  }

  // Registrar auditoría por cada campo cambiado
  for (var c = 0; c < cambios.length; c++) {
    registrarBitacora('EDICION', 'Documentos', docData.codigo, cambios[c].campo, cambios[c].anterior, cambios[c].nuevo);
  }

  return { exito: true, mensaje: 'Documento actualizado correctamente.' };
}

/**
 * Da de baja lógica a un documento (Estatus -> Obsoleto). NUNCA borra filas.
 */
function obsolecerDocumento(codigoDoc) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para modificar estatus de documentos.');
  }

  var ss = getSpreadsheet();
  var sheetDoc = ss.getSheetByName(SHEETS.DOCUMENTOS);
  var data = sheetDoc.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(codigoDoc).trim()) {
      var estatusAnterior = data[i][11];
      sheetDoc.getRange(i + 1, 12).setValue('Obsoleto');
      registrarBitacora('BAJA', 'Documentos', codigoDoc, 'estatus', estatusAnterior, 'Obsoleto');
      return { exito: true, mensaje: 'Documento marcado como Obsoleto exitosamente.' };
    }
  }

  throw new Error('Documento no encontrado.');
}

/**
 * Obtiene los formatos correspondientes a un documento determinado.
 */
function obtenerFormatosPorDocumento(codigoDoc) {
  var ss = getSpreadsheet();
  var sheetForm = ss.getSheetByName(SHEETS.FORMATOS);
  if (!sheetForm) return [];

  var data = sheetForm.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(codigoDoc).trim()) {
      result.push({
        id_formato: String(data[i][0]),
        codigo_documento: String(data[i][1]),
        codigo_formato: String(data[i][2]),
        nombre: String(data[i][3]),
        revision: String(data[i][4]),
        fecha_actualizacion: data[i][5] instanceof Date ? Utilities.formatDate(data[i][5], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(data[i][5]),
        estatus: String(data[i][6])
      });
    }
  }
  return result;
}

/**
 * Actualiza un formato existente.
 */
function actualizarFormato(formatoData) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para modificar formatos.');
  }

  var ss = getSpreadsheet();
  var sheetForm = ss.getSheetByName(SHEETS.FORMATOS);
  var data = sheetForm.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === String(formatoData.codigo_formato).trim()) {
      var fila = i + 1;
      var antNom = data[i][3];
      var antRev = data[i][4];
      var antEst = data[i][6];

      sheetForm.getRange(fila, 4).setValue(formatoData.nombre);
      sheetForm.getRange(fila, 5).setValue(formatoData.revision);
      sheetForm.getRange(fila, 6).setValue(new Date(formatoData.fecha_actualizacion));
      sheetForm.getRange(fila, 7).setValue(formatoData.estatus);

      if (antNom !== formatoData.nombre) registrarBitacora('EDICION', 'Formatos', formatoData.codigo_formato, 'nombre', antNom, formatoData.nombre);
      if (antRev !== formatoData.revision) registrarBitacora('EDICION', 'Formatos', formatoData.codigo_formato, 'revision', antRev, formatoData.revision);
      if (antEst !== formatoData.estatus) registrarBitacora('EDICION', 'Formatos', formatoData.codigo_formato, 'estatus', antEst, formatoData.estatus);

      recalcularNumFormatos(formatoData.codigo_documento);
      return { exito: true, mensaje: 'Formato actualizado correctamente.' };
    }
  }
  throw new Error('Formato no encontrado.');
}

/**
 * Cambia el estatus de un formato a Obsoleto.
 */
function obsolecerFormato(codigoFormato, codigoDocumento) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para modificar formatos.');
  }

  var ss = getSpreadsheet();
  var sheetForm = ss.getSheetByName(SHEETS.FORMATOS);
  var data = sheetForm.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === String(codigoFormato).trim()) {
      sheetForm.getRange(i + 1, 7).setValue('Obsoleto');
      registrarBitacora('BAJA', 'Formatos', codigoFormato, 'estatus', data[i][6], 'Obsoleto');
      recalcularNumFormatos(codigoDocumento || data[i][1]);
      return { exito: true, mensaje: 'Formato marcado como Obsoleto.' };
    }
  }
  throw new Error('Formato no encontrado.');
}

/**
 * Obtiene métricas y estadísticas para el Dashboard.
 */
function getDashboardData() {
  var docs = listarDocumentos({});
  var hoy = new Date();

  var totalVigentes = 0;
  var porTipo = {};
  var porDireccion = {};
  var obsoletos = 0;
  var enRevision = 0;
  var mayoresA12Meses = [];

  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];

    if (d.estatus === 'Vigente') totalVigentes++;
    if (d.estatus === 'Obsoleto') obsoletos++;
    if (d.estatus === 'En revisión') enRevision++;

    porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1;
    porDireccion[d.direccion] = (porDireccion[d.direccion] || 0) + 1;

    // Antigüedad basada en fecha_actualizacion o fecha_edicion
    var fechaBase = d.fecha_actualizacion ? new Date(d.fecha_actualizacion) : new Date(d.fecha_edicion);
    var difMeses = 0;
    if (fechaBase && !isNaN(fechaBase.getTime())) {
      difMeses = (hoy.getFullYear() - fechaBase.getFullYear()) * 12 + (hoy.getMonth() - fechaBase.getMonth());
    }

    var semaforo = 'verde';
    if (difMeses >= 12 && difMeses < 24) {
      semaforo = 'amarillo';
    } else if (difMeses >= 24) {
      semaforo = 'rojo';
    }

    if (difMeses >= 12 && d.estatus !== 'Obsoleto') {
      mayoresA12Meses.push({
        codigo: d.codigo,
        nombre: d.nombre,
        direccion: d.direccion,
        fecha_actualizacion: d.fecha_actualizacion,
        meses: difMeses,
        semaforo: semaforo,
        estatus: d.estatus
      });
    }
  }

  // Ordenar de mayor a menor antigüedad
  mayoresA12Meses.sort(function(a, b) { return b.meses - a.meses; });

  return {
    totales: {
      total: docs.length,
      vigentes: totalVigentes,
      enRevision: enRevision,
      obsoletos: obsoletos
    },
    porTipo: porTipo,
    porDireccion: porDireccion,
    mayoresA12Meses: mayoresA12Meses
  };
}

/**
 * Obtiene el historial de auditoría de la Bitácora.
 */
function getHistorialBitacora(codigoFiltro) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.BITACORA);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var result = [];

  for (var i = data.length - 1; i >= 1; i--) { // Cronológico inverso
    var cod = String(data[i][4]).trim();
    if (codigoFiltro && cod.toLowerCase().indexOf(codigoFiltro.toLowerCase().trim()) === -1) {
      continue;
    }

    result.push({
      fecha: data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(data[i][0]),
      usuario: String(data[i][1]),
      accion: String(data[i][2]),
      tabla: String(data[i][3]),
      codigo: String(data[i][4]),
      campo: String(data[i][5]),
      valor_anterior: String(data[i][6]),
      valor_nuevo: String(data[i][7])
    });
  }

  return result;
}

/**
 * Función helper para parsear fechas de Excel / CSV en múltiples formatos.
 */
function parsearFechaGenerica(valor) {
  if (!valor) return null;
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;

  // Si es un número serial de Excel (ej: 44927)
  var numVal = Number(valor);
  if (!isNaN(numVal) && numVal > 10000 && numVal < 80000) {
    // 25569 = días entre 1899-12-30 y 1970-01-01
    var jsDate = new Date((numVal - 25569) * 86400 * 1000);
    if (!isNaN(jsDate.getTime())) return jsDate;
  }

  var str = String(valor).trim();

  // Formato dd/mm/yyyy
  var matchDMY = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (matchDMY) {
    var dia = parseInt(matchDMY[1], 10);
    var mes = parseInt(matchDMY[2], 10) - 1;
    var anio = parseInt(matchDMY[3], 10);
    var d = new Date(anio, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  // Formato yyyy-mm-dd
  var matchYMD = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (matchYMD) {
    var anio2 = parseInt(matchYMD[1], 10);
    var mes2 = parseInt(matchYMD[2], 10) - 1;
    var dia2 = parseInt(matchYMD[3], 10);
    var d2 = new Date(anio2, mes2, dia2);
    if (!isNaN(d2.getTime())) return d2;
  }

  var standardDate = new Date(str);
  if (!isNaN(standardDate.getTime())) return standardDate;

  return null;
}

/**
 * Importa datos masivos desde texto pegado (CSV/TSV).
 * Consolida duplicados por código y reporta inconsistencias en la hoja ErroresMigracion.
 */
function importarDesdeExcel(contenidoTexto) {
  if (!esAdmin()) {
    throw new Error('No tiene permisos para ejecutar migraciones de datos.');
  }

  if (!contenidoTexto || !contenidoTexto.trim()) {
    throw new Error('El contenido a importar está vacío.');
  }

  var ss = getSpreadsheet();
  var sheetDoc = getOrCreateSheet(SHEETS.DOCUMENTOS);
  var sheetErr = getOrCreateSheet(SHEETS.ERRORES_MIGRACION, ['FilaOriginal', 'Codigo', 'Error', 'DatosFila']);

  // Limpiar errores previos de la hoja ErroresMigracion
  if (sheetErr.getLastRow() > 1) {
    sheetErr.getRange(2, 1, sheetErr.getLastRow() - 1, 4).clearContent();
  }

  var lineas = contenidoTexto.split(/\r?\n/);
  if (lineas.length === 0) return { creados: 0, actualizados: 0, errores: 0 };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('El servidor está procesando otra tarea. Intente más tarde.');
  }

  var creados = 0;
  var actualizados = 0;
  var erroresCount = 0;

  try {
    // Mapa de documentos existentes
    var docData = sheetDoc.getDataRange().getValues();
    var mapaDocs = {};
    for (var k = 1; k < docData.length; k++) {
      var codExistente = String(docData[k][1]).trim().toUpperCase();
      if (codExistente) {
        mapaDocs[codExistente] = k + 1; // Guarda número de fila
      }
    }

    var revPattern = /^(NR)?\d{1,2}$/i;

    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i].trim();
      if (!linea) continue;

      // Separar por coma o tabulador
      var cols = linea.indexOf('\t') !== -1 ? linea.split('\t') : linea.split(',');
      for (var c = 0; c < cols.length; c++) {
        cols[c] = cols[c].replace(/^["']|["']$/g, '').trim();
      }

      // Esperado: [codigo, tipo, nombre, direccion, subdireccion, departamento, fecha_edicion, fecha_actualizacion, revision, estatus, difundido]
      if (cols.length < 3) {
        sheetErr.appendRow([i + 1, cols[0] || 'N/A', 'Columnas insuficientes (mínimo 3: código, tipo, nombre)', linea]);
        erroresCount++;
        continue;
      }

      var codigoVal = cols[0] ? cols[0].toUpperCase() : '';
      var tipoVal = cols[1] || 'Procedimiento';
      var nombreVal = cols[2] || 'Sin nombre';
      var dirVal = cols[3] || 'ADMINISTRACIÓN';
      var subVal = cols[4] || 'Sin subdirección';
      var depVal = cols[5] || 'Despacho';
      var fEdicionRaw = cols[6];
      var fActRaw = cols[7] || cols[6];
      var revVal = cols[8] || '0';
      var estatusVal = cols[9] || 'Vigente';
      var difundidoVal = cols[10] || 'Sí';

      // Validación de código
      if (!codigoVal || codigoVal.indexOf('-') === -1) {
        sheetErr.appendRow([i + 1, codigoVal, 'Código inválido o mal formado', linea]);
        erroresCount++;
        continue;
      }

      // Validación de fechas
      var fEdicion = parsearFechaGenerica(fEdicionRaw);
      var fAct = parsearFechaGenerica(fActRaw);

      if (!fEdicion) fEdicion = new Date();
      if (!fAct) fAct = fEdicion;

      // Validación de revisión
      if (!revPattern.test(revVal)) {
        revVal = '0'; // Valor fallback si no cumple patrón
      }

      if (mapaDocs[codigoVal]) {
        // Consolidación de duplicados: Actualizar la fila existente
        var filaDestino = mapaDocs[codigoVal];
        sheetDoc.getRange(filaDestino, 3, 1, 11).setValues([[
          tipoVal, nombreVal, dirVal, subVal, depVal,
          fEdicion, fAct, revVal, 0, estatusVal, difundidoVal
        ]]);
        actualizados++;
        registrarBitacora('EDICION', 'Documentos', codigoVal, 'MIGRACION_CONSOLIDADA', '', 'Consolidado desde Excel/CSV');
      } else {
        // Nueva creación
        var newId = 'DOC-' + new Date().getTime() + '-' + i;
        sheetDoc.appendRow([
          newId, codigoVal, tipoVal, nombreVal, dirVal, subVal, depVal,
          fEdicion, fAct, revVal, 0, estatusVal, difundidoVal,
          getCurrentUserEmail(), new Date()
        ]);
        mapaDocs[codigoVal] = sheetDoc.getLastRow();
        creados++;
        registrarBitacora('ALTA', 'Documentos', codigoVal, 'MIGRACION_EXCEL', '', nombreVal);
      }
    }

    return {
      creados: creados,
      actualizados: actualizados,
      errores: erroresCount,
      mensaje: 'Migración finalizada. Creados: ' + creados + ', Actualizados: ' + actualizados + ', Errores: ' + erroresCount
    };
  } finally {
    lock.releaseLock();
  }
}
