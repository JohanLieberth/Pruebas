import asyncio
from playwright.async_api import async_playwright
import os

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        abs_path = os.path.abspath("verification/index_mocked.html")
        await page.goto(f"file://{abs_path}")

        print("Testing reordered wizard steps")
        await page.click("button:has-text('Nuevo Registro')")

        # Step 1
        await page.wait_for_selector("#reg-rfc", state="visible")
        await page.fill("#reg-rfc", "MAG040813731")
        await page.fill('input[name="representante"]', "Juan Perez")
        await page.fill('input[name="telefono"]', "5512345678")
        await page.fill('input[name="correo"]', "juan@test.com")
        await page.click("text=Continuar a Sucursales")

        # Step 2
        await page.wait_for_selector("text=Paso 2: Registro de Sucursales")
        await page.fill(".branch-nombre", "Sucursal Centro")
        await page.fill(".branch-direccion", "Av. Reforma 123")
        await page.fill(".branch-coords", "19.4326, -99.1332")
        await page.fill(".branch-horario", "9:00 - 18:00")
        await page.fill(".branch-telefono", "5511112222")
        await page.fill(".branch-responsable", "Maria Lopez")
        await page.fill(".branch-cargo", "Gerente")
        await page.click("text=Continuar a Compromisos")

        # Step 3
        await page.wait_for_selector("text=Paso 3: Compromisos Generales")
        checkboxes = await page.query_selector_all(".compromiso")
        for cb in checkboxes: await cb.check()
        await page.click("text=Revisar y Confirmar")

        # Step 4 (NEW: Calendar)
        print("Verifying Step 4: Calendar")
        await page.wait_for_selector("text=Paso 4: Calendario de Capacitaciones")
        await page.wait_for_selector(".calendar-item")
        await page.screenshot(path="verification/screenshots/reorder_step4_calendar.png")

        # Test Back Button
        await page.click("text=Atrás")
        await page.wait_for_selector("text=Paso 3: Compromisos Generales")
        await page.click("text=Revisar y Confirmar")

        # Select course and proceed
        await page.click(".calendar-item")
        await page.click("text=Continuar a Confirmación")

        # Step 5 (NEW: Summary)
        print("Verifying Step 5: Summary")
        await page.wait_for_selector("text=Paso 5: Confirmación y Finalización")
        await page.wait_for_selector("text=Capacitación Seleccionada:")
        await page.screenshot(path="verification/screenshots/reorder_step5_summary.png")

        await page.click("text=Finalizar Registro")

        # Step 6 (Success / Receipt)
        await page.wait_for_selector("text=¡Registro e Inscripción Completados!")
        await page.wait_for_selector("text=COMPROBANTE DE INSCRIPCIÓN")
        await page.screenshot(path="verification/screenshots/reorder_step6_receipt.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
