import json
import os

# Try to import from existing config utility, otherwise define path logic here
try:
    from ..utils.config import get_config_file_path
    DEFAULT_HOSTS_FILE_PATH = get_config_file_path("hosts_config.json")
except ImportError:
    # Fallback if get_config_file_path is not available or not yet created
    # This makes HostManager potentially dependent on the structure of utils.config
    # A better approach might be to pass the config path in __init__
    APP_NAME = "ai_gui_app"
    if os.name == 'nt': # Windows
        CONFIG_DIR = os.path.join(os.environ['APPDATA'], APP_NAME)
    else: # macOS/Linux
        CONFIG_DIR = os.path.join(os.path.expanduser('~'), '.config', APP_NAME)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    DEFAULT_HOSTS_FILE_PATH = os.path.join(CONFIG_DIR, "hosts_config.json")

class HostManager:
    def __init__(self, hosts_file_path=None):
        """
        Initializes the HostManager.
        Args:
            hosts_file_path (str, optional): Path to the JSON file storing host configurations.
                                            Defaults to a path in the user's config directory.
        """
        self.hosts_file_path = hosts_file_path or DEFAULT_HOSTS_FILE_PATH
        self.hosts_config = self._load_config() # Contains all hosts and the active host name

    def _load_config(self) -> dict:
        """Loads host configurations and active host from the JSON file."""
        try:
            if os.path.exists(self.hosts_file_path):
                with open(self.hosts_file_path, 'r') as f:
                    config = json.load(f)
                    # Ensure essential keys exist
                    if "hosts" not in config:
                        config["hosts"] = {}
                    if "active_host_name" not in config:
                        config["active_host_name"] = None
                    return config
            else:
                # Default structure if file doesn't exist
                return {"hosts": {}, "active_host_name": None}
        except (IOError, json.JSONDecodeError) as e:
            print(f"Error loading hosts configuration: {e}")
            return {"hosts": {}, "active_host_name": None} # Return default on error

    def _save_config(self):
        """Saves the current host configurations and active host to the JSON file."""
        try:
            with open(self.hosts_file_path, 'w') as f:
                json.dump(self.hosts_config, f, indent=4)
        except IOError as e:
            print(f"Error saving hosts configuration: {e}")

    def add_host(self, name: str, address: str) -> bool:
        """Adds a new host. Returns False if name already exists, True otherwise."""
        if name in self.hosts_config["hosts"]:
            print(f"Host name '{name}' already exists.")
            return False
        self.hosts_config["hosts"][name] = address.rstrip('/')
        self._save_config()
        # If this is the first host added, make it active
        if self.hosts_config["active_host_name"] is None:
            self.set_active_host(name)
        return True

    def update_host(self, name: str, new_address: str) -> bool:
        """Updates an existing host's address. Returns False if name not found, True otherwise."""
        if name not in self.hosts_config["hosts"]:
            print(f"Host name '{name}' not found for update.")
            return False
        self.hosts_config["hosts"][name] = new_address.rstrip('/')
        self._save_config()
        return True

    def delete_host(self, name: str) -> bool:
        """Deletes a host. Returns False if name not found, True otherwise."""
        if name not in self.hosts_config["hosts"]:
            print(f"Host name '{name}' not found for deletion.")
            return False
        del self.hosts_config["hosts"][name]
        # If the deleted host was the active one, reset active_host_name
        if self.hosts_config["active_host_name"] == name:
            self.hosts_config["active_host_name"] = None
            # Optionally, set another host as active if available
            if self.hosts_config["hosts"]:
                self.hosts_config["active_host_name"] = list(self.hosts_config["hosts"].keys())[0]
        self._save_config()
        return True

    def get_host_address(self, name: str) -> str | None:
        """Gets the address of a host by its name."""
        return self.hosts_config["hosts"].get(name)

    def get_all_hosts(self) -> dict:
        """Returns a dictionary of all host names and their addresses."""
        return self.hosts_config["hosts"].copy()

    def get_active_host_name(self) -> str | None:
        """Gets the name of the currently active host."""
        return self.hosts_config["active_host_name"]

    def get_active_host_address(self) -> str | None:
        """Gets the address of the currently active host."""
        active_name = self.get_active_host_name()
        if active_name:
            return self.get_host_address(active_name)
        return None

    def set_active_host(self, name: str) -> bool:
        """Sets the active host by its name. Returns False if name not found, True otherwise."""
        if name not in self.hosts_config["hosts"]:
            print(f"Host name '{name}' not found. Cannot set as active.")
            return False
        self.hosts_config["active_host_name"] = name
        self._save_config()
        return True

# Example Usage (for testing purposes)
if __name__ == '__main__':
    # This will create/use a hosts_config.json in a standard config location
    # or in the local directory if the config path logic fails.

    # To ensure it uses a local file for this test:
    # test_hosts_file = "test_hosts_config.json"
    # if os.path.exists(test_hosts_file):
    #    os.remove(test_hosts_file)
    # manager = HostManager(hosts_file_path=test_hosts_file)

    manager = HostManager() # Uses default path

    print(f"Using hosts file: {manager.hosts_file_path}")

    print("\nInitial hosts:", manager.get_all_hosts())
    print("Initial active host name:", manager.get_active_host_name())
    print("Initial active host address:", manager.get_active_host_address())

    manager.add_host("Localhost", "http://localhost:1234")
    manager.add_host("Dev Server", "http://dev.example.com:8080/") # Test trailing slash removal

    print("\nAfter adding hosts:", manager.get_all_hosts())

    manager.set_active_host("Localhost")
    print("\nActive host name:", manager.get_active_host_name())
    print("Active host address:", manager.get_active_host_address())

    manager.update_host("Localhost", "http://127.0.0.1:1234")
    print("\nAfter updating Localhost:", manager.get_all_hosts())
    print("Active host address (should be updated):", manager.get_active_host_address())

    manager.add_host("To Delete", "http://delete.me:123")
    print("\nBefore deletion:", manager.get_all_hosts())
    manager.delete_host("To Delete")
    print("After deletion:", manager.get_all_hosts())

    # Test deleting active host
    manager.add_host("ActiveToDelete", "http://active.delete.me:123")
    manager.set_active_host("ActiveToDelete")
    print(f"\nActive host before delete: {manager.get_active_host_name()}")
    manager.delete_host("ActiveToDelete")
    print(f"Hosts after deleting active: {manager.get_all_hosts()}")
    print(f"Active host name after delete: {manager.get_active_host_name()}") # Should be None or another host
    print(f"Active host address after delete: {manager.get_active_host_address()}")

    # Clean up the test file if it was created locally for the test
    # if os.path.exists(test_hosts_file):
    #     os.remove(test_hosts_file)
    #     print(f"\nCleaned up {test_hosts_file}")

    # To see the actual default config file, you might need to check:
    # print(f"Default config file is at: {DEFAULT_HOSTS_FILE_PATH}")
