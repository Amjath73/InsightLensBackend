from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline

app = Flask(__name__)
CORS(app)  # Allow frontend to access this API

# Load the Hugging Face summarization model
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

@app.route("/api/summary", methods=["POST"])
def get_summary():
    try:
        data = request.json
        text = data.get("text", "")

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Summarize text (set min/max length based on your needs)
        summary = summarizer(text, max_length=500, min_length=150, do_sample=False)

        return jsonify({"summary": summary[0]["summary_text"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5002)
