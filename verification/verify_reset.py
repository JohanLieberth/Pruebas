from playwright.sync_api import sync_playwright
import os

def run_verify(page):
    path = os.path.abspath("verification/index_mocked.html")
    page.goto(f"file://{path}")
    page.wait_for_timeout(1000)

    # 1. Manually show success section
    page.evaluate("() => { transitionToStep(5); document.getElementById('success-folio').innerText = 'MS-TEST'; document.getElementById('step-5').style.display='block'; document.getElementById('wizard-section').classList.add('active'); document.getElementById('welcome-section').classList.remove('active'); }")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/before_reset.png")

    # 2. Click 'Registrar otra empresa' which calls resetApp()
    page.get_by_text("Registrar otra empresa / Volver al Inicio").click()
    page.wait_for_timeout(1000)

    # 3. Verify we are back at the welcome section
    page.screenshot(path="/home/jules/verification/screenshots/after_reset.png")

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
