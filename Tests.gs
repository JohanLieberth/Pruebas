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
    // Prueba de Siglas
    console.log("Siglas Gobernación:", getSiglas("Gobernación")); // GOB
    console.log("Siglas Bienestar Humano:", getSiglas("Bienestar Humano")); // BIH
    console.log("Siglas Innovación y Gobierno Inteligente:", getSiglas("Innovación y Gobierno Inteligente")); // IGI
    console.log("Siglas con StopWords:", getSiglas("Dirección de Administración")); // ADM

    const code = generateDocCode({
      tipo: "Política",
      direccion: "Dirección de Administración",
      departamento: "Departamento de Nómina"
    });
    console.log("Código generado:", code);
    // ADM (de Administración) / NOM (de Nómina)
    if (code.startsWith("PL-ADM/NOM-01")) {
      console.log("✅ Prueba generateDocCode exitosa.");
    } else {
      console.error("❌ Prueba generateDocCode fallida. Código inesperado:", code);
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
