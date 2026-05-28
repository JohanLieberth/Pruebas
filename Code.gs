/**
 * Sistema de Quiniela Mundial 2026
 * Desarrollador: Jules (AI Assistant)
 * Lenguaje: Google Apps Script
 */

// --- CONFIGURACIÓN Y CONSTANTES ---
const SHEETS = {
  CONFIG: 'Configuracion',
  PARTIDOS: 'Partidos',
  PRONOSTICOS: 'Pronosticos',
  PARTICIPANTES: 'Participantes',
  RANKING: 'Ranking',
  LOGS: 'Log_Errores'
};

const PUNTOS = {
  EXACTO: 5,
  TENDENCIA: 2,
  ERROR: -1,
  BONUS_ELIMINATORIA: 3
};

/**
 * Función inicial para crear el menú en Google Sheets.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚽ Quiniela 2026')
    .addItem('Inicializar Sistema', 'validarEstructura')
    .addSeparator()
    .addItem('Recalcular Puntos', 'calcularPuntos')
    .addItem('Actualizar Resultados Reales', 'actualizarResultadosReales')
    .addSeparator()
    .addItem('Enviar Notificación Resultados', 'enviarNotificacionResultados')
    .addItem('Respaldar Datos', 'backupDatos')
    .addItem('Insertar Datos de Prueba', 'insertarDatosPrueba')
    .addToUi();
}

/**
 * Valida que todas las hojas y columnas existan. Si no, las crea.
 */
function validarEstructura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    { name: SHEETS.CONFIG, headers: ['Parametro', 'Valor'] },
    { name: SHEETS.PARTIDOS, headers: ['ID_Partido', 'Fecha', 'Hora', 'Grupo', 'Equipo_Local', 'Equipo_Visita', 'Gol_Local_Real', 'Gol_Visita_Real', 'Estado', 'Fuente_Dato'] },
    { name: SHEETS.PRONOSTICOS, headers: ['ID_Pronostico', 'Email_Participante', 'ID_Partido', 'Gol_Local_Pronostico', 'Gol_Visita_Pronostico', 'Fecha_Registro', 'Puntos_Obtenidos'] },
    { name: SHEETS.PARTICIPANTES, headers: ['Email', 'Nombre', 'Alias', 'Puntos_Totales', 'Posicion_Ranking', 'Fecha_Registro'] },
    { name: SHEETS.RANKING, headers: ['Posicion', 'Alias', 'Puntos_Totales', 'Aciertos_Marcador', 'Aciertos_Ganador', 'Errores'] },
    { name: SHEETS.LOGS, headers: ['Fecha', 'Error', 'Detalles'] }
  ];

  requiredSheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
      sheet.appendRow(s.headers);
      sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#d9ead3');
    }
  });

  // Configuración inicial por defecto
  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (configSheet.getLastRow() === 1) {
    configSheet.appendRow(['Puntos_Exacto', PUNTOS.EXACTO]);
    configSheet.appendRow(['Puntos_Tendencia', PUNTOS.TENDENCIA]);
    configSheet.appendRow(['Puntos_Error', PUNTOS.ERROR]);
    configSheet.appendRow(['Bonus_Eliminatoria', PUNTOS.BONUS_ELIMINATORIA]);
    configSheet.appendRow(['API_KEY', '']);
    configSheet.appendRow(['Zona_Horaria', 'GMT-6']);
  }

  SpreadsheetApp.getUi().alert('Estructura validada y creada correctamente.');
}

/**
 * Lógica principal para calcular puntos de los pronósticos.
 */
