/**
 * Tests.gs - Funciones de prueba para verificar flujos backend sin interfaz
 * Permite poblar datos de ejemplo y validar la integridad del sistema
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
   * Siembra datos de demostración para realizar pruebas de interfaz completas
   */
  sembrarDatosDeEjemplo: function() {
    Logger.log('Iniciando siembra de datos de ejemplo...');

    // 1. Crear un técnico de ejemplo
    var adminData = Utils.getAllRecords(CONFIG.SHEETS.USUARIOS_ADMIN);
    var tecExiste = adminData.filter(function(a) { return a.Rol === CONFIG.ROLES.TECNICO; });
    var tecId = null;
    var tecNombre = 'Carlos Mendoza (Técnico)';

    if (tecExiste.length === 0) {
      var salt = Utils.generateSalt(16);
      var hash = Utils.hashPassword('Tecnico123!', salt);
      tecId = Utils.generateId('TEC');
      Utils.appendRecord(CONFIG.SHEETS.USUARIOS_ADMIN, {
        IDAdmin: tecId,
        Nombre: tecNombre,
        Correo: 'tecnico@pixelfix.com',
        Telefono: '5598765432',
        PasswordHash: hash,
        PasswordSalt: salt,
        Rol: CONFIG.ROLES.TECNICO,
        Activo: 'SI',
        FechaCreacion: Utils.formatDateTime(),
        CreadoPor: 'DemoSetup'
      });
      Logger.log('Técnico demo creado: tecnico@pixelfix.com / Tecnico123!');
    } else {
      tecId = tecExiste[0].IDAdmin;
      tecNombre = tecExiste[0].Nombre;
    }

    // 2. Crear clientes demo (Normal y Taller)
    var saltCli = Utils.generateSalt(16);
    var hashCli = Utils.hashPassword('Cliente123!', saltCli);

    var cliNormal = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'Correo', 'juan.perez@ejemplo.com');
    var idCliNormal = null;
    if (!cliNormal) {
      idCliNormal = Utils.generateId('USR');
      Utils.appendRecord(CONFIG.SHEETS.USUARIOS, {
        IDUsuario: idCliNormal,
        TipoUsuario: CONFIG.TIPOS_CLIENTE.NORMAL,
        NombreORazonSocial: 'Juan Pérez Gamer',
        Correo: 'juan.perez@ejemplo.com',
        Telefono: '5511223344',
        PasswordHash: hashCli,
        PasswordSalt: saltCli,
        PuntosActuales: 1500,
        Activo: 'SI',
        FechaRegistro: Utils.formatDateTime(),
        UltimoAcceso: Utils.formatDateTime(),
        CorreoVerificado: 'SI',
        Notas: 'Cliente recurrente coleccionista'
      });

      // Agregar responsable solidario
      Usuarios.agregarResponsable(idCliNormal, {
        nombre: 'María Gómez (Hermana)',
        telefono: '5522334455',
        correo: 'maria.gomez@ejemplo.com',
        relacion: 'Hermana / Familiar directo'
      });
    } else {
      idCliNormal = cliNormal.IDUsuario;
    }

    var cliTaller = Utils.findRecordBy(CONFIG.SHEETS.USUARIOS, 'Correo', 'contacto@retroconsolas.mx');
    var idCliTaller = null;
    if (!cliTaller) {
      idCliTaller = Utils.generateId('USR');
      Utils.appendRecord(CONFIG.SHEETS.USUARIOS, {
        IDUsuario: idCliTaller,
        TipoUsuario: CONFIG.TIPOS_CLIENTE.TALLER,
        NombreORazonSocial: 'Taller RetroConsolas del Centro',
        Correo: 'contacto@retroconsolas.mx',
        Telefono: '5533445566',
        PasswordHash: hashCli,
        PasswordSalt: saltCli,
        PuntosActuales: 4200,
        Activo: 'SI',
        FechaRegistro: Utils.formatDateTime(),
        UltimoAcceso: Utils.formatDateTime(),
        CorreoVerificado: 'SI',
        Notas: 'Taller aliado distribuidor'
      });

      // Agregar responsable solidario de taller
      Usuarios.agregarResponsable(idCliTaller, {
        nombre: 'Roberto Sánchez (Encargado de Envíos)',
        telefono: '5544556677',
        correo: 'roberto@retroconsolas.mx',
        relacion: 'Jefe de Logística'
      });
    } else {
      idCliTaller = cliTaller.IDUsuario;
    }

    // 3. Crear una orden demo multi-dispositivo para Juan Pérez
    var ordenesJuan = Utils.findAllRecordsBy(CONFIG.SHEETS.ORDENES_SERVICIO, 'IDUsuario', idCliNormal);
    if (ordenesJuan.length === 0) {
      Ordenes.crearOrden({
        idUsuario: idCliNormal,
        tipoUsuario: CONFIG.TIPOS_CLIENTE.NORMAL,
        nombreCliente: 'Juan Pérez Gamer',
        correoContacto: 'juan.perez@ejemplo.com',
        telefonoContacto: '5511223344',
        observaciones: 'Llevar especial cuidado con la carcasa edición especial Zelda',
        dispositivos: [
          {
            tipoDispositivo: 'Nintendo Switch OLED',
            marca: 'Nintendo',
            modelo: 'OLED Edición Zelda Tears of the Kingdom',
            numeroSerie: 'XTW1002938475',
            color: 'Dorado / Blanco',
            accesorios: 'Consola con Joy-Cons acoplados',
            fallaReportada: 'Drift severo en palanca izquierda y no carga por USB-C',
            costoEstimado: 850,
            idTecnicoAsignado: tecId,
            tecnicoAsignado: tecNombre
          },
          {
            tipoDispositivo: 'PlayStation 5',
            marca: 'Sony',
            modelo: 'Disc Edition (CFI-1115A)',
            numeroSerie: 'AK58392019482',
            color: 'Blanco',
            accesorios: 'Solo consola y cable HDMI',
            fallaReportada: 'Se apaga a los 15 minutos de jugar juegos de PS5 (posible sobrecalentamiento de metal líquido)',
            costoEstimado: 1200,
            idTecnicoAsignado: tecId,
            tecnicoAsignado: tecNombre
          }
        ]
      }, { email: 'admin@pixelfix.com', role: CONFIG.ROLES.ADMINISTRADOR });
      Logger.log('Orden multi-dispositivo demo para Juan Pérez creada.');
    }

    // 4. Crear una orden demo multi-dispositivo para Taller RetroConsolas
    var ordenesTaller = Utils.findAllRecordsBy(CONFIG.SHEETS.ORDENES_SERVICIO, 'IDUsuario', idCliTaller);
    if (ordenesTaller.length === 0) {
      Ordenes.crearOrden({
        idUsuario: idCliTaller,
        tipoUsuario: CONFIG.TIPOS_CLIENTE.TALLER,
        nombreCliente: 'Taller RetroConsolas del Centro',
        correoContacto: 'contacto@retroconsolas.mx',
        telefonoContacto: '5533445566',
        observaciones: 'Lote de consolas para reacondicionamiento comercial',
        dispositivos: [
          {
            tipoDispositivo: 'Xbox Series X',
            marca: 'Microsoft',
            modelo: '1TB Black',
            numeroSerie: 'XBX0984729103',
            color: 'Negro',
            accesorios: 'Solo consola',
            fallaReportada: 'Sin salida de video por conector HDMI roto',
            costoEstimado: 1100,
            idTecnicoAsignado: tecId,
            tecnicoAsignado: tecNombre
          },
          {
            tipoDispositivo: 'PlayStation 4 Pro',
            marca: 'Sony',
            modelo: 'CUH-7215B',
            numeroSerie: 'PS4P847201948',
            color: 'Negro Mate',
            accesorios: 'Consola y cable de poder',
            fallaReportada: 'Ventilador suena como turbina de avión, requiere mantenimiento térmico y cambio de pads',
            costoEstimado: 650,
            idTecnicoAsignado: tecId,
            tecnicoAsignado: tecNombre
          },
          {
            tipoDispositivo: 'Steam Deck',
            marca: 'Valve',
            modelo: '512GB NVMe LCD',
            numeroSerie: 'FX84920183018',
            color: 'Negro',
            accesorios: 'Estuche oficial original y cargador 45W',
            fallaReportada: 'Gatillo R2 pegado y batería no pasa del 10%',
            costoEstimado: 1400,
            idTecnicoAsignado: tecId,
            tecnicoAsignado: tecNombre
          }
        ]
      }, { email: 'admin@pixelfix.com', role: CONFIG.ROLES.ADMINISTRADOR });
      Logger.log('Lote multi-dispositivo de taller demo creado.');
    }

    Logger.log('Siembra de datos de ejemplo finalizada con éxito.');
    return {
      success: true,
      message: 'Datos de prueba sembrados correctamente.'
    };
  }
};
