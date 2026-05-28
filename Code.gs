/**
 * SISTEMA DE QUINIELA MUNDIAL 2026 - BACKEND
 * Desarrollado para Google Apps Script + Google Sheets
 *
 * Este script maneja la lógica del servidor, base de datos y API.
 */

// --- CONFIGURACIÓN GLOBAL ---
const SHEETS = {
  CONFIG: 'Configuracion',
  EQUIPOS: 'Equipos',
  PARTIDOS: 'Partidos',
  PARTICIPANTES: 'Participantes',
  PRONOSTICOS: 'Pronosticos',
  LOGS: 'Log_Errores'
};

/**
 * Función que se ejecuta al abrir el documento.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚽ Quiniela Mundial 2026')
    .addItem('🌐 Abrir Web App', 'abrirWebApp')
    .addItem('⚙️ Inicializar / Resetear Hojas', 'inicializarEstructura')
    .addSeparator()
    .addItem('🔄 Actualizar Resultados API', 'actualizarResultadosAPI')
    .addItem('📊 Recalcular Puntos', 'recalcularTodosLosPuntos')
    .addSeparator()
    .addItem('🧪 Cargar Datos Iniciales (Seed)', 'seedPartidos')
    .addItem('💾 Backup Datos', 'crearBackup')
    .addToUi();
}

/**
 * Retorna la URL de la Web App para el menú.
 */
function abrirWebApp() {
  const url = ScriptApp.getService().getUrl();
  const html = `<script>window.open("${url}", "_blank");google.script.host.close();</script>`;
  const ui = HtmlService.createHtmlOutput(html).setWidth(300).setHeight(100);
  SpreadsheetApp.getUi().showModelessDialog(ui, "Abriendo Web App...");
}

/**
 * Inicializa la estructura de hojas y encabezados.
 */
function inicializarEstructura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const structure = [
    { name: SHEETS.CONFIG, headers: ['Parametro', 'Valor'] },
    { name: SHEETS.EQUIPOS, headers: ['ID_Equipo', 'Nombre_Equipo', 'Bandera', 'Grupo'] },
    { name: SHEETS.PARTIDOS, headers: ['ID_Partido', 'Fase', 'Grupo', 'Matchday', 'Fecha', 'Hora', 'Equipo_Local', 'Bandera_Local', 'Equipo_Visita', 'Bandera_Visita', 'Gol_Local_Real', 'Gol_Visita_Real', 'Estado', 'Fecha_Cierre', 'Llave'] },
    { name: SHEETS.PARTICIPANTES, headers: ['Email', 'Nombre', 'Alias', 'Puntos_Totales', 'Aciertos_Exactos', 'Aciertos_Ganador', 'Errores', 'Fecha_Registro'] },
    { name: SHEETS.PRONOSTICOS, headers: ['ID_Pronostico', 'Email_Participante', 'ID_Partido', 'Gol_Local', 'Gol_Visita', 'Fecha_Registro', 'Puntos_Obtenidos', 'Calculado'] },
    { name: SHEETS.LOGS, headers: ['Fecha', 'Funcion', 'Error', 'Detalle'] }
  ];

  structure.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
    } else {
      sheet.clear();
    }
    sheet.appendRow(s.headers);
    sheet.getRange(1, 1, 1, s.headers.length).setFontWeight('bold').setBackground('#C9A227').setFontColor('white');
  });

  // Configuración inicial
  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  const configData = [
    ['PUNTOS_MARCADOR_EXACTO', 5],
    ['PUNTOS_ACIERTA_GANADOR', 2],
    ['PUNTOS_ERROR', -1],
    ['PUNTOS_BONUS_ELIMINATORIA', 3],
    ['HORAS_CIERRE_PRONOSTICO', 1],
    ['ADMIN_EMAIL', Session.getEffectiveUser().getEmail()],
    ['API_FOOTBALL_KEY', ''],
    ['ZONA_HORARIA', 'America/Mexico_City'],
    ['TORNEO_NOMBRE', 'Quiniela Mundial 2026']
  ];
  configSheet.getRange(2, 1, configData.length, 2).setValues(configData);

  SpreadsheetApp.getUi().alert('Estructura inicializada correctamente.');
}

/**
 * Obtiene la configuración desde la hoja.
 */
function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = ss.getSheetByName(SHEETS.CONFIG).getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    config[data[i][0]] = data[i][1];
  }
  return config;
}

/**
 * Entry point para la Web App.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('🏆 Quiniela Mundial 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Maneja el registro de participantes.
 */
