import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import threading
import os # Added for os.path.basename in process_document

# Assuming HostManager and APIClient are in these locations based on prior steps
from ..host_manager.manager import HostManager
from ..api_client.api import APIClient
# Placeholder for the HostManagementDialog - will be created in a later step
# from .host_dialog import HostManagementDialog

class MainWindow:
    def __init__(self, master: tk.Tk, api_client: APIClient, host_manager: HostManager):
        self.master = master
        self.api_client = api_client # Initial API client, base_url might be None or default
        self.host_manager = host_manager

        master.title("AI GUI Application")
        master.geometry("900x700") # Increased size slightly

        # --- Menu Bar ---
        menubar = tk.Menu(master)
        filemenu = tk.Menu(menubar, tearoff=0)
        # filemenu.add_command(label="Manage Hosts...", command=self.open_host_management_dialog) # Will be added later
        filemenu.add_separator()
        filemenu.add_command(label="Exit", command=master.quit)
        menubar.add_cascade(label="File", menu=filemenu)
        master.config(menu=menubar)

        # --- Main Layout ---
        main_frame = ttk.Frame(master, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --- Top Row: Host Selection and Management ---
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=5)

        host_selection_frame = ttk.LabelFrame(top_frame, text="API Host Configuration", padding="10")
        host_selection_frame.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,5))

        ttk.Label(host_selection_frame, text="Active Host:").pack(side=tk.LEFT, padx=(0,5))
        self.active_host_var = tk.StringVar()
        self.host_dropdown = ttk.Combobox(host_selection_frame, textvariable=self.active_host_var, state="readonly", width=30)
        self.host_dropdown.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)
        self.host_dropdown.bind("<<ComboboxSelected>>", self.on_host_selected)

        self.manage_hosts_button = ttk.Button(host_selection_frame, text="Manage Hosts...", command=self.open_host_management_dialog)
        self.manage_hosts_button.pack(side=tk.LEFT, padx=5)

        self.host_status_label = ttk.Label(host_selection_frame, text="Status: Select a host")
        self.host_status_label.pack(side=tk.LEFT, padx=10)


        # --- Middle Row: Model, Chat, Parameters ---
        middle_frame = ttk.Frame(main_frame)
        middle_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        # --- Model Selection ---
        model_frame = ttk.LabelFrame(middle_frame, text="Model Configuration", padding="10")
        model_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0,5)) # Fixed width for this section

        ttk.Label(model_frame, text="Select Model:").pack(side=tk.TOP, anchor=tk.W, padx=5, pady=(0,2))
        self.model_var = tk.StringVar()
        self.model_dropdown = ttk.Combobox(model_frame, textvariable=self.model_var, state="disabled", width=25)
        self.model_dropdown.pack(side=tk.TOP, anchor=tk.W, padx=5, expand=False)
        self.model_dropdown.bind("<<ComboboxSelected>>", self.on_model_select)

        # --- Parameters ---
        params_frame = ttk.LabelFrame(model_frame, text="Parameters", padding="10") # Moved under Model Config
        params_frame.pack(side=tk.TOP, fill=tk.X, expand=False, pady=10)

        ttk.Label(params_frame, text="Max Tokens:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.max_tokens_var = tk.IntVar(value=150)
        ttk.Entry(params_frame, textvariable=self.max_tokens_var, width=10).grid(row=0, column=1, pady=2, sticky=tk.W)

        ttk.Label(params_frame, text="Temperature:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.temp_var = tk.DoubleVar(value=0.7)
        ttk.Entry(params_frame, textvariable=self.temp_var, width=10).grid(row=1, column=1, pady=2, sticky=tk.W)

        # --- Chat Area ---
        chat_frame = ttk.LabelFrame(middle_frame, text="Chat Interaction", padding="10")
        chat_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Placeholder for chat history (to be developed)
        self.chat_history_text = tk.Text(chat_frame, height=15, wrap=tk.WORD, state="disabled", relief=tk.SUNKEN, borderwidth=1)
        self.chat_history_text.pack(fill=tk.BOTH, expand=True, pady=(0,5))

        self.prompt_text = tk.Text(chat_frame, height=5, wrap=tk.WORD, relief=tk.SUNKEN, borderwidth=1)
        self.prompt_text.pack(fill=tk.X, expand=False, pady=(0,5))
        self.prompt_text.bind("<Return>", self.send_chat_message_event) # Allow sending with Enter

        self.send_chat_button = ttk.Button(chat_frame, text="Send Message", command=self.send_chat_message)
        self.send_chat_button.pack(anchor=tk.E) # Align to the right
        self.send_chat_button["state"] = "disabled"


        # --- Document Processing Section (Placeholder) ---
        doc_frame = ttk.LabelFrame(main_frame, text="Document Processing", padding="10")
        doc_frame.pack(fill=tk.X, pady=5)
        # This will be filled in a later step
        ttk.Label(doc_frame, text="Attach Document:").pack(side=tk.LEFT, padx=5)
        self.doc_path_var = tk.StringVar()
        ttk.Entry(doc_frame, textvariable=self.doc_path_var, width=50, state="readonly").pack(side=tk.LEFT, padx=5)
        ttk.Button(doc_frame, text="Browse...", command=self.browse_document).pack(side=tk.LEFT, padx=5)
        self.process_doc_button = ttk.Button(doc_frame, text="Process Document", command=self.process_document, state="disabled")
        self.process_doc_button.pack(side=tk.LEFT, padx=5)


        # --- Output/Results Area (Generic, might be merged with chat history or used for doc results) ---
        # For now, let's assume chat history is the primary output for chat.
        # This output_text can be for document processing results or general status.
        output_frame = ttk.LabelFrame(main_frame, text="Results / Logs", padding="10")
        output_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        self.results_text = tk.Text(output_frame, height=8, wrap=tk.WORD, state="disabled", relief=tk.SUNKEN, borderwidth=1)
        self.results_text.pack(fill=tk.BOTH, expand=True)

        # Initialize UI states
        self.refresh_host_dropdown()
        self.update_ui_for_host_selection()


    def refresh_host_dropdown(self):
        """Reloads host names into the dropdown and selects the active one."""
        all_hosts = self.host_manager.get_all_hosts()
        host_names = list(all_hosts.keys())
        self.host_dropdown['values'] = host_names

        active_host_name = self.host_manager.get_active_host_name()
        if active_host_name and active_host_name in host_names:
            self.active_host_var.set(active_host_name)
        elif host_names:
            self.active_host_var.set(host_names[0]) # Select first if no active or active not in list
            self.host_manager.set_active_host(host_names[0]) # Persist this choice
        else:
            self.active_host_var.set("") # No hosts available

        self.on_host_selected() # Trigger UI update based on selection


    def on_host_selected(self, event=None):
        """Handles selection of a host from the dropdown."""
        selected_host_name = self.active_host_var.get()
        if not selected_host_name:
            self.update_ui_for_host_selection()
            return

        if self.host_manager.set_active_host(selected_host_name):
            active_host_address = self.host_manager.get_active_host_address()
            if active_host_address:
                self.api_client.base_url = active_host_address # Update API client's base URL
                self.host_status_label.config(text=f"Selected: {selected_host_name}")
                self.load_models()
            else:
                # This case should ideally not happen if name is valid
                self.host_status_label.config(text="Error: Host address not found.")
                self.api_client.base_url = None
        else:
            # This case means the name wasn't found in host_manager, also unlikely if dropdown is correct
            self.host_status_label.config(text="Error: Failed to set active host.")
            self.api_client.base_url = None

        self.update_ui_for_host_selection()


    def update_ui_for_host_selection(self):
        """Updates UI elements based on whether a valid host is selected and models are loaded."""
        if self.api_client.base_url and self.model_var.get():
            self.send_chat_button["state"] = "normal"
        else:
            self.send_chat_button["state"] = "disabled"

        if not self.api_client.base_url:
            self.model_dropdown["state"] = "disabled"
            self.model_var.set("")
            self.model_dropdown['values'] = []
            self.host_status_label.config(text="Status: Select a host")
        else:
            # Model dropdown state is handled by load_models
            pass


    def load_models(self):
        """Loads models from the currently configured API client."""
        if not self.api_client.base_url:
            self.model_var.set("")
            self.model_dropdown['values'] = []
            self.model_dropdown["state"] = "disabled"
            self.update_ui_for_host_selection()
            return

        self.host_status_label.config(text=f"Status: Loading models from {self.active_host_var.get()}...")
        self.model_dropdown["state"] = "disabled" # Disable while loading

        def _load():
            try:
                models_data = self.api_client.get_models() # List of dicts with 'id'
                model_ids = [m['id'] for m in models_data if isinstance(m, dict) and 'id' in m]

                if model_ids:
                    self.model_dropdown['values'] = model_ids
                    self.model_dropdown["state"] = "readonly"
                    # Try to keep current selection, else pick first
                    current_model = self.model_var.get()
                    if current_model and current_model in model_ids:
                        self.model_var.set(current_model)
                    else:
                        self.model_var.set(model_ids[0])
                    self.host_status_label.config(text=f"Status: Ready ({self.active_host_var.get()})")
                else:
                    self.model_var.set("")
                    self.model_dropdown['values'] = []
                    self.model_dropdown["state"] = "disabled"
                    self.host_status_label.config(text=f"Status: No models found at {self.active_host_var.get()}")
                    messagebox.showinfo("Models", f"No models available from {self.active_host_var.get()} or incompatible format.")
            except Exception as e:
                self.model_var.set("")
                self.model_dropdown['values'] = []
                self.model_dropdown["state"] = "disabled"
                self.host_status_label.config(text=f"Status: Error loading models from {self.active_host_var.get()}")
                messagebox.showerror("API Error", f"Failed to load models from {self.active_host_var.get()}: {e}")
            finally:
                self.update_ui_for_host_selection()

        threading.Thread(target=_load, daemon=True).start()

    def on_model_select(self, event=None):
        """Handles model selection to enable/disable relevant UI parts."""
        self.update_ui_for_host_selection()


    def send_chat_message_event(self, event=None):
        """Handler for sending message via Enter key in prompt_text"""
        self.send_chat_message()
        return "break" # Prevents the default newline character insertion

    def send_chat_message(self):
        if not self.model_var.get():
            messagebox.showerror("Error", "No model selected.")
            return
        if not self.api_client.base_url:
            messagebox.showerror("Error", "No API host selected/configured.")
            return

        prompt_content = self.prompt_text.get("1.0", tk.END).strip()
        if not prompt_content:
            messagebox.showerror("Error", "Prompt cannot be empty.")
            return

        max_tokens = self.max_tokens_var.get()
        temperature = self.temp_var.get()
        model_id = self.model_var.get()
        messages = [{"role": "user", "content": prompt_content}]

        self._append_to_chat_history(f"You: {prompt_content}\n")
        self.prompt_text.delete("1.0", tk.END) # Clear input field
        self.send_chat_button["state"] = "disabled" # Disable while generating

        def _generate_response():
            try:
                self._append_to_chat_history(f"AI ({model_id}): Generating...\n")
                result = self.api_client.post_chat_completion(
                    messages=messages, model=model_id, max_tokens=max_tokens, temperature=temperature
                )

                # Remove "Generating..." message for this turn
                self.chat_history_text.config(state="normal")
                # A bit complex to remove only the "Generating..." part if other messages arrived.
                # Simpler: just update with the final response. For a real chat, need better history management.
                # For now, let's assume we replace the "Generating..." line.
                # A better way would be to store message IDs and update them.
                # Quick fix: delete last line if it contains "Generating..."
                # This is still imperfect.
                current_history = self.chat_history_text.get("1.0", tk.END)
                lines = current_history.strip().split('\n')
                if lines and "Generating..." in lines[-1]:
                    # Calculate start index of the last line.
                    # END-1c is end of text, -1l is start of that line.
                    last_line_start = self.chat_history_text.index(f"end-1c linestart") # Corrected index part
                    self.chat_history_text.delete(last_line_start, tk.END)
                    # Add a newline if we deleted something that wasn't the very first message
                    if self.chat_history_text.index("end-1c") != "1.0": # Corrected index part
                         self.chat_history_text.insert(tk.END, "\n")


                if result and "choices" in result and result["choices"]:
                    response_content = result["choices"][0]["message"]["content"]
                    self._append_to_chat_history(f"AI ({model_id}): {response_content.strip()}\n\n")
                elif "error" in result:
                    self._append_to_chat_history(f"API Error: {result['error']}\n\n")
                else:
                    self._append_to_chat_history(f"Unexpected API response: {result}\n\n")

            except Exception as e:
                self._append_to_chat_history(f"Error generating text: {e}\n\n")
            finally:
                self.send_chat_button["state"] = "normal" # Re-enable button
                self.chat_history_text.see(tk.END) # Scroll to end

        threading.Thread(target=_generate_response, daemon=True).start()

    def _append_to_chat_history(self, message: str):
        self.chat_history_text.config(state="normal")
        self.chat_history_text.insert(tk.END, message)
        self.chat_history_text.config(state="disabled")
        self.chat_history_text.see(tk.END)


    def open_host_management_dialog(self):
        # This will be implemented when HostManagementDialog is created
        # For now, a placeholder:
        # dialog = HostManagementDialog(self.master, self.host_manager, self.api_client)
        # self.master.wait_window(dialog.top) # Wait for dialog to close
        # self.refresh_host_dropdown() # Refresh dropdown in case hosts changed
        messagebox.showinfo("Manage Hosts", "Host management dialog will be implemented in a future step.")
        # Temporary call to refresh to test if dialog closing would work
        self.refresh_host_dropdown()


    def browse_document(self):
        # To be implemented
        file_path = filedialog.askopenfilename(
            title="Select Document",
            filetypes=(("PDF files", "*.pdf"), ("Word files", "*.docx"), ("Excel files", "*.xlsx"), ("All files", "*.*"))
        )
        if file_path:
            self.doc_path_var.set(file_path)
            self.process_doc_button["state"] = "normal"
        else:
            self.doc_path_var.set("")
            self.process_doc_button["state"] = "disabled"

    def process_document(self):
        # To be implemented fully, using utils.doc_processor
        doc_path = self.doc_path_var.get()
        if not doc_path:
            messagebox.showerror("Error", "No document selected.")
            return

        self.results_text.config(state="normal")
        self.results_text.delete("1.0", tk.END)
        self.results_text.insert(tk.END, f"Processing document: {doc_path}...\n")
        self.results_text.config(state="disabled")

        # This should also run in a thread
        def _process():
            from ..utils.doc_processor import read_pdf, read_excel, read_word, DocumentProcessingError
            content = ""
            try:
                if doc_path.lower().endswith(".pdf"):
                    content = read_pdf(doc_path)
                elif doc_path.lower().endswith(".docx"):
                    content = read_word(doc_path)
                elif doc_path.lower().endswith(".xlsx"):
                    content = read_excel(doc_path)
                else:
                    messagebox.showerror("Error", "Unsupported file type.")
                    self.results_text.config(state="normal")
                    self.results_text.insert(tk.END, "Unsupported file type.\n")
                    self.results_text.config(state="disabled")
                    return

                self.results_text.config(state="normal")
                self.results_text.delete("1.0", tk.END) # Clear "Processing..."
                self.results_text.insert(tk.END, f"--- Extracted Content from {os.path.basename(doc_path)} ---\n")
                self.results_text.insert(tk.END, content[:2000] + ("..." if len(content) > 2000 else "")) # Show preview
                self.results_text.insert(tk.END, "\n\n--- End of Content ---")
                # Next step would be to send this content to an AI model, e.g., via post_completion
                # For now, just displaying it.

                # Example: Send to completion endpoint (if user wants to process it with AI)
                # if self.api_client.base_url and self.model_var.get() and content:
                #     self._append_to_chat_history(f"Processing document content with {self.model_var.get()}...\n")
                #     # Simplified: send first 2000 chars
                #     # In a real app, might need chunking or specific prompts
                #     # For now, this part is commented out
                #     pass


            except DocumentProcessingError as e:
                messagebox.showerror("Document Error", str(e))
                self.results_text.config(state="normal")
                self.results_text.insert(tk.END, f"Error: {e}\n")
            except Exception as e:
                messagebox.showerror("Error", f"An unexpected error occurred: {e}")
                self.results_text.config(state="normal")
                self.results_text.insert(tk.END, f"Unexpected Error: {e}\n")
            finally:
                self.results_text.config(state="disabled")

        threading.Thread(target=_process, daemon=True).start()


# For direct execution (testing)
if __name__ == "__main__":
    import os # For path manipulation in test
    # Need to adjust path for imports if running this file directly
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

    from ai_gui_app.api_client.api import APIClient
    from ai_gui_app.host_manager.manager import HostManager
    from ai_gui_app.utils.config import get_config_file_path # For HostManager default path

    root = tk.Tk()

    # Use a test-specific hosts file for the HostManager during testing
    test_hosts_file = get_config_file_path("test_main_window_hosts.json")
    if os.path.exists(test_hosts_file): # Clean up from previous tests
        os.remove(test_hosts_file)

    # Initialize actual HostManager (it will create test_main_window_hosts.json)
    # The HostManager will use its own logic to find/create this file.
    # We pass the specific path to ensure it's sandboxed for this test.
    host_manager_instance = HostManager(hosts_file_path=test_hosts_file)

    # Add some sample hosts for testing the dropdown
    host_manager_instance.add_host("Localhost (Test)", "http://localhost:1234")
    host_manager_instance.add_host("Mock Service", "http://localhost:8080") # A non-existent one for testing failures
    host_manager_instance.set_active_host("Localhost (Test)") # Set one as active

    # Initialize actual APIClient (it will get its base_url from HostManager via MainWindow logic)
    api_client_instance = APIClient(base_url=host_manager_instance.get_active_host_address())


    # Mock APIClient for UI development without a live host, if preferred.
    # This MockAPIClient is more aligned with the actual APIClient structure now.
    class MockAPIClient(APIClient): # Inherits from real one to ensure method signatures match
        def __init__(self, base_url):
            super().__init__(base_url)
            print(f"MockAPIClient initialized with base_url: {base_url}")

        def get_models(self):
            print(f"MockAPIClient: get_models called for base_url: {self.base_url}")
            if "localhost:1234" in self.base_url: # Simulate success for one host
                return [{"id": "mock_model_alpha", "object": "model"}, {"id": "mock_model_beta", "object": "model"}]
            return [] # Simulate failure or no models for other hosts

        def post_chat_completion(self, messages: list, model: str = None, temperature: float = 0.7, max_tokens: int = 150):
            print(f"MockAPIClient: post_chat_completion for model {model} at {self.base_url}")
            user_message = messages[-1]['content'] if messages else "empty"
            return {
                "choices": [{"message": {"role": "assistant", "content": f"Mocked AI: I see you asked about '{user_message}' using {model}."}}]
            }

    # To use the mock:
    # api_client_instance = MockAPIClient(base_url=host_manager_instance.get_active_host_address())

    app = MainWindow(root, api_client_instance, host_manager_instance)
    root.mainloop()

    # Clean up the test hosts file
    if os.path.exists(test_hosts_file):
        # os.remove(test_hosts_file)
        print(f"Test hosts file at: {test_hosts_file} (not removed for inspection)")
