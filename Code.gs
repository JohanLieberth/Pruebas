/**
 * Xplore 2026 - Pre-registro
 * Backend logic for Google Apps Script
 */

const CONFIG = {
  // We'll get the ID dynamically inside functions to be safer
  SHEET_REGISTROS: 'Registros',
  SHEET_CONFIG: 'Config',
  SHEET_HORARIOS: 'Horarios',
  SHEET_ESTADOS: 'Estados',
  FOLIO_PREFIX: 'XPL2026-',
  MAX_ATTEMPTS: 3
};

/**
 * Serves the web application.
 */
function doGet(e) {
  // Handle case where e might be undefined (e.g. running from editor)
  const parameter = (e && e.parameter) ? e.parameter : {};
  const page = parameter.p || 'index';

  try {
    if (page === 'admin') {
      return HtmlService.createTemplateFromFile('Admin')
          .evaluate()
          .setTitle('Admin Panel - Xplore 2026')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('Registro Xplore 2026')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    return HtmlService.createHtmlOutput('Error al cargar la página: ' + error.message);
  }
}

/**
 * Includes HTML files within other HTML files.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gets initial data for the registration form.
 */
/**
 * Helper to get the active spreadsheet safely.
 */
function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getInitialData() {
  const ss = getSS();
  const configSheet = ss.getSheetByName(CONFIG.SHEET_CONFIG);
  const horariosSheet = ss.getSheetByName(CONFIG.SHEET_HORARIOS);
  const estadosSheet = ss.getSheetByName(CONFIG.SHEET_ESTADOS);

  if (!configSheet || !horariosSheet || !estadosSheet) {
    return { needsInit: true };
  }

  // Get schedules and availability
  const horariosData = horariosSheet.getDataRange().getValues();
  const schedules = [];
  for (let i = 1; i < horariosData.length; i++) {
    schedules.push({
      time: horariosData[i][0],
      total: horariosData[i][1],
      registered: horariosData[i][2],
      available: horariosData[i][3]
    });
  }

  // Get registration status
  const configData = configSheet.getDataRange().getValues();
  let registrationOpen = true;
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === 'Estado de inscripciones') {
      registrationOpen = configData[i][1] === 'Abierto';
      break;
    }
  }

  // Get states from sheet
  let states = [];
  const statesData = estadosSheet.getDataRange().getValues();
  if (statesData.length > 1) {
    // Skip header and filter empty values
    states = statesData.slice(1).map(row => row[0]).filter(s => s && String(s).trim() !== "");
  }

  return {
    schedules: schedules,
    registrationOpen: registrationOpen,
    states: states
  };
}

/**
 * Processes the registration form.
 */
function processRegistration(formData) {
  const ss = getSS();
  const registrosSheet = ss.getSheetByName(CONFIG.SHEET_REGISTROS);
  const configSheet = ss.getSheetByName(CONFIG.SHEET_CONFIG);
  const horariosSheet = ss.getSheetByName(CONFIG.SHEET_HORARIOS);

  // 1. Basic server-side validations
  if (formData.honeypot) {
    throw new Error('Spam detectado.');
  }

  if (!formData.email || !formData.nombre || !formData.apellidoPaterno || !formData.telefono) {
    throw new Error('Campos obligatorios faltantes.');
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    throw new Error('Formato de email inválido.');
  }

  // Phone validation (10 digits)
  if (!/^\d{10}$/.test(formData.telefono)) {
    throw new Error('El teléfono debe tener exactamente 10 dígitos.');
  }

  // Age validation
  const edad = parseInt(formData.edad);
  if (isNaN(edad) || edad < 18 || edad > 65) {
    throw new Error('La edad debe estar entre 18 y 65 años.');
  }

  if (formData.horarioPrincipal === formData.horarioAlternativo) {
    throw new Error('El horario alternativo debe ser diferente al principal.');
  }

  // 2. Check if registration is open
  const configValues = configSheet.getDataRange().getValues();
  let isOpen = false;
  for (let i = 0; i < configValues.length; i++) {
    if (configValues[i][0] === 'Estado de inscripciones' && configValues[i][1] === 'Abierto') {
      isOpen = true;
      break;
    }
  }
  if (!isOpen) throw new Error('Las inscripciones están cerradas.');

  // 3. Check for duplicates
  const emails = registrosSheet.getRange(2, 8, registrosSheet.getLastRow() || 1).getValues().flat();
  if (emails.includes(formData.email.toLowerCase().trim())) {
    throw new Error('Este correo electrónico ya está registrado.');
  }

  // 4. Check schedule availability
  const horariosData = horariosSheet.getDataRange().getValues();
  let scheduleFound = false;
  let availableSlots = 0;
  let rowIndex = -1;

  for (let i = 1; i < horariosData.length; i++) {
    if (horariosData[i][0] == formData.horarioPrincipal) {
      scheduleFound = true;
      availableSlots = horariosData[i][3];
      rowIndex = i + 1;
      break;
    }
  }

  if (!scheduleFound || availableSlots <= 0) {
    throw new Error('El horario seleccionado ya no tiene cupo disponible.');
  }

  // 5. Generate Folio
  const folioNum = (registrosSheet.getLastRow()).toString().padStart(4, '0');
  const folio = CONFIG.FOLIO_PREFIX + folioNum;

  // 6. Save Registration
  const timestamp = new Date();
  const rowData = [
    folio,
    timestamp,
    formData.prefix,
    formData.nombre,
    formData.apellidoPaterno,
    formData.apellidoMaterno,
    formData.telefono,
    formData.email.toLowerCase().trim(),
    formData.genero,
    formData.edad,
    formData.talla,
    formData.estado,
    formData.categoria,
    formData.horarioPrincipal,
    formData.horarioAlternativo,
    'Confirmado',
    '' // Notas
  ];

  registrosSheet.appendRow(rowData);

  // 7. Update Availability (Horarios Sheet)
  // We need to recalculate or just increment. The formula in sheet should handle it if set up,
  // but let's increment manually just in case or trigger a refresh.
  // Actually, if we use formulas in the sheet (Cupo Total - Registrados), it's better.
  // We'll ensure the initialization sets up formulas.

  SpreadsheetApp.flush();

  // 8. Send Confirmation Email
  try {
    sendConfirmationEmail(formData, folio);
  } catch (e) {
    console.error('Error sending email: ' + e.message);
  }

  return {
    success: true,
    folio: folio
  };
}

