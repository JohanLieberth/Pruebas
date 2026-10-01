# 🏆 Kilos Mortales - Guía de Instalación y Despliegue

Esta es una aplicación web completa desarrollada en **Google Apps Script** con base de datos en **Google Sheets** y una interfaz moderna e interactiva (**HtmlService**) diseñada para gestionar la competencia **Kilos Mortales**.

---

## 📊 Reglas de Negocio y Sistema de Puntuación

La puntuación busca ser equitativa tanto para personas sedentarias/con sobrepeso como para personas activas cerca de su peso ideal:

1. **Puntaje Final**:
   $$\text{Puntaje Final} = \% \text{ Peso Perdido} + (0.20 \times \text{cm de Cintura Reducidos})$$
   - $\% \text{ Peso Perdido} = \frac{\text{Peso Inicial} - \text{Peso Final}}{\text{Peso Inicial}} \times 100$
   - $\text{Bono Cintura} = (\text{Cintura Inicial} - \text{Cintura Final}) \times 0.20$

2. **Criterios de Desempate** (en orden de prioridad):
   1. **Mayor % de reducción de cintura**: $\frac{\text{Cintura Inicial} - \text{Cintura Final}}{\text{Cintura Inicial}} \times 100$
   2. **Mayor % de peso perdido**
   3. **Mayor cantidad de check-ins semanales registrados**
   4. **Menor desviación estándar** en las mediciones semanales de peso (premia la constancia)

---

## 🗄️ Estructura de la Base de Datos (Google Sheets)

La aplicación inicializa automáticamente tres (3) hojas si no existen:

1. **`Config`**:
   - `A1:B1` -> `PARAMETRO | VALOR`
   - `A2:B2` -> `PASSWORD_ADMIN | admin123` *(Configurable)*
   - `A3:B3` -> `NOMBRE_COMPETENCIA | Kilos Mortales 2025`
   - `A4:B4` -> `FACTOR_BONO_CINTURA | 0.20`
   - `A5:B5` -> `FECHA_INICIO | [Fecha]`

2. **`Participantes`**:
   - Encabezados: `ID`, `Nombre Completo`, `Edad`, `Sexo`, `Email`, `Estatura (m)`, `Peso Inicial (kg)`, `Cintura Inicial (cm)`, `Fecha Inicio`, `Categoría`, `Activo`, `Peso Final (kg)`, `Cintura Final (cm)`, `Fecha Final`, `Fecha Registro`

3. **`Mediciones`**:
   - Encabezados: `ID Medición`, `ID Participante`, `Nombre Participante`, `Fecha Medición`, `Peso (kg)`, `Cintura (cm)`, `Fecha Registro`

---

## 🚀 Pasos para Desplegar la Web App

### Paso 1: Crear la Hoja de Cálculo
1. Ve a [Google Sheets](https://sheets.google.com) y crea un libro en blanco titulado **"Kilos Mortales"**.

### Paso 2: Abrir el Editor de Google Apps Script
1. En la hoja de cálculo, ve al menú superior: **Extensiones** > **Apps Script**.

### Paso 3: Copiar los Archivos de Código
Crea los siguientes 5 archivos en el editor de Apps Script:

1. **`Code.gs`** (Archivo de script principal)
2. **`Index.html`** (Archivo HTML principal)
3. **`Styles.html`** (Estilos CSS)
4. **`JavaScript.html`** (Lógica cliente JS)
5. **`logo_base64.txt`** (Contenido Base64 del logo)

### Paso 4: Desplegar como Web App
1. En la esquina superior derecha del editor de Apps Script, haz clic en **Desplegar** > **Nuevo despliegue**.
2. Selecciona el icono de engranaje ⚙️ y elige **Aplicación web**.
3. Configura los parámetros:
   - **Descripción**: Kilos Mortales v1.0
   - **Ejecutar como**: *Yo (tu cuenta de Google)*
   - **Quién tiene acceso**: *Cualquier persona* (Anyone)
4. Haz clic en **Desplegar**.

### Paso 5: Autorizar Permisos de Google
1. Al desplegar por primera vez, Google te pedirá autorizar el acceso.
2. Haz clic en **Revisar permisos**.
3. Selecciona tu cuenta de Google.
4. Haz clic en **Configuración avanzada** (Advanced) y luego en **Ir a Kilos Mortales (no seguro)**.
5. Haz clic en **Permitir**.
6. Copia la **URL de la aplicación web** generada. ¡Ese es el enlace público de tu aplicación!

---

## 🔑 Uso del Panel de Administración

- Para acceder al panel de administración, haz clic en la pestaña **"🔒 Panel Administrador"**.
- Ingresa la contraseña configurada en la celda `B2` de la hoja `Config` (por defecto: `admin123`).
- Desde ahí podrás:
  1. **Registrar Participantes**: Ingresar datos iniciales (incluyendo Edad y Sexo), estatura, peso y cintura inicial.
  2. **Check-In Semanal**: Registrar el avance periódico del participante. Muestra una advertencia automática si la pérdida supera el 1% semanal.
  3. **Medición Final**: Registrar los datos definitivos al término de la competencia.
  4. **Lista Participantes**: Ver el padrón completo de participantes registrados con su edad, sexo y datos iniciales.

---

## 🛠️ Pruebas Locales

Si deseas ejecutar los tests unitarios incluidos para la lógica de desempates y fórmulas:
```bash
python3 test_competition.py
```
