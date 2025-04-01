from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import requests
import re
from datetime import datetime
from xml.etree import ElementTree as ET
from urllib.parse import quote_plus
import random

def preprocess_query(query):
    """Preprocess the search query for better results without NLTK."""
    # Convert to lowercase
    query = query.lower()
    
    # Basic stopwords list
    stopwords = {'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 
                'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 
                'to', 'was', 'were', 'will', 'with'}
    
    # Split into words and remove stopwords
    words = query.split()
    keywords = [word for word in words if word not in stopwords]
    
    # Add quotes around multi-word terms
    processed_query = ' '.join([f'"{term}"' if ' ' in term else term for term in keywords])
    return processed_query

def calculate_relevance_score(paper, query):
    """Calculate relevance score for a paper based on query keywords."""
    score = 0
    query_words = set(query.lower().split())
    
    # Title relevance (highest weight)
    title_words = set(paper['title'].lower().split())
    title_match = len(query_words.intersection(title_words))
    score += title_match * 3
    
    # Abstract/snippet relevance
    if paper['snippet']:
        snippet_words = set(paper['snippet'].lower().split())
        snippet_match = len(query_words.intersection(snippet_words))
        score += snippet_match * 2
        
        # Bonus for exact phrase matches
        for word in query_words:
            if word in paper['title'].lower():
                score += 1
            if word in paper['snippet'].lower():
                score += 0.5
    
    # Recency bonus
    current_year = datetime.now().year
    if paper['year'] and paper['year'] >= current_year - 5:
        score += 1
    
    # Citation bonus
    if paper.get('citations', 0) > 0:
        score += min(paper['citations'] / 100, 2)
    
    return score

def rate_limit_request():
    """Implement rate limiting to avoid getting blocked."""
    time.sleep(random.uniform(1, 3))

def extract_year(text):
    """Extracts the first four-digit year from a string (between 1900-2099)."""
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return int(match.group(1)) if match else None  # Return None instead of 0 for better handling

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

def scrape_google_scholar(query):
    driver = setup_driver()
    try:
        processed_query = preprocess_query(query)
        url = f"https://scholar.google.com/scholar?q={quote_plus(processed_query)}&hl=en&as_sdt=0,5"
        driver.get(url)
        rate_limit_request()

        research_papers = []
        results = driver.find_elements(By.CLASS_NAME, "gs_r")

        for result in results[:15]:  # Increased from 10 to 15 for better filtering
            try:
                title_element = result.find_element(By.CLASS_NAME, "gs_rt")
                title = title_element.text.strip()
                
                # Extract citation count if available
                citations = 0
                citation_element = result.find_elements(By.CLASS_NAME, "gs_fl")
                if citation_element:
                    citation_text = citation_element[0].text
                    citations_match = re.search(r'Cited by (\d+)', citation_text)
                    if citations_match:
                        citations = int(citations_match.group(1))

                link_element = title_element.find_elements(By.TAG_NAME, "a")
                link = link_element[0].get_attribute("href") if link_element else None

                # If the link is not a direct paper link, click on the first result to extract the actual paper link
                if not link or "scholar.google" in link:
                    title_element.click()
                    time.sleep(2)
                    link = driver.current_url  # Get the redirected URL after clicking

                # Skip if the link is still not valid
                if not link or "scholar.google" in link:
                    continue

                snippet = result.find_element(By.CLASS_NAME, "gs_rs").text if result.find_elements(By.CLASS_NAME, "gs_rs") else ""
                authors_text = result.find_element(By.CLASS_NAME, "gs_a").text if result.find_elements(By.CLASS_NAME, "gs_a") else "Unknown"
                year = extract_year(authors_text)

                paper = {
                    "title": title,
                    "link": link,
                    "snippet": snippet,
                    "authors": authors_text,
                    "year": year,
                    "source": "Google Scholar",
                    "citations": citations
                }
                
                # Calculate initial relevance score
                paper['relevance_score'] = calculate_relevance_score(paper, query)
                research_papers.append(paper)

            except Exception as e:
                print(f"Error parsing Google Scholar result: {e}")
                continue

        return research_papers
    finally:
        driver.quit()

def scrape_arxiv(query):
    processed_query = preprocess_query(query)
    url = f"http://export.arxiv.org/api/query?search_query=all:{quote_plus(processed_query)}&start=0&max_results=15&sortBy=relevance&sortOrder=descending"
    
    try:
        response = requests.get(url)
        rate_limit_request()
        
        if response.status_code != 200:
            return []

        root = ET.fromstring(response.content)
        research_papers = []
        
        for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
            title = entry.find("{http://www.w3.org/2005/Atom}title").text.strip()
            snippet = entry.find("{http://www.w3.org/2005/Atom}summary").text.strip()
            
            paper = {
                "title": title,
                "link": entry.find("{http://www.w3.org/2005/Atom}id").text.strip(),
                "snippet": snippet,
                "authors": ", ".join([author.find("{http://www.w3.org/2005/Atom}name").text 
                                    for author in entry.findall("{http://www.w3.org/2005/Atom}author")]),
                "year": int(entry.find("{http://www.w3.org/2005/Atom}published").text[:4]),
                "source": "arXiv",
                "citations": 0  # arXiv doesn't provide citation counts
            }
            
            paper['relevance_score'] = calculate_relevance_score(paper, query)
            research_papers.append(paper)
        
        return research_papers
    except Exception as e:
        print(f"Error scraping arXiv: {e}")
        return []

