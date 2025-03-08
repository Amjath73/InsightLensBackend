from sel import scrape_google_scholar

query = "deep learning"
papers = scrape_google_scholar(query)
print(papers)
