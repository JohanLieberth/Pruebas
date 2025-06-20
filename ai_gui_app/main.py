import tkinter as tk
from ui.main_window import MainWindow
from api_client.api import APIClient
from host_manager.manager import HostManager
from utils import config # Import the config module

def main():
    # Load configuration
    app_config = config.load_config()
    # Ensure the loaded URL is the base (e.g., http://localhost:1234) and not specific paths
    api_base_url = config.get_api_base_url(app_config) # Should be like "http://localhost:11434" or "http://localhost:1234"
    host_executable_path = config.get_host_path(app_config) # Get initial host path

    # Initialize components
    api_client = APIClient(base_url=api_base_url) # APIClient appends /v1/... paths

    # The host manager needs the path to the host executable.
    # This can be loaded from config and then updated via UI.
    host_manager = HostManager(host_path=host_executable_path if host_executable_path else None)


    # --- Set up the main window ---
    root = tk.Tk()
    app = MainWindow(root, api_client, host_manager)

    # --- UI Initial Configuration ---
    # If a host path was loaded from config, update the UI to reflect it
    if host_executable_path:
        app.host_path_label.config(text=f"Host Path: {host_executable_path}")
        app.start_host_button["state"] = "normal" # Enable start if path is known
        # It's important to also trigger an initial status check if the path is known
        app.update_host_status()
    else:
        # If no host path in config, prompt user or guide them.
        # For now, the UI defaults to "Not Selected" and "disabled" buttons.
        # Optionally, could pop up the 'Select Host Path' dialog on first run.
        # Example: if not host_executable_path: root.after(100, app.select_host_path)
        pass


    # Start the periodic status check
    # The MainWindow's __init__ might already call this, or it can be started here.
    # If MainWindow already starts it, this line might be redundant or could be removed
    # from MainWindow if preferred to be managed here.
    # For now, assume MainWindow handles its own periodic updates after initialization.
    # Let's ensure it's called after the main window is fully set up.
    root.after(500, app.periodic_status_check) # Start periodic checks after a short delay

    # Start the Tkinter event loop
    root.mainloop()

    # --- Application Shutdown (Optional) ---
    # Perform any cleanup here if needed, e.g., ensuring host is stopped.
    # This code runs after the Tkinter window is closed.
    print("Application shutting down...")
    if host_manager.is_host_running():
        print("Attempting to stop host on application exit...")
        # host_manager.stop_host() # Be cautious with auto-stopping if user expects host to persist

    # Save any configuration changes made during the session
    # Example: if the API URL or host path could be changed dynamically and need saving
    # config.set_host_path(host_manager.host_path) # Assuming host_manager.host_path is updated by UI
    # config.set_api_base_url(api_client.base_url) # Assuming api_client.base_url could change

if __name__ == '__main__':
    main()
