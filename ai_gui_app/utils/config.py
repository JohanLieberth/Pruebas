import json
import os

CONFIG_FILE_NAME = "app_config.json"

def get_config_path():
    # Get path to user's config directory
    if os.name == 'nt': # Windows
        app_data_path = os.getenv('APPDATA')
        if not app_data_path:
             app_data_path = os.path.expanduser("~") # Fallback to home if APPDATA not set
        config_dir = os.path.join(app_data_path, "AIGUIApplication")
    else: # macOS/Linux
        config_dir = os.path.join(os.path.expanduser("~"), ".config", "AIGUIApplication")

    if not os.path.exists(config_dir):
        os.makedirs(config_dir)
    return os.path.join(config_dir, CONFIG_FILE_NAME)

def load_config():
    """Loads application configuration from a JSON file."""
    config_path = get_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                # Basic validation or migration could be done here
                return config
        except json.JSONDecodeError:
            print(f"Warning: Error decoding JSON from {config_path}. Using default config.")
            return {} # Return default or empty config
        except Exception as e:
            print(f"Warning: Could not load config from {config_path}: {e}. Using default config.")
            return {}
    return {} # Default config if file doesn't exist

def save_config(config):
    """Saves application configuration to a JSON file."""
    config_path = get_config_path()
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=4)
    except Exception as e:
        print(f"Error: Could not save config to {config_path}: {e}")

# --- Default values and specific config accessors ---
DEFAULT_HOST_PATH = "" # No default, user must select
DEFAULT_API_BASE_URL = "http://localhost:1234" # Corrected default

def get_host_path(config=None):
    cfg = config or load_config()
    return cfg.get("host_path", DEFAULT_HOST_PATH)

def set_host_path(host_path):
    config = load_config()
    config["host_path"] = host_path
    save_config(config)

def get_api_base_url(config=None):
    cfg = config or load_config()
    return cfg.get("api_base_url", DEFAULT_API_BASE_URL)

def set_api_base_url(api_url):
    config = load_config()
    config["api_base_url"] = api_url
    save_config(config)

# Added by subtask to support HostManager
def get_config_file_path(filename: str) -> str:
    APP_NAME = "AIGUIApplication" # Corrected app name to match existing logic
    if os.name == 'nt': # Windows
        config_dir = os.path.join(os.getenv('APPDATA', os.path.expanduser("~")), APP_NAME)
    else: # macOS/Linux
        config_dir = os.path.join(os.path.expanduser("~"), ".config", APP_NAME)

    # Ensure the base config directory from get_config_path() logic is used and created
    # This reuses the logic from get_config_path() to determine the main app config folder.
    base_config_dir_parts = os.path.split(get_config_path())[0]
    config_dir = base_config_dir_parts # Use the directory determined by get_config_path

    # This check might be redundant if get_config_path already creates it, but safe to have.
    if not os.path.exists(config_dir):
        os.makedirs(config_dir, exist_ok=True) # exist_ok=True for safety
    return os.path.join(config_dir, filename)

if __name__ == '__main__':
    # Example usage:
    print(f"Config file path for app_config.json: {get_config_path()}")
    print(f"Config file path for hosts_config.json: {get_config_file_path('hosts_config.json')}")


    # Load existing config or default
    current_config = load_config()
    print(f"Current config: {current_config}")

    # Get specific settings
    print(f"Host path from config: {get_host_path(current_config)}")
    print(f"API base URL from config: {get_api_base_url(current_config)}")

    # # Example of saving a setting (uncomment to test)
    # new_host_path = "/usr/local/bin/ollama_serve_custom" # Example path
    # set_host_path(new_host_path)
    # updated_config = load_config()
    # print(f"Updated host path: {get_host_path(updated_config)}")

    # # Example of saving API URL (uncomment to test)
    # new_api_url = "http://127.0.0.1:8080/custom_api"
    # set_api_base_url(new_api_url)
    # updated_config = load_config()
    # print(f"Updated API URL: {get_api_base_url(updated_config)}")

    # Clean up test config file if one was created in a non-standard location for this test
    # test_config_path = get_config_path()
    # if "AIGUIApplication_Test" in test_config_path and os.path.exists(test_config_path):
    #     os.remove(test_config_path)
    #     print(f"Cleaned up test config: {test_config_path}")
