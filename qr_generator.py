import qrcode
import tkinter as tk
from tkinter import simpledialog, messagebox, filedialog
import os
from PIL import Image

# Texto o enlace para el QR
root = tk.Tk()
root.withdraw()  # Oculta la ventana principal

data = simpledialog.askstring("Entrada", "Introduce el texto o enlace para el QR:")
if not data:
    messagebox.showerror("Error", "No se ingresó ningún dato.")
    exit()

nombre_archivo = simpledialog.askstring("Entrada", "Introduce el nombre del archivo (ejemplo: mi_qr.png):")
if not nombre_archivo:
    messagebox.showerror("Error", "No se ingresó el nombre del archivo.")
    exit()

# Preguntar si se quiere añadir un icono
add_icon = messagebox.askyesno("Icono", "¿Quieres añadir un icono al código QR?")
icon_path = None
icon_selected_and_valid = False
if add_icon:
    icon_path = filedialog.askopenfilename(
        title="Selecciona el archivo del icono",
        filetypes=[("Image files", "*.png *.jpg *.jpeg *.bmp *.gif"), ("All files", "*.*")]
    )
    if icon_path and isinstance(icon_path, str) and os.path.exists(icon_path):
        icon_selected_and_valid = True
    elif icon_path: # Path was given but it's not valid or doesn't exist
        messagebox.showwarning("Advertencia de Icono", "La ruta del icono seleccionada no es válida o el archivo no existe. Se generará el QR sin icono.")
    # If icon_path is None or empty, no message needed, just proceed without icon.

# Crear el objeto QR
qr = qrcode.QRCode(
    version=1,
    box_size=10,
    border=5
)
qr.add_data(data)
qr.make(fit=True)

# Crear la imagen
img = qr.make_image(fill='black', back_color='white')

if icon_selected_and_valid:
    try:
        icon_img = Image.open(icon_path).convert("RGBA")
        qr_width, qr_height = img.size
        icon_size = qr_width // 5
        icon_img = icon_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        pos_x = (qr_width - icon_size) // 2
        pos_y = (qr_height - icon_size) // 2
        img.paste(icon_img, (pos_x, pos_y), icon_img)
    except Exception as e:
        messagebox.showerror("Error de Icono", f"No se pudo cargar o procesar el icono: {e}")
        # Decide if you want to exit or continue without icon
        # For now, let's continue without the icon if there's an error
        pass


# Preguntar al usuario dónde guardar la imagen
ruta_completa = filedialog.asksaveasfilename(
    defaultextension=".png",
    filetypes=[("PNG files", "*.png"), ("All files", "*.*")],
    initialfile=nombre_archivo,
    title="Guardar código QR como"
)

if not ruta_completa:
    messagebox.showerror("Error", "No se seleccionó una ubicación para guardar el archivo.")
    exit()

img.save(ruta_completa)

messagebox.showinfo("Éxito", f"Código QR guardado como {ruta_completa}")