/**
 * Sends a confirmation email to the user.
 */
function sendConfirmationEmail(data, folio) {
  const subject = `Confirmación de Pre-registro Xplore 2026 - Folio: ${folio}`;
  const body = `
    Hola ${data.nombre} ${data.apellidoPaterno},

    Tu pre-registro para el evento Xplore 2026 ha sido exitoso.

    DETALLES DE TU REGISTRO:
    Folio: ${folio}
    Fecha: 20 de septiembre 2026
    Lugar: Parque Xplor
    Horario Principal: ${data.horarioPrincipal}
    Categoría: ${data.categoria}

    Por favor presenta este correo o tu folio el día del evento.

    ¡Te esperamos!
    Equipo Xplore 2026
  `;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #4CAF50;">
      <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
        <h1>Xplore 2026</h1>
        <h2>Confirmación de Registro</h2>
      </div>
      <div style="padding: 20px;">
        <p>Hola <strong>${data.nombre} ${data.apellidoPaterno}</strong>,</p>
        <p>Tu pre-registro para el evento <strong>Xplore 2026</strong> ha sido exitoso.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Folio:</strong> <span style="font-size: 1.2em; color: #FF9800;">${folio}</span></p>
          <p><strong>Fecha:</strong> 20 de septiembre 2026</p>
          <p><strong>Lugar:</strong> Parque Xplor</p>
          <p><strong>Horario Principal:</strong> ${data.horarioPrincipal}</p>
          <p><strong>Categoría:</strong> ${data.categoria}</p>
        </div>
        <p>Por favor presenta este correo o tu folio el día del evento.</p>
        <p>¡Te esperamos con toda la energía!</p>
      </div>
      <div style="background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 0.8em;">
        &copy; 2026 Xplore Eventos. Todos los derechos reservados.
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body,
    htmlBody: htmlBody
  });
}

/**
 * ADMIN PANEL FUNCTIONS
 */

function checkPassword(password) {
  const ss = getSS();
  const configSheet = ss.getSheetByName(CONFIG.SHEET_CONFIG);
  const configData = configSheet.getDataRange().getValues();

  let correctPassword = '';
  for (let i = 0; i < configData.length; i++) {
    if (configData[i][0] === 'Contraseña de panel admin') {
      correctPassword = configData[i][1];
      break;
    }
  }

  return password === String(correctPassword);
}

function getAdminData(password) {
  if (!checkPassword(password)) {
    throw new Error('No autorizado');
  }

  const ss = getSS();
  const registrosSheet = ss.getSheetByName(CONFIG.SHEET_REGISTROS);
  const configSheet = ss.getSheetByName(CONFIG.SHEET_CONFIG);

  const registrations = registrosSheet.getDataRange().getValues();
  const config = configSheet.getDataRange().getValues();

  // Calculate statistics
  let totalRegistrations = registrations.length - 1;
  let individualCount = 0;
  let vipCount = 0;

  if (totalRegistrations > 0) {
    const categoriaColIndex = 12; // Column M
    for (let i = 1; i < registrations.length; i++) {
      if (registrations[i][categoriaColIndex] === 'Individual') individualCount++;
      if (registrations[i][categoriaColIndex] === 'VIP') vipCount++;
    }
  }

  return {
    registrations: registrations,
    stats: {
      total: totalRegistrations,
      individual: individualCount,
      vip: vipCount
    },
    config: config
  };
}

