/**
 * Mujeres Seguras - Google Apps Script Backend (v2)
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.p) || 'Index';
  // Note: Admin section is removed as per requirements.
  if (page === 'Admin') page = 'Index';

  try {
    return HtmlService.createTemplateFromFile(page)
        .evaluate()
        .setTitle('Mujeres Seguras - Registro de Certificación')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput("Error al cargar la página: " + err.toString());
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Asegura que la hoja exista, si no, la crea con la nueva estructura
 */
function getSheetSafe(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

/**
 * Inicializa las hojas de cálculo necesarias con la estructura solicitada
 */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = {
    "Empresas": ["RFC", "NombreEmpresa", "Teléfono", "Correo", "Folio", "FechaRegistro", "Estatus", "CompromisosGenerales"],
    "Sucursales": ["ID", "RFC_Empresa", "NombreSucursal", "Dirección", "Latitud", "Longitud", "Horario", "TeléfonoLocal", "Responsable", "Cargo", "CompromisosSucursal"],
    "PlanesTrabajo": ["ID", "RFC", "Folio", "FechaEnvio", "PlanDetalle", "Estatus", "Observaciones", "ID_Sucursal", "URL_Archivo", "Tipo_Archivo", "Ultima_Actualizacion"],
    "Cursos Disponibles": ["ID_Curso", "Nombre_Curso", "Fecha_Calendario", "Hora_Inicio", "ID_Sede", "Cupo_Máximo"],
    "Seguimiento": ["ID_Seguimiento", "RFC_Empresa", "ID_Sucursal", "ID_Curso", "Fecha_Accion", "Estatus", "Hora", "Sede"],
    "UsuariosAppSheet": ["Usuario", "Contraseña", "Rol"]
  };

  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight("bold").setBackground("#6B2C91").setFontColor("white");
    }
  }


  // Cursos Obligatorios default
  var sheetCursos = ss.getSheetByName("Cursos Disponibles");
  if (sheetCursos && sheetCursos.getLastRow() === 1) {
    var cursos = [
      ["C1", "Mesa de diálogo", "01/12/2023", "10:00", "Sede Central", 50],
      ["C2", "¿La igualdad de género es un bien?", "05/12/2023", "11:00", "Sede Central", 50],
      ["C3", "Comprender para prevenir la violencia de género", "10/12/2023", "09:00", "Sede Central", 50],
      ["C4", "Fortaleciendo espacios parte 1", "15/12/2023", "16:00", "Sede Central", 50],
      ["C5", "Fortaleciendo espacios parte 2", "20/12/2023", "16:00", "Sede Central", 50]
    ];
    sheetCursos.getRange(2, 1, cursos.length, 6).setValues(cursos);
  }

  return "Base de datos configurada correctamente.";
}

/**
 * Valida si un RFC ya existe
 */
function validarRFCExistente(rfc) {
  var sheet = getSheetSafe("Empresas");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === rfc) return true;
  }
  return false;
}

/**
 * Genera un folio único: MS-AAAA-#####
 */
function generarFolio() {
  var sheet = getSheetSafe("Empresas");
  var year = new Date().getFullYear();
  var lastRow = sheet.getLastRow();
  var consecutive = 1;

  if (lastRow > 1) {
    consecutive = lastRow;
  }

  var numStr = ("00000" + consecutive).slice(-5);
  return "MS-" + year + "-" + numStr;
}

/**
 * Procesa el registro completo (Empresa + Sucursales)
 */
