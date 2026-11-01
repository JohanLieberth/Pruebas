/**
 * Correos.gs - Envío de notificaciones por correo electrónico y bitácora en CorreosLog
 */

var Correos = {

  /**
   * Envía correo de registro exitoso con datos de cuenta y contraseña temporal (una sola vez)
   */
  enviarCorreoRegistro: function(datos) {
    var destinatario = datos.destinatario;
    var nombre = datos.nombre || 'Cliente';
    var tipoUsuario = datos.tipoUsuario || 'Normal';
    var password = datos.password;
    var telefono = datos.telefono || 'No especificado';

    var asunto = '¡Bienvenido a PixelFix! Confirmación de registro de cuenta';

    var cuerpoHtml = '' +
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">' +
        '<div style="text-align: center; margin-bottom: 20px;">' +
          '<h1 style="color: #6366f1; margin: 0; font-size: 26px;">🎮 PixelFix</h1>' +
          '<p style="color: #64748b; font-size: 14px; margin-top: 5px;">Taller Especializado en Reparación de Consolas de Videojuegos</p>' +
        '</div>' +
        '<div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">' +
          '<h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">¡Hola, ' + nombre + '!</h2>' +
          '<p style="color: #334155; line-height: 1.6;">Tu cuenta en <strong>PixelFix</strong> ha sido creada exitosamente como cliente <strong>' + tipoUsuario + '</strong>. Ahora puedes consultar el estado en tiempo real de tus consolas y controles, acumular puntos de cliente frecuente y canjearlos por servicios gratuitos o descuentos.</p>' +
        '</div>' +
        '<div style="background-color: #e0e7ff; border-left: 4px solid #6366f1; padding: 15px 20px; border-radius: 4px; margin-bottom: 25px;">' +
          '<h3 style="color: #3730a3; margin-top: 0; font-size: 16px;">Tus Credenciales de Acceso</h3>' +
          '<p style="margin: 6px 0; color: #1e1b4b;"><strong>Correo registrado:</strong> ' + destinatario + '</p>' +
          '<p style="margin: 6px 0; color: #1e1b4b;"><strong>Contraseña registrada:</strong> <span style="font-family: monospace; background: #c7d2fe; padding: 2px 8px; border-radius: 4px; font-weight: bold;">' + password + '</span></p>' +
          '<p style="margin: 6px 0; color: #1e1b4b;"><strong>Teléfono:</strong> ' + telefono + '</p>' +
          '<p style="font-size: 12px; color: #4338ca; margin-top: 10px; margin-bottom: 0;"><em>* Por tu seguridad, esta contraseña se almacena de forma encriptada (hash irreversible con salt criptográfico) en nuestro sistema y este correo se envía una única vez al registrarte.</em></p>' +
        '</div>' +
        '<div style="text-align: center; margin-bottom: 25px;">' +
          '<p style="color: #64748b; font-size: 13px;">Accede a tu portal con tu correo y contraseña en el sistema web de PixelFix.</p>' +
        '</div>' +
        '<div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 12px; color: #94a3b8;">' +
          '<p>PixelFix - Servicio profesional para PlayStation, Xbox, Nintendo y Handhelds.</p>' +
          '<p>Si no realizaste este registro, por favor ignora este mensaje o contacta al taller.</p>' +
        '</div>' +
      '</div>';

    var cuerpoPlano = '¡Hola, ' + nombre + '!\n\n' +
      'Tu cuenta en PixelFix ha sido creada exitosamente como cliente ' + tipoUsuario + '.\n\n' +
      'Tus credenciales de acceso:\n' +
      '- Correo: ' + destinatario + '\n' +
      '- Contraseña: ' + password + '\n' +
      '- Teléfono: ' + telefono + '\n\n' +
      'Guarda este correo, ya que no se almacenan contraseñas en texto plano.\n\n' +
      'PixelFix - Taller de Consolas de Videojuegos';

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
