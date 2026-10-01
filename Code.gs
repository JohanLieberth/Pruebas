/**
 * Competencia de Control de Peso - Server Logic
 * Google Apps Script (Code.gs)
 */

// Constantes de Hojas
var SHEET_PARTICIPANTES = "Participantes";
var SHEET_MEDICIONES = "Mediciones";
var SHEET_CONFIG = "Config";

/**
 * Función principal doGet para servir la Web App
 */
function doGet(e) {
  // Asegurar que las hojas necesarias existan
  inicializarBaseDatos();

  var template = HtmlService.createTemplateFromFile("Index");
  return template.evaluate()
    .setTitle("Competencia de Control de Peso")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper para incluir archivos HTML dentro de otros (ej: Styles, JavaScript)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Inicializa la estructura de la base de datos en Google Sheets si las hojas no existen.
 */
function inicializarBaseDatos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Hoja Config
  var sheetConfig = ss.getSheetByName(SHEET_CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(SHEET_CONFIG);
    sheetConfig.getRange("A1:B5").setValues([
      ["PARAMETRO", "VALOR"],
      ["PASSWORD_ADMIN", "admin123"],
      ["NOMBRE_COMPETENCIA", "Desafío Control de Peso 2025"],
      ["FACTOR_BONO_CINTURA", 0.20],
      ["FECHA_INICIO", new Date()]
    ]);
    sheetConfig.getRange("A1:B1").setFontWeight("bold").setBackground("#E8F5E9");
  }

  // 2. Hoja Participantes
  var sheetPart = ss.getSheetByName(SHEET_PARTICIPANTES);
  if (!sheetPart) {
    sheetPart = ss.insertSheet(SHEET_PARTICIPANTES);
    sheetPart.appendRow([
      "ID",
      "Nombre Completo",
      "Email",
      "Estatura (m)",
      "Peso Inicial (kg)",
      "Cintura Inicial (cm)",
      "Fecha Inicio",
      "Categoría",
      "Activo",
      "Peso Final (kg)",
      "Cintura Final (cm)",
      "Fecha Final",
      "Fecha Registro"
    ]);
    sheetPart.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#E8F5E9");
  }

  // 3. Hoja Mediciones
  var sheetMed = ss.getSheetByName(SHEET_MEDICIONES);
  if (!sheetMed) {
    sheetMed = ss.insertSheet(SHEET_MEDICIONES);
    sheetMed.appendRow([
      "ID Medición",
      "ID Participante",
      "Nombre Participante",
      "Fecha Medición",
      "Peso (kg)",
      "Cintura (cm)",
      "Fecha Registro"
    ]);
    sheetMed.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#E8F5E9");
  }
}

/**
 * Obtiene la configuración general del sistema.
 */
function getConfiguracion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) {
    inicializarBaseDatos();
    sheet = ss.getSheetByName(SHEET_CONFIG);
  }

  var data = sheet.getRange("A1:B5").getValues();
  var config = {
    nombreCompetencia: "Desafío Control de Peso",
    factorBonoCintura: 0.20
  };

  for (var i = 1; i < data.length; i++) {
    var clave = String(data[i][0]).trim();
    var valor = data[i][1];
    if (clave === "NOMBRE_COMPETENCIA") config.nombreCompetencia = valor;
    if (clave === "FACTOR_BONO_CINTURA") config.factorBonoCintura = Number(valor) || 0.20;
  }

  return config;
}

/**
 * Valida la contraseña de administrador leyendo directamente de la celda B2 de Config.
 */
function verificarPasswordAdmin(password) {
  if (!password) return false;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) return false;

  var passAlmacenada = String(sheet.getRange("B2").getValue()).trim();
  return String(password).trim() === passAlmacenada;
}

/**
 * Registra un nuevo participante.
 */
function registrarParticipante(datos, password) {
  if (!verificarPasswordAdmin(password)) {
    throw new Error("Acceso denegado: Contraseña de administrador incorrecta.");
  }

  // Validaciones obligatorias
  if (!datos.nombreCompleto || !datos.estatura || !datos.pesoInicial || !datos.cinturaInicial || !datos.fechaInicio || !datos.categoria) {
    throw new Error("Todos los campos obligatorios deben ser completados.");
  }

  var estatura = Number(datos.estatura);
  var pesoInicial = Number(datos.pesoInicial);
  var cinturaInicial = Number(datos.cinturaInicial);

  if (isNaN(estatura) || estatura <= 0) throw new Error("La estatura debe ser un número positivo mayor a cero.");
  if (isNaN(pesoInicial) || pesoInicial <= 0) throw new Error("El peso inicial debe ser un número positivo mayor a cero.");
  if (isNaN(cinturaInicial) || cinturaInicial <= 0) throw new Error("La cintura inicial debe ser un número positivo mayor a cero.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PARTICIPANTES);
  var data = sheet.getDataRange().getValues();

  // Validar duplicado por nombre (insensible a mayúsculas/minúsculas)
  var nombreBuscado = String(datos.nombreCompleto).trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var nombreExistente = String(data[i][1]).trim().toLowerCase();
    if (nombreExistente === nombreBuscado) {
      throw new Error("Ya existe un participante registrado con el nombre '" + datos.nombreCompleto + "'.");
    }
  }

  var id = "PART-" + Utilities.getUuid().substring(0, 8);
  var fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    id,
    datos.nombreCompleto.trim(),
    (datos.email || "").trim(),
    estatura,
    pesoInicial,
    cinturaInicial,
    datos.fechaInicio,
    datos.categoria,
    "Sí",
    "", // Peso Final
    "", // Cintura Final
    "", // Fecha Final
    fechaRegistro
  ]);

  return { exito: true, mensaje: "Participante '" + datos.nombreCompleto + "' registrado correctamente." };
}

