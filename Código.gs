/**
 * Mujeres Seguras - Google Apps Script Backend (v2)
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.p) || 'Index';
  // Note: Admin section is removed as per requirements.
  if (page === 'Admin') page = 'Index';

  try {
    // Asegurar que la base de datos y la migración se ejecuten automáticamente
    setupDatabase();
    migrarEmpresasExistentes();

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
 * Helper para obtener el siguiente ID secuencial en Seguimiento
 */
function getNextSeguimientoId() {
  var sheet = getSheetSafe("Seguimiento");
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxId = 0;
  for (var i = 0; i < data.length; i++) {
    var val = parseInt(data[i][0]);
    if (!isNaN(val) && val > maxId) maxId = val;
  }
  return maxId + 1;
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
    "Cursos_Disponibles": ["ID_Curso", "Nombre_Curso", "Fecha_Calendario", "Hora_Inicio", "ID_Sede", "Cupo_Máximo"],
    "Seguimiento": ["ID_Seguimiento", "RFC_Empresa", "ID_Sucursal", "ID_Curso", "Fecha_Accion", "Estatus", "Hora", "Sede"],
    "UsuariosAppSheet": ["Usuario", "Contraseña", "Rol"],
    "Config_Espacios": ["Nombre Comercial", "Nombre de la Empresa", "Sucursal", "Dirección", "Teléfono", "URL_Maps", "Estatus"],
    "Config_General": ["Clave", "Valor"],
    "Usuarios": ["Correo", "PasswordHash", "RFC_Asociado", "EsPasswordTemporal", "Activo"],
    "Acciones": ["Título", "Descripción"]
  };

  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight("bold").setBackground("#6B2C91").setFontColor("white");
    }
  }


  // La hoja 'Cursos_Disponibles' se lee directamente de la configuración manual del administrador.

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
 * Valida si un correo electrónico ya existe en la hoja de Usuarios
 */
function validarCorreoExistente(correo) {
  var sheet = getSheetSafe("Usuarios");
  var data = sheet.getDataRange().getValues();
  var cClean = String(correo).trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === cClean) return true;
  }
  return false;
}

/**
 * Genera un hash SHA-256 seguro a partir de una contraseña usando un Salt básico (el correo del usuario)
 */
function hashPassword(password, correo) {
  var salt = String(correo).trim().toLowerCase();
  var rawInput = password + salt;
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawInput, Utilities.Charset.UTF_8);
  var hexString = "";
  for (var i = 0; i < rawHash.length; i++) {
    var hex = (rawHash[i] < 0 ? rawHash[i] + 256 : rawHash[i]).toString(16);
    if (hex.length === 1) hex = "0" + hex;
    hexString += hex;
  }
  return hexString;
}

/**
 * Autentica un usuario con su correo y contraseña
 */