function exportToCSV(password) {
  if (!checkPassword(password)) {
    throw new Error('No autorizado');
  }

  const ss = getSS();
  const sheet = ss.getSheetByName(CONFIG.SHEET_REGISTROS);
  const data = sheet.getDataRange().getValues();

  let csvContent = "";
  data.forEach(function(row) {
    let rowContent = row.map(cell => {
      let content = String(cell).replace(/"/g, '""');
      return `"${content}"`;
    }).join(",");
    csvContent += rowContent + "\r\n";
  });

  return Utilities.base64Encode(csvContent);
}

/**
 * SYSTEM INITIALIZATION
 */
function initializeSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet "Registros"
  let registrosSheet = ss.getSheetByName(CONFIG.SHEET_REGISTROS);
  if (!registrosSheet) {
    registrosSheet = ss.insertSheet(CONFIG.SHEET_REGISTROS);
    const headers = [
      'Folio', 'Timestamp', 'Prefix', 'Nombre', 'Apellido Paterno', 'Apellido Materno',
      'Teléfono', 'Email', 'Género', 'Edad', 'Talla', 'Estado', 'Categoría',
      'Horario Principal', 'Horario Alternativo', 'Estatus', 'Notas'
    ];
    registrosSheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#4CAF50').setFontColor('white').setFontWeight('bold');
    registrosSheet.setFrozenRows(1);
  }

  // 2. Sheet "Config"
  let configSheet = ss.getSheetByName(CONFIG.SHEET_CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG.SHEET_CONFIG);
    const defaultConfig = [
      ['Configuración', 'Valor'],
      ['Cupo máximo por horario', 50],
      ['Email de administrador', Session.getEffectiveUser().getEmail()],
      ['Contraseña de panel admin', 'Xplore2026'],
      ['Estado de inscripciones', 'Abierto']
    ];
    configSheet.getRange(1, 1, defaultConfig.length, 2).setValues(defaultConfig);
    configSheet.getRange(1, 1, 1, 2).setBackground('#FF9800').setFontColor('white').setFontWeight('bold');
  }

  // 3. Sheet "Horarios"
  let horariosSheet = ss.getSheetByName(CONFIG.SHEET_HORARIOS);
  if (!horariosSheet) {
    horariosSheet = ss.insertSheet(CONFIG.SHEET_HORARIOS);
    const headers = ['Horario', 'Cupo Total', 'Registrados', 'Disponibles'];
    const timeSlots = [
      ['08:00', 50], ['08:30', 50], ['09:00', 50], ['09:30', 50],
      ['10:00', 50], ['10:30', 50], ['11:30', 50], ['12:00', 50]
    ];

    horariosSheet.getRange(1, 1, 1, 4).setValues([headers])
      .setBackground('#4CAF50').setFontColor('white').setFontWeight('bold');

    for (let i = 0; i < timeSlots.length; i++) {
      const row = i + 2;
      horariosSheet.getRange(row, 1, 1, 2).setValues([timeSlots[i]]);
      // Formula for "Registrados"
      horariosSheet.getRange(row, 3).setFormula(`=COUNTIF(Registros!N:N, A${row})`);
      // Formula for "Disponibles"
      horariosSheet.getRange(row, 4).setFormula(`=B${row} - C${row}`);
    }
  }

  // 4. Sheet "Estados"
  let estadosSheet = ss.getSheetByName(CONFIG.SHEET_ESTADOS);
  if (!estadosSheet || estadosSheet.getLastRow() <= 1) {
    if (!estadosSheet) {
      estadosSheet = ss.insertSheet(CONFIG.SHEET_ESTADOS);
    }
    const headers = [['Estado']];
    const statesList = [
      ["Aguascalientes"], ["Baja California"], ["Baja California Sur"], ["Campeche"], ["Chiapas"],
      ["Chihuahua"], ["Coahuila de Zaragoza"], ["Colima"], ["Ciudad de México"], ["Durango"],
      ["Guanajuato"], ["Guerrero"], ["Hidalgo"], ["Jalisco"], ["México (Estado de México)"],
      ["Michoacán de Ocampo"], ["Morelos"], ["Nayarit"], ["Nuevo León"], ["Oaxaca"], ["Puebla"],
      ["Querétaro"], ["Quintana Roo"], ["San Luis Potosí"], ["Sinaloa"], ["Sonora"], ["Tabasco"],
      ["Tamaulipas"], ["Tlaxcala"], ["Veracruz de Ignacio de la Llave"], ["Yucatán"], ["Zacatecas"]
    ];
    estadosSheet.clear();
    estadosSheet.getRange(1, 1, 1, 1).setValues(headers)
      .setBackground('#4CAF50').setFontColor('white').setFontWeight('bold');
    estadosSheet.getRange(2, 1, statesList.length, 1).setValues(statesList);
  }

  return "Sistema inicializado correctamente.";
}
