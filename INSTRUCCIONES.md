# Instrucciones de Instalación - Friend Travel - Ventas

Sigue estos pasos para poner en marcha tu sistema de seguimiento de ventas:

### 1. Preparación del Google Sheet
1. Crea una nueva Hoja de Cálculo de Google.
2. Cambia el nombre del archivo a "Friend Travel - Ventas".
3. Ve al menú **Extensiones > Apps Script**.

### 2. Configuración del Código
1. En el editor de Apps Script, crea los siguientes archivos y pega el código correspondiente proporcionado:
   - `Código.gs`
   - `Index.html`
   - `Formulario.html`
   - `Dashboard.html`
   - `Cobranza.html`
   - `Reportes.html`
   - `CSS.html`
   - `JS.html`
2. Guarda el proyecto (clic en el icono del disco).

### 3. Inicialización
1. Regresa a tu Google Sheet y **recarga la página**.
2. Verás un nuevo menú llamado **"Friend Travel"** en la parte superior.
3. Haz clic en **Friend Travel > Configurar Sistema**.
4. Se te pedirán permisos; acéptalos (es posible que debas hacer clic en "Configuración avanzada" > "Ir a Friend Travel (no seguro)").
5. Este proceso creará automáticamente todas las hojas necesarias (`Ventas`, `Dashboard`, `Vendedores`, `Config`, `Logo`).

### 4. Configuración del Logo
1. Ve a la hoja **"Logo"**.
2. **Opción A (Recomendada para HTML):** Pega una URL pública de tu logo (ej: de tu sitio web o Google Drive compartido) en la celda **D2**.
3. **Opción B (Para la Hoja):** Selecciona la celda **A1**, ve a **Insertar > Imagen > Imagen en celda** y sube tu archivo.
4. Ajusta el ancho en **B2** y el alto en **C2** (ej: 150 y 80).

### 5. Despliegue como Aplicación Web
1. En el editor de Apps Script, haz clic en el botón azul **Implementar > Nueva implementación**.
2. Selecciona el tipo **Aplicación web**.
3. En "Quién tiene acceso", selecciona **Cualquier persona** (o según prefieras).
4. Haz clic en **Implementar**.
5. Copia la **URL de la aplicación web**. Esta es la dirección que usarás para registrar ventas y ver el dashboard.

### 6. Uso del Sistema
- **Registro:** Usa el formulario web para ingresar nuevas ventas. Los vendedores se cargan desde la hoja "Vendedores".
- **Cobranza:** En la pestaña Cobranza de la App Web, puedes registrar abonos. El sistema permite hasta 3 abonos por venta.
- **Dashboard:** Filtra tus resultados por vendedor o por mes para ver el progreso hacia la meta de $10,000.
- **Reportes:** Genera listas de ventas vencidas y expórtalas a CSV/Excel o PDF (imprimir).