function registrarParticipante(email, nombre, alias) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.PARTICIPANTES);
    const data = sheet.getDataRange().getValues();

    // Normalizar email
    email = email.trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toLowerCase() === email) {
        return { success: false, msg: 'El email ya está registrado.' };
      }
    }

    sheet.appendRow([email, nombre, alias.substring(0, 15), 0, 0, 0, 0, new Date()]);
    return { success: true, msg: 'Registro exitoso.', email: email };
  } catch (e) {
    logError('registrarParticipante', e.toString());
    return { success: false, msg: 'Error en el servidor.' };
  }
}

/**
 * Obtiene datos para el Dashboard.
 */
function getDashboardData(email) {
  try {
    const config = getConfig();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sPartidos = ss.getSheetByName(SHEETS.PARTIDOS);
    const sParticipantes = ss.getSheetByName(SHEETS.PARTICIPANTES);
    const sPronosticos = ss.getSheetByName(SHEETS.PRONOSTICOS);
    const sRanking = ss.getSheetByName(SHEETS.PARTICIPANTES); // Usamos Participantes para el ranking

    const partidos = sPartidos.getDataRange().getValues().slice(1);
    const participantes = sParticipantes.getDataRange().getValues().slice(1);
    const pronosticos = sPronosticos.getDataRange().getValues().slice(1);

    const userPronosticos = pronosticos.filter(p => p[1].toLowerCase() === email.toLowerCase());
    const userData = participantes.find(p => p[0].toLowerCase() === email.toLowerCase());

    const ranking = participantes
      .map(p => ({
        email: p[0],
        alias: p[2],
        puntos: p[3],
        exactos: p[4],
        ganadores: p[5],
        errores: p[6]
      }))
      .sort((a, b) => b.puntos - a.puntos || b.exactos - a.exactos);

    return {
      success: true,
      config: config,
      partidos: partidos,
      misPronosticos: userPronosticos,
      userData: userData ? {
        alias: userData[2],
        puntos: userData[3],
        exactos: userData[4],
        ganadores: userData[5],
        errores: userData[6],
        posicion: ranking.findIndex(r => r.email.toLowerCase() === email.toLowerCase()) + 1
      } : null,
      ranking: ranking,
      isAdmin: email.toLowerCase() === config.ADMIN_EMAIL.toLowerCase()
    };
  } catch (e) {
    logError('getDashboardData', e.toString());
    throw e;
  }
}

/**
 * Guarda pronósticos masivamente.
 */
function guardarPronosticos(email, pronArray) {
  try {
    const config = getConfig();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sPartidos = ss.getSheetByName(SHEETS.PARTIDOS);
    const sPronosticos = ss.getSheetByName(SHEETS.PRONOSTICOS);

    const partidosData = sPartidos.getDataRange().getValues();
    const partidosMap = {};
    for (let i = 1; i < partidosData.length; i++) {
      partidosMap[partidosData[i][0]] = partidosData[i];
    }

    const pronExistentes = sPronosticos.getDataRange().getValues();
    const existingMap = {};
    for (let j = 1; j < pronExistentes.length; j++) {
      existingMap[pronExistentes[j][1] + "_" + pronExistentes[j][2]] = j + 1;
    }

    const ahora = new Date();
    const horasCierre = config.HORAS_CIERRE_PRONOSTICO || 1;
    let count = 0;

    pronArray.forEach(p => {
      const partido = partidosMap[p.id];
      if (!partido) return;

      // Validar cierre (Fecha_Cierre es col 13, índice 13)
      const fechaCierre = new Date(partido[13]);
      if (ahora > fechaCierre) return;

      const key = email + "_" + p.id;
      if (existingMap[key]) {
        const rowIdx = existingMap[key];
        sPronosticos.getRange(rowIdx, 4, 1, 3).setValues([[p.gl, p.gv, ahora]]);
      } else {
        const newId = 'PRON-' + Utilities.getUuid().substring(0, 8);
        sPronosticos.appendRow([newId, email, p.id, p.gl, p.gv, ahora, 0, 'No']);
      }
      count++;
    });

    return { success: true, msg: `${count} pronósticos actualizados.` };
  } catch (e) {
    logError('guardarPronosticos', e.toString());
    return { success: false, msg: 'Error al guardar.' };
  }
}

/**
 * Lógica de puntuación.
 */
