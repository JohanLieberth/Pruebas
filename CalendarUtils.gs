/**
 * Utilidades para la integración con Google Calendar.
 */
const CalendarUtils = {

  /**
   * Crea o actualiza un evento en el calendario para la fecha límite de pago.
   */
  sincronizarEventoCalendario: function(v) {
    try {
      const calendar = CalendarApp.getDefaultCalendar();
      const titulo = "Límite de Pago: " + v['folio/concepto'] + " - " + v.cliente;
      const fechaLimite = new Date(v.fecha_limite);

      // La fecha del evento es el día completo de la fecha límite
      // Si la fecha es inválida, salimos
      if (isNaN(fechaLimite.getTime())) return;

      const descripcion = `
Cliente: ${v.cliente}
Folio: ${v['folio/concepto']}
Monto Total: $${parseFloat(v.total).toLocaleString()}
Monto Pendiente: $${parseFloat(v.saldo).toLocaleString()}
Estado: ${v.estado}
ID Venta: ${v['folio/concepto']}
      `.trim();

      // Buscar si ya existe un evento para este folio
      // Buscamos eventos en un rango amplio (ej: 1 año atrás y adelante)
      const inicioBusqueda = new Date();
      inicioBusqueda.setFullYear(inicioBusqueda.getFullYear() - 1);
      const finBusqueda = new Date();
      finBusqueda.setFullYear(finBusqueda.getFullYear() + 1);

      const eventos = calendar.getEvents(inicioBusqueda, finBusqueda, { search: v['folio/concepto'] });

      let eventoExistente = null;
      for (let i = 0; i < eventos.length; i++) {
        if (eventos[i].getDescription().includes("Folio: " + v['folio/concepto'])) {
          eventoExistente = eventos[i];
          break;
        }
      }

      if (eventoExistente) {
        // Actualizar evento
        eventoExistente.setTitle(titulo);
        eventoExistente.setDescription(descripcion);
        // Solo actualizar fecha si cambió
        const fechaEventoActual = eventoExistente.getStartTime();
        if (fechaEventoActual.toDateString() !== fechaLimite.toDateString()) {
          eventoExistente.setAllDayDate(fechaLimite);
        }
      } else {
        // Crear nuevo evento de día completo
        calendar.createAllDayEvent(titulo, fechaLimite, {
          description: descripcion
        });
      }

    } catch (e) {
      console.error("Error al sincronizar con Calendar: " + e.message);
    }
  }
};
