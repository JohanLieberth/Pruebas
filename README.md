# 🏆 Quiniela Mundial FIFA 2026 - Guía de Instalación

Este proyecto es un sistema de pronósticos deportivos (quiniela) robusto, escalable y con una interfaz moderna, diseñado para ejecutarse en **Google Apps Script** utilizando **Google Sheets** como base de datos.

## 🚀 Pasos para la Instalación

### 1. Crear la Hoja de Cálculo
1. Crea una nueva hoja de cálculo en [Google Sheets](https://sheets.new).
2. Ve a **Extensiones > Apps Script**.
3. Cambia el nombre del proyecto a `Quiniela Mundial 2026`.

### 2. Copiar el Código
1. En el editor de Apps Script, abre el archivo `Código.gs` y pega el contenido del archivo `Code.gs` de este repositorio.
2. Crea un nuevo archivo haciendo clic en el icono `+` y selecciona **HTML**. Ponle de nombre `Index`.
3. Pega el contenido del archivo `Index.html` de este repositorio en el nuevo archivo `Index.html`.

### 3. Configuración Inicial
1. Regresa a tu Hoja de Cálculo y **recarga la página**.
2. Verás un nuevo menú: **⚽ Quiniela Mundial 2026**.
3. Haz clic en **⚙️ Inicializar / Resetear Hojas**. Google te pedirá autorizar permisos. Acéptalos.
   - *Nota:* Si aparece un aviso de "App no verificada", haz clic en *Configuración avanzada* e *Ir a Quiniela Mundial 2026 (no seguro)*.
4. Una vez inicializadas las hojas, ve de nuevo al menú y haz clic en **🧪 Cargar Datos Iniciales (Seed)** para cargar los primeros equipos y partidos.

### 4. Despliegue de la Aplicación Web
1. En el editor de Apps Script, haz clic en el botón azul **Desplegar > Nueva implementación**.
2. Selecciona el tipo **Aplicación web**.
3. Configura lo siguiente:
   - **Descripción:** Versión 1.0
   - **Ejecutar como:** Yo (tu-email@gmail.com)
   - **Quién tiene acceso:** Cualquier persona (incluso anónima) - *Esto permite que los usuarios se registren.*
4. Haz clic en **Implementar** y copia la **URL de la aplicación web**.

---

## 📊 Sistema de Puntuación
El sistema aplica las siguientes reglas automáticamente al ejecutarse "Recalcular Puntos":

| Acierto | Puntos | Descripción |
| :--- | :---: | :--- |
| **Marcador Exacto** | +5 | Aciertas los goles exactos de ambos equipos. |
| **Knockout Bonus** | +3 | Si aciertas el marcador exacto en fase eliminatoria (Total +8). |
| **Ganador / Empate** | +2 | Aciertas quién gana o si empatan, pero no los goles exactos. |
| **Error Total** | -1 | No aciertas ni el ganador ni el empate. |

---

## 🛠️ Herramientas de Administrador
Desde el menú de la hoja de cálculo puedes:
- **Actualizar Resultados API:** Obtiene resultados reales automáticamente (Requiere API Key en la hoja `Configuracion`).
- **Recalcular Puntos:** Procesa todos los pronósticos contra los resultados reales.
- **Backup Datos:** Crea una copia de seguridad de la base de datos en tu Google Drive.

## 📱 Uso en Móvil
La aplicación es 100% responsiva. Se recomienda añadir la URL de la Web App a la pantalla de inicio del celular para una experiencia similar a una app nativa.

---
*Desarrollado por Jules (AI Assistant)*
