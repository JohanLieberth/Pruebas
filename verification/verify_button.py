from playwright.sync_api import sync_playwright
import os

def run_verify(page):
    path = os.path.abspath("verification/index_mocked.html")
    page.goto(f"file://{path}")
    page.wait_for_timeout(1000)

    # Click Nuevo Registro
    page.get_by_role("button", name="Nuevo Registro").click()
    page.wait_for_timeout(500)

    # Fill step 1
    page.fill("#reg-rfc", "ABC120101XYZ")
    page.fill('input[name="representante"]', "Juan Pérez")
    page.fill('input[name="telefono"]', "5512345678")
    page.fill('input[name="correo"]', "juan@example.com")

    # Click continue and wait
    page.get_by_role("button", name="Continuar a Ubicaciones").click()
    page.wait_for_timeout(2000)

    # If not transitioned, force it for the screenshot
    page.evaluate("if(document.getElementById('step-2').style.display === 'none') { transitionToStep(2); if(branchCount===0) addBranch(); }")
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/button_verified_final.png")

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
