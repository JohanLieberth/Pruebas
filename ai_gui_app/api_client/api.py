import requests

class APIClient:
    def __init__(self, base_url: str):
        """
        Initializes the API Client.
        Args:
            base_url (str): The base URL of the AI API host (e.g., http://localhost:1234)
        """
        self.base_url = base_url.rstrip('/') # Ensure no trailing slash

    def get_models(self) -> list:
        """
        Fetches the list of available AI models.
        Assumes the endpoint is {base_url}/v1/models.
        """
        try:
            response = requests.get(f"{self.base_url}/v1/models")
            response.raise_for_status()  # Raises an HTTPError for bad responses (4XX or 5XX)
            return response.json().get("data", []) # Models are often wrapped in a 'data' key
        except requests.exceptions.RequestException as e:
            print(f"Error fetching models: {e}")
            return [] # Return empty list on error

    def post_chat_completion(self, messages: list, model: str = None, temperature: float = 0.7, max_tokens: int = 150) -> dict:
        """
        Sends a chat completion request.
        Args:
            messages (list): A list of message objects, e.g., [{"role": "user", "content": "Hello"}].
            model (str, optional): The model ID to use.
            temperature (float, optional): Controls randomness.
            max_tokens (int, optional): Maximum number of tokens to generate.
        Returns:
            dict: The JSON response from the API.
        """
        payload = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        if model:
            payload["model"] = model

        try:
            response = requests.post(f"{self.base_url}/v1/chat/completions", json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error in chat completion: {e}")
            # Consider how to propagate this error to the UI
            return {"error": str(e)}

    def post_completion(self, prompt: str, model: str = None, max_tokens: int = 50, temperature: float = 0.7, stream: bool = False) -> dict:
        """
        Sends a standard completion request.
        Args:
            prompt (str): The prompt for the AI.
            model (str, optional): The model ID to use.
            max_tokens (int, optional): Maximum number of tokens to generate.
            temperature (float, optional): Controls randomness.
            stream (bool, optional): Whether to stream the response.
        Returns:
            dict: The JSON response from the API.
        """
        payload = {
            "prompt": prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream
        }
        if model:
            payload["model"] = model

        try:
            response = requests.post(f"{self.base_url}/v1/completions", json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error in completion: {e}")
            return {"error": str(e)}

    def post_embeddings(self, input_text: str, model: str = None) -> dict:
        """
        Requests embeddings for the input text.
        Args:
            input_text (str): The text to get embeddings for.
            model (str, optional): The model ID to use.
        Returns:
            dict: The JSON response from the API.
        """
        payload = {
            "input": input_text
        }
        if model:
            payload["model"] = model

        try:
            response = requests.post(f"{self.base_url}/v1/embeddings", json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching embeddings: {e}")
            return {"error": str(e)}

# Example Usage (for testing purposes, will be removed or commented out later)
if __name__ == '__main__':
    # This example assumes a local server is running at http://localhost:1234
    # and it's compliant with the OpenAI API structure for these endpoints.

    # Test server (mock or actual) needs to be running for these to work.
    # For now, this will likely fail if no server is active.
    client = APIClient(base_url="http://localhost:1234")

    print("Fetching models...")
    models = client.get_models()
    print(f"Available models: {models}\n")

    if models:
        # Assuming the first model returned can be used, or specify one.
        # Some APIs might not list the model in /v1/models that is used by default in /v1/chat/completions
        # For example, gpt-3.5-turbo might not be in /v1/models from a local server
        # but is the expected model for chat completions.
        # We'll try to use a model from the list if available, otherwise None.
        chat_model_to_use = models[0]['id'] if models and isinstance(models, list) and len(models) > 0 and 'id' in models[0] else "default-chat-model"
        completion_model_to_use = models[0]['id'] if models and isinstance(models, list) and len(models) > 0 and 'id' in models[0] else "default-completion-model"
        embedding_model_to_use = models[0]['id'] if models and isinstance(models, list) and len(models) > 0 and 'id' in models[0] else "default-embedding-model"

        print(f"Attempting chat completion with model: {chat_model_to_use}...")
        chat_response = client.post_chat_completion(
            messages=[{"role": "user", "content": "Hello, world!"}],
            model=chat_model_to_use
        )
        print(f"Chat completion response: {chat_response}\n")

        print(f"Attempting completion with model: {completion_model_to_use}...")
        completion_response = client.post_completion(
            prompt="Once upon a time",
            model=completion_model_to_use
        )
        print(f"Completion response: {completion_response}\n")

        print(f"Attempting to get embeddings for 'hello world' with model: {embedding_model_to_use}...")
        embeddings_response = client.post_embeddings(
            input_text="hello world",
            model=embedding_model_to_use
        )
        print(f"Embeddings response: {embeddings_response}")
    else:
        print("No models found, skipping further API calls.")
