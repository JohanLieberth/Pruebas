# Guía de Migración: BitFix de Google Apps Script a Microsoft Ecosystem

Esta guía detalla la arquitectura técnica para replicar el sistema de administración de servicios **BitFix** utilizando **Microsoft Power Apps**, **Power Automate** y **SharePoint Online**.

## 1. BASE DE DATOS (SharePoint Lists)

Se deben crear 3 listas en un sitio de SharePoint:

### A. Lista: `BitFix_Servicios`
| Columna (Internal Name) | Tipo | Equivalente GAS |
|-------------------------|------|-----------------|
| `Title` (Folio) | Texto (Único) | Folio (BF-XXXXX) |
| `Nombre` | Texto | Nombre |
| `Telefono` | Texto | Teléfono |
| `FechaRecepcion` | Fecha | Fecha de recepción |
| `Email` | Texto | Correo electrónico |
| `Dispositivo` | Texto múltiple | Dispositivo a recibir |
| `Falla` | Texto múltiple | Descripción de la falla |
| `EstadoEquipo` | Texto | Estado del equipo |
| `Estatus` | Choice | Estatus (Pendiente/Listo/etc) |
| `Solucion` | Texto múltiple | Solución aplicada |
| `FechaEntrega` | Fecha | Fecha de entrega |
| `Total` | Moneda | Total ($) |
| `Anticipo` | Moneda | Anticipo |
| `AsignadoA` | Persona | Asignado a |

### B. Lista: `BitFix_Config`
| Columna | Tipo | Propósito |
|---------|------|-----------|
| `Parametro` | Texto (Key) | Nombre del parámetro |
| `Valor` | Texto múltiple | URL de Logo, Video, etc. |

---

## 2. LÓGICA DE BACKEND (Power Automate)

### Flujo 1: Registro y Generación de Folio
*   **Trigger:** Al crearse un elemento en `BitFix_Servicios`.
*   **Acción:** Generar folio automático.
    *   *Lógica:* `concatenate("BF-", formatNumber(items('List_Name')?['ID'], '00000'))`
*   **Acción:** Enviar correo de confirmación (Outlook Connector).

### Flujo 2: Notificación de "Equipo Listo"
*   **Trigger:** Al modificarse un elemento en `BitFix_Servicios`.
*   **Condición:** Si `Estatus` es igual a `Listo` y antes era distinto.
*   **Acción:** Enviar correo al cliente con detalles de la solución y total a pagar.

---

## 3. INTERFAZ DE USUARIO (Power Apps - Canvas App)

### Pantalla 1: Registro Público
*   **Formulario:** `EditForm` conectado a `BitFix_Servicios`.
*   **Validación (Power Fx):**
    `IsMatch(TextInput_Tel.Text, "^\d{10}$")`
*   **Botón Enviar:** `SubmitForm(Form_Registro); ResetForm(Form_Registro);`

### Pantalla 2: Panel de Administrador
*   **Galería:** Filtrada por búsqueda y estatus.
    `Filter(BitFix_Servicios, Estatus_Dropdown.Selected.Value = Estatus || Estatus_Dropdown.Selected.Value = "Todos")`
*   **Seguridad:** Validar rol de usuario al inicio.
    `Set(UserRole, LookUp(Office365Users.MyProfileV2().jobTitle, ...))` o lista personalizada.

### Pantalla 3: Consulta de Estatus (Pública)
*   **Input:** Campo de texto para Folio.
*   **Búsqueda:** `LookUp(BitFix_Servicios, Title = TextInput_Folio.Text)`
*   **Visualización:** Mostrar solo campos no sensibles.

---

## 4. NOTAS DE SEGURIDAD
*   En Power Apps, usa la conexión `SharePoint` con permisos de "Solo lectura" para la pantalla de consulta pública si se distribuye externamente.
*   Utiliza **Power Automate Per User** o **Per Flow** para gestionar el envío de correos desde una cuenta institucional (ej: soporte@empresa.com).