def scrape_ieee(query):
    driver = setup_driver()
    try:
        processed_query = preprocess_query(query)
        url = f"https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={quote_plus(processed_query)}"
        driver.get(url)
        rate_limit_request()

        research_papers = []
        results = driver.find_elements(By.CLASS_NAME, "List-results-items")

        for result in results[:5]:
            try:
                title_element = result.find_element(By.CLASS_NAME, "title")
                link = title_element.get_attribute("href")

                # Skip if the link is not a direct paper link
                if not link or "ieeexplore.ieee.org/document" not in link:
                    continue

                title = title_element.text
                snippet = result.find_element(By.CLASS_NAME, "description").text if result.find_elements(By.CLASS_NAME, "description") else "No snippet available"
                authors_text = result.find_element(By.CLASS_NAME, "authors").text if result.find_elements(By.CLASS_NAME, "authors") else "Unknown"
                year = extract_year(authors_text)

                paper = {
                    "title": title,
                    "link": link,
                    "snippet": snippet,
                    "authors": authors_text,
                    "year": year,
                    "source": "IEEE Xplore",
                    "citations": 0  # IEEE doesn't provide citation counts
                }

                paper['relevance_score'] = calculate_relevance_score(paper, query)
                research_papers.append(paper)
            except Exception as e:
                print(f"Error parsing IEEE Xplore result: {e}")
                continue

        return research_papers
    finally:
        driver.quit()

def scrape_semantic_scholar(query):
    processed_query = preprocess_query(query)
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={quote_plus(processed_query)}&limit=10&fields=title,url,abstract,authors,year"
    
    try:
        response = requests.get(url)
        rate_limit_request()
        
        if response.status_code != 200:
            return []

        data = response.json()
        research_papers = []
        
        for paper in data.get("data", []):
            paper_data = {
                "title": paper["title"],
                "link": paper["url"],
                "snippet": paper.get("abstract", "No abstract available"),
                "authors": ", ".join([author["name"] for author in paper.get("authors", [])]),
                "year": paper.get("year", None),  # Use None to avoid sorting errors
                "source": "Semantic Scholar",
                "citations": 0  # Semantic Scholar doesn't provide citation counts
            }
            
            paper_data['relevance_score'] = calculate_relevance_score(paper_data, query)
            research_papers.append(paper_data)
        
        return research_papers
    except Exception as e:
        print(f"Error scraping Semantic Scholar: {e}")
        return []

def fetch_top_research_papers(query):
    """Fetch and return the most relevant research papers."""
    all_papers = []
    
    # Collect papers from all sources with improved error handling
    for scraper_func in [scrape_google_scholar, scrape_arxiv, scrape_semantic_scholar, scrape_ieee]:
        try:
            papers = scraper_func(query)
            for paper in papers:
                # Additional validation
                if not paper.get('title') or not paper.get('link'):
                    continue
                if paper.get('relevance_score', 0) < 0.5:  # Adjusted threshold
                    continue
                all_papers.append(paper)
        except Exception as e:
            print(f"Error in {scraper_func.__name__}: {e}")
            continue
    
    # Remove duplicates and sort by relevance
    seen_titles = set()
    unique_papers = []
    for paper in all_papers:
        normalized_title = paper['title'].lower().strip()
        if normalized_title not in seen_titles:
            seen_titles.add(normalized_title)
            unique_papers.append(paper)
    
    # Sort by relevance score and recency
    sorted_papers = sorted(
        unique_papers,
        key=lambda x: (x.get('relevance_score', 0), x.get('year', 0) or 0),
        reverse=True
    )
    
    return sorted_papers[:15]

if __name__ == "__main__":
    query = input("Enter your search query: ")
    papers = fetch_top_research_papers(query)
    
    print("\nTop Research Papers:\n")
    for idx, paper in enumerate(papers, start=1):
        print(f"{idx}. {paper['title']} ({paper.get('year', 'N/A')})")
        print(f"   Relevance Score: {paper.get('relevance_score', 0):.2f}")
        print(f"   Citations: {paper.get('citations', 'N/A')}")
        print(f"   Source: {paper['source']}")
        print(f"   Link: {paper['link']}\n")
