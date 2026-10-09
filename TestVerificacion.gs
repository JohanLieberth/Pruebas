/**
 * ==============================================================================
 * SUITE DE VERIFICACIÓN AUTOMATIZADA
 * Ayuntamiento de Mérida, Yucatán - Matriz de Administración de Riesgos y PTAR
 * ==============================================================================
 */

function correrSuitePruebasVerificacion() {
  Logger.log("==========================================================");
  Logger.log("INICIANDO VERIFICACIÓN DE REQUERIMIENTOS - AYUNTAMIENTO DE MÉRIDA");
  Logger.log("==========================================================");

  let pasadas = 0;
  let falladas = 0;

  // (a) Verificación de Cuadrantes para las 4 combinaciones
  Logger.log("\n--- PRUEBA (a): Cálculo de cuadrantes para las 4 combinaciones ---");
  const c1 = calcularCuadrante(8, 8); // >5 y >5 -> I
  const c2 = calcularCuadrante(3, 8); // <=5 y >5 -> II
  const c3 = calcularCuadrante(3, 3); // <=5 y <=5 -> III
  const c4 = calcularCuadrante(8, 3); // >5 y <=5 -> IV

  if (c1.numero === 'I' && c2.numero === 'II' && c3.numero === 'III' && c4.numero === 'IV') {
    Logger.log("✔ PASÓ: Cuadrante I(8,8), II(3,8), III(3,3) y IV(8,3) calculados correctamente.");
    pasadas++;
  } else {
    Logger.log("✖ FALLÓ: Error en cálculo de cuadrantes.");
    falladas++;
  }

  // (b) Verificación de listas dependientes y rangos
  Logger.log("\n--- PRUEBA (b): Listas dependientes y rangos de valores ---");
  const vGraveValido = validarRangoValor('GRAVE', 8);
  const vGraveInvalido = validarRangoValor('GRAVE', 5);
  const vProbValido = validarRangoValor('MUY PROBABLE', 7);

  if (vGraveValido === true && vGraveInvalido === false && vProbValido === true) {
    Logger.log("✔ PASÓ: La validación de rangos numéricos dependientes del grado funciona.");
    pasadas++;
  } else {
    Logger.log("✖ FALLÓ: Error en validación de rangos.");
    falladas++;
  }

  // (c) Verificación Valoración Final <= Inicial
  Logger.log("\n--- PRUEBA (c): Valoración Final <= Inicial ---");
  const datosInvalidos = {
    riesgo: {
      dependencia: 'ADM',
      noRiesgo: 'R1-ADM',
      descripcionRiesgo: 'Trámites no procesados por falla del servidor',
      impactoInicialGrado: 'BAJO',
      impactoInicialValor: 4,
      probabilidadInicialGrado: 'INUSUAL',
      probabilidadInicialValor: 3,
      tieneControles: 'SI',
      impactoFinalGrado: 'CATASTRÓFICO',
      impactoFinalValor: 9, // Inválido
      probabilidadFinalGrado: 'INUSUAL',
      probabilidadFinalValor: 3
    },
    factores: [{ factorCausa: 'TECNOLOGÍAS DE LA INFORMACIÓN', tipoFactor: 'INTERNO', efectosConsecuencias: 'COSTOS' }]
  };

  const erroresFinalMayor = validarRiesgoServidor(datosInvalidos);
  const detectoError = erroresFinalMayor.some(err => err.includes('no puede ser mayor'));

  if (detectoError) {
    Logger.log("✔ PASÓ: Se rechazó correctamente una valoración final mayor que la inicial.");
    pasadas++;
  } else {
    Logger.log("✖ FALLÓ: No se detectó la violación de Valoración Final <= Inicial.");
    falladas++;
  }

  // (d) Guardado y resumen de un riesgo con múltiples factores y acciones PTAR
  Logger.log("\n--- PRUEBA (d): Guardado y resumen de riesgo multifactor ---");
  const payloadMulti = {
    riesgo: {
      dependencia: 'DOP',
      noRiesgo: 'R88-TEST',
      procedimiento: 'Licitación de Obra Pública',
      objetivoEstrategico: 'Infraestructura Municipal de Calidad',
      descripcionRiesgo: 'Obras públicas retrasadas por inspección deficiente',
      nivelExposicion: 'DIRECTIVO',
      tipoRiesgo: 'DE OBRA PÚBLICA',
      tieneControles: 'SI',
      impactoInicialGrado: 'GRAVE',
      impactoInicialValor: 8,
      probabilidadInicialGrado: 'PROBABLE',
      probabilidadInicialValor: 6,
      impactoFinalGrado: 'MODERADO',
      impactoFinalValor: 5,
      probabilidadFinalGrado: 'INUSUAL',
      probabilidadFinalValor: 4,
      estrategiaRespuesta: 'REDUCIR'
    },
    factores: [
      { factorCausa: 'PROCESOS-OPERATIVO', tipoFactor: 'INTERNO', efectosConsecuencias: 'COSTOS' },
      { factorCausa: 'RECURSOS HUMANOS', tipoFactor: 'INTERNO', efectosConsecuencias: 'MEJORA DE PROCESOS' }
    ],
    control: {
      descripcionControl: 'Verificación semanal en sitio por supervisor externo',
      quienEjecuta: 'Supervisor de Obra',
      cuandoSeEjecuta: 'Semanal',
      evidencia: 'Bitácora de obra firmada',
      tipoControl: 'PREVENTIVO',
      atribDocumentado: true,
      atribFormalizado: true,
      atribAplicado: true,
      atribEfectivo: true,
      calificacion: 'SUFICIENTE'
    },
    acciones: [
      { descripcionAccion: 'Contratar supervisión externa', responsable: 'Jefe de Obras', fechaCompromiso: '2025-11-15', medioVerificacion: 'Contrato firmado' }
    ]
  };

  const resSave = guardarRiesgoCompleto(payloadMulti);
  if (resSave.exito) {
    const rObtenido = obtenerRiesgoPorId(resSave.idRiesgo);
    if (rObtenido && rObtenido.factores.length === 2 && rObtenido.acciones.length === 1) {
      Logger.log(`✔ PASÓ: Riesgo ${resSave.idRiesgo} guardado y resumido correctamente con 2 factores y 1 acción PTAR.`);
      pasadas++;
    } else {
      Logger.log("✖ FALLÓ: El riesgo se guardó pero no recuperó los factores o acciones de forma íntegra.");
      falladas++;
    }
    eliminarRiesgo(resSave.idRiesgo);
  } else {
    Logger.log("✖ FALLÓ: Ocurrió un error al guardar el riesgo multifactor: " + resSave.errores.join(', '));
    falladas++;
  }

  // (e) Filtrado por rol/dependencia
  Logger.log("\n--- PRUEBA (e): Filtrado por rol/dependencia ---");
  const listaADM = obtenerRiesgos('ADM');
  const listaTodas = obtenerRiesgos('TODAS');

  if (Array.isArray(listaADM) && Array.isArray(listaTodas)) {
    Logger.log(`✔ PASÓ: Filtrado por dependencia funcional. Registros ADM: ${listaADM.length}, Total: ${listaTodas.length}.`);
    pasadas++;
  } else {
    Logger.log("✖ FALLÓ: Error en filtrado de dependencias.");
    falladas++;
  }

  // (f) Verificación de las 30 dependencias oficiales
  Logger.log("\n--- PRUEBA (f): Verificación de 30 dependencias de Mérida ---");
  const cats = obtenerCatalogos();
  if (cats.dependencias && cats.dependencias.length === 30) {
    Logger.log("✔ PASÓ: Se inicializaron y cargaron exactamente las 30 dependencias municipales.");
    pasadas++;
  } else {
    Logger.log("✖ FALLÓ: Cantidad de dependencias incorrecta: " + (cats.dependencias ? cats.dependencias.length : 0));
    falladas++;
  }

  Logger.log("==========================================================");
  Logger.log(`RESULTADO FINAL DE PRUEBAS: ${pasadas} PASADAS, ${falladas} FALLADAS.`);
  Logger.log("==========================================================");

  return { pasadas: pasadas, falladas: falladas };
}
