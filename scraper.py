from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from sel import fetch_top_research_papers  # Import the updated function

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # Allow all origins

@app.route('/api/papers', methods=['GET'])
def get_papers():
    try:
        query = request.args.get('query', '')
        print(f"📢 Received query: {query}")  # Debugging

        if not query:
            return jsonify({"error": "Query parameter is required"}), 400

        papers = fetch_top_research_papers(query)  # Fetch papers from all sources
        print(f"✅ Scraped Papers: {papers}")  # Debugging

        return jsonify({"dbPapers": [], "scrapedPapers": json.loads(json.dumps(papers))})

    except Exception as e:
        print(f"❌ Server Error: {str(e)}")  # Log error
        return jsonify({"message": "Server Error", "error": str(e)}), 500



if __name__ == "__main__":
    app.run(debug=True, port=5001)
