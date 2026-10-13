# 📋 Manual de Usuario Operativo - Control Machete

Bienvenido a la guía rápida de uso de la aplicación **Control Machete** para usuarios del rol **Operativo**.

Este sistema permite a los enlaces de cada subdirección responder las preguntas de auditorías de control interno de manera ordenada, adjuntando evidencias documentales en Google Drive y justificando documentalmente cada aspecto evaluado.

---

## 🔑 1. Acceso e Inicio de Sesión

1. Ingrese a la **URL de la Aplicación Web** proporcionada por el Administrador del Sistema.
2. Ingrese su **Correo Electrónico** registrado y su **Contraseña**.
3. Haga clic en **Iniciar Sesión**.

> 💡 *Nota:* Al iniciar sesión como usuario **Operativo**, la aplicación filtrará automáticamente las preguntas y asignaciones que corresponden de manera exclusiva a la subdirección a la que está adscrito su usuario.

---

## 📋 2. Navegación en "Mis Preguntas Asignadas"

En el menú lateral izquierdo, seleccione la sección **Mis Preguntas Asignadas**:

1. Se desplegará una lista con todas las preguntas del lote de auditoría asignadas a su subdirección.
2. Cada tarjeta muestra:
   - **Número de pregunta** e **ID único** (ejemplo: `LOTE-001-001`).
   - **Categoría / Componente** (ejemplo: *Ambiente de Control*).
   - **Subcategoría / Principio** (ejemplo: *Normas de Conducta*).
   - **Texto de la Pregunta**.
   - **Fundamento Legal / Normativo** aplicable.
   - **Estado de Revisión actual** (*Pendiente*, *En revisión*, *Enviada*, *Observada*, *Aceptada*).

---

## 📝 3. Responder una Pregunta de Auditoría

Para cada pregunta asignada, debe completar los siguientes campos en su formulario correspondiente:

### A. Valor de Respuesta (Obligatorio para envío final)
Seleccione del menú desplegable la opción que mejor describa la situación actual de su subdirección:
- **Sí**: Se cumple completamente con la norma o requerimiento.
- **Parcial**: Se cumple de forma parcial o está en proceso de implementación.
- **No**: No se cumple con la norma o requerimiento.
- **No Aplica**: El criterio no aplica a la competencia de la subdirección.

### B. Cálculo Automático de Riesgo Residual
Al seleccionar la respuesta, el sistema calcula de manera automática el nivel de riesgo residual:
- **Sí** ➔ Riesgo **Bajo** 🟢
- **Parcial** ➔ Riesgo **Medio** 🟠
- **No** ➔ Riesgo **Alto** 🔴
- **No Aplica** ➔ **N/A** ⚪

### C. Evidencia Documental (Carga de Archivo a Drive)
1. Haga clic en **Seleccionar archivo** (*Choose File*).
2. Elija el documento de respaldo (PDF, Word, Excel, imagen, etc.) desde su computadora.
3. El archivo se subirá automáticamente a la carpeta de **Google Drive** institucional "Evidencias Auditorias" y el enlace se asociará a su respuesta.

### D. Evidencia Textual
Describa detalladamente en el recuadro de texto la explicación, referencia o justificación que sustenta la respuesta brindada.

### E. Observaciones (Opcional)
Agregue comentarios o aclaraciones adicionales si lo considera necesario.

---

## 💾 4. Guardar Borrador vs. Enviar Respuesta Final

Al final de la tarjeta de cada pregunta encontrará dos opciones:

- 💾 **Guardar Borrador**:
  - Permite guardar los avances realizados sin enviar definitivamente la respuesta al Administrador.
  - El estado cambiará a **En revisión**. Puede regresar en cualquier momento a corregir o complementar la información.

- 🚀 **Enviar Respuesta Final**:
  - Confirma y envía la respuesta definitiva al equipo de auditoría para su revisión.
  - El estado cambiará a **Enviada**.

---

## 🔍 5. Atención a Observaciones del Administrador

Si el Administrador revisa su respuesta y detecta inconsistencias o falta de evidencias, marcará la respuesta como **Observada**:

1. En la tarjeta de la pregunta aparecerá una caja de alerta destacada en color amarillo con la **Observación del Administrador**.
2. Revise el comentario del auditor.
3. Corrija los datos, reemplace la evidencia documental o amplíe la evidencia textual según lo solicitado.
4. Haga clic en **Enviar Respuesta Final** para remitir la corrección.

---

## 🚪 6. Cierre de Sesión

Al terminar de trabajar, haga clic en el botón **Salir** ubicado en la esquina superior derecha de la pantalla para cerrar de forma segura su sesión.
