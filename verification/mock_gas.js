window.google = {
  script: {
    run: {
      withSuccessHandler: function(callback) {
        this.successHandler = callback;
        return this;
      },
      withFailureHandler: function(callback) {
        this.failureHandler = callback;
        return this;
      },
      validarRFCExistente: function(rfc) {
        setTimeout(() => this.successHandler(false), 100);
      },
      procesarRegistro: function(data) {
        setTimeout(() => this.successHandler({
          success: true,
          folio: "MS-2023-00001",
          qrUrl: "https://quickchart.io/qr?text=MS-2023-00001&size=200"
        }), 100);
      },
      buscarPorRFC: function(rfc) {
        setTimeout(() => this.successHandler({
          rfc: rfc,
          representante: "Juan Pérez",
          folio: "MS-2023-00001",
          estatus: "Pendiente"
        }), 100);
      },
      getUbicaciones: function(rfc) {
        setTimeout(() => this.successHandler([
          { id: "loc-123", nombre: "Sucursal Centro" },
          { id: "loc-456", nombre: "Sucursal Norte" }
        ]), 100);
      },
      getPlanesTrabajo: function(rfc) {
        setTimeout(() => this.successHandler([
          {
            planDetalle: "Plan de acción preventivo",
            estatus: "Aprobado",
            fechaEnvio: "10/04/2023 14:00",
            observaciones: "Todo correcto",
            urlArchivo: "https://drive.google.com/test",
            idSucursal: "loc-123"
          }
        ]), 200);
      },
      guardarPlanTrabajo: function(data) {
        setTimeout(() => this.successHandler({ success: true }), 100);
      },
      setupDatabase: function() {
        console.log("Database setup called");
      }
    }
  }
};
