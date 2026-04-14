from playwright.sync_api import sync_playwright
import os

def run_v2(page):
    path = os.path.abspath("verification/index_mocked.html")
    page.goto(f"file://{path}")
    page.wait_for_timeout(1000)

    # Test Dashboard and Work Plan History (easier to start here)
    page.get_by_role("button", name="Continuar Registro / Subir Plan de Trabajo").click()
    page.fill("#login-rfc", "ABC120101XYZ")
    page.get_by_role("button", name="Acceder").click()

    page.wait_for_selector("#lista-planes", state="visible", timeout=10000)
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/dashboard_v2.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/videos")
        page = context.new_page()
        try:
            run_v2(page)
        finally:
            context.close()
            browser.close()