/**
 * Obtiene la lista de participantes activos para los desplegables del panel admin.
 */
function obtenerParticipantesActivos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PARTICIPANTES);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var lista = [];

  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    var nombre = data[i][1];
    var activo = String(data[i][8]).toLowerCase();
    var pesoInicial = Number(data[i][4]);
    var cinturaInicial = Number(data[i][5]);

    if (id && (activo === "sí" || activo === "si" || activo === "true")) {
      lista.push({
        id: id,
        nombre: nombre,
        pesoInicial: pesoInicial,
        cinturaInicial: cinturaInicial
      });
    }
  }

  return lista;
}

/**
 * Registra un check-in semanal de un participante.
 * Retorna advertencia si la pérdida semanal supera el 1% del peso corporal.
 */
function registrarMedicionSemanal(datos, password) {
  if (!verificarPasswordAdmin(password)) {
    throw new Error("Acceso denegado: Contraseña de administrador incorrecta.");
  }

  if (!datos.idParticipante || !datos.peso || !datos.cintura || !datos.fechaMedicion) {
    throw new Error("Todos los campos obligatorios deben ser completados.");
  }

  var peso = Number(datos.peso);
  var cintura = Number(datos.cintura);

  if (isNaN(peso) || peso <= 0) throw new Error("El peso no puede ser negativo ni cero.");
  if (isNaN(cintura) || cintura <= 0) throw new Error("La cintura no puede ser negativa ni cero.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPart = ss.getSheetByName(SHEET_PARTICIPANTES);
  var dataPart = sheetPart.getDataRange().getValues();

  var participanteEncontrado = null;
  for (var i = 1; i < dataPart.length; i++) {
    if (String(dataPart[i][0]) === String(datos.idParticipante)) {
      participanteEncontrado = {
        id: dataPart[i][0],
        nombre: dataPart[i][1],
        pesoInicial: Number(dataPart[i][4])
      };
      break;
    }
  }

  if (!participanteEncontrado) {
    throw new Error("Participante no encontrado.");
  }

  // Obtener mediciones previas para calcular la pérdida semanal o acumulada
  var sheetMed = ss.getSheetByName(SHEET_MEDICIONES);
  var dataMed = sheetMed.getDataRange().getValues();

  var pesoAnterior = participanteEncontrado.pesoInicial;
  var medicionesAnteriores = [];

  for (var j = 1; j < dataMed.length; j++) {
    if (String(dataMed[j][1]) === String(datos.idParticipante)) {
      medicionesAnteriores.push({
        fecha: dataMed[j][3],
        peso: Number(dataMed[j][4])
      });
    }
  }

  if (medicionesAnteriores.length > 0) {
    // Tomar la última medición
    pesoAnterior = medicionesAnteriores[medicionesAnteriores.length - 1].peso;
  }

  // Advertencia de pérdida saludable (> 1% de pérdida semanal)
  var advertenciaSaludable = false;
  var porcentajePerdidaSemanale = 0;
  if (pesoAnterior > 0) {
    porcentajePerdidaSemanale = ((pesoAnterior - peso) / pesoAnterior) * 100;
    if (porcentajePerdidaSemanale > 1.0) {
      advertenciaSaludable = true;
    }
  }

  var idMedicion = "MED-" + Utilities.getUuid().substring(0, 8);
  var fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  sheetMed.appendRow([
    idMedicion,
    participanteEncontrado.id,
    participanteEncontrado.nombre,
    datos.fechaMedicion,
    peso,
    cintura,
    fechaRegistro
  ]);

  var mensaje = "Medición semanal registrada con éxito para " + participanteEncontrado.nombre + ".";
  if (advertenciaSaludable) {
    mensaje += " ⚠️ ADVERTENCIA: La pérdida respecto a la medición anterior es de " +
               porcentajePerdidaSemanale.toFixed(2) + "%, lo cual supera la recomendación saludable (0.5% a 1.0% semanal).";
  }

  return {
    exito: true,
    mensaje: mensaje,
    advertencia: advertenciaSaludable,
    porcentajePerdida: porcentajePerdidaSemanale.toFixed(2)
  };
}

/**
 * Registra la medición final de un participante.
 */
function registrarMedicionFinal(datos, password) {
  if (!verificarPasswordAdmin(password)) {
    throw new Error("Acceso denegado: Contraseña de administrador incorrecta.");
  }

  if (!datos.idParticipante || !datos.pesoFinal || !datos.cinturaFinal || !datos.fechaFinal) {
    throw new Error("Todos los campos obligatorios deben ser completados.");
  }

  var pesoFinal = Number(datos.pesoFinal);
  var cinturaFinal = Number(datos.cinturaFinal);

  if (isNaN(pesoFinal) || pesoFinal <= 0) throw new Error("El peso final no puede ser negativo ni cero.");
  if (isNaN(cinturaFinal) || cinturaFinal <= 0) throw new Error("La cintura final no puede ser negativa ni cero.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPart = ss.getSheetByName(SHEET_PARTICIPANTES);
  var dataPart = sheetPart.getDataRange().getValues();

  var rowIndex = -1;
  var nombreParticipante = "";

  for (var i = 1; i < dataPart.length; i++) {
    if (String(dataPart[i][0]) === String(datos.idParticipante)) {
      rowIndex = i + 1; // 1-based index in Google Sheets
      nombreParticipante = dataPart[i][1];
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("No se puede registrar la medición final porque no existe la medición inicial del participante.");
  }

  // Actualizar columnas Peso Final (col 10), Cintura Final (col 11), Fecha Final (col 12)
  sheetPart.getRange(rowIndex, 10).setValue(pesoFinal);
  sheetPart.getRange(rowIndex, 11).setValue(cinturaFinal);
  sheetPart.getRange(rowIndex, 12).setValue(datos.fechaFinal);

  return {
    exito: true,
    mensaje: "Medición final registrada exitosamente para " + nombreParticipante + "."
  };
}

/**
 * Calcula la desviación estándar muestral de un arreglo de números.
 * Si n < 2, retorna 0.
 */
function calcularDesviacionEstandar(valores) {
  if (!valores || valores.length < 2) return 0;

  var n = valores.length;
  var suma = 0;
  for (var i = 0; i < n; i++) {
    suma += valores[i];
  }
  var media = suma / n;

  var sumaCuadrados = 0;
  for (var j = 0; j < n; j++) {
    sumaCuadrados += Math.pow(valores[j] - media, 2);
  }

  // Desviación estándar muestral (n - 1)
  return Math.sqrt(sumaCuadrados / (n - 1));
}

/**
 * Calcula la clasificación general de la competencia y sus estadísticas.
 * Aplica exactamente las reglas de puntaje y desempate definidas:
 * 1. Puntaje Final = % peso perdido + (0.20 * cm cintura reducidos)
 * Desempates (en orden):
 * a) Mayor % de reducción de cintura
 * b) Mayor % de peso perdido
 * c) Mayor cantidad de check-ins semanales
 * d) Menor variación estándar entre mediciones semanales de peso
 */
function calcularClasificacion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPart = ss.getSheetByName(SHEET_PARTICIPANTES);
  var sheetMed = ss.getSheetByName(SHEET_MEDICIONES);

  if (!sheetPart) return { leaderboard: [], estadisticas: {} };

  var config = getConfiguracion();
  var factorBono = config.factorBonoCintura || 0.20;

  var dataPart = sheetPart.getDataRange().getValues();
  var dataMed = sheetMed ? sheetMed.getDataRange().getValues() : [];

  // Agrupar mediciones por participante
  var medicionesPorParticipante = {};
  for (var m = 1; m < dataMed.length; m++) {
    var idPart = String(dataMed[m][1]);
    var pesoMed = Number(dataMed[m][4]);
    if (!medicionesPorParticipante[idPart]) {
      medicionesPorParticipante[idPart] = [];
    }
    if (!isNaN(pesoMed)) {
      medicionesPorParticipante[idPart].push(pesoMed);
    }
  }

  var participantesProcesados = [];

  for (var i = 1; i < dataPart.length; i++) {
    var row = dataPart[i];
    var id = String(row[0]);
    var nombre = String(row[1] || "");
    var email = String(row[2] || "");
    var pesoInicial = Number(row[4]);
    var cinturaInicial = Number(row[5]);
    var categoria = String(row[7] || "");
    var activo = String(row[8]).toLowerCase();

    // Solo procesar participantes activos con datos válidos
    if (!id || (activo !== "sí" && activo !== "si" && activo !== "true")) continue;
    if (isNaN(pesoInicial) || pesoInicial <= 0 || isNaN(cinturaInicial) || cinturaInicial <= 0) continue;

    var pesoFinalVal = row[9];
    var cinturaFinalVal = row[10];

    // Obtener mediciones semanales
    var listaPesosSemana = medicionesPorParticipante[id] || [];
    var totalCheckIns = listaPesosSemana.length;

    // Determinar peso y cintura final a considerar (si no hay final registrado, usar la última semanal o inicial)
    var pesoActual = (pesoFinalVal !== "" && pesoFinalVal !== null && !isNaN(Number(pesoFinalVal)))
                     ? Number(pesoFinalVal)
                     : (listaPesosSemana.length > 0 ? listaPesosSemana[listaPesosSemana.length - 1] : pesoInicial);

    var cinturaActual = (cinturaFinalVal !== "" && cinturaFinalVal !== null && !isNaN(Number(cinturaFinalVal)))
                        ? Number(cinturaFinalVal)
                        : cinturaInicial;

    // Fórmulas de Puntaje
    var pctPesoPerdido = ((pesoInicial - pesoActual) / pesoInicial) * 100;
    var cmCinturaReducidos = cinturaInicial - cinturaActual;
    var bonoCintura = cmCinturaReducidos * factorBono;
    var puntajeFinal = pctPesoPerdido + bonoCintura;

    // Criterios para desempate
    var pctReduccionCintura = ((cinturaInicial - cinturaActual) / cinturaInicial) * 100;

    // Variación estándar de pesos semanales (incluyendo peso inicial y mediciones)
    var historialPesosCompleto = [pesoInicial].concat(listaPesosSemana);
    var stdDev = calcularDesviacionEstandar(historialPesosCompleto);

    participantesProcesados.push({
      id: id,
      nombre: nombre,
      categoria: categoria,
      pesoInicial: pesoInicial,
      cinturaInicial: cinturaInicial,
      pesoActual: pesoActual,
      cinturaActual: cinturaActual,
      pctPesoPerdido: pctPesoPerdido,
      cmCinturaReducidos: cmCinturaReducidos,
      bonoCintura: bonoCintura,
      puntajeFinal: puntajeFinal,
      // Datos desempate:
      pctReduccionCintura: pctReduccionCintura,
      totalCheckIns: totalCheckIns,
      stdDev: stdDev,
      tieneFinal: (pesoFinalVal !== "" && pesoFinalVal !== null)
    });
  }

  // Lógica de Ordenamiento con Desempates Exactos
  participantesProcesados.sort(function(a, b) {
    // 1. Mayor Puntaje Final (Tolerancia de flotante < 0.0001)
    if (Math.abs(b.puntajeFinal - a.puntajeFinal) > 0.0001) {
      return b.puntajeFinal - a.puntajeFinal;
    }

    // Desempate a) Mayor % de reducción de cintura
    if (Math.abs(b.pctReduccionCintura - a.pctReduccionCintura) > 0.0001) {
      return b.pctReduccionCintura - a.pctReduccionCintura;
    }

    // Desempate b) Mayor % de peso perdido
    if (Math.abs(b.pctPesoPerdido - a.pctPesoPerdido) > 0.0001) {
      return b.pctPesoPerdido - a.pctPesoPerdido;
    }

    // Desempate c) Mayor cantidad de check-ins semanales
    if (b.totalCheckIns !== a.totalCheckIns) {
      return b.totalCheckIns - a.totalCheckIns;
    }

    // Desempate d) Menor variación estándar entre mediciones semanales
    return a.stdDev - b.stdDev;
  });

  // Asignar posiciones
  for (var k = 0; k < participantesProcesados.length; k++) {
    participantesProcesados[k].posicion = k + 1;
  }

  // Calcular Estadísticas Generales
  var totalParticipantes = participantesProcesados.length;
  var sumaPctPerdida = 0;
  var masConstante = null;
  var maxCheckIns = -1;
  var menorStdDev = 999999;

  for (var p = 0; p < participantesProcesados.length; p++) {
    var part = participantesProcesados[p];
    sumaPctPerdida += part.pctPesoPerdido;

    if (part.totalCheckIns > maxCheckIns || (part.totalCheckIns === maxCheckIns && part.stdDev < menorStdDev)) {
      maxCheckIns = part.totalCheckIns;
      menorStdDev = part.stdDev;
      masConstante = part.nombre + " (" + part.totalCheckIns + " check-ins)";
    }
  }

  var promedioPctPerdida = totalParticipantes > 0 ? (sumaPctPerdida / totalParticipantes) : 0;

  return {
    leaderboard: participantesProcesados,
    estadisticas: {
      totalParticipantes: totalParticipantes,
      promedioPctPerdida: promedioPctPerdida.toFixed(2),
      masConstante: masConstante || "N/A"
    }
  };
}
