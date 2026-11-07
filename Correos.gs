/**
 * Correos.gs - Envío de notificaciones por correo electrónico y bitácora en CorreosLog
 * Reutiliza la configuración global del taller (Logo, Nombre, Aviso Legal de Ticket).
 */

var Correos = {

  /**
   * Obtiene la configuración del taller para encabezados y pies de correo
   */
  obtenerConfiguracionTaller: function() {
    var nombre = 'PixelFix - Taller de Consolas';
    var logoUrl = '';
    var leyendaTicket = 'DISPOSITIVO CON AVISO DE RECOLECCIÓN, DESPUES DE 30 DIAS, NO NOS HACEMOS RESPONSABLES DEL EQUIPO. EQUIPO MOJADO O CON DAÑOS DE HUMEDAD NO TIENE GARANTIA. EN REPARACIONES LA GARANTIA ES DE 15 DIAS SOBRE LA PIEZA CAMBIADA, APLICA RESTRICCIONES. TRABAJO DE MANTENIMIENTO NO APLICA GARANTIA. PUEDE COMUNICARSE AL 9999693251 PARA INFORMACION DE LUNES A SABADO DE 10 AM A 7 PM.';

    try {
      if (typeof Utils !== 'undefined' && Utils.getAllConfigValues) {
        var vals = Utils.getAllConfigValues();
        if (vals.NOMBRE_TALLER && String(vals.NOMBRE_TALLER).trim()) {
          nombre = String(vals.NOMBRE_TALLER).trim();
        } else if (typeof CONFIG !== 'undefined' && CONFIG.APP_NAME) {
          nombre = CONFIG.APP_NAME;
        }
        if (vals.LOGO_URL && String(vals.LOGO_URL).trim()) {
          logoUrl = String(vals.LOGO_URL).trim();
        }
        if (vals.LEYENDA_TICKET && String(vals.LEYENDA_TICKET).trim()) {
          leyendaTicket = String(vals.LEYENDA_TICKET).trim();
        }
      }
    } catch (eConf) {
      Logger.log('Correos: error obteniendo configuracion del taller: ' + eConf.message);
    }

    return {
      nombreTaller: nombre,
      logoUrl: logoUrl,
      leyendaTicket: leyendaTicket
    };
  },

  /**
   * Helper unificado que envuelve cualquier contenido en la plantilla oficial de correo
   * Incluye cabecera con Logo y Nombre del Taller, contenedor responsive y pie de página.
   */
  construirPlantillaHtml: function(contenidoHtml, subtituloHeader) {
    var conf = Correos.obtenerConfiguracionTaller();
    var subtitulo = subtituloHeader || 'Taller Especializado en Reparación de Consolas de Videojuegos';
    var year = new Date().getFullYear();

    var logoHtml = '';
    if (conf.logoUrl) {
      logoHtml = '<div style="margin-bottom: 12px;">' +
                   '<img src="' + conf.logoUrl + '" alt="' + conf.nombreTaller + '" style="max-height: 50px; max-width: 220px; object-fit: contain; vertical-align: middle;" />' +
                 '</div>';
    } else {
      logoHtml = '<div style="font-size: 32px; margin-bottom: 6px;">🎮</div>';
    }

    return '' +
      '<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; padding: 25px 10px; margin: 0;">' +
        '<div style="max-width: 620px; margin: auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">' +
          // Header común
          '<div style="background-color: #0f172a; color: #ffffff; padding: 24px 20px; text-align: center;">' +
            logoHtml +
            '<h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">' + conf.nombreTaller + '</h1>' +
            '<p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">' + subtitulo + '</p>' +
          '</div>' +
          // Cuerpo del contenido
          '<div style="padding: 25px 22px; color: #334155; line-height: 1.6; font-size: 14.5px;">' +
            contenidoHtml +
          '</div>' +
          // Footer común
          '<div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 20px; text-align: center; font-size: 12px; color: #64748b;">' +
            '<p style="margin: 0 0 4px 0;"><strong>' + conf.nombreTaller + '</strong> &copy; ' + year + '</p>' +
            '<p style="margin: 0; font-size: 11px; color: #94a3b8;">Servicio profesional garantizado para consolas y controles.</p>' +
          '</div>' +
        '</div>' +
      '</div>';
  },

  /**
   * Envía correo de registro exitoso con datos de cuenta y contraseña temporal (una sola vez)
   */
  enviarCorreoRegistro: function(datos) {
    var destinatario = datos.destinatario;
    var nombre = datos.nombre || 'Cliente';
    var tipoUsuario = datos.tipoUsuario || 'Normal';
    var password = datos.password;
    var telefono = datos.telefono || 'No especificado';

    var conf = Correos.obtenerConfiguracionTaller();
    var asunto = '¡Bienvenido a ' + conf.nombreTaller + '! Confirmación de registro de cuenta';

    var contenidoHtml = '' +
      '<div style="background-color: #f8fafc; border-radius: 8px; padding: 18px; margin-bottom: 20px; border-left: 4px solid #4f46e5;">' +
        '<h2 style="color: #1e293b; font-size: 17px; margin-top: 0; margin-bottom: 8px;">¡Hola, ' + nombre + '!</h2>' +
        '<p style="margin: 0; color: #334155;">Tu cuenta en <strong>' + conf.nombreTaller + '</strong> ha sido creada exitosamente como cliente <strong>' + tipoUsuario + '</strong>. Ahora puedes consultar el estado en tiempo real de tus consolas y controles, acumular puntos de cliente frecuente y canjearlos por servicios o descuentos.</p>' +
      '</div>' +
      '<div style="background-color: #e0e7ff; border-radius: 6px; padding: 16px 20px; margin-bottom: 22px;">' +
        '<h3 style="color: #3730a3; margin-top: 0; font-size: 15px; margin-bottom: 12px;">🔑 Tus Credenciales de Acceso</h3>' +
        '<p style="margin: 6px 0; color: #1e1b4b;"><strong>Correo registrado:</strong> ' + destinatario + '</p>' +
        '<p style="margin: 6px 0; color: #1e1b4b;"><strong>Contraseña registrada:</strong> <span style="font-family: monospace; background: #c7d2fe; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 14px;">' + password + '</span></p>' +
        '<p style="margin: 6px 0; color: #1e1b4b;"><strong>Teléfono:</strong> ' + telefono + '</p>' +
        '<p style="font-size: 11.5px; color: #4338ca; margin-top: 12px; margin-bottom: 0;"><em>* Por tu seguridad, esta contraseña se almacena de forma encriptada (hash irreversible con salt criptográfico) en nuestro sistema y este correo se envía una única vez al registrarte.</em></p>' +
      '</div>' +
      '<div style="text-align: center; margin-bottom: 10px;">' +
        '<p style="color: #64748b; font-size: 13px; margin: 0;">Accede a tu portal con tu correo y contraseña en el sistema web de ' + conf.nombreTaller + '.</p>' +
      '</div>';

    var cuerpoHtml = Correos.construirPlantillaHtml(contenidoHtml, 'Confirmación de Registro y Credenciales');

    var cuerpoPlano = '¡Hola, ' + nombre + '!\n\n' +
      'Tu cuenta en ' + conf.nombreTaller + ' ha sido creada exitosamente como cliente ' + tipoUsuario + '.\n\n' +
      'Tus credenciales de acceso:\n' +
      '- Correo: ' + destinatario + '\n' +
      '- Contraseña: ' + password + '\n' +
      '- Teléfono: ' + telefono + '\n\n' +
      'Guarda este correo, ya que no se almacenan contraseñas en texto plano.\n\n' +
      conf.nombreTaller + ' - Taller de Consolas de Videojuegos';

    return Correos.enviar({
      destinatario: destinatario,
      asunto: asunto,
      cuerpoHtml: cuerpoHtml,
      cuerpoPlano: cuerpoPlano
    });
  },

  /**
   * Envía correo al registrar una Orden de Servicio Multi-Dispositivo
   * Contiene la misma información que el ticket térmico (cliente, teléfono, equipos, fallas, costos y aviso legal).
   */
  enviarCorreoOrdenServicio: function(orden, dispositivos) {
    if (!orden) return false;
    var destinatario = orden.CorreoContacto;
    if (!destinatario || destinatario.indexOf('@') === -1) {
      Logger.log('Correos: orden ' + orden.Folio + ' no tiene correo de contacto válido (' + destinatario + '). Se omite envío.');
      return false;
    }

    var conf = Correos.obtenerConfiguracionTaller();
    var devs = dispositivos || [];
    var asunto = 'Orden de Servicio Registrada: ' + orden.Folio + ' - ' + conf.nombreTaller;

    // Construcción de la tabla de dispositivos idéntica al ticket
    var tablaDispositivos = '';
    for (var i = 0; i < devs.length; i++) {
      var d = devs[i];
      var costo = (d.CostoFinal !== '' && d.CostoFinal != null) ? Number(d.CostoFinal) : (Number(d.CostoEstimado) || 0);
      var costoFormateado = '$' + costo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      tablaDispositivos += '' +
        '<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px;">' +
          '<div style="display: flex; justify-content: space-between; align-items: baseline; font-weight: bold; color: #1e293b; font-size: 14px; margin-bottom: 4px;">' +
            '<span>#' + (i + 1) + ' ' + (d.TipoDispositivo || 'Consola') + ' ' + (d.Marca || '') + ' ' + (d.Modelo || '') + '</span>' +
            '<span style="color: #4f46e5; margin-left: 10px;">' + costoFormateado + '</span>' +
          '</div>' +
          (d.NumeroSerie ? '<div style="font-size: 12px; color: #64748b; margin-bottom: 3px;"><strong>S/N:</strong> ' + d.NumeroSerie + (d.Color ? ' • <strong>Color:</strong> ' + d.Color : '') + '</div>' : '') +
          (d.FallaReportada ? '<div style="font-size: 12.5px; color: #334155; margin-bottom: 2px;"><strong>Falla reportada:</strong> ' + d.FallaReportada + '</div>' : '') +
          (d.Diagnostico ? '<div style="font-size: 12.5px; color: #334155;"><strong>Diagnóstico inicial:</strong> ' + d.Diagnostico + '</div>' : '') +
        '</div>';
    }

    var totalEstimado = Number(orden.TotalEstimado) || 0;
    var totalFormateado = '$' + totalEstimado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    var contenidoHtml = '' +
      '<div style="text-align: center; margin-bottom: 18px;">' +
        '<span style="display: inline-block; background-color: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 13px;">ORDEN DE SERVICIO TÉCNICO</span>' +
        '<h2 style="color: #1e293b; font-size: 20px; margin: 8px 0 4px 0;">Folio: ' + orden.Folio + '</h2>' +
        '<p style="color: #64748b; font-size: 12.5px; margin: 0;">Fecha de ingreso: ' + (orden.FechaCreacion || Utils.formatDateTime()) + '</p>' +
      '</div>' +

      '<div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; font-size: 13.5px;">' +
        '<div style="margin-bottom: 4px;"><strong>Cliente:</strong> ' + orden.NombreCliente + '</div>' +
        (orden.TelefonoContacto ? '<div style="margin-bottom: 4px;"><strong>Teléfono:</strong> ' + orden.TelefonoContacto + '</div>' : '') +
        '<div style="margin-bottom: 4px;"><strong>Tipo de cuenta:</strong> ' + (orden.TipoUsuario || 'Normal') + '</div>' +
        (orden.Observaciones ? '<div><strong>Observaciones:</strong> ' + orden.Observaciones + '</div>' : '') +
      '</div>' +

      '<h3 style="color: #1e293b; font-size: 15px; margin: 0 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Equipos Registrados (' + devs.length + ')</h3>' +
      tablaDispositivos +

      '<div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-top: 14px; margin-bottom: 18px;">' +
        '<div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; color: #1e293b;">' +
          '<span>TOTAL ESTIMADO:</span>' +
          '<span style="color: #059669;">' + totalFormateado + '</span>' +
        '</div>' +
      '</div>' +

      // Aviso legal oficial del ticket
      '<div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 14px; margin-bottom: 18px;">' +
        '<div style="font-weight: bold; color: #92400e; font-size: 12px; margin-bottom: 4px;">TÉRMINOS Y CONDICIONES DE SERVICIO:</div>' +
        '<div style="font-size: 11px; color: #78350f; line-height: 1.5;">' + conf.leyendaTicket + '</div>' +
      '</div>' +

      '<div style="text-align: center; font-size: 12.5px; color: #64748b;">' +
        'Puedes consultar el avance en tiempo real de tu orden desde nuestro portal web utilizando tu folio: <strong>' + orden.Folio + '</strong>' +
      '</div>';

    var cuerpoHtml = Correos.construirPlantillaHtml(contenidoHtml, 'Comprobante de Recepción de Equipos');

    var cuerpoPlano = 'ORDEN DE SERVICIO: ' + orden.Folio + '\n' +
      conf.nombreTaller + '\n\n' +
      'Cliente: ' + orden.NombreCliente + '\n' +
      'Teléfono: ' + orden.TelefonoContacto + '\n' +
      'Equipos registrados: ' + devs.length + '\n' +
      'Total estimado: ' + totalFormateado + '\n\n' +
      'Aviso legal:\n' + conf.leyendaTicket + '\n\n' +
      'Rastrea tu equipo con el folio: ' + orden.Folio;

    return Correos.enviar({
      destinatario: destinatario,
      asunto: asunto,
      cuerpoHtml: cuerpoHtml,
      cuerpoPlano: cuerpoPlano
    });
  },

  /**
   * Envía correo al cliente cuando un dispositivo cambia su estatus a "Listo"
   */
  enviarCorreoDispositivoListo: function(dispositivo, orden) {
    if (!dispositivo || !orden) return false;
    var destinatario = orden.CorreoContacto;
    if (!destinatario || destinatario.indexOf('@') === -1) {
      Logger.log('Correos: dispositivo ' + dispositivo.IDDispositivo + ' sin correo de contacto asociado.');
      return false;
    }

    var conf = Correos.obtenerConfiguracionTaller();
    var nombreEquipo = (dispositivo.TipoDispositivo || 'Consola') + ' ' + (dispositivo.Marca || '') + ' ' + (dispositivo.Modelo || '');
    var asunto = '¡Tu equipo está LISTO para entrega! - ' + orden.Folio + ' (' + nombreEquipo.trim() + ')';

    var costo = (dispositivo.CostoFinal !== '' && dispositivo.CostoFinal != null) ? Number(dispositivo.CostoFinal) : (Number(dispositivo.CostoEstimado) || 0);
    var costoFormateado = '$' + costo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    var contenidoHtml = '' +
      '<div style="text-align: center; margin-bottom: 20px;">' +
        '<span style="display: inline-block; background-color: #d1fae5; color: #065f46; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px;">✅ EQUIPO LISTO PARA ENTREGA</span>' +
        '<h2 style="color: #1e293b; font-size: 19px; margin: 12px 0 4px 0;">¡Buenas noticias, ' + orden.NombreCliente + '!</h2>' +
        '<p style="color: #64748b; font-size: 13px; margin: 0;">Tu equipo ha finalizado con éxito sus pruebas de reparación y mantenimiento.</p>' +
      '</div>' +

      '<div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">' +
        '<h3 style="color: #1e293b; font-size: 15px; margin-top: 0; margin-bottom: 10px;">Detalles del Dispositivo Listo:</h3>' +
        '<p style="margin: 4px 0; color: #334155;"><strong>Equipo:</strong> ' + nombreEquipo + '</p>' +
        (dispositivo.NumeroSerie ? '<p style="margin: 4px 0; color: #334155;"><strong>Número de serie:</strong> ' + dispositivo.NumeroSerie + '</p>' : '') +
        (dispositivo.Diagnostico ? '<p style="margin: 4px 0; color: #334155;"><strong>Trabajo / Diagnóstico realizado:</strong> ' + dispositivo.Diagnostico + '</p>' : '') +
        '<p style="margin: 4px 0; color: #334155;"><strong>Folio de orden:</strong> ' + orden.Folio + '</p>' +
        '<p style="margin: 6px 0 0 0; color: #1e293b; font-size: 15px;"><strong>Monto a liquidar por este equipo:</strong> <span style="color: #059669; font-weight: bold;">' + costoFormateado + '</span></p>' +
      '</div>' +

      '<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #1e40af;">' +
        '<strong>Entrega Inmediata:</strong> Ya puedes pasar a recoger este equipo en el taller dentro de nuestro horario de atención habitual. Recuerda presentar tu folio de orden o número telefónico registrado.' +
      '</div>' +

      '<div style="text-align: center; font-size: 12.5px; color: #64748b;">' +
        '¿Tienes varios equipos en la misma orden? Puedes retirar este equipo de manera individual mediante entrega parcial.' +
      '</div>';

    var cuerpoHtml = Correos.construirPlantillaHtml(contenidoHtml, 'Notificación de Equipo Listo');

    var cuerpoPlano = '¡Buenas noticias, ' + orden.NombreCliente + '!\n\n' +
      'Tu equipo ' + nombreEquipo + ' está LISTO para entrega.\n' +
      'Folio de orden: ' + orden.Folio + '\n' +
      (dispositivo.NumeroSerie ? 'Número de serie: ' + dispositivo.NumeroSerie + '\n' : '') +
      'Monto a liquidar: ' + costoFormateado + '\n\n' +
      'Ya puedes pasar a recogerlo al taller.\n\n' +
      conf.nombreTaller;

    return Correos.enviar({
      destinatario: destinatario,
      asunto: asunto,
      cuerpoHtml: cuerpoHtml,
      cuerpoPlano: cuerpoPlano
    });
  },

  /**
   * Envía un correo y registra el resultado en la hoja CorreosLog
   */
  enviar: function(opts) {
    var idCorreo = Utils.generateId('EML');
    var destinatario = opts.destinatario;
    var asunto = opts.asunto;
    var estado = 'PENDIENTE';
    var errorMsg = '';

    try {
      // Verificar cuota de correo disponible
      var quota = MailApp.getRemainingDailyQuota();
      if (quota <= 0) {
        throw new Error('Cuota diaria de correos excedida en Google Apps Script.');
      }

      MailApp.sendEmail({
        to: destinatario,
        subject: asunto,
        body: opts.cuerpoPlano || '',
        htmlBody: opts.cuerpoHtml || ''
      });

      estado = 'ENVIADO';
    } catch (e) {
      estado = 'FALLIDO';
      errorMsg = e.message;
      Logger.log('Error enviando correo a ' + destinatario + ': ' + errorMsg);
    }

    // Registrar en CorreosLog
    try {
      Utils.appendRecord(CONFIG.SHEETS.CORREOS_LOG, {
        IDCorreo: idCorreo,
        Destinatario: destinatario,
        Asunto: asunto,
        Estado: estado,
        FechaHora: Utils.formatDateTime(),
        Error: errorMsg
      });
    } catch (logErr) {
      Logger.log('No se pudo registrar en CorreosLog: ' + logErr.message);
    }

    return estado === 'ENVIADO';
  }
};
