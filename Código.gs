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
    "Empresas": ["RFC", "Representante", "Teléfono", "Correo", "Folio", "FechaRegistro", "Estatus", "CompromisosGenerales"],
    "Sucursales": ["ID", "RFC_Empresa", "NombreSucursal", "Dirección", "Latitud", "Longitud", "Horario", "TeléfonoLocal", "Responsable", "Cargo", "CompromisosSucursal"],
    "PlanesTrabajo": ["ID", "RFC", "Folio", "FechaEnvio", "PlanDetalle", "Estatus", "Observaciones", "ID_Sucursal", "URL_Archivo", "Tipo_Archivo", "Ultima_Actualizacion"],
    "Cursos_Disponibles": ["ID", "Nombre", "Fecha", "Hora", "Sede_ID", "Capacidad"],
    "Inscripciones_Cursos": ["ID", "RFC", "Curso_ID", "Fecha_Inscripcion", "Estatus"],
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

  // Cursos Obligatorios default (con objetos Date)
  var sheetCursos = ss.getSheetByName("Cursos_Disponibles");
  if (sheetCursos && sheetCursos.getLastRow() === 1) {
    var cursos = [
      [Utilities.getUuid(), "Mesa de Diálogo", new Date(2023, 11, 1), "10:00", "", 50],
      [Utilities.getUuid(), "¿La igualdad de género es un bien?", new Date(2023, 11, 5), "11:00", "", 50],
      [Utilities.getUuid(), "Comprender para prevenir la violencia de género", new Date(2023, 11, 10), "09:00", "", 50],
      [Utilities.getUuid(), "Fortaleciendo espacios parte 1", new Date(2023, 11, 15), "16:00", "", 50],
      [Utilities.getUuid(), "Fortaleciendo espacios parte 2", new Date(2023, 11, 20), "16:00", "", 50]
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
      data.empresa.representante,
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
 * Agrega una nueva sucursal de forma independiente
 */
function agregarNuevaSucursal(data) {
  try {
    var sheetSucursales = getSheetSafe("Sucursales");
    var coords = data.coordenadas.split(",");

    sheetSucursales.appendRow([
      Utilities.getUuid(),
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
        representante: data[i][1],
        folio: data[i][4],
        estatus: data[i][6]
      };
    }
  }
  return null;
}

/**
 * Obtiene el historial de Planes de Trabajo para un RFC (Estructura Limpia)
 */
function getPlanesTrabajo(rfc) {
  var sheet = getSheetSafe("PlanesTrabajo");
  var data = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === rfc) {
      result.push({
        id: data[i][0],
        idSucursal: data[i][7],
        tipoArchivo: data[i][9] || "Plan de Trabajo",
        estatus: data[i][5],
        fecha: Utilities.formatDate(data[i][10] || data[i][3], Session.getScriptTimeZone(), "dd/MM/yyyy"),
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
 * Lógica de Capacitación - Obtiene cursos con manejo de fechas robusto
 */
function getCursosDisponibles() {
  try {
    var sheet = getSheetSafe("Cursos_Disponibles");

    // Auto-poblar si está vacío (segunda capa de seguridad)
    if (sheet.getLastRow() <= 1) {
       var cursos = [
          [Utilities.getUuid(), "Mesa de Diálogo", new Date(2023, 11, 1), "10:00", "", 50],
          [Utilities.getUuid(), "¿La igualdad de género es un bien?", new Date(2023, 11, 5), "11:00", "", 50],
          [Utilities.getUuid(), "Comprender para prevenir la violencia de género", new Date(2023, 11, 10), "09:00", "", 50],
          [Utilities.getUuid(), "Fortaleciendo espacios parte 1", new Date(2023, 11, 15), "16:00", "", 50],
          [Utilities.getUuid(), "Fortaleciendo espacios parte 2", new Date(2023, 11, 20), "16:00", "", 50]
        ];
        sheet.getRange(2, 1, cursos.length, 6).setValues(cursos);
    }
    var sheetSuc = getSheetSafe("Sucursales");
    var data = sheet.getDataRange().getValues();
    var sucs = sheetSuc.getDataRange().getValues();
    var result = [];

    for (var i = 1; i < data.length; i++) {
      if (!data[i][1]) continue; // Saltar vacíos

      var sedeNombre = "Sede Central";
      if (data[i][4]) {
         for(var j=1; j<sucs.length; j++) {
           if(sucs[j][0] === data[i][4]) { sedeNombre = sucs[j][2]; break; }
         }
      }

      var fechaVal = data[i][2];
      var fechaStr = "";

      if (fechaVal instanceof Date) {
        fechaStr = Utilities.formatDate(fechaVal, Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else if (fechaVal) {
        fechaStr = String(fechaVal);
      }

      result.push({
        id: data[i][0],
        nombre: data[i][1],
        fecha: fechaStr,
        hora: data[i][3],
        sede: sedeNombre
      });
    }
    return result;
  } catch (e) {
    Logger.log("Error en getCursosDisponibles: " + e.toString());
    return [];
  }
}

function inscribirCurso(data) {
  try {
    var sheet = getSheetSafe("Inscripciones_Cursos");
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

function getProgresoCapacitacion(rfc) {
  var modules = [
    "Mesa de Diálogo",
    "¿La igualdad de género es un bien?",
    "Comprender para prevenir la violencia de género",
    "Fortaleciendo espacios parte 1",
    "Fortaleciendo espacios parte 2"
  ];

  var sheetInsc = getSheetSafe("Inscripciones_Cursos");
  var sheetCursos = getSheetSafe("Cursos_Disponibles");
  var sheetSuc = getSheetSafe("Sucursales");

  var inscData = sheetInsc.getDataRange().getValues();
  var cursData = sheetCursos.getDataRange().getValues();
  var sucsData = sheetSuc.getDataRange().getValues();

  var inscritos = [];
  for (var i = 1; i < inscData.length; i++) {
    if (inscData[i][1] === rfc) {
      var cursoId = inscData[i][2];
      var cursoInfo = {};
      for (var j = 1; j < cursData.length; j++) {
        if (cursData[j][0] === cursoId) {
          cursoInfo = {
            nombre: cursData[j][1],
            fecha: Utilities.formatDate(cursData[j][2], Session.getScriptTimeZone(), "dd/MM/yyyy"),
            hora: cursData[j][3],
            sedeId: cursData[j][4]
          };
          break;
        }
      }

      var sedeNombre = "Sede Central";
      for (var k = 1; k < sucsData.length; k++) {
        if (sucsData[k][0] === cursoInfo.sedeId) { sedeNombre = sucsData[k][2]; break; }
      }

      inscritos.push({
        nombre: cursoInfo.nombre,
        fecha: cursoInfo.fecha,
        hora: cursoInfo.hora,
        sede: sedeNombre,
        estatus: inscData[i][4]
      });
    }
  }

  var completados = inscritos.filter(i => i.estatus === "Completado").length;

  return {
    modulos: modules.map(m => {
      var ins = inscritos.find(i => i.nombre === m);
      return ins || { nombre: m, estatus: "No Inscrito", fecha: "-", hora: "-", sede: "-" };
    }),
    completados: completados,
    total: modules.length,
    estatusGeneral: completados === modules.length ? "Terminado" : "En Proceso"
  };
}

// Las funciones de administración getRegistrosAdmin y cambiarEstatus han sido ELIMINADAS.