function calcularPuntos(gLR, gVR, gLP, gVP, esEliminatoria) {
  const config = getConfig();
  let puntos = 0;
  let tipo = "";

  // 1. Marcador exacto
  if (gLR == gLP && gVR == gVP) {
    puntos = Number(config.PUNTOS_MARCADOR_EXACTO); // 5
    tipo = "EXACTO";
    if (esEliminatoria) puntos += Number(config.PUNTOS_BONUS_ELIMINATORIA); // +3
  }
  // 2. Acierta ganador o empate (pero no exacto)
  else if (
    (gLR > gVR && gLP > gVP) ||   // Gana local
    (gLR < gVR && gLP < gVP) ||   // Gana visita
    (gLR == gVR && gLP == gVP)    // Empate
  ) {
    puntos = Number(config.PUNTOS_ACIERTA_GANADOR); // 2
    tipo = "GANADOR";
  }
  // 3. Error total
  else {
    puntos = Number(config.PUNTOS_ERROR); // -1
    tipo = "ERROR";
  }

  return { puntos, tipo };
}

/**
 * Recalcula todos los puntos.
 */
function recalcularTodosLosPuntos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sPartidos = ss.getSheetByName(SHEETS.PARTIDOS);
    const sPronosticos = ss.getSheetByName(SHEETS.PRONOSTICOS);
    const sParticipantes = ss.getSheetByName(SHEETS.PARTICIPANTES);

    const partidos = sPartidos.getDataRange().getValues().slice(1);
    const pronosticos = sPronosticos.getDataRange().getValues();
    const participantes = sParticipantes.getDataRange().getValues();

    const partidosJugados = {};
    partidos.forEach(p => {
      if (p[12] === 'Jugado') {
        partidosJugados[p[0]] = {
          gl: p[10],
          gv: p[11],
          fase: p[1]
        };
      }
    });

    const userStats = {};
    for (let i = 1; i < participantes.length; i++) {
      userStats[participantes[i][0]] = { puntos: 0, exactos: 0, ganadores: 0, errores: 0 };
    }

    const pronUpdates = [];
    for (let j = 1; j < pronosticos.length; j++) {
      const idPartido = pronosticos[j][2];
      const email = pronosticos[j][1];
      const real = partidosJugados[idPartido];

      let pts = 0;
      if (real) {
        const esEliminatoria = real.fase !== 'Fase de Grupos';
        const res = calcularPuntos(real.gl, real.gv, pronosticos[j][3], pronosticos[j][4], esEliminatoria);
        pts = res.puntos;

        if (userStats[email]) {
          userStats[email].puntos += pts;
          if (res.tipo === 'EXACTO') userStats[email].exactos++;
          else if (res.tipo === 'GANADOR') userStats[email].ganadores++;
          else userStats[email].errores++;
        }
      }
      pronUpdates.push([pts, real ? 'Sí' : 'No']);
    }

    if (pronUpdates.length > 0) {
      sPronosticos.getRange(2, 7, pronUpdates.length, 2).setValues(pronUpdates);
    }

    const partUpdates = [];
    for (let k = 1; k < participantes.length; k++) {
      const email = participantes[k][0];
      const s = userStats[email] || { puntos: 0, exactos: 0, ganadores: 0, errores: 0 };
      partUpdates.push([s.puntos, s.exactos, s.ganadores, s.errores]);
    }

    if (partUpdates.length > 0) {
      sParticipantes.getRange(2, 4, partUpdates.length, 4).setValues(partUpdates);
    }

    SpreadsheetApp.flush();
    return "Puntos recalculados exitosamente.";
  } catch (e) {
    logError('recalcularTodosLosPuntos', e.toString());
    throw e;
  }
}

/**
 * Seed inicial de equipos y partidos.
 */
function seedPartidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sEquipos = ss.getSheetByName(SHEETS.EQUIPOS);
  const sPartidos = ss.getSheetByName(SHEETS.PARTIDOS);

  sEquipos.clear();
  sEquipos.appendRow(['ID_Equipo', 'Nombre_Equipo', 'Bandera', 'Grupo']);

  const equipos = [
    [1, 'Ecuador', '🇪🇨', 'A'], [2, 'Países Bajos', '🇳🇱', 'A'], [3, 'Qatar', '🇶🇦', 'A'], [4, 'Senegal', '🇸🇳', 'A'],
    [5, 'Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'B'], [6, 'Estados Unidos', '🇺🇸', 'B'], [7, 'Irán', '🇮🇷', 'B'], [8, 'Gales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'B'],
    [9, 'Argentina', '🇦🇷', 'C'], [10, 'México', '🇲🇽', 'C'], [11, 'Arabia Saudita', '🇸🇦', 'C'], [12, 'Polonia', '🇵🇱', 'C'],
    [13, 'Francia', '🇫🇷', 'D'], [14, 'Dinamarca', '🇩🇰', 'D'], [15, 'Australia', '🇦🇺', 'D'], [16, 'Túnez', '🇹🇳', 'D'],
    [17, 'España', '🇪🇸', 'E'], [18, 'Alemania', '🇩🇪', 'E'], [19, 'Costa Rica', '🇨🇷', 'E'], [20, 'Japón', '🇯🇵', 'E'],
    [21, 'Bélgica', '🇧🇪', 'F'], [22, 'Marruecos', '🇲🇦', 'F'], [23, 'Canadá', '🇨🇦', 'F'], [24, 'Croacia', '🇭🇷', 'F'],
    [25, 'Brasil', '🇧🇷', 'G'], [26, 'Suiza', '🇨🇭', 'G'], [27, 'Serbia', '🇷🇸', 'G'], [28, 'Camerún', '🇨🇲', 'G'],
    [29, 'Portugal', '🇵🇹', 'H'], [30, 'Uruguay', '🇺🇾', 'H'], [31, 'Ghana', '🇬🇭', 'H'], [32, 'Corea del Sur', '🇰🇷', 'H']
  ];
  sEquipos.getRange(2, 1, equipos.length, 4).setValues(equipos);

  sPartidos.clear();
  sPartidos.appendRow(['ID_Partido', 'Fase', 'Grupo', 'Matchday', 'Fecha', 'Hora', 'Equipo_Local', 'Bandera_Local', 'Equipo_Visita', 'Bandera_Visita', 'Gol_Local_Real', 'Gol_Visita_Real', 'Estado', 'Fecha_Cierre', 'Llave']);

  const groupMatches = [
    // Grupo A
    ['G-A1', 'FASE DE GRUPOS', 'A', 1, '2026-06-11', '14:00', 'Ecuador', '🇪🇨', 'Qatar', '🇶🇦'],
    ['G-A2', 'FASE DE GRUPOS', 'A', 1, '2026-06-12', '10:00', 'Países Bajos', '🇳🇱', 'Senegal', '🇸🇳'],
    ['G-A3', 'FASE DE GRUPOS', 'A', 2, '2026-06-16', '14:00', 'Ecuador', '🇪🇨', 'Senegal', '🇸🇳'],
    ['G-A4', 'FASE DE GRUPOS', 'A', 2, '2026-06-16', '17:00', 'Países Bajos', '🇳🇱', 'Qatar', '🇶🇦'],
    ['G-A5', 'FASE DE GRUPOS', 'A', 3, '2026-06-21', '14:00', 'Senegal', '🇸🇳', 'Ecuador', '🇪🇨'],
    ['G-A6', 'FASE DE GRUPOS', 'A', 3, '2026-06-21', '14:00', 'Qatar', '🇶🇦', 'Países Bajos', '🇳🇱'],
    // Grupo B
    ['G-B1', 'FASE DE GRUPOS', 'B', 1, '2026-06-12', '14:00', 'Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Estados Unidos', '🇺🇸'],
    ['G-B2', 'FASE DE GRUPOS', 'B', 1, '2026-06-12', '17:00', 'Irán', '🇮🇷', 'Gales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿'],
    ['G-B3', 'FASE DE GRUPOS', 'B', 2, '2026-06-17', '14:00', 'Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Gales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿'],
    ['G-B4', 'FASE DE GRUPOS', 'B', 2, '2026-06-17', '17:00', 'Irán', '🇮🇷', 'Estados Unidos', '🇺🇸'],
    ['G-B5', 'FASE DE GRUPOS', 'B', 3, '2026-06-22', '14:00', 'Gales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
    ['G-B6', 'FASE DE GRUPOS', 'B', 3, '2026-06-22', '14:00', 'Estados Unidos', '🇺🇸', 'Irán', '🇮🇷'],
    // Grupo C
    ['G-C1', 'FASE DE GRUPOS', 'C', 1, '2026-06-13', '14:00', 'Argentina', '🇦🇷', 'México', '🇲🇽'],
    ['G-C2', 'FASE DE GRUPOS', 'C', 1, '2026-06-13', '17:00', 'Arabia Saudita', '🇸🇦', 'Polonia', '🇵🇱'],
    ['G-C3', 'FASE DE GRUPOS', 'C', 2, '2026-06-18', '20:00', 'Argentina', '🇦🇷', 'Polonia', '🇵🇱'],
    ['G-C4', 'FASE DE GRUPOS', 'C', 2, '2026-06-18', '17:00', 'Arabia Saudita', '🇸🇦', 'México', '🇲🇽'],
    ['G-C5', 'FASE DE GRUPOS', 'C', 3, '2026-06-23', '14:00', 'Polonia', '🇵🇱', 'Argentina', '🇦🇷'],
    ['G-C6', 'FASE DE GRUPOS', 'C', 3, '2026-06-23', '14:00', 'México', '🇲🇽', 'Arabia Saudita', '🇸🇦']
  ];

  // Fase Eliminatoria - Octavos (Ejemplo)
  const knockoutMatches = [
    ['KO-1', 'OCTAVOS DE FINAL', '-', '-', '2026-06-28', '14:00', '1A', '⚽', '2B', '⚽'],
    ['KO-2', 'OCTAVOS DE FINAL', '-', '-', '2026-06-28', '18:00', '1C', '⚽', '2D', '⚽'],
    ['KO-FIN', 'GRAN FINAL', '-', '-', '2026-07-19', '14:00', 'Ganador Semifinal 1', '🏆', 'Ganador Semifinal 2', '🏆']
  ];

  const allMatches = [...groupMatches, ...knockoutMatches];

  const rows = allMatches.map(m => {
    // Manejo robusto de fechas para Apps Script
    const dateParts = m[4].split('-');
    const timeParts = m[5].split(':');
    const matchDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);

    const config = getConfig();
    const horasCierre = config.HORAS_CIERRE_PRONOSTICO || 1;
    const closureDate = new Date(matchDate.getTime() - (horasCierre * 60 * 60 * 1000));

    return [...m, '', '', 'Pendiente', closureDate, ''];
  });

  sPartidos.getRange(2, 1, rows.length, 15).setValues(rows);
  SpreadsheetApp.getUi().alert('Datos semilla cargados con éxito (Grupos A-C y KO base).');
}

