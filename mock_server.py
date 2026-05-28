
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
                      withSuccessHandler: function(callback) {
                        return {
                          getDashboardData: function(email) {
                            setTimeout(() => {
                              callback({
                                ranking: [[1, 'Juanito26', 10, 0, 2, 0], [2, 'MariGol', 8, -2, 1, 1]],
                                partidos: [
                                  ['P-001', '2026-06-11', '15:00', 'Grupo A', 'México', 'Argentina', 2, 1, 'Jugado', 'Manual'],
                                  ['P-002', '2026-06-12', '18:00', 'Grupo B', 'España', 'Brasil', '', '', 'Pendiente', '']
                                ],
                                misPronosticos: [
                                  ['PRON-001', 'test@test.com', 'P-001', 2, 1, '2026-06-11', 5]
                                ],
                                participante: ['test@test.com', 'Test User', 'Tester', 5, 1, '2026-06-11']
                              });
                            }, 500);
                          },
                          registrarParticipante: function(n, a, e) {
                            setTimeout(() => callback({success: true, msg: 'Registro exitoso (Mock)'}), 500);
                          },
                          guardarPronostico: function(id, gl, gv, e) {
                            setTimeout(() => callback({success: true, msg: 'Pronóstico guardado (Mock)'}), 500);
                          }
                        };
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
        print(f"Servidor de pruebas corriendo en http://localhost:{PORT}")
        print("Presiona Ctrl+C para detener.")
        httpd.serve_forever()
