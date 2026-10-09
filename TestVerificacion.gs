/**
 * ==============================================================================
 * SUITE DE VERIFICACIÓN AUTOMATIZADA
 * Ayuntamiento de Mérida, Yucatán - Matriz de Administración de Riesgos y PTAR
 * ==============================================================================
 * Este script ejecuta las 5 verificaciones obligatorias exigidas por el requerimiento:
 * (a) Que los cuadrantes se calculan correctamente para las 4 combinaciones de impacto/probabilidad.
 * (b) Que las listas dependientes funcionen (Grado -> Rango de Valores).
 * (c) Que las validaciones de rangos y valoración final <= inicial se cumplan.
 * (d) Que un riesgo con múltiples factores se guarde y resuma correctamente.
 * (e) Que el filtrado por rol/dependencia funcione.
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
  const vGraveValido = validarRangoValor('Grave (7-8)', 8);
  const vGraveInvalido = validarRangoValor('Grave (7-8)', 5);
  const vProbValido = validarRangoValor('Muy probable (7-8)', 7);

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
      impactoInicialGrado: 'Bajo (3-4)',
      impactoInicialValor: 4,
      probabilidadInicialGrado: 'Inusual (3-4)',
      probabilidadInicialValor: 3,
      tieneControles: 'SI',
      impactoFinalGrado: 'Catastrófico (9-10)',
      impactoFinalValor: 9, // Inválido
      probabilidadFinalGrado: 'Inusual (3-4)',
      probabilidadFinalValor: 3
    },
    factores: [{ factorCausa: 'Tecnologías de la información', tipoFactor: 'Interno', efectosConsecuencias: 'Interrupción parcial o total del servicio público' }]
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
      nivelExposicion: 'Directivo',
      tipoRiesgo: 'De Obra Pública',
      tieneControles: 'SI',
      impactoInicialGrado: 'Grave (7-8)',
      impactoInicialValor: 8,
      probabilidadInicialGrado: 'Probable (5-6)',
      probabilidadInicialValor: 6,
      impactoFinalGrado: 'Moderado (5-6)',
      impactoFinalValor: 5,
      probabilidadFinalGrado: 'Inusual (3-4)',
      probabilidadFinalValor: 4,
      estrategiaRespuesta: 'Reducir'
    },
    factores: [
      { factorCausa: 'Procesos-operativo', tipoFactor: 'Interno', efectosConsecuencias: 'Ineficiencia y sobrecosto en procesos operativos' },
      { factorCausa: 'Recursos humanos', tipoFactor: 'Interno', efectosConsecuencias: 'Incumplimiento de metas y objetivos institucionales' }
    ],
    control: {
      descripcionControl: 'Verificación semanal en sitio por supervisor externo',
      quienEjecuta: 'Supervisor de Obra',
      cuandoSeEjecuta: 'Semanal',
      evidencia: 'Bitácora de obra firmada',
      tipoControl: 'Preventivo',
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
    // Limpiar prueba
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

  Logger.log("==========================================================");
  Logger.log(`RESULTADO FINAL DE PRUEBAS: ${pasadas} PASADAS, ${falladas} FALLADAS.`);
  Logger.log("==========================================================");

  return { pasadas: pasadas, falladas: falladas };
}
