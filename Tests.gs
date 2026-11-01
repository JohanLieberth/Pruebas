/**
 * Tests.gs - Funciones de prueba y sembrado de datos de prueba para validar el sistema
 */

var Tests = {

  /**
   * Ejecuta una serie de pruebas automatizadas en backend
   */
  ejecutarPruebas: function() {
    var resultados = [];

    function assert(cond, desc) {
      if (cond) {
        resultados.push('✅ OK: ' + desc);
        Logger.log('✅ OK: ' + desc);
      } else {
        resultados.push('❌ FALLÓ: ' + desc);
        Logger.log('❌ FALLÓ: ' + desc);
      }
    }

    try {
      // 1. Probar hash y salt
      var salt = Utils.generateSalt(16);
      var pass = 'SuperSecret123!';
      var hash1 = Utils.hashPassword(pass, salt);
      var hash2 = Utils.hashPassword(pass, salt);
      var hash3 = Utils.hashPassword('OtraPassword', salt);
      assert(hash1 === hash2, 'Hash determinista con el mismo salt');
      assert(hash1 !== hash3, 'Hash diferente para passwords distintas');

      // 2. Probar creación y validación de tokens de sesión
      var session = Auth.createSessionToken({
        userId: 'USR-TEST-123',
        email: 'test@ejemplo.com',
        name: 'Usuario Prueba',
        role: 'ClienteNormal'
      });
      assert(session && session.token, 'Token de sesión generado');
      var val = Auth.validateSession(session.token);
      assert(val && val.email === 'test@ejemplo.com', 'Sesión validada correctamente');
      Auth.invalidateSession(session.token);

      // 3. Probar generación de folio
      var folio = Ordenes.generarSiguienteFolio();
      assert(/^OS-\d{8}-\d{4}$/.test(folio), 'Folio generado con formato OS-YYYYMMDD-####: ' + folio);

      Logger.log('Pruebas unitarias completadas: ' + resultados.length + ' evaluadas.');
    } catch (e) {
      resultados.push('❌ Error inesperado en pruebas: ' + e.message);
    }

    return resultados;
  },

  /**
   * Siembra datos de prueba en TODAS las pestañas definidas en el SCHEMA.
   * Es estrictamente idempotente: detecta registros ya sembrados por IDs con prefijo TEST_ o identificadores únicos
   * y evita duplicar registros si se ejecuta dos o más veces consecutivas.
   * Utiliza LockService y registra la acción en Logs.
   */
  seedTestData: function() {
    return Utils.withScriptLock(function() {
      var ss = null;
      try {
        ss = getDbSpreadsheet();
      } catch (errDb) {
        throw new Error('seedTestData(): No se pudo conectar al Spreadsheet: ' + errDb.message);
      }

      var esquema = getEsquemaHojas();
      var pestañasFaltantes = [];
      for (var hojaNombre in esquema) {
        if (esquema.hasOwnProperty(hojaNombre) && !ss.getSheetByName(hojaNombre)) {
          pestañasFaltantes.push(hojaNombre);
        }
      }

      if (pestañasFaltantes.length > 0) {
        Logger.log('Advertencia en seedTestData: Las siguientes pestañas faltan en el Spreadsheet: ' + pestañasFaltantes.join(', ') + '. Ejecuta ensureSchema() primero.');
      }

      var reporte = {
        pestañasProcesadas: [],
        filasInsertadas: {}
      };

      var nowStr = Utils.formatDateTime();

      // 1. Pestaña: Config
      if (ss.getSheetByName(CONFIG.SHEETS.CONFIG)) {
        var sheetConfig = ss.getSheetByName(CONFIG.SHEETS.CONFIG);
        var configRows = sheetConfig.getDataRange().getValues();
        var keysExistentes = {};
        for (var c = 1; c < configRows.length; c++) {
          keysExistentes[String(configRows[c][0]).trim()] = true;
        }

        var configSeeds = [
          ['APP_NOMBRE', CONFIG.APP_NAME, 'Nombre del taller o aplicación'],
          ['PUNTOS_POR_PESO', '0.05', 'Equivalencia de puntos por cada peso pagado (5%)'],
          ['VERSION_BD', '1.0.0', 'Versión del esquema de base de datos'],
          ['MONEDA', 'MXN', 'Moneda de operación'],
          ['TEST_SEEDED', 'TRUE', 'Bandera de datos de prueba sembrados']
        ];

        var configNuevos = 0;
        configSeeds.forEach(function(row) {
          if (!keysExistentes[row[0]]) {
            sheetConfig.appendRow(row);
            configNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.CONFIG] = configNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.CONFIG);
      }

      // 2. Pestaña: UsuariosAdmin (Admin y Técnico)
      var idAdminDemo = 'TEST_ADM_001';
      var idTecnicoDemo = 'TEST_TEC_001';

      if (ss.getSheetByName(CONFIG.SHEETS.USUARIOS_ADMIN)) {
        var sheetAdmin = ss.getSheetByName(CONFIG.SHEETS.USUARIOS_ADMIN);
        var adminRows = sheetAdmin.getDataRange().getValues();
        var adminIds = {};
        var adminEmails = {};
        for (var a = 1; a < adminRows.length; a++) {
          adminIds[String(adminRows[a][0]).trim()] = true;
          adminEmails[String(adminRows[a][2]).trim().toLowerCase()] = true;
        }

        var saltAdmin = Utils.generateSalt(16);
        var hashAdmin = Utils.hashPassword('Admin123!', saltAdmin);
        var saltTec = Utils.generateSalt(16);
        var hashTec = Utils.hashPassword('Tecnico123!', saltTec);

        var adminSeeds = [
          {
            IDAdmin: idAdminDemo,
            Nombre: 'Administrador Demo PixelFix',
            Correo: 'admin@pixelfix.com',
            Telefono: '5512345678',
            PasswordHash: hashAdmin,
            PasswordSalt: saltAdmin,
            Rol: CONFIG.ROLES.ADMINISTRADOR,
            Activo: 'SI',
            FechaCreacion: nowStr,
            CreadoPor: 'Seeder'
          },
          {
            IDAdmin: idTecnicoDemo,
            Nombre: 'Carlos Mendoza (Técnico Master)',
            Correo: 'tecnico@pixelfix.com',
            Telefono: '5598765432',
            PasswordHash: hashTec,
            PasswordSalt: saltTec,
            Rol: CONFIG.ROLES.TECNICO,
            Activo: 'SI',
            FechaCreacion: nowStr,
            CreadoPor: 'Seeder'
          }
        ];

        var adminNuevos = 0;
        adminSeeds.forEach(function(row) {
          if (!adminIds[row.IDAdmin] && !adminEmails[row.Correo.toLowerCase()]) {
            Utils.appendRecord(CONFIG.SHEETS.USUARIOS_ADMIN, row);
            adminNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.USUARIOS_ADMIN] = adminNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.USUARIOS_ADMIN);
      }

      // 3. Pestaña: Usuarios (Normal y Taller)
      var idUserNormal = 'TEST_USR_NORMAL';
      var idUserTaller = 'TEST_USR_TALLER';

      if (ss.getSheetByName(CONFIG.SHEETS.USUARIOS)) {
        var sheetUsr = ss.getSheetByName(CONFIG.SHEETS.USUARIOS);
        var usrRows = sheetUsr.getDataRange().getValues();
        var usrIds = {};
        var usrEmails = {};
        for (var u = 1; u < usrRows.length; u++) {
          usrIds[String(usrRows[u][0]).trim()] = true;
          usrEmails[String(usrRows[u][3]).trim().toLowerCase()] = true;
        }

        var saltUsr1 = Utils.generateSalt(16);
        var hashUsr1 = Utils.hashPassword('Cliente123!', saltUsr1);
        var saltUsr2 = Utils.generateSalt(16);
        var hashUsr2 = Utils.hashPassword('Taller123!', saltUsr2);

        var usrSeeds = [
          {
            IDUsuario: idUserNormal,
            TipoUsuario: CONFIG.TIPOS_CLIENTE.NORMAL,
            NombreORazonSocial: 'Juan Pérez Gamer',
            Correo: 'juan.perez@ejemplo.com',
            Telefono: '5511223344',
            PasswordHash: hashUsr1,
            PasswordSalt: saltUsr1,
            PuntosActuales: 1500,
            Activo: 'SI',
            FechaRegistro: nowStr,
            UltimoAcceso: nowStr,
            CorreoVerificado: 'SI',
            Notas: 'Cliente entusiasta de consolas retro y coleccionables'
          },
          {
            IDUsuario: idUserTaller,
            TipoUsuario: CONFIG.TIPOS_CLIENTE.TALLER,
            NombreORazonSocial: 'Taller RetroConsolas del Centro',
            Correo: 'contacto@retroconsolas.mx',
            Telefono: '5533445566',
            PasswordHash: hashUsr2,
            PasswordSalt: saltUsr2,
            PuntosActuales: 3500,
            Activo: 'SI',
            FechaRegistro: nowStr,
            UltimoAcceso: nowStr,
            CorreoVerificado: 'SI',
            Notas: 'Taller distribuidor aliado con envíos por lote'
          }
        ];

        var usrNuevos = 0;
        usrSeeds.forEach(function(row) {
          if (!usrIds[row.IDUsuario] && !usrEmails[row.Correo.toLowerCase()]) {
            Utils.appendRecord(CONFIG.SHEETS.USUARIOS, row);
            usrNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.USUARIOS] = usrNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.USUARIOS);
      }

      // 4. Pestaña: ResponsablesSolidarios
      var idRespNormal = 'TEST_RSP_001';
      var idRespTaller = 'TEST_RSP_002';

      if (ss.getSheetByName(CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS)) {
        var sheetRsp = ss.getSheetByName(CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS);
        var rspRows = sheetRsp.getDataRange().getValues();
        var rspIds = {};
        for (var r = 1; r < rspRows.length; r++) {
          rspIds[String(rspRows[r][0]).trim()] = true;
        }

        var rspSeeds = [
          {
            IDResponsable: idRespNormal,
            IDUsuario: idUserNormal,
            Nombre: 'María Gómez (Hermana)',
            Telefono: '5522334455',
            Correo: 'maria.gomez@ejemplo.com',
            Relacion: 'Hermana / Familiar directo',
            Activo: 'SI',
            FechaRegistro: nowStr
          },
          {
            IDResponsable: idRespTaller,
            IDUsuario: idUserTaller,
            Nombre: 'Roberto Sánchez (Encargado Logística)',
            Telefono: '5544556677',
            Correo: 'roberto@retroconsolas.mx',
            Relacion: 'Jefe de Logística y Envíos',
            Activo: 'SI',
            FechaRegistro: nowStr
          }
        ];

        var rspNuevos = 0;
        rspSeeds.forEach(function(row) {
          if (!rspIds[row.IDResponsable]) {
            Utils.appendRecord(CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS, row);
            rspNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS] = rspNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.RESPONSABLES_SOLIDARIOS);
      }

      // 5. Pestaña: OrdenesServicio
      var idOrden1 = 'TEST_ORD_001';
      var idOrden2 = 'TEST_ORD_002';
      var folioOrden1 = 'OS-20250101-0001';
      var folioOrden2 = 'OS-20250101-0002';

      if (ss.getSheetByName(CONFIG.SHEETS.ORDENES_SERVICIO)) {
        var sheetOrd = ss.getSheetByName(CONFIG.SHEETS.ORDENES_SERVICIO);
        var ordRows = sheetOrd.getDataRange().getValues();
        var ordIds = {};
        for (var o = 1; o < ordRows.length; o++) {
          ordIds[String(ordRows[o][0]).trim()] = true;
        }

        // Orden 1: Juan Pérez (2 consolas: una entregada parcial y otra lista -> Parcial)
        // TotalEstimado: 2050, TotalCobrado: 850, Saldo: 1200, EstadoOrden: Parcial
        // Orden 2: RetroConsolas (2 consolas pendientes -> Abierta)
        var ordSeeds = [
          {
            IDOrden: idOrden1,
            Folio: folioOrden1,
            IDUsuario: idUserNormal,
            TipoUsuario: CONFIG.TIPOS_CLIENTE.NORMAL,
            NombreCliente: 'Juan Pérez Gamer',
            CorreoContacto: 'juan.perez@ejemplo.com',
            TelefonoContacto: '5511223344',
            IDResponsable: idRespNormal,
            EstadoOrden: CONFIG.ESTADOS_ORDEN.PARCIAL,
            Observaciones: 'Manejar con cuidado carcasa edición especial Zelda Tears of the Kingdom',
            TotalEstimado: 2050,
            TotalCobrado: 850,
            Saldo: 1200,
            FechaCreacion: nowStr,
            FechaActualizacion: nowStr,
            CreadoPor: 'admin@pixelfix.com'
          },
          {
            IDOrden: idOrden2,
            Folio: folioOrden2,
            IDUsuario: idUserTaller,
            TipoUsuario: CONFIG.TIPOS_CLIENTE.TALLER,
            NombreCliente: 'Taller RetroConsolas del Centro',
            CorreoContacto: 'contacto@retroconsolas.mx',
            TelefonoContacto: '5533445566',
            IDResponsable: idRespTaller,
            EstadoOrden: CONFIG.ESTADOS_ORDEN.ABIERTA,
            Observaciones: 'Lote de consolas para reacondicionamiento técnico',
            TotalEstimado: 1750,
            TotalCobrado: 0,
            Saldo: 1750,
            FechaCreacion: nowStr,
            FechaActualizacion: nowStr,
            CreadoPor: 'admin@pixelfix.com'
          }
        ];

        var ordNuevos = 0;
        ordSeeds.forEach(function(row) {
          if (!ordIds[row.IDOrden]) {
            Utils.appendRecord(CONFIG.SHEETS.ORDENES_SERVICIO, row);
            ordNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.ORDENES_SERVICIO] = ordNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.ORDENES_SERVICIO);
      }

      // 6. Pestaña: Dispositivos (Múltiples dispositivos por orden y entrega parcial)
      var idDev1 = 'TEST_DEV_001';
      var idDev2 = 'TEST_DEV_002';
      var idDev3 = 'TEST_DEV_003';
      var idDev4 = 'TEST_DEV_004';

      if (ss.getSheetByName(CONFIG.SHEETS.DISPOSITIVOS)) {
        var sheetDev = ss.getSheetByName(CONFIG.SHEETS.DISPOSITIVOS);
        var devRows = sheetDev.getDataRange().getValues();
        var devIds = {};
        for (var d = 1; d < devRows.length; d++) {
          devIds[String(devRows[d][0]).trim()] = true;
        }

        var devSeeds = [
          // Dispositivo 1: Entregado de forma parcial
          {
            IDDispositivo: idDev1,
            IDOrden: idOrden1,
            FolioOrden: folioOrden1,
            TipoDispositivo: 'Nintendo Switch OLED',
            Marca: 'Nintendo',
            Modelo: 'OLED Edición Zelda',
            NumeroSerie: 'XTW1002938475',
            Color: 'Dorado / Blanco',
            Accesorios: 'Consola y Joy-Cons acoplados',
            FallaReportada: 'Drift en palanca izquierda y falso contacto de carga',
            Diagnostico: 'Se reemplazó joystick por módulo magnético Hall Effect y se reparó pin de conector USB-C',
            Estatus: CONFIG.ESTATUS_DISPOSITIVO.ENTREGADO,
            IDTecnicoAsignado: idTecnicoDemo,
            TecnicoAsignado: 'Carlos Mendoza (Técnico Master)',
            CostoEstimado: 850,
            CostoFinal: 850,
            FechaRecepcion: nowStr,
            FechaHoraEstatus: nowStr,
            FechaEntrega: nowStr,
            EntregadoParcial: 'SI',
            Observaciones: 'Entregado al cliente con prueba de calibración'
          },
          // Dispositivo 2: Listo para entrega
          {
            IDDispositivo: idDev2,
            IDOrden: idOrden1,
            FolioOrden: folioOrden1,
            TipoDispositivo: 'PlayStation 5',
            Marca: 'Sony',
            Modelo: 'CFI-1115A Disc Edition',
            NumeroSerie: 'AK58392019482',
            Color: 'Blanco',
            Accesorios: 'Solo consola y cable HDMI',
            FallaReportada: 'Se apaga a los 15 minutos de juego',
            Diagnostico: 'Oxidación de metal líquido y obstrucción térmica en disipador. Se realizó limpieza y reaplicación',
            Estatus: CONFIG.ESTATUS_DISPOSITIVO.LISTO,
            IDTecnicoAsignado: idTecnicoDemo,
            TecnicoAsignado: 'Carlos Mendoza (Técnico Master)',
            CostoEstimado: 1200,
            CostoFinal: 1200,
            FechaRecepcion: nowStr,
            FechaHoraEstatus: nowStr,
            FechaEntrega: '',
            EntregadoParcial: 'NO',
            Observaciones: 'Superó 2 horas de estrés en Spider-Man 2'
          },
          // Dispositivo 3: En reparación
          {
            IDDispositivo: idDev3,
            IDOrden: idOrden2,
            FolioOrden: folioOrden2,
            TipoDispositivo: 'Xbox Series X',
            Marca: 'Microsoft',
            Modelo: '1TB Black',
            NumeroSerie: 'XBX0984729103',
            Color: 'Negro',
            Accesorios: 'Solo consola',
            FallaReportada: 'Sin salida de video por HDMI',
            Diagnostico: 'Filtros y puerto HDMI dañados',
            Estatus: CONFIG.ESTATUS_DISPOSITIVO.EN_REPARACION,
            IDTecnicoAsignado: idTecnicoDemo,
            TecnicoAsignado: 'Carlos Mendoza (Técnico Master)',
            CostoEstimado: 1100,
            CostoFinal: '',
            FechaRecepcion: nowStr,
            FechaHoraEstatus: nowStr,
            FechaEntrega: '',
            EntregadoParcial: 'NO',
            Observaciones: 'Esperando conector HDMI original'
          },
          // Dispositivo 4: Pendiente
          {
            IDDispositivo: idDev4,
            IDOrden: idOrden2,
            FolioOrden: folioOrden2,
            TipoDispositivo: 'PlayStation 4 Pro',
            Marca: 'Sony',
            Modelo: 'CUH-7215B',
            NumeroSerie: 'PS4P847201948',
            Color: 'Negro Mate',
            Accesorios: 'Consola y cable de poder',
            FallaReportada: 'Ruido excesivo de turbina',
            Diagnostico: 'En espera de revisión en banco técnico',
            Estatus: CONFIG.ESTATUS_DISPOSITIVO.PENDIENTE,
            IDTecnicoAsignado: idTecnicoDemo,
            TecnicoAsignado: 'Carlos Mendoza (Técnico Master)',
            CostoEstimado: 650,
            CostoFinal: '',
            FechaRecepcion: nowStr,
            FechaHoraEstatus: nowStr,
            FechaEntrega: '',
            EntregadoParcial: 'NO',
            Observaciones: 'Requiere mantenimiento general'
          }
        ];

        var devNuevos = 0;
        devSeeds.forEach(function(row) {
          if (!devIds[row.IDDispositivo]) {
            Utils.appendRecord(CONFIG.SHEETS.DISPOSITIVOS, row);
            devNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.DISPOSITIVOS] = devNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.DISPOSITIVOS);
      }

      // 7. Pestaña: HistorialEstatus
      if (ss.getSheetByName(CONFIG.SHEETS.HISTORIAL_ESTATUS)) {
        var sheetHst = ss.getSheetByName(CONFIG.SHEETS.HISTORIAL_ESTATUS);
        var hstRows = sheetHst.getDataRange().getValues();
        var hstIds = {};
        for (var h = 1; h < hstRows.length; h++) {
          hstIds[String(hstRows[h][0]).trim()] = true;
        }

        var hstSeeds = [
          {
            IDHistorial: 'TEST_HST_001',
            IDDispositivo: idDev1,
            IDOrden: idOrden1,
            EstatusAnterior: 'Pendiente',
            EstatusNuevo: 'En reparación',
            Comentario: 'Inicio de reemplazo de conector USB-C',
            UsuarioCambio: 'tecnico@pixelfix.com',
            RolUsuario: CONFIG.ROLES.TECNICO,
            FechaHora: nowStr
          },
          {
            IDHistorial: 'TEST_HST_002',
            IDDispositivo: idDev1,
            IDOrden: idOrden1,
            EstatusAnterior: 'En reparación',
            EstatusNuevo: 'Listo',
            Comentario: 'Equipo probado y cargando a 15V',
            UsuarioCambio: 'tecnico@pixelfix.com',
            RolUsuario: CONFIG.ROLES.TECNICO,
            FechaHora: nowStr
          },
          {
            IDHistorial: 'TEST_HST_003',
            IDDispositivo: idDev1,
            IDOrden: idOrden1,
            EstatusAnterior: 'Listo',
            EstatusNuevo: 'Entregado',
            Comentario: 'Entrega parcial en mostrador al titular',
            UsuarioCambio: 'admin@pixelfix.com',
            RolUsuario: CONFIG.ROLES.ADMINISTRADOR,
            FechaHora: nowStr
          }
        ];

        var hstNuevos = 0;
        hstSeeds.forEach(function(row) {
          if (!hstIds[row.IDHistorial]) {
            Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_ESTATUS, row);
            hstNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.HISTORIAL_ESTATUS] = hstNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.HISTORIAL_ESTATUS);
      }

      // 8. Pestaña: HistorialCostos
      if (ss.getSheetByName(CONFIG.SHEETS.HISTORIAL_COSTOS)) {
        var sheetHcs = ss.getSheetByName(CONFIG.SHEETS.HISTORIAL_COSTOS);
        var hcsRows = sheetHcs.getDataRange().getValues();
        var hcsIds = {};
        for (var c = 1; c < hcsRows.length; c++) {
          hcsIds[String(hcsRows[c][0]).trim()] = true;
        }

        var hcsSeeds = [
          {
            IDHistorialCosto: 'TEST_HCS_001',
            IDDispositivo: idDev1,
            CostoAnterior: 0,
            CostoNuevo: 850,
            Motivo: 'Presupuesto inicial estimado al ingreso',
            UsuarioCambio: 'admin@pixelfix.com',
            FechaHora: nowStr
          },
          {
            IDHistorialCosto: 'TEST_HCS_002',
            IDDispositivo: idDev2,
            CostoAnterior: 1000,
            CostoNuevo: 1200,
            Motivo: 'Ajuste de costo por requerimiento de metal líquido de alta gama',
            UsuarioCambio: 'admin@pixelfix.com',
            FechaHora: nowStr
          }
        ];

        var hcsNuevos = 0;
        hcsSeeds.forEach(function(row) {
          if (!hcsIds[row.IDHistorialCosto]) {
            Utils.appendRecord(CONFIG.SHEETS.HISTORIAL_COSTOS, row);
            hcsNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.HISTORIAL_COSTOS] = hcsNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.HISTORIAL_COSTOS);
      }

      // 9. Pestaña: RecompensasPuntos (Catálogo de recompensas)
      if (ss.getSheetByName(CONFIG.SHEETS.RECOMPENSAS_PUNTOS)) {
        var sheetRec = ss.getSheetByName(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
        var recRows = sheetRec.getDataRange().getValues();
        var recIds = {};
        for (var rp = 1; rp < recRows.length; rp++) {
          recIds[String(recRows[rp][0]).trim()] = true;
        }

        var recSeeds = [
          { IDRecompensa: 'REC-001', Nombre: 'Limpieza profunda de control / mando', PuntosRequeridos: 500, Descripcion: 'Mantenimiento preventivo, desinfección y lubricación de palancas', Activo: 'SI', Orden: 1 },
          { IDRecompensa: 'REC-002', Nombre: 'Reemplazo de palanca / Joystick Hall Effect', PuntosRequeridos: 1000, Descripcion: 'Cambio de mecanismo análogo por sensor magnético anti-drift', Activo: 'SI', Orden: 2 },
          { IDRecompensa: 'REC-003', Nombre: 'Reparación menor / Conector HDMI / Botón', PuntosRequeridos: 1000, Descripcion: 'Reparación de puerto, switch de encendido o soldadura menor', Activo: 'SI', Orden: 3 },
          { IDRecompensa: 'REC-004', Nombre: 'Mantenimiento preventivo de consola', PuntosRequeridos: 2000, Descripcion: 'Cambio de pasta térmica de alta conductividad, metal líquido y limpieza de disipador', Activo: 'SI', Orden: 4 },
          { IDRecompensa: 'REC-005', Nombre: 'Reballing / Reparación de circuito de carga', PuntosRequeridos: 3500, Descripcion: 'Reparación especializada de IC de administración de energía o chip de video', Activo: 'SI', Orden: 5 }
        ];

        var recNuevos = 0;
        recSeeds.forEach(function(row) {
          if (!recIds[row.IDRecompensa]) {
            Utils.appendRecord(CONFIG.SHEETS.RECOMPENSAS_PUNTOS, row);
            recNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.RECOMPENSAS_PUNTOS] = recNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.RECOMPENSAS_PUNTOS);
      }

      // 10. Pestaña: PuntosMovimientos (Asignaciones y canjes consistentes con saldos)
      if (ss.getSheetByName(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS)) {
        var sheetMov = ss.getSheetByName(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS);
        var movRows = sheetMov.getDataRange().getValues();
        var movIds = {};
        for (var m = 1; m < movRows.length; m++) {
          movIds[String(movRows[m][0]).trim()] = true;
        }

        var movSeeds = [
          // Juan Pérez: Saldo 0 -> +2500 (Asignación) -> -1000 (Canje palanca) -> Saldo 1500
          {
            IDMovimiento: 'TEST_MOV_001',
            IDUsuario: idUserNormal,
            Correo: 'juan.perez@ejemplo.com',
            Telefono: '5511223344',
            TipoMovimiento: CONFIG.TIPOS_MOVIMIENTO_PUNTOS.ASIGNACION,
            Puntos: 2500,
            SaldoAnterior: 0,
            SaldoNuevo: 2500,
            Motivo: 'Puntos por reparación de consolas previas y bienvenida',
            IDOrden: idOrden1,
            IDDispositivo: idDev1,
            UsuarioAdmin: 'admin@pixelfix.com',
            FechaHora: nowStr
          },
          {
            IDMovimiento: 'TEST_MOV_002',
            IDUsuario: idUserNormal,
            Correo: 'juan.perez@ejemplo.com',
            Telefono: '5511223344',
            TipoMovimiento: CONFIG.TIPOS_MOVIMIENTO_PUNTOS.CANJE,
            Puntos: -1000,
            SaldoAnterior: 2500,
            SaldoNuevo: 1500,
            Motivo: 'Canje de recompensa: Reemplazo de palanca / Joystick Hall Effect',
            IDOrden: '',
            IDDispositivo: '',
            UsuarioAdmin: 'admin@pixelfix.com',
            FechaHora: nowStr
          },
          // Taller RetroConsolas: Saldo 0 -> +3500 (Asignación lote) -> Saldo 3500
          {
            IDMovimiento: 'TEST_MOV_003',
            IDUsuario: idUserTaller,
            Correo: 'contacto@retroconsolas.mx',
            Telefono: '5533445566',
            TipoMovimiento: CONFIG.TIPOS_MOVIMIENTO_PUNTOS.ASIGNACION,
            Puntos: 3500,
            SaldoAnterior: 0,
            SaldoNuevo: 3500,
            Motivo: 'Bonificación por volumen y convenio de taller comercial',
            IDOrden: idOrden2,
            IDDispositivo: '',
            UsuarioAdmin: 'admin@pixelfix.com',
            FechaHora: nowStr
          }
        ];

        var movNuevos = 0;
        movSeeds.forEach(function(row) {
          if (!movIds[row.IDMovimiento]) {
            Utils.appendRecord(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS, row);
            movNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.PUNTOS_MOVIMIENTOS] = movNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.PUNTOS_MOVIMIENTOS);
      }

      // 11. Pestaña: EtiquetasNFC
      if (ss.getSheetByName(CONFIG.SHEETS.ETIQUETAS_NFC)) {
        var sheetNfc = ss.getSheetByName(CONFIG.SHEETS.ETIQUETAS_NFC);
        var nfcRows = sheetNfc.getDataRange().getValues();
        var nfcIds = {};
        for (var nf = 1; nf < nfcRows.length; nf++) {
          nfcIds[String(nfcRows[nf][0]).trim()] = true;
        }

        var nfcSeeds = [
          {
            IDNFC: 'TEST_NFC_001',
            CodigoNFC: '04A23B5F80',
            IDUsuario: idUserNormal,
            Activo: 'SI',
            FechaAsignacion: nowStr,
            AsignadoPor: 'admin@pixelfix.com'
          },
          {
            IDNFC: 'TEST_NFC_002',
            CodigoNFC: '0411223344',
            IDUsuario: idUserTaller,
            Activo: 'SI',
            FechaAsignacion: nowStr,
            AsignadoPor: 'admin@pixelfix.com'
          }
        ];

        var nfcNuevos = 0;
        nfcSeeds.forEach(function(row) {
          if (!nfcIds[row.IDNFC]) {
            Utils.appendRecord(CONFIG.SHEETS.ETIQUETAS_NFC, row);
            nfcNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.ETIQUETAS_NFC] = nfcNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.ETIQUETAS_NFC);
      }

      // 12. Pestaña: CorreosLog
      if (ss.getSheetByName(CONFIG.SHEETS.CORREOS_LOG)) {
        var sheetEml = ss.getSheetByName(CONFIG.SHEETS.CORREOS_LOG);
        var emlRows = sheetEml.getDataRange().getValues();
        var emlIds = {};
        for (var em = 1; em < emlRows.length; em++) {
          emlIds[String(emlRows[em][0]).trim()] = true;
        }

        var emlSeeds = [
          {
            IDCorreo: 'TEST_EML_001',
            Destinatario: 'juan.perez@ejemplo.com',
            Asunto: '¡Bienvenido a PixelFix! Confirmación de registro de cuenta',
            Estado: 'ENVIADO',
            FechaHora: nowStr,
            Error: ''
          },
          {
            IDCorreo: 'TEST_EML_002',
            Destinatario: 'contacto@retroconsolas.mx',
            Asunto: '¡Bienvenido a PixelFix! Confirmación de registro de cuenta',
            Estado: 'ENVIADO',
            FechaHora: nowStr,
            Error: ''
          }
        ];

        var emlNuevos = 0;
        emlSeeds.forEach(function(row) {
          if (!emlIds[row.IDCorreo]) {
            Utils.appendRecord(CONFIG.SHEETS.CORREOS_LOG, row);
            emlNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.CORREOS_LOG] = emlNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.CORREOS_LOG);
      }

      // 13. Pestaña: Logs
      if (ss.getSheetByName(CONFIG.SHEETS.LOGS)) {
        var sheetLog = ss.getSheetByName(CONFIG.SHEETS.LOGS);
        var logRows = sheetLog.getDataRange().getValues();
        var logIds = {};
        for (var lg = 1; lg < logRows.length; lg++) {
          logIds[String(logRows[lg][0]).trim()] = true;
        }

        var logSeeds = [
          {
            IDLog: 'TEST_LOG_001',
            Accion: 'SEED_TEST_DATA',
            Detalle: 'Siembra de datos de prueba completos en todas las pestañas de PixelFix',
            Usuario: 'Seeder',
            FechaHora: nowStr
          }
        ];

        var logNuevos = 0;
        logSeeds.forEach(function(row) {
          if (!logIds[row.IDLog]) {
            Utils.appendRecord(CONFIG.SHEETS.LOGS, row);
            logNuevos++;
          }
        });
        reporte.filasInsertadas[CONFIG.SHEETS.LOGS] = logNuevos;
        reporte.pestañasProcesadas.push(CONFIG.SHEETS.LOGS);
      }

      Utils.logAction('SEED_TEST_DATA_COMPLETE', 'Datos de prueba sembrados exitosamente en ' + reporte.pestañasProcesadas.length + ' pestañas.', 'Seeder');

      SpreadsheetApp.flush();
      Logger.log('seedTestData completado exitosamente: ' + JSON.stringify(reporte));
      return {
        success: true,
        reporte: reporte,
        message: 'Datos de prueba sembrados exitosamente en todas las pestañas sin duplicaciones.'
      };
    });
  },

  /**
   * Alias de compatibilidad hacia seedTestData
   */
  sembrarDatosDeEjemplo: function() {
    return Tests.seedTestData();
  }
};

/**
 * Función global expuesta para ejecutar la siembra de datos de prueba desde Apps Script
 */
function seedTestData() {
  return Tests.seedTestData();
}
