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
    page.wait_for_timeout(2000)

    # Scroll to bottom
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/upload_dropdown_scrolled.png")

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