/**
 * Registro de errores.
 */
function logError(funcion, detalle) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.LOGS);
    sheet.appendRow([new Date(), funcion, 'ERROR', detalle]);
  } catch (e) {}
}

function crearBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = "Backup_Quiniela_" + Utilities.formatDate(new Date(), "GMT-6", "yyyyMMdd_HHmm");
  const copy = DriveApp.getFileById(ss.getId()).makeCopy(name);
  return "Backup creado: " + copy.getName();
}

function actualizarResultadosAPI() {
  const config = getConfig();
  if (Session.getEffectiveUser().getEmail() !== config.ADMIN_EMAIL) {
    throw new Error("Acceso denegado: Solo administrador");
  }

  const apiKey = config.API_FOOTBALL_KEY;
  if (!apiKey) return "API Key no configurada.";

  try {
    const url = "https://v3.football.api-sports.io/fixtures?league=1&season=2026";
    const response = UrlFetchApp.fetch(url, {
      headers: { "x-apisports-key": apiKey }
    });
    const resData = JSON.parse(response.getContentText());

    if (resData.response && resData.response.length > 0) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEETS.PARTIDOS);
      const data = sheet.getDataRange().getValues();

      resData.response.forEach(fix => {
        const idExt = fix.fixture.id;
        const status = fix.fixture.status.short;
        const golL = fix.goals.home;
        const golV = fix.goals.away;

        if (status === 'FT') {
          for (let i = 1; i < data.length; i++) {
            if (data[i][0] == idExt && data[i][12] !== 'Jugado') {
              sheet.getRange(i + 1, 11, 1, 3).setValues([[golL, golV, 'Jugado']]);
            }
          }
        }
      });
      return "Resultados actualizados desde API.";
    }
    return "No se encontraron nuevos resultados.";
  } catch (e) {
    logError('actualizarResultadosAPI', e.toString());
    return "Error al conectar con API.";
  }
}

function actualizarResultadoManual(idPartido, golLocal, golVisita) {
  const config = getConfig();
  if (Session.getEffectiveUser().getEmail() !== config.ADMIN_EMAIL) {
    throw new Error("Acceso denegado: Solo administrador");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PARTIDOS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idPartido) {
      sheet.getRange(i + 1, 11, 1, 3).setValues([[golLocal, golVisita, 'Jugado']]);
      return { success: true, msg: "Resultado actualizado." };
    }
  }
  return { success: false, msg: "Partido no encontrado." };
}
