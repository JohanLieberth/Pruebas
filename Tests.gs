/**
 * Tests para la lógica de servidor.
 */
function runTests() {
  const testData = {
    coordinacion: "COOR1",
    direccion: "DIR2",
    subdireccion: "SUB3",
    departamento: "DEP4",
    tipo: "Proceso"
  };

  console.log("--- Iniciando Pruebas ---");

  try {
    const code = generateDocCode(testData);
    console.log("Código generado:", code);
    if (code.startsWith("COOR1-DIR2-SUB3-DEP4-PRO-")) {
      console.log("✅ Prueba generateDocCode exitosa.");
    } else {
      console.error("❌ Prueba generateDocCode fallida. Código inesperado.");
    }
  } catch (e) {
    console.error("❌ Error en prueba generateDocCode:", e);
  }

  try {
    const catalogs = getCatalogs();
    if (catalogs.coords && catalogs.dirs && catalogs.subs) {
       console.log("✅ Prueba getCatalogs exitosa.");
    } else {
       console.error("❌ Prueba getCatalogs fallida.");
    }
  } catch (e) {
    console.error("❌ Error en prueba getCatalogs:", e);
  }

  try {
    const docs = getDocuments();
    console.log("✅ Prueba getDocuments exitosa. Total recuperado:", docs.length);
  } catch (e) {
    console.error("❌ Error en prueba getDocuments:", e);
  }

  console.log("--- Pruebas Finalizadas ---");
}
