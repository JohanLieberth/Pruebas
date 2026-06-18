/**
 * Initialization and Menu setup for Xplore 2026
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Xplore 2026')
    .addItem('🚀 Inicializar Sistema', 'runInitialization')
    .addSeparator()
    .addItem('📊 Abrir Panel Admin', 'openAdminLink')
    .addToUi();
}

function runInitialization() {
  const result = initializeSystem(); // Call from Code.gs
  SpreadsheetApp.getUi().alert(result);
}

function openAdminLink() {
  const url = ScriptApp.getService().getUrl() + '?p=admin';
  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <p>El panel de administración está disponible en:</p>
      <a href="${url}" target="_blank" style="word-break: break-all;">${url}</a>
      <p style="margin-top: 20px; font-size: 0.9em; color: #666;">Asegúrate de haber desplegado la aplicación como "Web App" primero.</p>
    </div>
  `;
  const userInterface = HtmlService.createHtmlOutput(html)
      .setWidth(450)
      .setHeight(200)
      .setTitle('Enlace Panel Admin');
  SpreadsheetApp.getUi().showModalDialog(userInterface, 'Panel Admin');
}
