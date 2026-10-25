/**
 * Backend Helper extra para inicializar datos requeridos por los formularios frontend.
 */

/**
 * Retorna datos requeridos para inicializar la pantalla de creación de Minuta.
 */
function obtenerDatosMinutaIniciales() {
  try {
    return {
      catalogos: obtenerCatalogos() || {},
      proyectos: listarProyectosActivos() || []
    };
  } catch (e) {
    console.error("Error en obtenerDatosMinutaIniciales: " + e.toString());
    return {
      catalogos: {},
      proyectos: []
    };
  }
}
