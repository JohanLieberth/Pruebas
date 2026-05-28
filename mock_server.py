
import http.server
import socketserver
import os

PORT = 8000
HTML_FILE = 'Index.html'

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            with open(HTML_FILE, 'rb') as f:
                content = f.read().decode('utf-8')
                # Inject mock google.script.run for local testing
                mock_script = """
                <script>
                window.google = {
                  script: {
                    run: {
                      withFailureHandler: function(failCallback) {
                        this._fail = failCallback;
                        return this;
                      },
                      withSuccessHandler: function(successCallback) {
                        this._success = successCallback;
                        return this;
                      },
                      getDashboardData: function(email) {
                        console.log("Mock getDashboardData called");
                        const self = this;
                        setTimeout(() => {
                          if (self._success) {
                            self._success({
                              ranking: [[1, 'Juanito26', 10, 0, 2, 0], [2, 'MariGol', 8, -2, 1, 1]],
                              partidos: [
                                ['P-001', '2026-06-11', '15:00', 'Fase de Grupos', 'México', 'Argentina', 2, 1, 'Jugado', 'Manual', 'https://flagcdn.com/w40/mx.png', 'https://flagcdn.com/w40/ar.png'],
                                ['P-002', '2026-06-12', '18:00', 'Fase de Grupos', 'España', 'Brasil', '', '', 'Pendiente', '', 'https://flagcdn.com/w40/es.png', 'https://flagcdn.com/w40/br.png'],
                                ['P-003', '2026-06-13', '20:00', 'Fase de Grupos', 'Corea del Sur', 'República Checa', '', '', 'Pendiente', '', 'https://flagcdn.com/w40/kr.png', 'https://flagcdn.com/w40/cz.png']
                              ],
                              misPronosticos: [
                                ['PRON-001', 'test@test.com', 'P-001', 2, 1, '2026-06-11', 5]
                              ],
                              participante: ['test@test.com', 'Test User', 'Tester', 5, 1, '2026-06-11'],
                              esAdmin: true
                            });
                          }
                        }, 500);
                      },
                      guardarMultiplesPronosticos: function(p, e) {
                        const self = this;
                        setTimeout(() => { if(self._success) self._success({success:true, msg: 'Guardado mock'}); }, 500);
                      },
                      registrarParticipante: function(n, a, e) {
                        const self = this;
                        setTimeout(() => { if(self._success) self._success({success: true, msg: 'Registro exitoso mock'}); }, 500);
                      }
                    }
                  }
                };
                </script>
                """
                content = content.replace('<body>', '<body>' + mock_script)
                self.wfile.write(content.encode('utf-8'))
        else:
            super().do_GET()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        httpd.serve_forever()