function calcularPuntos() {
  if (!isAdmin()) {
    throw new Error('No tienes permisos para ejecutar esta acción.');
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const partidosSheet = ss.getSheetByName(SHEETS.PARTIDOS);
    const pronosticosSheet = ss.getSheetByName(SHEETS.PRONOSTICOS);
    const participantesSheet = ss.getSheetByName(SHEETS.PARTICIPANTES);

    const partidosData = partidosSheet.getDataRange().getValues();
    const pronosticosData = pronosticosSheet.getDataRange().getValues();

    // Mapa de partidos jugados para acceso rápido
    const partidosJugados = {};
    for (let i = 1; i < partidosData.length; i++) {
      if (partidosData[i][8] === 'Jugado') {
        partidosJugados[partidosData[i][0]] = {
          golL: partidosData[i][6],
          golV: partidosData[i][7],
          fase: partidosData[i][3] // El campo "Grupo" puede indicar la fase
        };
      }
    }

    const puntosPorParticipante = {};

    // Preparar arrays para actualizaciones masivas (batch updates)
    const puntosPronosticosActualizados = [];

    // Iteramos por cada pronóstico registrado para compararlo con los resultados reales
    for (let j = 1; j < pronosticosData.length; j++) {
      const idPartido = pronosticosData[j][2];
      const real = partidosJugados[idPartido];
      let puntos = pronosticosData[j][6] || 0;

      if (real) { // Si el partido ya fue jugado y tiene resultado real
        const pGolL = pronosticosData[j][3];
        const pGolV = pronosticosData[j][4];
        const email = pronosticosData[j][1];

        // Lógica de puntuación
        let esFaseEliminatoria = ['Octavos', 'Cuartos', 'Semifinal', 'Final', '32avos'].some(f => real.fase.includes(f));

        if (real.golL === pGolL && real.golV === pGolV) {
          puntos = PUNTOS.EXACTO;
          if (esFaseEliminatoria) puntos += PUNTOS.BONUS_ELIMINATORIA;
        } else if (
          (real.golL > real.golV && pGolL > pGolV) ||
          (real.golL < real.golV && pGolL < pGolV) ||
          (real.golL === real.golV && pGolL === pGolV)
        ) {
          puntos = PUNTOS.TENDENCIA;
        } else {
          puntos = PUNTOS.ERROR;
        }

        puntosPorParticipante[email] = (puntosPorParticipante[email] || 0) + puntos;
      }
      puntosPronosticosActualizados.push([puntos]);
    }

    // Actualización masiva de puntos en hoja de pronósticos
    if (puntosPronosticosActualizados.length > 0) {
      pronosticosSheet.getRange(2, 7, puntosPronosticosActualizados.length, 1).setValues(puntosPronosticosActualizados);
    }

    // Actualizar Puntos Totales en Participantes de forma masiva
    const participantesData = participantesSheet.getDataRange().getValues();
    const puntosParticipantesActualizados = [];
    for (let k = 1; k < participantesData.length; k++) {
      const email = participantesData[k][0];
      const totalPuntos = puntosPorParticipante[email] || 0;
      puntosParticipantesActualizados.push([totalPuntos]);
    }

    if (puntosParticipantesActualizados.length > 0) {
      participantesSheet.getRange(2, 4, puntosParticipantesActualizados.length, 1).setValues(puntosParticipantesActualizados);
    }

    actualizarRanking();
    SpreadsheetApp.flush();
    return "Puntos calculados exitosamente.";
  } catch (e) {
    logError('calcularPuntos', e.toString());
    throw e;
  }
}

/**
 * Actualiza la hoja de Ranking basada en los puntos de los participantes.
 */
function actualizarRanking() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const participantesSheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
  const rankingSheet = ss.getSheetByName(SHEETS.RANKING);
  const pronosticosSheet = ss.getSheetByName(SHEETS.PRONOSTICOS);

  const participantes = participantesSheet.getRange(2, 1, participantesSheet.getLastRow() - 1, 4).getValues();
  const pronosticos = pronosticosSheet.getDataRange().getValues();

  // Calcular estadísticas adicionales para el ranking
  const stats = {};
  participantes.forEach(p => {
    stats[p[0]] = { alias: p[2], puntos: p[3], exactos: 0, ganadores: 0, errores: 0 };
  });

  for (let i = 1; i < pronosticos.length; i++) {
    const email = pronosticos[i][1];
    const puntos = pronosticos[i][6];
    if (stats[email]) {
      if (puntos >= 5) stats[email].exactos++;
      else if (puntos === 2) stats[email].ganadores++;
      else if (puntos === -1) stats[email].errores++;
    }
  }

  const sortedRanking = Object.values(stats).sort((a, b) => b.puntos - a.puntos);

  rankingSheet.getRange(2, 1, rankingSheet.getLastRow(), 6).clearContent();
  const rankingData = sortedRanking.map((s, index) => [
    index + 1, s.alias, s.puntos, s.exactos, s.ganadores, s.errores
  ]);

  if (rankingData.length > 0) {
    rankingSheet.getRange(2, 1, rankingData.length, 6).setValues(rankingData);
  }
}

