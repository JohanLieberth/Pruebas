import http.server
import socketserver
import urllib.parse
import os

PORT = 8001

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed_url.query)

        page = params.get('page', ['panelContrato'])[0]

        if page == 'listaRegistros':
            self.path = '/listaRegistros.html'
        elif page == 'dashboardKPI':
            self.path = '/dashboardKPI.html'
        elif page == 'panelContrato':
            self.path = '/panelContrato.html'
        else:
            self.path = '/panelContrato.html'

        print(f"Serving {page} via {self.path}")
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print("serving at port", PORT)
    httpd.serve_forever()
