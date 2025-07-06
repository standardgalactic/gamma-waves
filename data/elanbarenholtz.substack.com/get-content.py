import xml.etree.ElementTree as ET
import html
import re

# Load the XML content from the file
with open('feed', 'r', encoding='utf-8') as file:
    xml_content = file.read()

# Parse the XML content
root = ET.fromstring(xml_content)

# Function to clean article text
def clean_article_text(text):
    # Decode HTML entities
    text = html.unescape(text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)  # Remove any remaining HTML tags
    return text

# Extract titles, links, and full article text
for item in root.findall("./channel/item"):
    title = item.find("title").text
    article_link = item.find("link").text
    # Get the full article text
    article_text = item.find("{http://purl.org/rss/1.0/modules/content/}encoded").text

    # Clean the article text
    cleaned_text = clean_article_text(article_text)

    print(f"Title: {title}\nLink: {article_link}\nArticle Text: {cleaned_text}\n")
