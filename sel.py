from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import requests
import re
from datetime import datetime
from xml.etree import ElementTree as ET

# Function to extract the year from text
def extract_year(text):
    """Extracts the first four-digit year from a string (between 1900-2099)."""
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return int(match.group(1)) if match else None  # Return None instead of 0 for better handling

# Function to set up Selenium WebDriver
def setup_driver():
    """Set up and return a Selenium WebDriver."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.178 Safari/537.36"
    )
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)

# Google Scholar Scraper
def scrape_google_scholar(query):
    driver = setup_driver()
    try:
        url = f"https://scholar.google.com/scholar?q={query}"
        driver.get(url)
        time.sleep(2)

        research_papers = []
        results = driver.find_elements(By.CLASS_NAME, "gs_r")

        for result in results[:10]:
            try:
                title_element = result.find_element(By.CLASS_NAME, "gs_rt")
                title = title_element.text
                link_element = title_element.find_elements(By.TAG_NAME, "a")
                link = link_element[0].get_attribute("href") if link_element else "No link available"
                snippet = result.find_element(By.CLASS_NAME, "gs_rs").text if result.find_elements(By.CLASS_NAME, "gs_rs") else "No snippet available"
                authors_text = result.find_element(By.CLASS_NAME, "gs_a").text if result.find_elements(By.CLASS_NAME, "gs_a") else "Unknown"
                year = extract_year(authors_text)

                research_papers.append({
                    "title": title,
                    "link": link,
                    "snippet": snippet,
                    "authors": authors_text,
                    "year": year,
                    "source": "Google Scholar"
                })
            except Exception as e:
                print(f"Error parsing Google Scholar result: {e}")
                continue

        return research_papers
    finally:
        driver.quit()

# arXiv API Scraper
def scrape_arxiv(query):
    url = f"http://export.arxiv.org/api/query?search_query=all:{query}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending"
    response = requests.get(url)
    if response.status_code != 200:
        return []

    root = ET.fromstring(response.content)
    research_papers = []
    for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
        title = entry.find("{http://www.w3.org/2005/Atom}title").text.strip()
        link = entry.find("{http://www.w3.org/2005/Atom}id").text.strip()
        snippet = entry.find("{http://www.w3.org/2005/Atom}summary").text.strip()
        authors = ", ".join([author.find("{http://www.w3.org/2005/Atom}name").text for author in entry.findall("{http://www.w3.org/2005/Atom}author")])
        year = int(entry.find("{http://www.w3.org/2005/Atom}published").text[:4])

        research_papers.append({
            "title": title,
            "link": link,
            "snippet": snippet,
            "authors": authors,
            "year": year,
            "source": "arXiv"
        })
    
    return research_papers

# IEEE Xplore Scraper
def scrape_ieee(query):
    driver = setup_driver()
    try:
        url = f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={query}"
        driver.get(url)
        time.sleep(3)

        research_papers = []
        results = driver.find_elements(By.CLASS_NAME, "List-results-items")

        for result in results[:5]:
            try:
                title_element = result.find_element(By.CLASS_NAME, "title")
                title = title_element.text
                link = title_element.get_attribute("href")
                snippet = result.find_element(By.CLASS_NAME, "description").text if result.find_elements(By.CLASS_NAME, "description") else "No snippet available"
                authors_text = result.find_element(By.CLASS_NAME, "authors").text if result.find_elements(By.CLASS_NAME, "authors") else "Unknown"
                year = extract_year(authors_text)

                research_papers.append({
                    "title": title,
                    "link": link,
                    "snippet": snippet,
                    "authors": authors_text,
                    "year": year,
                    "source": "IEEE Xplore"
                })
            except Exception as e:
                print(f"Error parsing IEEE Xplore result: {e}")
                continue

        return research_papers
    finally:
        driver.quit()

# Semantic Scholar API Scraper
def scrape_semantic_scholar(query):
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={query}&limit=10&fields=title,url,abstract,authors,year"
    response = requests.get(url)
    if response.status_code != 200:
        return []

    data = response.json()
    research_papers = []
    for paper in data.get("data", []):
        research_papers.append({
            "title": paper["title"],
            "link": paper["url"],
            "snippet": paper.get("abstract", "No abstract available"),
            "authors": ", ".join([author["name"] for author in paper.get("authors", [])]),
            "year": paper.get("year", None),  # Use None to avoid sorting errors
            "source": "Semantic Scholar"
        })
    
    return research_papers

# Fetch Top 15 Latest Research Papers
def fetch_top_research_papers(query):
    all_papers = scrape_google_scholar(query) + scrape_arxiv(query) + scrape_ieee(query) + scrape_semantic_scholar(query)

    # Handle NoneType values for sorting
    sorted_papers = sorted(all_papers, key=lambda x: x["year"] if x["year"] is not None else 0, reverse=True)

    return sorted_papers[:15]

# Test Script
if __name__ == "__main__":
    query = "deep learning"
    papers = fetch_top_research_papers(query)
    
    print("\nTop Research Papers:\n")
    for idx, paper in enumerate(papers, start=1):
        print(f"{idx}. {paper['title']} ({paper['year']}) - {paper['source']}")
        print(f"   {paper['link']}\n")