/**
 * Obtiene resultados reales desde una API o fallback manual.
 */
function actualizarResultadosReales() {
  if (!isAdmin()) throw new Error('No autorizado.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  const apiKey = configSheet.getRange(5, 2).getValue();

  if (!apiKey) {
    return "API Key no configurada. Por favor actualice manualmente o proporcione una clave.";
  }

  try {
    // Ejemplo con API-Football (ficticio para 2026 por ahora)
    const url = `https://v3.football.api-sports.io/fixtures?league=1&season=2026`;
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    };

    const response = UrlFetchApp.fetch(url, options);
    const resData = JSON.parse(response.getContentText());

    // Si la API retorna datos de partidos
    if (resData.response && resData.response.length > 0) {
      const partidosSheet = ss.getSheetByName(SHEETS.PARTIDOS);
      const data = partidosSheet.getDataRange().getValues();

      resData.response.forEach(fix => {
        const idExt = fix.fixture.id; // ID del partido en la API
        const golL = fix.goals.home;
        const golV = fix.goals.away;
        const status = fix.fixture.status.short;

        if (status === 'FT') { // 'FT' significa partido finalizado
          for (let i = 1; i < data.length; i++) {
            // Buscamos coincidencia por ID y que el estado local sea 'Pendiente'
            if (data[i][0] == idExt && data[i][8] === 'Pendiente') {
              partidosSheet.getRange(i + 1, 7).setValue(golL);
              partidosSheet.getRange(i + 1, 8).setValue(golV);
              partidosSheet.getRange(i + 1, 9).setValue('Jugado');
              partidosSheet.getRange(i + 1, 10).setValue('API-Football');
            }
          }
        }
      });
      return "Resultados actualizados desde la API.";
    }
  } catch (e) {
    logError('actualizarResultadosReales', e.toString());
    return "Error al conectar con la API: " + e.toString();
  }
}

/**
 * Web App Entry Points
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Quiniela Mundial 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Registra un nuevo participante.
 */
function registrarParticipante(nombre, alias, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) return { success: false, msg: 'El email ya está registrado.' };
  }

  sheet.appendRow([email, nombre, alias.substring(0, 15), 0, '', new Date()]);

  try {
    MailApp.sendEmail(email, '⚽ Registro Exitoso - Quiniela Mundial 2026',
      `¡Hola ${nombre}!\n\nTe has registrado correctamente con el alias: ${alias}.\n¡Mucha suerte en tus pronósticos!`);
  } catch (e) {
    logError('MailApp', 'Error enviando correo a ' + email);
  }

  return { success: true, msg: 'Registro exitoso.' };
}

/**
 * Guarda o actualiza un pronóstico.
 */
function guardarPronostico(idPartido, golL, golV, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const partidosSheet = ss.getSheetByName(SHEETS.PARTIDOS);
  const pronosticosSheet = ss.getSheetByName(SHEETS.PRONOSTICOS);

  // Validar cierre de pronósticos (1 hora antes)
  const partidosData = partidosSheet.getDataRange().getValues();
  let partido = null;
  for (let i = 1; i < partidosData.length; i++) {
    if (partidosData[i][0] == idPartido) {
      partido = partidosData[i];
      break;
    }
  }

  if (!partido) return { success: false, msg: 'Partido no encontrado.' };

  const fechaPartido = new Date(partido[1]);
  // Asumiendo que la hora está en la columna 2 y es un objeto Date o string HH:mm
  const horaArr = partido[2].toString().split(':');
  if (horaArr.length >= 2) {
    fechaPartido.setHours(parseInt(horaArr[0]), parseInt(horaArr[1]), 0);
  }

  const ahora = new Date();
  const limite = new Date(fechaPartido.getTime() - (60 * 60 * 1000));

  if (ahora > limite) {
    return { success: false, msg: 'El tiempo para este pronóstico ha cerrado (1h antes del partido).' };
  }

  // Buscar si ya existe para actualizar o insertar
  const pronosticosData = pronosticosSheet.getDataRange().getValues();
  for (let j = 1; j < pronosticosData.length; j++) {
    if (pronosticosData[j][1] === email && pronosticosData[j][2] == idPartido) {
      pronosticosSheet.getRange(j + 1, 4).setValue(golL);
      pronosticosSheet.getRange(j + 1, 5).setValue(golV);
      pronosticosSheet.getRange(j + 1, 6).setValue(new Date());
      return { success: true, msg: 'Pronóstico actualizado.' };
    }
  }

  const newId = 'PRON-' + Utilities.getUuid().substring(0, 8);
  pronosticosSheet.appendRow([newId, email, idPartido, golL, golV, new Date(), 0]);
  return { success: true, msg: 'Pronóstico guardado.' };
}

