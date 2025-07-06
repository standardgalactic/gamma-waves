import xml.etree.ElementTree as ET

# Load the XML content from the file
with open('feed', 'r', encoding='utf-8') as file:
    xml_content = file.read()

# Parse the XML content
root = ET.fromstring(xml_content)

# Extract titles and articles
for item in root.findall("./channel/item"):
    title = item.find("title").text
    article_link = item.find("link").text
    print(f"Title: {title}\nLink: {article_link}\n")
