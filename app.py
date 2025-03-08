from flask import Flask, jsonify, request
from scraper import scrape_data  # Import your existing scraping function
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

@app.route('/scrape', methods=['GET'])
def get_scraped_data():
    query = request.args.get('query', 'deep learning')  # Default search term
    data = scrape_data(query)  # Run the scraper
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)