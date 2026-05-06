import asyncio
from playwright.async_api import async_playwright
import os

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Load the mock environment
        abs_path = os.path.abspath("verification/index_mocked.html")
        await page.goto(f"file://{abs_path}")

        # 1. Test Registration and Step 6 (Training)
        print("Testing Registration and Step 6")
        await page.click("button:has-text('Nuevo Registro')")
        await page.wait_for_selector("#reg-rfc", state="visible")
        await page.fill("#reg-rfc", "MAG040813731")
        await page.fill('input[name="representante"]', "Juan Perez")
        await page.fill('input[name="telefono"]', "5512345678")
        await page.fill('input[name="correo"]', "juan@test.com")
        await page.click("text=Continuar a Sucursales")

        await page.wait_for_selector("text=Paso 2: Registro de Sucursales")
        await page.fill(".branch-nombre", "Sucursal Centro")
        await page.fill(".branch-direccion", "Av. Reforma 123")
        await page.fill(".branch-coords", "19.4326, -99.1332")
        await page.fill(".branch-horario", "9:00 - 18:00")
        await page.fill(".branch-telefono", "5511112222")
        await page.fill(".branch-responsable", "Maria Lopez")
        await page.fill(".branch-cargo", "Gerente")
        await page.click("text=Continuar a Compromisos")

        await page.wait_for_selector("text=Paso 3: Compromisos Generales")
        checkboxes = await page.query_selector_all(".compromiso")
        for cb in checkboxes: await cb.check()
        await page.click("text=Revisar y Confirmar")

        await page.wait_for_selector("text=Paso 4: Confirmación del Registro")
        await page.click("text=Finalizar Registro")

        # Success Initial (Step 5)
        await page.wait_for_selector("text=¡Información de Empresa Registrada!")
        await page.click("text=Seleccionar Capacitación")

        # Step 6: Selection
        await page.wait_for_selector("text=Paso 6: Calendario de Capacitaciones")
        await page.click(".calendar-item")
        await page.click("text=Finalizar e Inscribir")

        # Comprobante Final
        await page.wait_for_selector("text=¡Inscripción Completada!")
        await page.screenshot(path="verification/screenshots/registration_final_comprobante.png")

        # 2. Test Dashboard: Training Progress and Plan Update
        print("Testing Dashboard: Training and Plans")
        await page.click("text=Volver al Inicio")
        await page.click("text=Continuar Registro / Plan de Trabajo")
        await page.fill("#login-rfc", "MAG040813731")
        await page.click("text=Acceder")

        await page.wait_for_selector("#user-dashboard.active")
        await page.wait_for_selector("text=Seguimiento de Capacitación")
        await page.screenshot(path="verification/screenshots/dashboard_training_progress.png")

        # Test Plan Update
        print("Testing Plan Update")
        await page.click("text=Actualizar") # Click on button in the table
        await page.wait_for_selector("textarea[placeholder='Describa los cambios realizados...']")
        await page.fill("#plan-detalle", "Correcciones enviadas")
        await page.click("text=Enviar Plan de Trabajo")

        # Check Alert (mocked) or wait for reloading logic
        # For this test, we just take a screenshot of the filled update form
        await page.screenshot(path="verification/screenshots/dashboard_plan_update.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
