/**
 * Code.gs - Punto de entrada doGet, inclusión de archivos, menú personalizado onOpen y funciones de configuración.
 */

/**
 * Función principal Web App doGet.
 * Detecta el usuario activo y renderiza la interfaz correspondiente a su rol.
 */
function doGet(e) {
  var userEmail = Session.getActiveUser().getEmail() || "";
  var rol = obtenerRolUsuario(userEmail);

  var template;

  if (rol === "Administrador") {
    template = HtmlService.createTemplateFromFile("Admin");
  } else if (rol === "Operador") {
    template = HtmlService.createTemplateFromFile("Operador");
  } else {
    template = HtmlService.createTemplateFromFile("AccesoDenegado");
  }

  template.userEmail = userEmail;
  template.userRol = rol;
  template.userSubdireccion = obtenerSubdireccionUsuario(userEmail);

  return template.evaluate()
    .setTitle("Seguimiento de Tareas y Acuerdos de Reuniones")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper para incluir archivos HTML parciales (CSS / JS) dentro de las plantillas.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Evento onOpen que crea el menú personalizado en Google Sheets.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Seguimiento de Reuniones")
    .addItem("📁 Abrir Aplicación Web", "mostrarModalAppUrl")
    .addSeparator()
    .addItem("📁 Gestión de Proyectos", "abrirModalProyectos")
    .addItem("📝 Registrar Nueva Minuta", "abrirModalMinuta")
    .addItem("⚡ Registrar Acuerdo Individual", "abrirModalAcuerdoIndividual")
    .addItem("📊 Abrir Dashboard (Solo Admin)", "abrirModalDashboard")
    .addItem("👥 Gestión de Usuarios", "abrirModalUsuarios")
    .addSeparator()
    .addItem("⚙️ Configuración e Inicialización BD", "ejecutarInicializacionEstructura")
    .addItem("🔔 Enviar recordatorios ahora", "ejecutarRecordatoriosAhora")
    .addToUi();
}

/**
 * Muestra el enlace directo a la Web App desplegada.
 */
function mostrarModalAppUrl() {
  var url = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutput(
    "<div style='font-family: Arial, sans-serif; padding: 20px; text-align: center;'>" +
      "<h3>Aplicación Web de Seguimiento</h3>" +
      "<p>Haz clic en el siguiente enlace para abrir la aplicación web:</p>" +
      "<a href='" + url + "' target='_blank' style='background: #1A237E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Abrir Aplicación</a>" +
    "</div>"
  ).setWidth(400).setHeight(200);

  SpreadsheetApp.getUi().showModalDialog(html, "Seguimiento de Reuniones");
}

/**
 * Modal para Configuración de Estructura.
 */
function ejecutarInicializacionEstructura() {
  var res = inicializarEstructuraBD();
  SpreadsheetApp.getUi().alert(res.mensaje);
}

/**
 * Modal para ejecutar envío inmediato de recordatorios.
 */
function ejecutarRecordatoriosAhora() {
  var res = enviarRecordatorioAcuerdosVencidos();
  SpreadsheetApp.getUi().alert("Proceso finalizado. Total de notificaciones enviadas: " + res.totalNotificados);
}

/**
 * Modales de acceso rápido desde la hoja de cálculo.
 */
function abrirModalProyectos() { abrirModalVista("ProyectosView", "Gestión de Proyectos", 850, 600); }
function abrirModalMinuta() { abrirModalVista("MinutaView", "Registrar Minuta", 950, 680); }
function abrirModalAcuerdoIndividual() { abrirModalVista("AcuerdoIndividualView", "Registrar Acuerdo Individual", 800, 550); }
function abrirModalDashboard() { abrirModalVista("DashboardView", "Dashboard General", 1000, 700); }
function abrirModalUsuarios() { abrirModalVista("UsuariosView", "Gestión de Usuarios", 850, 600); }

function abrirModalVista(file, title, width, height) {
  var template = HtmlService.createTemplateFromFile(file);
  var html = template.evaluate().setWidth(width).setHeight(height);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

/**
 * Retorna las opciones de catálogos para selectores dinámicos.
 */
function obtenerCatalogos() {
  var catalogos = sheetToObjects(SHEETS.CATALOGOS);
  var agrupados = {};

  catalogos.forEach(function(c) {
    if (!agrupados[c.Tipo]) agrupados[c.Tipo] = [];
    agrupados[c.Tipo].push(c.Valor);
  });

  return agrupados;
}

/**
 * Retorna métricas generales para el Dashboard del Administrador.
 */
function obtenerMetricasDashboard() {
  var correo = Session.getActiveUser().getEmail();
  if (!validarAdministrador(correo)) {
    throw new Error("Acceso denegado.");
  }

  var acuerdos = sheetToObjects(SHEETS.ACUERDOS);
  var proyectos = sheetToObjects(SHEETS.PROYECTOS);
  var minutas = sheetToObjects(SHEETS.MINUTAS);

  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  var totalAcuerdos = acuerdos.length;
  var porEstatus = { "Pendiente": 0, "En Proceso": 0, "Cumplido": 0, "Cancelado": 0 };
  var porPrioridad = { "Alta": 0, "Media": 0, "Baja": 0 };
  var porSubdireccion = {};
  var vencidos = 0;

  acuerdos.forEach(function(a) {
    // Estatus
    var est = a.Estatus || "Pendiente";
    if (porEstatus[est] !== undefined) porEstatus[est]++;
    else porEstatus[est] = 1;

    // Prioridad
    var prio = a.Prioridad || "Media";
    if (porPrioridad[prio] !== undefined) porPrioridad[prio]++;
    else porPrioridad[prio] = 1;

    // Subdirección
    var sub = a.Subdirección_Asignada || "Sin Asignar";
    if (!porSubdireccion[sub]) porSubdireccion[sub] = 0;
    porSubdireccion[sub]++;

    // Vencidos
    if ((est === "Pendiente" || est === "En Proceso") && a.Fecha_Límite) {
      var partes = a.Fecha_Límite.split("-");
      if (partes.length === 3) {
        var fechaLim = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
        fechaLim.setHours(0, 0, 0, 0);
        if (fechaLim.getTime() < hoy.getTime()) {
          vencidos++;
        }
      }
    }
  });

  return {
    totalProyectos: proyectos.length,
    totalMinutas: minutas.length,
    totalAcuerdos: totalAcuerdos,
    porEstatus: porEstatus,
    porPrioridad: porPrioridad,
    porSubdireccion: porSubdireccion,
    vencidos: vencidos,
    acuerdos: acuerdos,
    proyectos: proyectos,
    minutas: minutas
  };
}
