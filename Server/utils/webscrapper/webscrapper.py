from typing import List, TypedDict, Optional
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from langchain.text_splitter import RecursiveCharacterTextSplitter
from urllib.parse import urldefrag

class PageChunk(TypedDict):
    source_url: str
    content: str
    chunk_index: int
    total_chunks: int
    char_count: int  # could be token_count if using token-based splitters
    metadata: Optional[dict]  # extendable

def scrape_text_from_url(url: str, headers: dict) -> tuple[Optional[str], Optional[BeautifulSoup]]:
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        text = soup.get_text(separator=' ', strip=True)
        return text, soup
    except requests.exceptions.RequestException as e:
        print(f"Error scraping {url}: {e}")
        return None, None

def scrape_page_and_its_links(
    start_url: str,
    link_limit: int = 5,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> List[PageChunk]:
    raw_pages: List[dict] = []

    print(f"Starting scrape process for base URL: {start_url}")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    visited_urls = set()

    # Scrape the base page
    print(f"\n--- Scraping base page: {start_url} ---")
    initial_text, soup = scrape_text_from_url(start_url, headers)

    if not soup or not initial_text:
        return []

    raw_pages.append({"url": start_url, "content": initial_text})
    visited_urls.add(start_url)
    print(f"Successfully scraped {len(initial_text)} characters from the base page.")

    # Collect links on the page
    links_to_visit = set()
    base_domain = urlparse(start_url).netloc

    for tag in soup.find_all('a', href=True):
        raw_url = urljoin(start_url, tag['href'])
        full_url, _ = urldefrag(raw_url)  # strip fragment
        if urlparse(full_url).netloc == base_domain and full_url.startswith('http'):
            links_to_visit.add(full_url)

    print(f"\nFound {len(links_to_visit)} unique links. Will scrape up to {link_limit}.")

    # Scrape linked pages
    scraped_link_count = 0
    for link in links_to_visit:
        if scraped_link_count >= link_limit:
            break
        if link not in visited_urls:
            print(f"\n--- Scraping linked page ({scraped_link_count + 1}/{link_limit}): {link} ---")
            linked_text, _ = scrape_text_from_url(link, headers)
            if linked_text:
                raw_pages.append({"url": link, "content": linked_text})
                print(f"Successfully scraped {len(linked_text)} characters.")
            visited_urls.add(link)
            scraped_link_count += 1

    # ✅ Chunk all page contents
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunked_pages: List[PageChunk] = []

    for page in raw_pages:
        chunks = splitter.split_text(page["content"])
        total = len(chunks)
        for idx, chunk in enumerate(chunks):
            chunked_pages.append({
                "source_url": page["url"],
                "content": chunk,
                "chunk_index": idx,
                "total_chunks": total,
                "char_count": len(chunk),
                "metadata": {
                    "source": "scraped",
                    "domain": urlparse(page["url"]).netloc
                }
            })

    print(f"\nTotal chunks generated: {len(chunked_pages)}")
    return chunked_pages
