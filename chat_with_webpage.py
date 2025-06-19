import requests
from bs4 import BeautifulSoup
import nltk
from nltk.tokenize import sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Ensure NLTK's 'punkt' tokenizer is available
try:
    nltk.data.find('tokenizers/punkt')
except nltk.downloader.DownloadError:
    print("NLTK 'punkt' tokenizer not found. Downloading...")
    nltk.download('punkt', quiet=True)
    print("'punkt' tokenizer downloaded.")

def get_user_url():
    """Prompts the user to enter a URL and returns it."""
    url = input("Please enter the URL of the webpage (or type 'quit' to exit): ")
    if url.lower() == 'quit':
        return None
    return url

def fetch_html_content(url):
    """Fetches HTML content from the given URL."""
    print(f"Fetching content from: {url}...")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        print("Content fetched successfully.")
        return response.text
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err} - Status code: {http_err.response.status_code}")
    except requests.exceptions.ConnectionError as conn_err:
        print(f"Connection error occurred: {conn_err}")
    except requests.exceptions.Timeout as timeout_err:
        print(f"Timeout error occurred: {timeout_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"An error occurred while fetching the URL: {req_err}")
    return None

def extract_and_clean_content(html_content):
    """Extracts and cleans textual content from HTML."""
    if not html_content:
        return ""
    print("Extracting and cleaning content...")
    soup = BeautifulSoup(html_content, 'html.parser')
    for unwanted_tag in soup(['script', 'style', 'nav', 'footer', 'aside', 'header', 'form', 'button', 'input', 'textarea', 'select', 'option']):
        unwanted_tag.decompose()
    main_content_tags = []
    for tag_name in ['article', 'main']:
        main_content_tags.extend(soup.find_all(tag_name))
    if main_content_tags:
        text_parts = [tag.get_text(separator=' ', strip=True) for tag in main_content_tags]
        text = ' '.join(text_parts)
    else:
        body = soup.find('body')
        if body:
            text = body.get_text(separator=' ', strip=True)
        else:
            text = soup.get_text(separator=' ', strip=True)
    text = ' '.join(text.split())
    if text:
        print("Content extracted and cleaned.")
    else:
        print("Warning: No meaningful content could be extracted.")
    return text

def process_text_to_chunks(cleaned_text):
    """Processes cleaned text into a list of sentences (chunks)."""
    if not cleaned_text:
        return []
    print("Processing text into chunks...")
    sentences = sent_tokenize(cleaned_text)
    if sentences:
        print(f"Text processed into {len(sentences)} chunks (sentences).")
    else:
        print("Warning: No chunks were generated from the text.")
    return sentences

def get_relevant_chunks(question, chunks, top_n=2, similarity_threshold=0.05): # Lowered threshold slightly
    """Retrieves the most relevant chunks for a given question using TF-IDF and cosine similarity."""
    if not chunks or not question:
        return []
    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(chunks)
        question_vector = vectorizer.transform([question])
        cosine_similarities = cosine_similarity(question_vector, tfidf_matrix).flatten()
        relevant_chunk_indices = np.argsort(cosine_similarities)[::-1]
        top_chunks = []
        for i in range(min(top_n, len(relevant_chunk_indices))):
            chunk_index = relevant_chunk_indices[i]
            if cosine_similarities[chunk_index] >= similarity_threshold:
                top_chunks.append(chunks[chunk_index])
            else:
                break
        return top_chunks
    except Exception as e:
        print(f"Error in get_relevant_chunks: {e}") # More specific error
        return []

def formulate_answer(question, relevant_chunks):
    """Formulates an answer based on the relevant chunks."""
    if relevant_chunks:
        return " ".join(relevant_chunks)
    else:
        return "Sorry, I couldn't find an answer to that in the provided text."

def main():
    """Main function to run the chat application."""
    print("Welcome to the Webpage Q&A Chatbot!")
    print("You can paste a URL, and then ask questions about its content.")

    text_chunks = []

    while True:
        if not text_chunks: # If no content is loaded, or user wants a new URL
            user_url = get_user_url()
            if not user_url: # User typed 'quit' at URL prompt
                break

            html_doc = fetch_html_content(user_url)
            if not html_doc:
                print("Could not retrieve content. Please try another URL or check the error messages.")
                text_chunks = [] # Ensure chunks are empty
                continue

            cleaned_content = extract_and_clean_content(html_doc)
            if not cleaned_content:
                print("Could not extract meaningful content. Please try another URL.")
                text_chunks = [] # Ensure chunks are empty
                continue

            text_chunks = process_text_to_chunks(cleaned_content)
            if not text_chunks:
                print("Could not process content into queryable chunks. Please try another URL.")
                continue

            print(f"\nWebpage processed successfully! You can now ask questions about its content.")

        # Q&A loop for the current document
        user_question = input("\nAsk a question (or type 'new_url' for a new page, 'quit' to exit): ").strip()

        if not user_question:
            print("Please enter a question.")
            continue
        if user_question.lower() == 'quit':
            break
        if user_question.lower() == 'new_url':
            text_chunks = [] # Clear chunks to trigger URL prompt
            print("\nLoading new URL...")
            continue

        relevant_chunks = get_relevant_chunks(user_question, text_chunks)
        answer = formulate_answer(user_question, relevant_chunks)

        print(f"Answer: {answer}")

    print("\nThank you for using the Webpage Q&A Chatbot. Goodbye!")

if __name__ == '__main__':
    main()