function autenticarUsuario(correo, password) {
  try {
    var sheet = getSheetSafe("Usuarios");
    var data = sheet.getDataRange().getValues();
    var cClean = String(correo).trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var userCorreo = String(data[i][0]).trim().toLowerCase();
      if (userCorreo === cClean) {
        var storedPassword = data[i][1];
        var rfc = data[i][2];
        var esTemporal = data[i][3];
        var activo = data[i][4];

        if (activo !== true && String(activo).toUpperCase() !== "TRUE" && String(activo).toUpperCase() !== "SI" && activo !== 1) {
          return { success: false, error: "El usuario se encuentra inactivo." };
        }

        var passwordMatched = false;

        // Comparación directa de la contraseña sin aplicar hash ni transformaciones
        if (password === String(storedPassword)) {
          passwordMatched = true;
        }

        if (passwordMatched) {
          // Buscar info de la empresa
          var userObj = buscarPorRFC(rfc);
          if (!userObj) {
            return { success: false, error: "Empresa asociada no encontrada." };
          }
          return {
            success: true,
            rfc: rfc,
            correo: userCorreo,
            nombreEmpresa: userObj.nombreEmpresa,
            folio: userObj.folio,
            esPasswordTemporal: (esTemporal === true || String(esTemporal).toUpperCase() === "TRUE" || esTemporal === 1 || String(esTemporal).trim() === "SI")
          };
        } else {
          return { success: false, error: "Contraseña incorrecta." };
        }
      }
    }
    return { success: false, error: "El correo electrónico no está registrado." };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Cambia la contraseña temporal de un usuario por primera vez
 */
function cambiarContrasenaTemporal(correo, nuevaPassword) {
  try {
    var sheet = getSheetSafe("Usuarios");
    var data = sheet.getDataRange().getValues();
    var cClean = String(correo).trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var userCorreo = String(data[i][0]).trim().toLowerCase();
      if (userCorreo === cClean) {
        // Almacenar la nueva contraseña directamente sin aplicar hash ni transformaciones
        sheet.getRange(i + 1, 2).setValue(nuevaPassword); // Update Password column directly
        sheet.getRange(i + 1, 4).setValue("FALSE"); // EsPasswordTemporal = false
        return { success: true };
      }
    }
    return { success: false, error: "Usuario no encontrado." };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Realiza la migración de empresas existentes a la hoja Usuarios,
 * asignándoles el correo registrado en la empresa y un password temporal (el RFC).
 */
function migrarEmpresasExistentes() {
  try {
    var sheetEmp = getSheetSafe("Empresas");
    var empData = sheetEmp.getDataRange().getValues();

    var sheetUser = getSheetSafe("Usuarios");
    var userRange = sheetUser.getDataRange();
    var userData = userRange.getValues();

    var registeredRFCs = {};
    for (var i = 1; i < userData.length; i++) {
      var rfc = String(userData[i][2]).trim().toUpperCase();
      if (rfc) {
        registeredRFCs[rfc] = true;
      }
    }

    var migratedCount = 0;
    for (var j = 1; j < empData.length; j++) {
      var rfc = String(empData[j][0]).trim().toUpperCase();
      var correo = String(empData[j][3]).trim();

      if (rfc && correo && !registeredRFCs[rfc]) {
        // Si el correo ya está en uso por otro usuario, usamos un sufijo o lo omitimos para evitar colisiones
        var correoFinal = correo;
        if (validarCorreoExistente(correoFinal)) {
          correoFinal = rfc.toLowerCase() + "@mujeresseguras.tmp";
        }

        // Generar password temporal que es el mismo RFC (en minúsculas por simplicidad)
        var tempPassword = rfc.toLowerCase();

        sheetUser.appendRow([
          correoFinal,
          tempPassword,
          rfc,
          "TRUE", // EsPasswordTemporal
          "TRUE"  // Activo
        ]);
        migratedCount++;
      }
    }
    if (migratedCount > 0) {
      console.log("Migración completada. Registros migrados: " + migratedCount);
    }
  } catch (e) {
    console.error("Error durante migración: " + e.toString());
  }
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
 * Procesa el registro completo (Empresa + Sucursales + Capacitación Inicial)
 */
function procesarRegistro(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetEmpresas = getSheetSafe("Empresas");
    var sheetSucursales = getSheetSafe("Sucursales");
    var sheetSeg = getSheetSafe("Seguimiento");

    if (validarRFCExistente(data.empresa.rfc)) {
      throw new Error("El RFC ya se encuentra registrado.");
    }

    if (validarCorreoExistente(data.empresa.correo)) {
      throw new Error("El correo electrónico ya se encuentra registrado.");
    }

    var folio = generarFolio();
    var fecha = new Date();

    // Guardar Empresa
    sheetEmpresas.appendRow([
      data.empresa.rfc,
      data.empresa.nombreEmpresa,
      data.empresa.telefono,
      data.empresa.correo,
      folio,
      fecha,
      "Pendiente",
      JSON.stringify(data.compromisos)
    ]);

    // Crear Usuario de acceso
    var sheetUser = getSheetSafe("Usuarios");
    // Almacenar esa contraseña exactamente como la ingresó el usuario
    sheetUser.appendRow([
      data.empresa.correo,
      data.empresa.password,
      data.empresa.rfc,
      "FALSE", // EsPasswordTemporal = false (lo asignó el usuario)
      "TRUE"   // Activo
    ]);

    var firstSucursalId = "";
    // Guardar Sucursales
    data.sucursales.forEach(function(suc, index) {
      var id = Utilities.getUuid();
      if (index === 0) firstSucursalId = id;
      var coords = (suc.coordenadas || "").split(",");
      sheetSucursales.appendRow([
        id,
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

    // Vincular capacitación inicial si se proporcionó
    if (data.capacitacionInicial && data.capacitacionInicial.idCurso) {
      sheetSeg.appendRow([
        getNextSeguimientoId(),
        data.empresa.rfc,
        firstSucursalId || "GENERAL",
        data.capacitacionInicial.idCurso,
        fecha,
        "Programada",
        String(data.capacitacionInicial.hora || "-"), // Tratado como texto sin conversión
        data.capacitacionInicial.sede || "-"
      ]);
    }

    var qrUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(folio) + "&size=200";

    // Requerimiento: Envío de correo electrónico tras registro de empresa
    try {
      var emailRecipient = data.empresa.correo;
      var emailSubject = "Registro exitoso";

      // Obtener el logo según las preferencias: Opción A (Config_General 'link_logo') con fallback a Opción B
      var rawLogoUrl = getConfigValue("link_logo");
      if (!rawLogoUrl || String(rawLogoUrl).trim() === "") {
        rawLogoUrl = "https://drive.google.com/file/d/1iuDRJMp2PLPF1Vji-6qqI-EDWsZjbcWx/view?usp=drive_link";
      }

      // Convertir enlaces de Google Drive a formato directo para asegurar compatibilidad en Gmail/Outlook
      var logoUrl = rawLogoUrl;
      var driveMatch = String(rawLogoUrl).match(/\/file\/d\/([^\/]+)/) || String(rawLogoUrl).match(/id=([^&]+)/);
      if (driveMatch && driveMatch[1]) {
        logoUrl = "https://drive.google.com/uc?export=view&id=" + driveMatch[1];
      }

      // Obtener el nombre de la sucursal registrada (primera sucursal)
      var branchName = "No especificada";
      if (data.sucursales && data.sucursales.length > 0) {
        branchName = data.sucursales[0].nombre;
      }

      // Obtener el nombre, fecha y lugar del curso elegido durante el registro
      var courseName = "Módulo General";
      var courseDate = "No especificada";
      var coursePlace = "No especificado";

      if (data.capacitacionInicial && data.capacitacionInicial.idCurso) {
        var cursosList = getCursosDisponibles();
        var selectedCourse = cursosList.find(function(c) {
          return String(c.id) === String(data.capacitacionInicial.idCurso);
        });
        if (selectedCourse) {
          if (selectedCourse.nombre) {
            courseName = selectedCourse.nombre;
          }
          if (selectedCourse.fecha) {
            courseDate = selectedCourse.fecha;
          }
          if (selectedCourse.sede) {
            coursePlace = selectedCourse.sede;
          }
        } else {
          if (data.capacitacionInicial.sede) {
            coursePlace = data.capacitacionInicial.sede;
          }
        }
      }

      var htmlBody = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;'>" +
                     "<div style='text-align: center; margin-bottom: 20px;'>" +
                     "<img src='" + logoUrl + "' alt='Logo Mujeres Seguras' style='max-height: 120px; max-width: 100%; height: auto; object-fit: contain;'>" +
                     "</div>" +
                     "<h2 style='color: #DE007B; text-align: center;'>¡Registro Exitoso!</h2>" +
                     "<p>Estimado/a,</p>" +
                     "<p>Le confirmamos que el registro de su organización <strong>" + data.empresa.nombreEmpresa + "</strong> ha sido procesado correctamente.</p>" +
                     "<hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>" +
                     "<h3 style='color: #F47C20;'>Detalles de Registro:</h3>" +
                     "<p><strong>Sucursal Registrada:</strong> " + branchName + "</p>" +
                     "<p><strong>Curso de Capacitación Inicial:</strong> " + courseName + "</p>" +
                     "<p><strong>Lugar:</strong> " + coursePlace + "</p>" +
                     "<p><strong>Fecha:</strong> " + courseDate + "</p>" +
                     "<hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>" +
                     "<h3 style='color: #F47C20;'>Credenciales de Acceso:</h3>" +
                     "<p><strong>Usuario / Correo:</strong> " + emailRecipient + "</p>" +
                     "<p><strong>Contraseña:</strong> " + data.empresa.password + "</p>" +
                     "<p style='font-size: 12px; color: #666; margin-top: 30px; text-align: center;'>Este es un mensaje automático del Sistema de Mujeres Seguras. Por favor no responda directamente a este correo.</p>" +
                     "</div>";

      // Validación básica para asegurar que el destinatario y el asunto no estén vacíos
      if (!emailRecipient || String(emailRecipient).trim() === "") {
        throw new Error("El destinatario del correo (correo electrónico) está vacío.");
      }
      if (!emailSubject || String(emailSubject).trim() === "") {
        throw new Error("El asunto del correo está vacío.");
      }

      // Implementación robusta de envío con GmailApp y fallback a MailApp con manejo de excepciones
      var correoEnviado = false;
      try {
        GmailApp.sendEmail(emailRecipient, emailSubject, "", {
          htmlBody: htmlBody
        });
        correoEnviado = true;
        console.log("Correo enviado exitosamente usando GmailApp.");
      } catch (e1) {
        console.warn("Fallo al enviar correo con GmailApp: " + e1.toString() + ". Intentando MailApp...");
        try {
          MailApp.sendEmail({
            to: emailRecipient,
            subject: emailSubject,
            htmlBody: htmlBody
          });
          correoEnviado = true;
          console.log("Correo enviado exitosamente usando MailApp.");
        } catch (e2) {
          console.error("Fallo definitivo de envío de correo (GmailApp y MailApp): " + e2.toString());
          throw e2;
        }
      }
    } catch (mailError) {
      console.error("Error al enviar el correo de registro exitoso: " + mailError.toString());
    }

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
    var coords = (data.coordenadas || "").split(",");

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
        getNextSeguimientoId(),
        data.rfc,
        sucursalId,
        data.capacitacion.idCurso,
        new Date(),
        "Programada",
        String(data.capacitacion.hora || "-"), // Tratado como texto sin conversión
        data.capacitacion.sede || "-"
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
 * Obtiene la lista de acciones desde la pestaña 'Acciones'
 * Formato: Columna A = Título, Columna B = Descripción
 */
function getAcciones() {
  try {
    var sheet = getSheetSafe("Acciones");
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];

    var result = [];
    for (var i = 1; i < data.length; i++) {
      var titulo = data[i][0] ? String(data[i][0]).trim() : "";
      var descripcion = data[i][1] ? String(data[i][1]).trim() : "";
      if (titulo || descripcion) {
        result.push({
          titulo: titulo,
          descripcion: descripcion
        });
      }
    }
    return result;
  } catch (e) {
    console.error("Error en getAcciones: " + e.toString());
    return [];
  }
}

/**
 * Obtiene las sucursales que ya cuentan con certificación aprobada
 * Ahora lee exclusivamente de la pestaña Config_Espacios (Manual)
 */
function getSucursalesCertificadas() {
  try {
    var sheet = getSheetSafe("Config_Espacios");
    var data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];

    var headers = data[0].map(function(h) { return String(h || "").trim().toLowerCase(); });

    var idxComercial = headers.indexOf("nombre comercial");
    var idxEmpresa = headers.indexOf("nombre de la empresa");
    if (idxEmpresa === -1) idxEmpresa = headers.indexOf("empresa");
    var idxSucursal = headers.indexOf("sucursal");
    var idxDireccion = headers.indexOf("dirección");
    if (idxDireccion === -1) idxDireccion = headers.indexOf("direccion");
    var idxTelefono = headers.indexOf("teléfono");
    if (idxTelefono === -1) idxTelefono = headers.indexOf("telefono");
    var idxMaps = headers.indexOf("url_maps");
    if (idxMaps === -1) idxMaps = headers.indexOf("url maps");
    var idxEstatus = headers.indexOf("estatus");

    // Fallbacks si las cabeceras no coinciden exactamente
    if (idxSucursal === -1) {
      if (idxComercial !== -1) {
        idxEmpresa = 1; idxSucursal = 2; idxDireccion = 3; idxTelefono = 4; idxMaps = 5; idxEstatus = 6;
      } else {
        idxEmpresa = 0; idxSucursal = 1; idxDireccion = 2; idxTelefono = 3; idxMaps = 4; idxEstatus = 5;
      }
    }

    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var nombreSuc = (idxSucursal !== -1 && row[idxSucursal]) ? String(row[idxSucursal]).trim() : "";
      var nombreEmp = (idxEmpresa !== -1 && row[idxEmpresa]) ? String(row[idxEmpresa]).trim() : "";
      var nombreCom = (idxComercial !== -1 && row[idxComercial]) ? String(row[idxComercial]).trim() : "";

      if (nombreSuc || nombreCom || nombreEmp) {
        result.push({
          nombreComercial: nombreCom,
          empresa: nombreEmp,
          nombre: nombreSuc,
          direccion: (idxDireccion !== -1 && row[idxDireccion]) ? String(row[idxDireccion]).trim() : "",
          telefono: (idxTelefono !== -1 && row[idxTelefono]) ? String(row[idxTelefono]).trim() : "",
          urlMaps: (idxMaps !== -1 && row[idxMaps]) ? String(row[idxMaps]).trim() : "",
          estatus: (idxEstatus !== -1 && row[idxEstatus]) ? String(row[idxEstatus]).trim() : "Sin insignia"
        });
      }
    }
    return result;
  } catch (e) {
    console.error("Error en getSucursalesCertificadas: " + e.toString());
    return [];
  }
}

/**
 * Obtiene un valor de configuración de la pestaña Config_General
 */
function getConfigValue(key) {
  try {
    var sheet = getSheetSafe("Config_General");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      // Comparación flexible para claves que puedan ser numéricas en el Sheet
      var sheetKey = String(data[i][0] || "").trim();
      var targetKey = String(key || "").trim();
      if (sheetKey === targetKey) {
        var value = data[i][1];
        return typeof value === 'string' ? value.trim() : value;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Obtiene los links de videos configurados en la pestaña Config_General
 * Utiliza las claves: link_video1, link_video2 y link_video3
 */
function getVideoLinks() {
  var keys = ["link_video1", "link_video2", "link_video3"];
  var videos = [];
  for (var i = 0; i < keys.length; i++) {
    var val = getConfigValue(keys[i]);
    if (val !== null && val !== undefined) {
      var strVal = String(val).trim();
      if (strVal !== "") {
        videos.push(strVal);
      }
    }
  }
  if (videos.length === 0) {
    var fallback = getConfigValue("link_video");
    if (fallback !== null && fallback !== undefined) {
      var fallbackStr = String(fallback).trim();
      if (fallbackStr !== "") {
        videos.push(fallbackStr);
      }
    }
  }
  return videos;
}

/**
 * Lógica de Capacitación - Lectura de Cursos_Disponibles (SOLO LECTURA)
 * Se elimina el filtrado y el auto-poblamiento para depender 100% del Sheet.
 */
function getCursosDisponibles() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Cursos_Disponibles");
    if (!sheet) return [];

    var dataValues = sheet.getDataRange().getValues();
    var displayValues = sheet.getDataRange().getDisplayValues(); // Para campos de Hora como Texto
    var sheetSuc = getSheetSafe("Sucursales");
    var sucs = sheetSuc.getDataRange().getValues();
    var result = [];

    for (var i = 1; i < dataValues.length; i++) {
      var row = dataValues[i];
      var dispRow = displayValues[i];
      var id = row[0];
      var nombre = String(row[1] || "").trim();
      var fechaRaw = row[2];
      var hora = dispRow[3] || "-"; // Usar valor mostrado en celda sin conversión
      var sede = dispRow[4] || "-"; // Leer directamente de la columna Sede (index 4)

      if (!nombre) continue; // Muestra la lista completa tal cual está en el Sheet

      var fechaFinal = "Fecha no disponible";
      if (fechaRaw instanceof Date) {
        fechaFinal = Utilities.formatDate(fechaRaw, "GMT-6", "dd/MM/yyyy");
      } else if (fechaRaw) {
        fechaFinal = String(fechaRaw);
      }

      result.push({
        id: String(id),
        nombre: String(nombre),
        fecha: fechaFinal,
        hora: hora,
        sede: sede,
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
    // Schema: ["ID_Seguimiento", "RFC_Empresa", "ID_Sucursal", "ID_Curso", "Fecha_Accion", "Estatus", "Hora", "Sede"]
    sheet.appendRow([
      getNextSeguimientoId(),
      data.rfc,
      data.idSucursal || "GENERAL",
      data.cursoId,
      new Date(),
      "Programada",
      String(data.hora || "-"), // Tratado como texto sin conversión
      data.sede || "-"
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
  var inscDispData = sheetInsc.getDataRange().getDisplayValues(); // Para campos de Hora
  var cursData = sheetCursos.getDataRange().getValues();
  var cursDispData = sheetCursos.getDataRange().getDisplayValues(); // Para campos de Hora
  var sucsData = sheetSuc.getDataRange().getValues();

  // 1. Obtener todas las sucursales de la empresa
  var misSucursales = sucsData.slice(1).filter(function(s) {
    return String(s[1]).trim().toUpperCase() === String(rfc).trim().toUpperCase();
  }).map(function(s) {
    return { id: s[0], nombre: s[2] };
  });

  // 2. Procesar inscripciones (Alineado con el schema de Seguimiento)
  var inscripciones = [];
  for (var i = 1; i < inscData.length; i++) {
    var row = inscData[i];
    var dispRow = inscDispData[i];

    if (String(row[1]).trim().toUpperCase() === String(rfc).trim().toUpperCase()) {
      var cursoId = String(row[3]);

      // Buscar info del curso y su valor mostrado (Hora)
      var cursoInfo = null;
      var cursoDispInfo = null;
      for (var k = 1; k < cursData.length; k++) {
        if (String(cursData[k][0]) === cursoId) {
          cursoInfo = cursData[k];
          cursoDispInfo = cursDispData[k];
          break;
        }
      }

      var sucInfo = misSucursales.find(function(s) { return String(s.id) === String(row[2]); });

      var fechaFinal = "-";
      if (cursoInfo && cursoInfo[2]) {
        fechaFinal = (cursoInfo[2] instanceof Date) ? Utilities.formatDate(cursoInfo[2], "GMT-6", "dd/MM/yyyy") : String(cursoInfo[2]);
      } else {
        fechaFinal = row[4] instanceof Date ? Utilities.formatDate(row[4], "GMT-6", "dd/MM/yyyy") : (row[4] || "-");
      }

      // El campo HORA y SEDE se toman de cursoDispInfo si existe, si no de dispRow (Hoja Seguimiento)
      var horaFinal = cursoDispInfo ? cursoDispInfo[3] : (dispRow[6] || "-");
      var sedeFinal = cursoDispInfo ? cursoDispInfo[4] : (dispRow[7] || "-");

      inscripciones.push({
        idSeguimiento: row[0],
        sucursalId: row[2],
        sucursalNombre: sucInfo ? sucInfo.nombre : (row[2] === "GENERAL" ? "General" : "Desconocida"),
        nombreCurso: cursoInfo ? cursoInfo[1] : (row[3] || "Curso Desconocido"),
        estatus: row[5] || "Pendiente",
        fecha: fechaFinal,
        hora: horaFinal,
        sede: sedeFinal
      });
    }
  }

  // 3. Agrupar progreso por Sucursal
  var desglosePorSucursal = misSucursales.map(function(suc) {
    var inscDeSuc = inscripciones.filter(function(i) { return String(i.sucursalId) === String(suc.id); });

    var modulosAvance = modules.map(function(m) {
      var ins = inscDeSuc.find(function(i) { return i.nombreCurso === m; });
      return ins || { nombreCurso: m, estatus: "No Inscrito", fecha: "-", hora: "-", sede: "-" };
    });

    var completados = modulosAvance.filter(function(m) { return m.estatus === "Completado" || m.estatus === "Terminada"; }).length;

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
    seguimientoDetallado: inscripciones, // Añadido para compatibilidad con el frontend
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
    var sheetCursos = getSheetSafe("Cursos_Disponibles");
    var cursosData = sheetCursos.getDataRange().getValues();
    var cursoExiste = cursosData.slice(1).some(function(row) { return String(row[0]) === String(idCursoNuevo); });

    if (!cursoExiste) {
      throw new Error("El ID_Curso '" + idCursoNuevo + "' no existe en Cursos Disponibles.");
    }

    // 3. Agregar el nuevo registro de seguimiento vinculado
    sheetSeg.appendRow([
      getNextSeguimientoId(),
      registroBase.rfc,
      registroBase.sucursalId,
      idCursoNuevo,
      new Date(),
      "Completado (Manual)",
      "-",
      "-"
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// Las funciones de administración getRegistrosAdmin y cambiarEstatus han sido ELIMINADAS.

/**
 * Función de prueba para verificar el envío de correos desde el Editor de Google Apps Script.
 * Puede seleccionar esta función en el menú desplegable del editor y hacer clic en "Ejecutar".
 * Reemplace "su_correo@ejemplo.com" con su correo real para recibir la prueba.
 */
function probarEnvioCorreo() {
  var correoDePrueba = Session.getActiveUser().getEmail() || "su_correo@ejemplo.com";

  Logger.log("Iniciando prueba de envío de correo a: " + correoDePrueba);

  // Simulamos los datos del registro de una empresa y curso
  var dummyData = {
    empresa: {
      rfc: "DUMMY1234567",
      nombreEmpresa: "Empresa de Prueba S.A. de C.V.",
      telefono: "555-123-4567",
      correo: correoDePrueba,
      password: "passwordPrueba123"
    },
    sucursales: [
      {
        nombre: "Sucursal Norte Centro",
        direccion: "Av. Paseo de la Reforma 123",
        coordenadas: "19.4326,-99.1332",
        telefono: "555-987-6543",
        responsable: "Juan Pérez",
        cargo: "Gerente",
        compromisos: ["Compromiso 1", "Compromiso 2"]
      }
    ],
    compromisos: ["Compromiso General 1"],
    capacitacionInicial: {
      idCurso: "1", // El ID del curso a buscar en la hoja de cálculo
      hora: "10:00 AM",
      sede: "Oficina Central - Sala de Conferencias A"
    }
  };

  try {
    // 1. Validar destinatario y asunto
    var emailRecipient = dummyData.empresa.correo;
    var emailSubject = "Prueba de Registro Exitoso - Mujeres Seguras";

    // 2. Resolver Logo
    var rawLogoUrl = getConfigValue("link_logo");
    if (!rawLogoUrl || String(rawLogoUrl).trim() === "") {
      rawLogoUrl = "https://drive.google.com/file/d/1iuDRJMp2PLPF1Vji-6qqI-EDWsZjbcWx/view?usp=drive_link";
    }
    var logoUrl = rawLogoUrl;
    var driveMatch = String(rawLogoUrl).match(/\/file\/d\/([^\/]+)/) || String(rawLogoUrl).match(/id=([^&]+)/);
    if (driveMatch && driveMatch[1]) {
      logoUrl = "https://drive.google.com/uc?export=view&id=" + driveMatch[1];
    }

    // 3. Resolver datos del curso
    var courseName = "Módulo de Prueba";
    var courseDate = Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy");
    var coursePlace = dummyData.capacitacionInicial.sede;

    // Intentar buscar un curso real de la hoja si existe
    try {
      var cursosList = getCursosDisponibles();
      if (cursosList && cursosList.length > 0) {
        var selectedCourse = cursosList[0]; // Usar el primero disponible para la prueba
        courseName = selectedCourse.nombre;
        courseDate = selectedCourse.fecha;
        coursePlace = selectedCourse.sede;
        Logger.log("Se encontró un curso real en 'Cursos_Disponibles' para la prueba: " + courseName);
      }
    } catch (eCursos) {
      Logger.log("Nota: No se pudo leer la lista de cursos reales, usando valores dummy: " + eCursos.toString());
    }

    // 4. Construir cuerpo HTML
    var htmlBody = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;'>" +
                   "<div style='text-align: center; margin-bottom: 20px;'>" +
                   "<img src='" + logoUrl + "' alt='Logo Mujeres Seguras' style='max-height: 120px; max-width: 100%; height: auto; object-fit: contain;'>" +
                   "</div>" +
                   "<h2 style='color: #DE007B; text-align: center;'>¡Registro Exitoso! (Prueba de Envío)</h2>" +
                   "<p>Estimado/a,</p>" +
                   "<p>Le confirmamos que el registro de su organización de prueba <strong>" + dummyData.empresa.nombreEmpresa + "</strong> ha sido procesado correctamente.</p>" +
                   "<hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>" +
                   "<h3 style='color: #F47C20;'>Detalles de Registro:</h3>" +
                   "<p><strong>Sucursal Registrada:</strong> " + dummyData.sucursales[0].nombre + "</p>" +
                   "<p><strong>Curso de Capacitación Inicial:</strong> " + courseName + "</p>" +
                   "<p><strong>Lugar:</strong> " + coursePlace + "</p>" +
                   "<p><strong>Fecha:</strong> " + courseDate + "</p>" +
                   "<hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>" +
                   "<h3 style='color: #F47C20;'>Credenciales de Acceso:</h3>" +
                   "<p><strong>Usuario / Correo:</strong> " + emailRecipient + "</p>" +
                   "<p><strong>Contraseña:</strong> " + dummyData.empresa.password + "</p>" +
                   "<p style='font-size: 12px; color: #666; margin-top: 30px; text-align: center;'>Este es un mensaje automático de prueba del Sistema de Mujeres Seguras.</p>" +
                   "</div>";

    // 5. Enviar usando la lógica robusta
    var correoEnviado = false;
    try {
      GmailApp.sendEmail(emailRecipient, emailSubject, "", {
        htmlBody: htmlBody
      });
      correoEnviado = true;
      Logger.log("¡ÉXITO! El correo de prueba se envió correctamente usando GmailApp.");
    } catch (e1) {
      Logger.log("Advertencia: Falló GmailApp (" + e1.toString() + "). Intentando con MailApp...");
      try {
        MailApp.sendEmail({
          to: emailRecipient,
          subject: emailSubject,
          htmlBody: htmlBody
        });
        correoEnviado = true;
        Logger.log("¡ÉXITO! El correo de prueba se envió correctamente usando MailApp.");
      } catch (e2) {
        Logger.log("ERROR CRÍTICO: No se pudo enviar el correo de prueba con ninguno de los servicios: " + e2.toString());
        throw e2;
      }
    }

    return "Prueba finalizada. ¿Enviado con éxito?: " + (correoEnviado ? "SÍ" : "NO");
  } catch (err) {
    Logger.log("Error durante la ejecución de la prueba: " + err.toString());
    return "Error: " + err.toString();
  }
}