function procesarRegistro(data) {
  try {
    var sheetEmpresas = getSheetSafe("Empresas");
    var sheetSucursales = getSheetSafe("Sucursales");

    if (validarRFCExistente(data.empresa.rfc)) {
      throw new Error("El RFC ya se encuentra registrado.");
    }

    var folio = generarFolio();
    var fecha = new Date();

    // Guardar Empresa
    sheetEmpresas.appendRow([
      data.empresa.rfc,
      data.empresa.nombreEmpresa, // Actualizado: Nombre de la Empresa Principal
      data.empresa.telefono,
      data.empresa.correo,
      folio,
      fecha,
      "Pendiente",
      JSON.stringify(data.compromisos)
    ]);

    // Guardar Sucursales
    data.sucursales.forEach(function(suc) {
      var coords = suc.coordenadas.split(",");
      sheetSucursales.appendRow([
        Utilities.getUuid(),
        data.empresa.rfc,
        suc.nombre,
        suc.direccion,
        coords[0] ? coords[0].trim() : "",
        coords[1] ? coords[1].trim() : "",
        suc.horario,
        suc.telefono,
        suc.responsable,
        suc.cargo,
        JSON.stringify(suc.compromisos || [])
      ]);
    });

    var qrUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(folio) + "&size=200";

    return {
      success: true,
      folio: folio,
      qrUrl: qrUrl
    };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Agrega una nueva sucursal y vincula obligatoriamente la capacitación en 'Seguimiento'
 */
function agregarNuevaSucursal(data) {
  try {
    var sheetSucursales = getSheetSafe("Sucursales");
    var sucursalId = Utilities.getUuid();
    var coords = data.coordenadas.split(",");

    sheetSucursales.appendRow([
      sucursalId,
      data.rfc,
      data.nombre,
      data.direccion,
      coords[0] ? coords[0].trim() : "",
      coords[1] ? coords[1].trim() : "",
      data.horario,
      data.telefono,
      data.responsable,
      data.cargo,
      JSON.stringify(data.compromisos || [])
    ]);

    // Registro obligatorio en Seguimiento
    if (data.capacitacion) {
      var sheetSeg = getSheetSafe("Seguimiento");
      sheetSeg.appendRow([
        Utilities.getUuid(),
        data.rfc,
        sucursalId,
        data.capacitacion.idCurso,
        new Date(),
        "Programada",
        data.capacitacion.hora,
        data.capacitacion.sede
      ]);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Obtiene datos de una empresa por RFC
 */
function buscarPorRFC(rfc) {
  var sheet = getSheetSafe("Empresas");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === rfc) {
      return {
        rfc: data[i][0],
        nombreEmpresa: data[i][1], // Cambiado de representante a Nombre de la Empresa
        folio: data[i][4],
        estatus: data[i][6]
      };
    }
  }
  return null;
}

/**
 * Obtiene el historial de Planes de Trabajo para un RFC (Mapeo de Estatus y Lookup de Sucursal)
 */
function getPlanesTrabajo(rfc) {
  var sheet = getSheetSafe("PlanesTrabajo");
  var data = sheet.getDataRange().getValues();

  var sheetSuc = getSheetSafe("Sucursales");
  var dataSuc = sheetSuc.getDataRange().getValues();

  // Mapa de Sucursales (ID -> Nombre)
  var sucsMap = {};
  for (var j = 1; j < dataSuc.length; j++) {
    sucsMap[dataSuc[j][0]] = dataSuc[j][2]; // [ID] = Nombre
  }

  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toUpperCase() === String(rfc).trim().toUpperCase()) {
      var rawStatus = String(data[i][5] || "").trim();

      // Lógica de Mapeo de Estatus solicitado: Recibido, Observado, Aprobado
      var cleanStatus = "Recibido";
      if (rawStatus.toLowerCase().includes("observa")) cleanStatus = "Observado";
      if (rawStatus.toLowerCase().includes("aproba")) cleanStatus = "Aprobado";

      var idSuc = data[i][7];
      var nombreSuc = sucsMap[idSuc] || "Sede Desconocida";

      result.push({
        id: data[i][0],
        idSucursal: idSuc,
        nombreSucursal: nombreSuc,
        tipoArchivo: data[i][9] || "Plan de Trabajo",
        estatus: cleanStatus,
        fecha: (data[i][10] instanceof Date) ? Utilities.formatDate(data[i][10], "GMT-6", "dd/MM/yyyy") : (data[i][10] || "-"),
        observaciones: data[i][6]
      });
    }
  }
  return result;
}

/**
 * Obtiene las sucursales de una empresa
 */
function getUbicaciones(rfc) {
  var sheet = getSheetSafe("Sucursales");
  var data = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === rfc) {
      result.push({
        id: data[i][0],
        nombre: data[i][2]
      });
    }
  }
  return result;
}

/**
 * Guarda o Actualiza el Plan de Trabajo
 */
