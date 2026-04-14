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
      getPlanesTrabajo: function(rfc) {
        setTimeout(() => this.successHandler([
          {
            nombreArchivo: "plan_inicial.pdf",
            estatus: "Aprobado",
            fechaSubida: "10/04/2023 14:00",
            observaciones: "Todo correcto",
            urlArchivo: "https://drive.google.com/test"
          },
          {
            nombreArchivo: "Sin archivo",
            estatus: "Pendiente",
            fechaSubida: "11/04/2023 09:30",
            observaciones: "",
            urlArchivo: ""
          }
        ]), 100);
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
