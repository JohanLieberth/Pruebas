# Webpage Q&A Chatbot

## Description

This application allows you to chat with the content of a specific webpage. You provide a URL, the application extracts the text from that page, and then you can ask questions based solely on the information found on that webpage. It does not use any external knowledge.

## Features

*   Fetches content from a user-provided URL.
*   Extracts and cleans the main textual content from the webpage.
*   Processes the text into manageable chunks (sentences).
*   Allows users to ask questions about the content.
*   Uses TF-IDF and cosine similarity to find relevant text sections for answering questions.
*   Interactive command-line interface.

## Requirements

*   Python 3.7+
*   Dependencies listed in `requirements.txt`:
    *   `requests`
    *   `beautifulsoup4`
    *   `nltk`
    *   `scikit-learn`
    *   `numpy`

## Setup and Installation

1.  **Clone the repository (if applicable):**
    If you have downloaded this as a project, navigate to its root directory.

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **NLTK Data (`punkt`):**
    The application will attempt to download the necessary NLTK `punkt` tokenizer data automatically on its first run if it's not found. If you encounter issues, you can manually download it by running a Python interpreter and typing:
    ```python
    import nltk
    nltk.download('punkt')
    ```

## How to Run

Once the dependencies are installed, run the application from the project's root directory using:

```bash
python chat_with_webpage.py
```

## How to Use

1.  When prompted, enter the full URL of the webpage you want to process (e.g., `https://en.wikipedia.org/wiki/Python_(programming_language)`).
    *   Type `quit` at the URL prompt to exit the application.
2.  The application will fetch, clean, and process the content. You'll see status messages.
3.  Once processed, you'll be prompted to ask a question.
4.  Type your question and press Enter. The application will provide an answer based on the webpage's content.
5.  After an answer, you can:
    *   Ask another question about the same webpage.
    *   Type `new_url` to process a different webpage.
    *   Type `quit` to exit the application.

```