/**
 * Obtiene datos para el dashboard.
 */
function getDashboardData(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Verificar que las hojas existan
    const sPartidos = ss.getSheetByName(SHEETS.PARTIDOS);
    const sRanking = ss.getSheetByName(SHEETS.RANKING);

    if (!sPartidos || !sRanking) {
      throw new Error("El sistema no ha sido inicializado. El administrador debe ejecutar 'Inicializar Sistema' desde el menú de la hoja de cálculo.");
    }

    const partidos = sPartidos.getDataRange().getValues().slice(1);

    // Enriquecer partidos con URLs de banderas
    const partidosConBanderas = partidos.map(p => {
      return [...p, getFlagUrl(p[4]), getFlagUrl(p[5])];
    });

    const ranking = sRanking.getDataRange().getValues().slice(1);
    const pronosticosData = ss.getSheetByName(SHEETS.PRONOSTICOS).getDataRange().getValues();
    const participantesData = ss.getSheetByName(SHEETS.PARTICIPANTES).getDataRange().getValues();

    return {
      ranking: ranking,
      partidos: partidosConBanderas,
      misPronosticos: email ? pronosticosData.filter(row => row[1] === email) : [],
      participante: email ? participantesData.find(row => row[0] === email) : null,
      esAdmin: isAdmin()
    };
  } catch (e) {
    throw new Error("Error al obtener datos: " + e.toString());
  }
}

/**
 * Funciones de utilidad y seguridad
 */
function isAdmin() {
  const adminEmail = Session.getEffectiveUser().getEmail();
  const userEmail = Session.getActiveUser().getEmail();

  // Si el usuario es el dueño del script, es admin.
  if (userEmail === adminEmail) return true;

  // También verificar en la hoja de Participantes si tiene algún rol (opcional, por ahora solo dueño)
  return false;
}

function logError(funcion, detalle) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.LOGS);
  sheet.appendRow([new Date(), funcion, detalle]);
}

function backupDatos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = DriveApp.getRootFolder();
  const copy = DriveApp.getFileById(ss.getId()).makeCopy('Backup_Quiniela_' + Utilities.formatDate(new Date(), "GMT-6", "yyyy-MM-dd_HHmm"));
  return "Backup creado: " + copy.getName();
}

function enviarNotificacionResultados() {
  // Envía un resumen de puntos ganados a los participantes activos
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const participantes = ss.getSheetByName(SHEETS.PARTICIPANTES).getDataRange().getValues().slice(1);

  participantes.forEach(p => {
    const email = p[0];
    const puntos = p[3];
    MailApp.sendEmail(email, '⚽ Actualización de Puntos - Quiniela 2026',
      `Hola ${p[2]},\n\nLos resultados se han actualizado. Actualmente tienes ${puntos} puntos totales.\n\nRevisa el dashboard para ver el detalle.`);
  });
  return "Notificaciones enviadas.";
}

/**
 * Mapeo de países a códigos ISO para banderas.
 * Se puede expandir según sea necesario.
 */
function getFlagUrl(pais) {
  const flags = {
    'México': 'mx', 'Argentina': 'ar', 'España': 'es', 'Brasil': 'br',
    'EEUU': 'us', 'USA': 'us', 'Italia': 'it', 'Francia': 'fr',
    'Japón': 'jp', 'Alemania': 'de', 'Marruecos': 'ma', 'Canadá': 'ca',
    'Inglaterra': 'gb-eng', 'Portugal': 'pt', 'Bélgica': 'be', 'Uruguay': 'uy',
    'Croacia': 'hr', 'Países Bajos': 'nl', 'Ecuador': 'ec', 'Colombia': 'co'
  };
  const code = flags[pais] || 'un'; // 'un' para desconocido
  return `https://flagcdn.com/w40/${code}.png`;
}

