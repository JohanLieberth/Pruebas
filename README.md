# Guía de Despliegue e Instalación — App de Registro Tarjeta de Mujeres

Esta guía explica paso a paso cómo desplegar la aplicación web **Tarjeta de Mujeres (Mujeres Seguras, Mérida, Yucatán)** en Google Apps Script y preparar la base de datos en Google Sheets.

---

## 1. Crear el Proyecto en Google Apps Script

1. Abre [Google Apps Script](https://script.google.com/) e inicia sesión con tu cuenta de Google.
2. Haz clic en **"Nuevo proyecto"**.
3. Cambia el nombre del proyecto en la esquina superior izquierda a **`App_Tarjeta_Mujeres_Merida`**.

---

## 2. Copiar los Archivos del Código Fuente

Crea los siguientes 4 archivos en el editor de Apps Script e inserta el contenido correspondiente:

### **Archivo 1: `Code.gs`** (Código del Servidor)
- Crea un archivo de script llamado `Code.gs`.
- Copia y pega todo el contenido de `Code.gs`.

### **Archivo 2: `Index.html`** (Página de Inicio)
- Haz clic en el botón **`+`** (Añadir un archivo) > **HTML**.
- Nómbralo exactamente `Index` (Apps Script agregará la extensión `.html` automáticamente).
- Copia y pega el contenido de `Index.html`.

### **Archivo 3: `Registro.html`** (Formulario de Registro)
- Haz clic en **`+`** > **HTML**.
- Nómbralo `Registro`.
- Copia y pega el contenido de `Registro.html`.

### **Archivo 4: `Admin.html`** (Panel Administrador)
- Haz clic en **`+`** > **HTML**.
- Nómbralo `Admin`.
- Copia y pega el contenido de `Admin.html`.

---

## 3. Inicializar la Base de Datos en Google Sheets

1. En el editor de Apps Script, selecciona la función **`inicializarBaseDatos`** en la barra superior.
2. Haz clic en **"Ejecutar"**.
3. Se te solicitará otorgar permisos de acceso a Google Drive y Google Sheets. Otorga los permisos requeridos.
4. La función creará automáticamente un libro de Google Sheets llamado **`BD_Mujeres_Seguras_Merida`** con las 4 pestañas requeridas:
   - **`Config`**: Contiene la configuración inicial de fechas, banderas y credenciales de administración.
   - **`CURPs_Bloqueadas`**: Registra CURPs bloqueadas o que ya cuentan con tarjeta.
   - **`Registros`**: Almacena las solicitudes recibidas.
   - **`Ubicaciones`**: Catálogo predefinido de colonias y comisarías de Mérida, Yucatán.

---

## 4. Pasos Opcionales: Precargar Ubicaciones y CURPs Bloqueadas

- **Añadir más Colonias/Comisarías**: Abre la hoja de cálculo generada `BD_Mujeres_Seguras_Merida`, ve a la pestaña `Ubicaciones` y agrega filas con el formato `Tipo` (`Colonia` o `Comisaría`) y `Nombre`.
- **Precargar CURPs ya emitidas**: Abre la pestaña `CURPs_Bloqueadas` y agrega las CURPs existentes en la columna A.

---

## 5. Desplegar como Aplicación Web (Web App)

1. Haz clic en el botón azul **"Desplegar"** (Deploy) en la esquina superior derecha > **"Nuevo despliegue"** (New deployment).
2. Selecciona el tipo de despliegue: **Aplicación Web** (Web app).
3. Configura los parámetros:
   - **Descripción**: `Versión 1.0 - Lanzamiento Inicial`
   - **Ejecutar como**: `Yo` (tu cuenta de correo)
   - **Quién tiene acceso**: `Cualquier persona` (Anyone)
4. Haz clic en **"Desplegar"**.
5. Copia la **URL de la aplicación web** generada (ej. `https://script.google.com/macros/s/.../exec`).

---

## 6. URLs de Acceso a los Módulos

- **Página de Inicio**: `URL_DEL_WEB_APP`
- **Formulario de Registro**: `URL_DEL_WEB_APP?v=registro`
- **Panel Administrador**: `URL_DEL_WEB_APP?v=admin`

---

## 7. Credenciales por Defecto del Panel Administrador

- **Usuario**: `admin`
- **Contraseña**: `admin123`

*(Puedes modificar el usuario y la contraseña directamente en la pestaña `Config` de la hoja de cálculo).*
