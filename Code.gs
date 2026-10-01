/**
 * Kilos Mortales - Server Logic
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
    .setTitle("Kilos Mortales")
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
 * Helper robusto para obtener una hoja por nombre o comodín
 */
function obtenerHojaParticipantes(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;

  var sheet = ss.getSheetByName(SHEET_PARTICIPANTES);
  if (sheet) return sheet;

  // Búsqueda insensible a mayúsculas/minúsculas o variaciones
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toLowerCase().trim();
    if (name.indexOf("participante") !== -1) {
      return sheets[i];
    }
  }
  return null;
}

/**
 * Inicializa la estructura de la base de datos en Google Sheets si las hojas no existen.
 */
function inicializarBaseDatos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  // 1. Hoja Config
  var sheetConfig = ss.getSheetByName(SHEET_CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(SHEET_CONFIG);
    sheetConfig.getRange("A1:B5").setValues([
      ["PARAMETRO", "VALOR"],
      ["PASSWORD_ADMIN", "admin123"],
      ["NOMBRE_COMPETENCIA", "Kilos Mortales 2025"],
      ["FACTOR_BONO_CINTURA", 0.20],
      ["FECHA_INICIO", new Date()]
    ]);
    sheetConfig.getRange("A1:B1").setFontWeight("bold").setBackground("#E8F5E9");
  } else {
    var valB3 = sheetConfig.getRange("B3").getValue();
    if (!valB3 || String(valB3).indexOf("Control de Peso") !== -1) {
      sheetConfig.getRange("B3").setValue("Kilos Mortales 2025");
    }
  }

  // 2. Hoja Participantes
  var sheetPart = obtenerHojaParticipantes(ss);
  if (!sheetPart) {
    sheetPart = ss.insertSheet(SHEET_PARTICIPANTES);
    sheetPart.appendRow([
      "ID",
      "Nombre Completo",
      "Edad",
      "Sexo",
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
    sheetPart.getRange(1, 1, 1, 15).setFontWeight("bold").setBackground("#E8F5E9");
  }
}

/**
 * Obtiene la configuración general del sistema.
 */
function getConfiguracion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss ? ss.getSheetByName(SHEET_CONFIG) : null;
  if (!sheet) {
    inicializarBaseDatos();
    sheet = ss ? ss.getSheetByName(SHEET_CONFIG) : null;
  }

  var config = {
    nombreCompetencia: "Kilos Mortales",
    factorBonoCintura: 0.20
  };

  if (!sheet) return config;

  var data = sheet.getRange("A1:B5").getValues();
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
  var sheet = ss ? ss.getSheetByName(SHEET_CONFIG) : null;
  if (!sheet) return false;

  var passAlmacenada = String(sheet.getRange("B2").getValue()).trim();
  return String(password).trim() === passAlmacenada;
}

/**
 * Registra un nuevo participante con Edad y Sexo.
 */