function guardarPlanTrabajo(data) {
  try {
    var sheetPlanes = getSheetSafe("PlanesTrabajo");
    var folderName = "Planes_Trabajo_Mujeres_Seguras";
    var folder, fileUrl = "";
    var now = new Date();

    if (data.fileData) {
      var folders = DriveApp.getFoldersByName(folderName);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

      var contentType = data.fileData.substring(data.fileData.indexOf(":")+1, data.fileData.indexOf(";"));
      var bytes = Utilities.base64Decode(data.fileData.split(",")[1]);
      var blob = Utilities.newBlob(bytes, contentType, data.fileName);
      var file = folder.createFile(blob);
      fileUrl = file.getUrl();
    }

    if (data.idPlan) {
      // Lógica de Actualización (Versionado)
      var rows = sheetPlanes.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] === data.idPlan) {
          if (fileUrl) sheetPlanes.getRange(i + 1, 9).setValue(fileUrl);
          sheetPlanes.getRange(i + 1, 6).setValue("Recibido (Actualizado)");
          sheetPlanes.getRange(i + 1, 11).setValue(now);
          if (data.planDetalle) sheetPlanes.getRange(i + 1, 5).setValue(data.planDetalle);
          break;
        }
      }
    } else {
      // Nuevo Registro
      sheetPlanes.appendRow([
        Utilities.getUuid(),
        data.rfc,
        data.folio,
        now,
        data.planDetalle,
        "Recibido",
        "",
        data.idUbicacion,
        fileUrl,
        data.tipoArchivo || "Plan de Trabajo",
        now
      ]);
    }

    // Actualizar estatus general de la empresa
    var sheetEmpresas = getSheetSafe("Empresas");
    var empData = sheetEmpresas.getDataRange().getValues();
    for (var i = 1; i < empData.length; i++) {
      if (empData[i][0] === data.rfc) {
        sheetEmpresas.getRange(i + 1, 7).setValue("En Revisión");
        break;
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


/**
 * Obtiene las sucursales que ya cuentan con certificación aprobada
 * Cruza la información de Sucursales con Planes de Trabajo aprobados
 */
function getSucursalesCertificadas() {
  try {
    var sheetSuc = getSheetSafe("Sucursales");
    var sheetPlanes = getSheetSafe("PlanesTrabajo");

    var dataSuc = sheetSuc.getDataRange().getValues();
    var dataPlanes = sheetPlanes.getDataRange().getValues();

    // Mapa de Sucursales Aprobadas (ID_Sucursal -> true)
    var aprobadasMap = {};
    for (var j = 1; j < dataPlanes.length; j++) {
      if (dataPlanes[j][5] === "Aprobado") { // Columna Estatus en PlanesTrabajo
        aprobadasMap[dataPlanes[j][7]] = true; // Columna ID_Sucursal en PlanesTrabajo
      }
    }

    var result = [];
    for (var i = 1; i < dataSuc.length; i++) {
      var idSuc = dataSuc[i][0];
      if (aprobadasMap[idSuc]) {
        result.push({
          nombre: dataSuc[i][2],
          direccion: dataSuc[i][3],
          telefono: dataSuc[i][7]
        });
      }
    }
    return result;
  } catch (e) {
    return [];
  }
}

/**
 * Lógica de Capacitación - Obtiene cursos leyendo directamente de Sheets
 */
function getCursosDisponibles() {
  try {
    var sheet = getSheetSafe("Cursos_Disponibles");
    var data = sheet.getDataRange().getValues();

    // Si solo hay encabezados, intentar poblar con valores iniciales
    if (data.length <= 1) {
       setupDatabase();
       data = sheet.getDataRange().getValues();
    }

    var sheetSuc = getSheetSafe("Sucursales");
    var sucs = sheetSuc.getDataRange().getValues();
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0] || ("TEMP-" + i);
      var nombre = String(row[1] || "").trim();
      var fechaRaw = row[2];
      var hora = row[3] ? String(row[3]) : "Por definir";
      var sedeId = row[4];

      // FILTRO: Solo "Mesa de diálogo"
      if (nombre !== "Mesa de diálogo") continue;

      // Procesar Fecha en Español
      var fechaFinal = "Fecha no disponible";
      if (fechaRaw instanceof Date) {
        // Forzamos formato día/mes/año
        fechaFinal = Utilities.formatDate(fechaRaw, "GMT-6", "dd/MM/yyyy");
      } else if (fechaRaw) {
        fechaFinal = String(fechaRaw);
      }

      // Buscar nombre de la sede
      var sedeNombre = "Sede Central";
      if (sedeId) {
         for(var j=1; j<sucs.length; j++) {
           if(sucs[j][0] === sedeId || sucs[j][2] === sedeId) {
             sedeNombre = sucs[j][2]; // Usar nombre de la sucursal
             break;
           }
         }
      }

      result.push({
        id: String(id),
        nombre: String(nombre),
        fecha: fechaFinal,
        hora: hora,
        sede: sedeNombre,
        fechaAmigable: (fechaRaw instanceof Date) ? formatearFechaEspañol(fechaRaw) : fechaFinal
      });
    }
    return result;
  } catch (e) {
    console.error("Error en getCursosDisponibles: " + e.toString());
    return [];
  }
}

