# Guía de Instalación - Sistema de Gestión de Contratos

## 1. Preparación del Google Sheet
1. Crea un nuevo Google Sheet.
2. Abre el Editor de Script (Extensiones > Apps Script).
3. Crea los archivos `Código.gs`, `panelContrato.html`, `gestionDocumental.html`, `dashboardKPI.html` y `Configuracion.html` con el código proporcionado.
4. Guarda el proyecto.

## 2. Configuración Inicial
1. Recarga el Google Sheet. Verás un nuevo menú llamado **"Gestión de Contratos"**.
2. Al abrirlo por primera vez, el sistema creará automáticamente las hojas necesarias (`CONTRATOS`, `RESUMEN_TIEMPOS`, `LOG_DOCUMENTAL`, `CONFIGURACION`).
3. Ve a **Gestión de Contratos > Configuración**.
4. Pega el ID de la carpeta de Google Drive donde se guardarán los documentos.
5. Ajusta los umbrales de tiempo si es necesario.

## 3. Uso del Panel de Control
1. Ingresa datos de contratos en la hoja `CONTRATOS`.
2. Abre **Gestión de Contratos > Panel de Control**.
3. Selecciona un contrato para ver su línea de tiempo visual y actualizar fechas o subir documentos.

## 4. Regla Especial: Secretaría Municipal
El sistema aplica automáticamente una regla diferenciada para la etapa de "Secretaría":
- **Verde**: Hasta 5 días hábiles.
- **Amarillo**: Hasta 9 días hábiles.
- **Rojo**: 10 o más días hábiles.

Para las demás etapas, la regla estándar es:
- **Verde**: Hasta 3 días hábiles.
- **Amarillo**: Hasta 5 días hábiles.
- **Rojo**: 6 o más días hábiles.

## 5. Triggers Automáticos
Para habilitar el envío de correos automáticos cuando una etapa pase a Rojo:
1. En el editor de Apps Script, ve a **Activadores** (icono de reloj).
2. Añade un nuevo activador:
   - Función: `generarReporteKPI` (o crea una específica para alertas).
   - Evento: `De la hoja de cálculo` - `Al editar` o `Por tiempo`.