function registrarParticipante(datos, password) {
  if (!verificarPasswordAdmin(password)) {
    throw new Error("Acceso denegado: Contraseña de administrador incorrecta.");
  }

  if (!datos.nombreCompleto || datos.edad === undefined || datos.edad === null || datos.edad === "" || !datos.sexo || !datos.estatura || !datos.pesoInicial || !datos.cinturaInicial || !datos.fechaInicio || !datos.categoria) {
    throw new Error("Todos los campos obligatorios deben ser completados.");
  }

  var edad = Number(datos.edad);
  var sexo = String(datos.sexo).trim();
  var estatura = Number(datos.estatura);
  var pesoInicial = Number(datos.pesoInicial);
  var cinturaInicial = Number(datos.cinturaInicial);

  if (isNaN(edad) || edad <= 0 || edad >= 120 || !Number.isInteger(edad)) {
    throw new Error("La edad debe ser un número entero mayor a 0 y menor a 120.");
  }

  if (sexo !== "Femenino" && sexo !== "Masculino") {
    throw new Error("El sexo debe ser 'Femenino' o 'Masculino'.");
  }

  if (isNaN(estatura) || estatura <= 0) throw new Error("La estatura debe ser un número positivo mayor a cero.");
  if (isNaN(pesoInicial) || pesoInicial <= 0) throw new Error("El peso inicial debe ser un número positivo mayor a cero.");
  if (isNaN(cinturaInicial) || cinturaInicial <= 0) throw new Error("La cintura inicial debe ser un número positivo mayor a cero.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = obtenerHojaParticipantes(ss);
  if (!sheet) {
    inicializarBaseDatos();
    sheet = obtenerHojaParticipantes(ss);
  }

  var data = sheet.getDataRange().getValues();

  var nombreBuscado = String(datos.nombreCompleto).trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var nombreExistente = String(data[i][1] || "").trim().toLowerCase();
    if (nombreExistente === nombreBuscado) {
      throw new Error("Ya existe un participante registrado con el nombre '" + datos.nombreCompleto + "'.");
    }
  }

  var id = "PART-" + Utilities.getUuid().substring(0, 8);
  var fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    id,
    datos.nombreCompleto.trim(),
    edad,
    sexo,
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
 * Función auxiliar para resolver índices de columna con tolerancia.
 */
function resolverIndicesHeaders(headersRaw) {
  var headers = headersRaw.map(function(h) { return String(h).trim().toUpperCase(); });

  function findCol(possibleNames, defaultIndex) {
    for (var idx = 0; idx < headers.length; idx++) {
      for (var p = 0; p < possibleNames.length; p++) {
        if (headers[idx].indexOf(possibleNames[p].toUpperCase()) !== -1) {
          return idx;
        }
      }
    }
    return defaultIndex;
  }

  return {
    colId: findCol(["ID"], 0),
    colNombre: findCol(["NOMBRE"], 1),
    colEdad: findCol(["EDAD"], 2),
    colSexo: findCol(["SEXO"], 3),
    colEmail: findCol(["EMAIL", "CORREO"], 4),
    colEstatura: findCol(["ESTATURA"], 5),
    colPesoIni: findCol(["PESO INICIAL", "PESO INI"], 6),
    colCinturaIni: findCol(["CINTURA INICIAL", "CINTURA INI"], 7),
    colFechaIni: findCol(["FECHA INICIO"], 8),
    colCategoria: findCol(["CATEGORIA", "CATEGORÍA"], 9),
    colActivo: findCol(["ACTIVO"], 10),
    colPesoFin: findCol(["PESO FINAL", "PESO FIN"], 11),
    colCinturaFin: findCol(["CINTURA FINAL", "CINTURA FIN"], 12),
    colFechaFin: findCol(["FECHA FINAL"], 13)
  };
}

/**
 * Obtiene la lista completa de participantes para el panel de administración (leyendo directamente de la hoja de cálculo).
 */
function obtenerTodosLosParticipantesAdmin(password) {
  if (!verificarPasswordAdmin(password)) {
    throw new Error("Acceso denegado: Contraseña de administrador incorrecta.");
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = obtenerHojaParticipantes(ss);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var idxs = resolverIndicesHeaders(data[0]);
  var lista = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var nombreVal = idxs.colNombre < row.length ? String(row[idxs.colNombre] || "").trim() : "";
    var idVal = idxs.colId < row.length ? String(row[idxs.colId] || "").trim() : "";

    // Si la fila no tiene ni nombre ni id, omitir fila vacía
    if (!nombreVal && !idVal) continue;

    lista.push({
      id: idVal || ("PART-" + i),
      nombre: nombreVal || ("Participante " + i),
      edad: (idxs.colEdad < row.length && row[idxs.colEdad] !== "") ? row[idxs.colEdad] : "N/A",
      sexo: (idxs.colSexo < row.length && row[idxs.colSexo] !== "") ? row[idxs.colSexo] : "N/A",
      categoria: (idxs.colCategoria < row.length && row[idxs.colCategoria] !== "") ? row[idxs.colCategoria] : "N/A",
      pesoInicial: (idxs.colPesoIni < row.length && row[idxs.colPesoIni] !== "") ? Number(row[idxs.colPesoIni]) : 0,
      cinturaInicial: (idxs.colCinturaIni < row.length && row[idxs.colCinturaIni] !== "") ? Number(row[idxs.colCinturaIni]) : 0,
      activo: (idxs.colActivo < row.length && row[idxs.colActivo] !== "") ? String(row[idxs.colActivo]) : "Sí"
    });
  }

  return lista;
}

/**
 * Obtiene la lista de participantes activos para los desplegables del panel admin.
 */
function obtenerParticipantesActivos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = obtenerHojaParticipantes(ss);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var idxs = resolverIndicesHeaders(data[0]);
  var lista = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var idVal = idxs.colId < row.length ? String(row[idxs.colId] || "").trim() : "";
    var nombreVal = idxs.colNombre < row.length ? String(row[idxs.colNombre] || "").trim() : "";
    var activoVal = idxs.colActivo < row.length ? String(row[idxs.colActivo] || "").toLowerCase().trim() : "sí";

    if ((nombreVal || idVal) && (activoVal === "sí" || activoVal === "si" || activoVal === "true" || activoVal === "")) {
      lista.push({
        id: idVal || ("PART-" + i),
        nombre: nombreVal || ("Participante " + i),
        edad: (idxs.colEdad < row.length && row[idxs.colEdad] !== "") ? row[idxs.colEdad] : "",
        sexo: (idxs.colSexo < row.length && row[idxs.colSexo] !== "") ? row[idxs.colSexo] : "",
        pesoInicial: (idxs.colPesoIni < row.length && row[idxs.colPesoIni] !== "") ? Number(row[idxs.colPesoIni]) : 0,
        cinturaInicial: (idxs.colCinturaIni < row.length && row[idxs.colCinturaIni] !== "") ? Number(row[idxs.colCinturaIni]) : 0
      });
    }
  }

  return lista;
}