function inscribirCurso(data) {
  try {
    var sheet = getSheetSafe("Seguimiento");
    sheet.appendRow([
      Utilities.getUuid(),
      data.rfc,
      data.cursoId,
      new Date(),
      "Pendiente"
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * REQUERIMIENTO 2: Integración de Seguimiento de Capacitación y Sucursales
 * Retorna el progreso de capacitación desglosado por sucursal
 */
/**
 * Formatea una fecha en texto largo en español
 */
function formatearFechaEspañol(date) {
  var dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return dias[date.getDay()] + ", " + date.getDate() + " de " + meses[date.getMonth()];
}

function getProgresoCapacitacion(rfc) {
  var modules = [
    "Mesa de diálogo",
    "¿La igualdad de género es un bien?",
    "Comprender para prevenir la violencia de género",
    "Fortaleciendo espacios parte 1",
    "Fortaleciendo espacios parte 2"
  ];

  var sheetInsc = getSheetSafe("Seguimiento");
  var sheetCursos = getSheetSafe("Cursos_Disponibles");
  var sheetSuc = getSheetSafe("Sucursales");

  var inscData = sheetInsc.getDataRange().getValues();
  var cursData = sheetCursos.getDataRange().getValues();
  var sucsData = sheetSuc.getDataRange().getValues();

  // 1. Obtener todas las sucursales de la empresa
  var misSucursales = sucsData.slice(1).filter(function(s) {
    return String(s[1]).trim().toUpperCase() === String(rfc).trim().toUpperCase();
  }).map(function(s) {
    return { id: s[0], nombre: s[2] };
  });

  // 2. Procesar inscripciones
  var inscripciones = inscData.slice(1).filter(function(row) {
    return String(row[1]).trim().toUpperCase() === String(rfc).trim().toUpperCase();
  }).map(function(row) {
    var cursoId = String(row[2]);
    var cursoInfo = cursData.slice(1).find(function(c) { return String(c[0]) === cursoId; });

    return {
      idSeguimiento: row[0],
      cursoNombre: cursoInfo ? cursoInfo[1] : "Curso Desconocido",
      sucursalId: row[3],
      estatus: row[5] || "Pendiente",
      fecha: cursoInfo ? ((cursoInfo[2] instanceof Date) ? Utilities.formatDate(cursoInfo[2], "GMT-6", "dd/MM/yyyy") : cursoInfo[2]) : "-",
      hora: cursoInfo ? cursoInfo[3] : "-"
    };
  });

  // 3. Agrupar progreso por Sucursal
  var desglosePorSucursal = misSucursales.map(function(suc) {
    var inscDeSuc = inscripciones.filter(function(i) { return String(i.sucursalId) === String(suc.id); });

    var modulosAvance = modules.map(function(m) {
      var ins = inscDeSuc.find(function(i) { return i.cursoNombre === m; });
      return ins || { cursoNombre: m, estatus: "No Inscrito", fecha: "-", hora: "-" };
    });

    var completados = modulosAvance.filter(function(m) { return m.estatus === "Completado"; }).length;

    return {
      sucursalNombre: suc.nombre,
      modulos: modulosAvance,
      completados: completados,
      total: modules.length,
      terminado: completados === modules.length
    };
  });

  // Estatus global consolidado
  var totalCompletados = desglosePorSucursal.reduce(function(acc, s) { return acc + s.completados; }, 0);
  var totalEsperados = desglosePorSucursal.length * modules.length;

  return {
    porSucursal: desglosePorSucursal,
    completadosGlobal: totalCompletados,
    totalGlobal: totalEsperados,
    estatusGeneral: (totalCompletados === totalEsperados && totalEsperados > 0) ? "Terminado" : "En Proceso"
  };
}

/**
 * REQUERIMIENTO 3: Vinculación de Cursos Disponibles vía ID_Seguimiento
 * Esta función permite 'completar' el perfil de capacitación de una empresa
 * partiendo de un registro de seguimiento existente (llave primaria ID_Seguimiento).
 * Integra las pestañas 'Seguimiento' y 'Cursos Disponibles'.
 */
function agregarCursosManual(idSeguimientoBase, idCursoNuevo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetSeg = getSheetSafe("Seguimiento");
    var segData = sheetSeg.getDataRange().getValues();

    // 1. Buscar el registro base mediante ID_Seguimiento para obtener el RFC y Sucursal
    var registroBase = null;
    for (var i = 1; i < segData.length; i++) {
      if (String(segData[i][0]) === String(idSeguimientoBase)) {
        registroBase = {
          rfc: segData[i][1],
          sucursalId: segData[i][3]
        };
        break;
      }
    }

    if (!registroBase) {
      throw new Error("El ID_Seguimiento '" + idSeguimientoBase + "' no existe.");
    }

    // 2. Validar existencia del curso nuevo
    var sheetCursos = getSheetSafe("Cursos Disponibles");
    var cursosData = sheetCursos.getDataRange().getValues();
    var cursoExiste = cursosData.slice(1).some(function(row) { return String(row[0]) === String(idCursoNuevo); });

    if (!cursoExiste) {
      throw new Error("El ID_Curso '" + idCursoNuevo + "' no existe en Cursos Disponibles.");
    }

    // 3. Agregar el nuevo registro de seguimiento vinculado
    sheetSeg.appendRow([
      Utilities.getUuid(),
      registroBase.rfc,
      idCursoNuevo,
      registroBase.sucursalId,
      new Date(),
      "Completado (Manual)"
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Las funciones de administración getRegistrosAdmin y cambiarEstatus han sido ELIMINADAS.
