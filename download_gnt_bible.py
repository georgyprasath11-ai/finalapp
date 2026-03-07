import requests
from bs4 import BeautifulSoup
import time
import json

base_url = "https://www.biblestudytools.com"
translation = "gnt"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

books = [
"genesis","exodus","leviticus","numbers","deuteronomy",
"joshua","judges","ruth","1-samuel","2-samuel",
"1-kings","2-kings","1-chronicles","2-chronicles","ezra",
"nehemiah","esther","job","psalms","proverbs",
"ecclesiastes","song-of-solomon","isaiah","jeremiah","lamentations",
"ezekiel","daniel","hosea","joel","amos",
"obadiah","jonah","micah","nahum","habakkuk",
"zephaniah","haggai","zechariah","malachi",
"matthew","mark","luke","john","acts",
"romans","1-corinthians","2-corinthians","galatians","ephesians",
"philippians","colossians","1-thessalonians","2-thessalonians",
"1-timothy","2-timothy","titus","philemon","hebrews",
"james","1-peter","2-peter","1-john","2-john",
"3-john","jude","revelation"
]

verses_data = []

for book in books:
    chapter = 1

    while True:
        url = f"{base_url}/{translation}/{book}/{chapter}.html"
        print("Fetching:", url)

        r = requests.get(url, headers=headers, timeout=30)

        if r.status_code != 200:
            break

        soup = BeautifulSoup(r.text, "html.parser")
        verses = soup.select("[data-verse-id]")

        if not verses:
            break

        for v in verses:
            verse_num = v.get("data-verse-id")
            if verse_num is None:
                continue

            num = str(verse_num).strip()
            if not num.isdigit():
                continue

            verse_copy = BeautifulSoup(str(v), "html.parser")
            for sup in verse_copy.select("sup"):
                sup.decompose()
            first_anchor = verse_copy.find("a")
            if first_anchor:
                first_anchor.decompose()

            text = verse_copy.get_text(" ", strip=True)
            text = " ".join(text.split())

            verses_data.append({
                "book": book,
                "chapter": chapter,
                "verse": int(num),
                "text": text
            })

        chapter += 1
        time.sleep(0.3)

# Save txt file
with open("gnt_bible.txt", "w", encoding="utf-8") as f:
    for v in verses_data:
        f.write(f'{v["book"]} {v["chapter"]}:{v["verse"]} {v["text"]}\n')

# Save TypeScript file
with open("bible-verses.ts", "w", encoding="utf-8") as f:
    f.write("export const bibleVerses = ")
    json.dump(verses_data, f, indent=2)
    f.write(";\n")

print("Finished.")
print("Files created:")
print("gnt_bible.txt")
print("bible-verses.ts")