/**
 * Registra un check-in semanal de un participante.
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
  var sheetPart = obtenerHojaParticipantes(ss);
  if (!sheetPart) throw new Error("No se encontró la hoja de Participantes.");

  var dataPart = sheetPart.getDataRange().getValues();
  var idxs = resolverIndicesHeaders(dataPart[0]);

  var participanteEncontrado = null;
  for (var i = 1; i < dataPart.length; i++) {
    var currentId = idxs.colId < dataPart[i].length ? String(dataPart[i][idxs.colId] || "").trim() : "";
    if (currentId === String(datos.idParticipante).trim()) {
      participanteEncontrado = {
        id: currentId,
        nombre: dataPart[i][idxs.colNombre] || "Participante",
        pesoInicial: Number(dataPart[i][idxs.colPesoIni] || 0)
      };
      break;
    }
  }

  if (!participanteEncontrado) {
    throw new Error("Participante no encontrado.");
  }

  var sheetMed = ss.getSheetByName(SHEET_MEDICIONES);
  if (!sheetMed) {
    inicializarBaseDatos();
    sheetMed = ss.getSheetByName(SHEET_MEDICIONES);
  }
  var dataMed = sheetMed.getDataRange().getValues();

  var pesoAnterior = participanteEncontrado.pesoInicial;
  var medicionesAnteriores = [];

  for (var j = 1; j < dataMed.length; j++) {
    if (String(dataMed[j][1]).trim() === String(datos.idParticipante).trim()) {
      medicionesAnteriores.push({
        fecha: dataMed[j][3],
        peso: Number(dataMed[j][4])
      });
    }
  }

  if (medicionesAnteriores.length > 0) {
    pesoAnterior = medicionesAnteriores[medicionesAnteriores.length - 1].peso;
  }

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
  var sheetPart = obtenerHojaParticipantes(ss);
  if (!sheetPart) throw new Error("No se encontró la hoja de Participantes.");

  var dataPart = sheetPart.getDataRange().getValues();
  var idxs = resolverIndicesHeaders(dataPart[0]);

  var rowIndex = -1;
  var nombreParticipante = "";

  for (var i = 1; i < dataPart.length; i++) {
    var currentId = idxs.colId < dataPart[i].length ? String(dataPart[i][idxs.colId] || "").trim() : "";
    if (currentId === String(datos.idParticipante).trim()) {
      rowIndex = i + 1; // 1-based index in Google Sheets
      nombreParticipante = dataPart[i][idxs.colNombre] || "Participante";
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error("No se puede registrar la medición final porque no existe la medición inicial del participante.");
  }

  sheetPart.getRange(rowIndex, idxs.colPesoFin + 1).setValue(pesoFinal);
  sheetPart.getRange(rowIndex, idxs.colCinturaFin + 1).setValue(cinturaFinal);
  sheetPart.getRange(rowIndex, idxs.colFechaFin + 1).setValue(datos.fechaFinal);

  return {
    exito: true,
    mensaje: "Medición final registrada exitosamente para " + nombreParticipante + "."
  };
}

/**
 * Calcula la desviación estándar muestral de un arreglo de números.
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

  return Math.sqrt(sumaCuadrados / (n - 1));
}

/**
 * Calcula la clasificación general de la competencia y sus estadísticas.
 */
