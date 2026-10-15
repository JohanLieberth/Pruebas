/**
 * Backend Helper extra para inicializar datos requeridos por los formularios frontend.
 */

/**
 * Retorna datos requeridos para inicializar la pantalla de creación de Minuta.
 */
function obtenerDatosMinutaIniciales() {
  return {
    catalogos: obtenerCatalogos(),
    proyectos: listarProyectosActivos()
  };
}
