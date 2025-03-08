from flask import Flask, jsonify, request
from scraper import scrape_data  # Your existing scraping function
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

@app.route('/scrape', methods=['GET'])
def get_scraped_data():
    query = request.args.get('query', 'deep learning')  # Get query from request
    data = scrape_data(query)  # Scrape based on the query
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)
