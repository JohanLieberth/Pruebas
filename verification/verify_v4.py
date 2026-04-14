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

        # Wait for catalog to load
        await page.wait_for_selector(".catalog-card")
        await page.screenshot(path="verification/screenshots/landing_page_v4.png")

        print("Testing Step 1: Company Data")
        # Click the button with the text "Nuevo Registro"
        await page.click("button:has-text('Nuevo Registro')")
        await page.wait_for_selector("#reg-rfc", state="visible")
        await page.fill("#reg-rfc", "MAG040813731")
        await page.fill('input[name="representante"]', "Juan Perez")
        await page.fill('input[name="telefono"]', "5512345678")
        await page.fill('input[name="correo"]', "juan@test.com")
        await page.click("text=Continuar a Sucursales")

        print("Testing Step 2: Branches (Sucursales)")
        await page.wait_for_selector("text=Paso 2: Registro de Sucursales")
        await page.fill(".branch-nombre", "Sucursal Centro")
        await page.fill(".branch-direccion", "Av. Reforma 123")
        await page.fill(".branch-coords", "19.4326, -99.1332")
        await page.fill(".branch-horario", "9:00 - 18:00")
        await page.fill(".branch-telefono", "5511112222")
        await page.fill(".branch-responsable", "Maria Lopez")
        await page.fill(".branch-cargo", "Gerente")

        await page.screenshot(path="verification/screenshots/step2_filled.png")
        await page.click("text=Continuar a Compromisos")

        print("Testing Step 3: Commitments")
        await page.wait_for_selector("text=Paso 3: Compromisos Generales")
        # Check all checkboxes
        checkboxes = await page.query_selector_all(".compromiso")
        for cb in checkboxes:
            await cb.check()

        await page.click("text=Revisar y Confirmar")

        print("Testing Step 4: Summary")
        await page.wait_for_selector("text=Paso 4: Confirmación del Registro")
        await page.screenshot(path="verification/screenshots/step4_summary.png")
        await page.click("text=Finalizar Registro")

        print("Testing Step 5: Success")
        await page.wait_for_selector("text=¡Registro Completado con Éxito!")
        await page.screenshot(path="verification/screenshots/step5_success.png")

        # Test Dashboard / Login
        print("Testing Dashboard")
        await page.click("text=Registrar otra empresa / Volver al Inicio")
        await page.click("text=Continuar Registro / Plan de Trabajo")
        await page.fill("#login-rfc", "MAG040813731")
        await page.click("text=Acceder")

        await page.wait_for_selector("#user-dashboard.active")
        # Check if locations are loaded in dropdown
        await page.wait_for_selector("#plan-id-ubicacion option[value='loc-123']")
        await page.screenshot(path="verification/screenshots/dashboard_view.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