/**
 * Importa partidos de forma masiva desde texto (CSV, TSV o JSON).
 */
function importarPartidosMasivo(datosStr, formato) {
  if (!isAdmin()) throw new Error('Solo administradores.');

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.PARTIDOS);
    let rows = [];

    if (formato === 'json') {
      const data = JSON.parse(datosStr);
      rows = data.map(p => [
        p.id || 'P-' + Math.floor(Math.random()*10000),
        p.fecha, p.hora, p.fase || p.grupo, p.local, p.visita,
        '', '', 'Pendiente', 'JSON Import'
      ]);
    } else {
      // Separar por tabuladores (Excel) o comas
      const delimiter = formato === 'excel' ? '\t' : ',';
      const lines = datosStr.split('\n').filter(l => l.trim() !== '');
      rows = lines.map(line => {
        const cols = line.split(delimiter).map(c => c.trim());
        // Esperamos: ID | Fecha | Hora | Fase | Local | Visita
        return [
          cols[0] || 'P-' + Math.floor(Math.random()*10000),
          cols[1] || '',
          cols[2] || '',
          cols[3] || '',
          cols[4] || '',
          cols[5] || '',
          '', '', 'Pendiente', 'Excel Import'
        ];
      });
    }

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    }
    return { success: true, msg: `${rows.length} partidos importados correctamente.` };
  } catch (e) {
    return { success: false, msg: 'Error al importar: ' + e.toString() };
  }
}

/**
 * Inserta datos de prueba para validación inicial.
 */
function insertarDatosPrueba() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Participantes
  const partSheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
  partSheet.appendRow(['usuario1@test.com', 'Juan Perez', 'Juanito26', 0, '', new Date()]);
  partSheet.appendRow(['usuario2@test.com', 'Maria Garcia', 'MariGol', 0, '', new Date()]);
  partSheet.appendRow(['usuario3@test.com', 'Pedro Luis', 'ElProfe', 0, '', new Date()]);

  // 2. Partidos
  const partDataSheet = ss.getSheetByName(SHEETS.PARTIDOS);
  const p1Id = 'P-001';
  const p2Id = 'P-002';
  partDataSheet.appendRow([p1Id, '2026-06-11', '15:00', 'Grupo A', 'México', 'Argentina', 2, 1, 'Jugado', 'Manual']);
  partDataSheet.appendRow([p2Id, '2026-06-12', '18:00', 'Grupo B', 'España', 'Brasil', 1, 1, 'Jugado', 'Manual']);
  partDataSheet.appendRow(['P-003', '2026-06-13', '12:00', 'Grupo C', 'EEUU', 'Italia', '', '', 'Pendiente', '']);
  partDataSheet.appendRow(['P-004', '2026-06-14', '20:00', 'Grupo D', 'Francia', 'Japón', '', '', 'Pendiente', '']);
  partDataSheet.appendRow(['P-005', '2026-06-15', '10:00', 'Grupo E', 'Alemania', 'Marruecos', '', '', 'Pendiente', '']);

  // 3. Pronósticos de prueba
  const pronSheet = ss.getSheetByName(SHEETS.PRONOSTICOS);
  // Juanito: Acertó exacto P1 (2-1), Falló P2 (0-3)
  pronSheet.appendRow(['PRON-001', 'usuario1@test.com', p1Id, 2, 1, new Date(), 0]);
  pronSheet.appendRow(['PRON-002', 'usuario1@test.com', p2Id, 0, 3, new Date(), 0]);

  // MariGol: Acertó tendencia P1 (1-0), Acertó exacto P2 (1-1)
  pronSheet.appendRow(['PRON-003', 'usuario2@test.com', p1Id, 1, 0, new Date(), 0]);
  pronSheet.appendRow(['PRON-004', 'usuario2@test.com', p2Id, 1, 1, new Date(), 0]);

  SpreadsheetApp.getUi().alert('Datos de prueba insertados. Ejecute "Recalcular Puntos" para ver resultados.');
}