function calcularClasificacion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPart = obtenerHojaParticipantes(ss);
  var sheetMed = ss ? ss.getSheetByName(SHEET_MEDICIONES) : null;

  if (!sheetPart) return { leaderboard: [], estadisticas: {} };

  var config = getConfiguracion();
  var factorBono = config.factorBonoCintura || 0.20;

  var dataPart = sheetPart.getDataRange().getValues();
  if (dataPart.length <= 1) return { leaderboard: [], estadisticas: {} };

  var idxs = resolverIndicesHeaders(dataPart[0]);

  var dataMed = sheetMed ? sheetMed.getDataRange().getValues() : [];

  // Agrupar mediciones por participante
  var medicionesPorParticipante = {};
  for (var m = 1; m < dataMed.length; m++) {
    var idPart = String(dataMed[m][1]).trim();
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
    var id = idxs.colId < row.length ? String(row[idxs.colId] || "").trim() : "";
    var nombre = idxs.colNombre < row.length ? String(row[idxs.colNombre] || "").trim() : "";
    var edad = idxs.colEdad < row.length ? row[idxs.colEdad] : "";
    var sexo = idxs.colSexo < row.length ? row[idxs.colSexo] : "";
    var pesoInicial = Number(row[idxs.colPesoIni] || 0);
    var cinturaInicial = Number(row[idxs.colCinturaIni] || 0);
    var categoria = idxs.colCategoria < row.length ? String(row[idxs.colCategoria] || "") : "";
    var activo = idxs.colActivo < row.length ? String(row[idxs.colActivo] || "").toLowerCase().trim() : "sí";

    if ((!id && !nombre) || (activo !== "sí" && activo !== "si" && activo !== "true" && activo !== "")) continue;
    if (isNaN(pesoInicial) || pesoInicial <= 0 || isNaN(cinturaInicial) || cinturaInicial <= 0) continue;

    var pesoFinalVal = row[idxs.colPesoFin];
    var cinturaFinalVal = row[idxs.colCinturaFin];

    var listaPesosSemana = medicionesPorParticipante[id] || [];
    var totalCheckIns = listaPesosSemana.length;

    var pesoActual = (pesoFinalVal !== "" && pesoFinalVal !== null && !isNaN(Number(pesoFinalVal)))
                     ? Number(pesoFinalVal)
                     : (listaPesosSemana.length > 0 ? listaPesosSemana[listaPesosSemana.length - 1] : pesoInicial);

    var cinturaActual = (cinturaFinalVal !== "" && cinturaFinalVal !== null && !isNaN(Number(cinturaFinalVal)))
                        ? Number(cinturaFinalVal)
                        : cinturaInicial;

    var pctPesoPerdido = ((pesoInicial - pesoActual) / pesoInicial) * 100;
    var cmCinturaReducidos = cinturaInicial - cinturaActual;
    var bonoCintura = cmCinturaReducidos * factorBono;
    var puntajeFinal = pctPesoPerdido + bonoCintura;

    var pctReduccionCintura = ((cinturaInicial - cinturaActual) / cinturaInicial) * 100;

    var historialPesosCompleto = [pesoInicial].concat(listaPesosSemana);
    var stdDev = calcularDesviacionEstandar(historialPesosCompleto);

    participantesProcesados.push({
      id: id || ("PART-" + i),
      nombre: nombre || ("Participante " + i),
      edad: edad,
      sexo: sexo,
      categoria: categoria,
      pesoInicial: pesoInicial,
      cinturaInicial: cinturaInicial,
      pesoActual: pesoActual,
      cinturaActual: cinturaActual,
      pctPesoPerdido: pctPesoPerdido,
      cmCinturaReducidos: cmCinturaReducidos,
      bonoCintura: bonoCintura,
      puntajeFinal: puntajeFinal,
      pctReduccionCintura: pctReduccionCintura,
      totalCheckIns: totalCheckIns,
      stdDev: stdDev,
      tieneFinal: (pesoFinalVal !== "" && pesoFinalVal !== null && pesoFinalVal !== undefined)
    });
  }

  // Lógica de Ordenamiento con Desempates Exactos
  participantesProcesados.sort(function(a, b) {
    if (Math.abs(b.puntajeFinal - a.puntajeFinal) > 0.0001) {
      return b.puntajeFinal - a.puntajeFinal;
    }
    if (Math.abs(b.pctReduccionCintura - a.pctReduccionCintura) > 0.0001) {
      return b.pctReduccionCintura - a.pctReduccionCintura;
    }
    if (Math.abs(b.pctPesoPerdido - a.pctPesoPerdido) > 0.0001) {
      return b.pctPesoPerdido - a.pctPesoPerdido;
    }
    if (b.totalCheckIns !== a.totalCheckIns) {
      return b.totalCheckIns - a.totalCheckIns;
    }
    return a.stdDev - b.stdDev;
  });

  for (var k = 0; k < participantesProcesados.length; k++) {
    participantesProcesados[k].posicion = k + 1;
  }

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
