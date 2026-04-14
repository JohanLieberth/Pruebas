from playwright.sync_api import sync_playwright
import os

def run_verify(page):
    path = os.path.abspath("verification/index_mocked.html")
    page.goto(f"file://{path}")
    page.wait_for_timeout(1000)

    # 1. Access dashboard
    page.get_by_role("button", name="Continuar Registro / Subir Plan de Trabajo").click()
    page.fill("#login-rfc", "ABC120101XYZ")
    page.get_by_role("button", name="Acceder").click()
    page.wait_for_timeout(1000)

    # 2. Toggle new branch form
    page.get_by_role("button", name="Registrar Nueva Ubicación").click()
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/new_branch_form.png")

    # 3. Fill and verify commitments are there
    page.fill(".branch-nombre", "Nueva Sucursal Norte")
    page.check(".branch-comp >> nth=0")
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/new_branch_filled.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/videos")
        page = context.new_page()
        try:
            run_verify(page)
        finally:
            context.close()
            browser.close()
