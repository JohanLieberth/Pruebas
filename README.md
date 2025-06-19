# Website Content Chatbot

This is a simple web-based chatbot application that allows you to interact with the content of a specific webpage. You provide a URL, the application fetches and extracts text from that page, and then you can ask questions or request summaries from a local AI service that processes this extracted text.

## Features

*   Fetches content from a user-provided URL.
*   Extracts relevant text from the webpage.
*   Sends the extracted text and user prompts to a local AI service.
*   Displays a chat interface for bidirectional conversation.

## Prerequisites

1.  **Python 3.7+**: Ensure you have Python installed. You can download it from [python.org](https://www.python.org/).
2.  **pip**: Python's package installer, usually comes with Python.
3.  **Local AI Service**: This application requires a local AI service running and accessible at `http://127.0.0.1:1234/chat`.
    *   The AI service must accept POST requests with a JSON payload of the format:
        ```json
        {
            "context": "The extracted text from the website...",
            "prompt": "The user's question or instruction..."
        }
        ```
    *   It should return a JSON response of the format:
        ```json
        {
            "response": "The AI's answer based on the context and prompt..."
        }
        ```
        (Alternatively, the key for the AI's answer can be "answer" or "message".)

## Setup Instructions

1.  **Clone the repository (if applicable) or download the files.**
    If this project is in a Git repository, clone it:
    ```bash
    # git clone <repository-url>
    # cd <repository-directory>
    ```
    If you have the files directly, navigate to the project directory.

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    ```
    Activate the virtual environment:
    *   On Windows:
        ```bash
        .\venv\Scripts\activate
        ```
    *   On macOS and Linux:
        ```bash
        source venv/bin/activate
        ```

3.  **Install dependencies:**
    With the virtual environment activated, install the required Python packages:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

1.  **Ensure your local AI service is running** at `http://127.0.0.1:1234/chat`.

2.  **Start the Flask application:**
    From the project's root directory (where `app.py` is located):
    ```bash
    flask run
    ```
    Alternatively, you can run:
    ```bash
    python app.py
    ```
    You should see output indicating the server is running, typically on `http://127.0.0.1:5000/`.

3.  **Access the application:**
    Open your web browser and navigate to `http://127.0.0.1:5000/`.

## How to Use

1.  **Enter URL**: In the "Step 1: Enter Website URL" section, type or paste the full URL of the website you want to chat about (e.g., `https://en.wikipedia.org/wiki/Web_scraping`).
2.  **Fetch Content**: Click the "Fetch Content" button. The application will attempt to retrieve and process the text from the URL. You'll see a status message.
3.  **Chat**: If content is fetched successfully, the "Step 2: Chat about the website" area will appear. Type your questions or requests (e.g., "Summarize this page", "What does it say about X?") into the message input field and click "Send" or press Enter.
4.  The AI's responses will appear in the chat history.

## Troubleshooting

*   **"Error fetching URL"**: Ensure the URL is correct and the website is accessible. Check your internet connection. Some websites may block scraping attempts.
*   **"Error: Could not connect to the AI service."**: Make sure your local AI service is running at `http://127.0.0.1:1234/chat` and is functioning correctly. Check its console for any errors.
*   **No text extracted or "AI's abilities might be limited"**: The application tries to extract text from common HTML tags (`<p>`, headings, `<li>`). Some websites might have complex structures or use client-side JavaScript rendering extensively, which can make text extraction difficult for this simple scraper.
```
