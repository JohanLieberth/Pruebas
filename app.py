from flask import Flask, render_template, request, session, jsonify
import requests
from bs4 import BeautifulSoup

AI_SERVICE_URL = "http://127.0.0.1:1234/chat" # Assuming /chat endpoint

app = Flask(__name__)
# IMPORTANT: Change this to a strong, random key and keep it secret!
# For development, this is fine. For production, use an environment variable.
app.secret_key = 'dev_secret_key_chatbot'

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/process_url', methods=['POST'])
def process_url():
    data = request.get_json()
    url = data.get('url')

    if not url:
        return jsonify({'status': 'error', 'message': 'URL is required'}), 400

    try:
        response = requests.get(url, timeout=10) # Added timeout
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)

        soup = BeautifulSoup(response.content, 'html.parser')

        # Extract text from common content-holding tags
        texts = []
        for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'article', 'main']):
            texts.append(tag.get_text(separator=' ', strip=True))

        extracted_text = '\n'.join(texts) # Join with newlines to preserve some structure

        if not extracted_text.strip():
            # Handle cases where no text was extracted even if the request was successful
            session['extracted_text'] = "" # Store empty string
            return jsonify({'status': 'warning', 'message': 'URL fetched, but no text content found or extracted from specified tags.', 'text_length': 0})

        session['extracted_text'] = extracted_text

        return jsonify({
            'status': 'success',
            'message': f'Successfully fetched and processed URL: {url}',
            'text_length': len(extracted_text)
        })

    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': f'Error fetching URL: {str(e)}'}), 500
    except Exception as e:
        # Catch any other potential errors during parsing
        return jsonify({'status': 'error', 'message': f'Error processing HTML: {str(e)}'}), 500

def get_ai_response(context_text, user_prompt):
    payload = {
        "context": context_text,
        "prompt": user_prompt
    }
    try:
        response = requests.post(AI_SERVICE_URL, json=payload, timeout=15) # 15-second timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4XX or 5XX)
        ai_data = response.json()

        # Assuming the AI returns a JSON with a "response" key
        if "response" in ai_data:
            return ai_data["response"]
        # Or "answer", or "message" - this might need adjustment based on the actual AI
        elif "answer" in ai_data: # Common alternative
            return ai_data["answer"]
        elif "message" in ai_data: # Another common alternative
            return ai_data["message"]
        else:
            # If the expected key is not found, return a generic error message
            # Log this situation on the server for debugging
            app.logger.error(f"AI response did not contain 'response', 'answer', or 'message' key. Payload received: {ai_data}")
            return "Error: AI service returned an unexpected response format."

    except requests.exceptions.Timeout:
        app.logger.error(f"Timeout connecting to AI service at {AI_SERVICE_URL}")
        return "Error: The AI service timed out."
    except requests.exceptions.RequestException as e:
        # This catches connection errors, HTTP errors (if not caught by raise_for_status for some reason), etc.
        app.logger.error(f"Error connecting to AI service at {AI_SERVICE_URL}: {str(e)}")
        return f"Error: Could not connect to the AI service. {str(e)}"
    except ValueError as e: # Catches JSON decoding errors
        app.logger.error(f"Error decoding JSON response from AI service: {str(e)}")
        return "Error: AI service returned an invalid JSON response."

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message')

    if not user_message:
        return jsonify({'response': 'Error: No message provided.'}), 400

    if 'extracted_text' not in session:
        return jsonify({'response': 'Error: No URL processed yet. Please submit a URL first.'}), 400

    # Check if extracted_text is empty or only whitespace
    # Some AIs might not behave well with empty context.
    # If the text was empty from process_url, it would have been stored as "" or similar.
    context_text = session.get('extracted_text', "") # Default to empty string if somehow not set
    if not context_text.strip() and "no text content found" in session.get('last_url_status_message', ''):
        # This condition checks if the context is empty AND the URL processing step explicitly said no text was found
        # This helps provide a more specific message if the user tries to chat with an empty page.
        # The 'last_url_status_message' would need to be set in /process_url if we want this specific check.
        # For now, let's just pass the (potentially empty) context_text. The AI or get_ai_response will handle it.
        pass # Continue, let the AI decide what to do with empty or minimal context

    ai_reply = get_ai_response(context_text, user_message)

    return jsonify({'response': ai_reply})

if __name__ == '__main__':
    app.run(debug=True)
