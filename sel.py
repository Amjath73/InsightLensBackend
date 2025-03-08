from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

def scrape_google_scholar(query):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.178 Safari/537.36")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)

    try:
        url = f"https://scholar.google.com/scholar?q={query}"
        driver.get(url)
        time.sleep(2)  # Allow page to load

        research_papers = []
        results = driver.find_elements(By.CLASS_NAME, "gs_r")

        for result in results[:10]:
            try:
                title_element = result.find_element(By.CLASS_NAME, "gs_rt")
                title = title_element.text
                link_element = title_element.find_element(By.TAG_NAME, "a") if title_element.find_elements(By.TAG_NAME, "a") else None
                link = link_element.get_attribute("href") if link_element else "No link available"
                snippet = result.find_element(By.CLASS_NAME, "gs_rs").text if result.find_elements(By.CLASS_NAME, "gs_rs") else "No snippet available"
                authors = result.find_element(By.CLASS_NAME, "gs_a").text if result.find_elements(By.CLASS_NAME, "gs_a") else "Unknown"

                research_papers.append({
                    "title": title,
                    "link": link,
                    "snippet": snippet,
                    "authors": authors
                })
            except Exception as e:
                print("Skipping result due to error:", e)
                continue

        return research_papers

    except Exception as e:
        print("❌ Web Scraping Error:", e)
        return []

    finally:
        driver.quit()

# Test
if __name__ == "__main__":
    query = "deep learning"
    papers = scrape_google_scholar(query)
    print(papers)
