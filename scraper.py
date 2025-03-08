from flask import Flask, jsonify, request
from flask_cors import CORS
from sel import scrape_google_scholar  # Import your scraper

app = Flask(__name__)
CORS(app)

@app.route('/api/papers', methods=['GET'])
def get_papers():
    try:
        query = request.args.get('query', '')
        print(f"📢 Received query: {query}")  # Debugging

        if not query:
            return jsonify({"error": "Query parameter is required"}), 400

        # Test if function works inside API
        papers = scrape_google_scholar(query)
        print(f"✅ Scraped Papers: {papers}")  # Debugging

        return jsonify({"dbPapers": [], "scrapedPapers": papers})

    except Exception as e:
        print(f"❌ Server Error: {str(e)}")  # Log error
        return jsonify({"message": "Server Error"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)