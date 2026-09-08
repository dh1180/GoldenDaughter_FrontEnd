#!/usr/bin/env python3
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

LIST_URL = "https://gall.dcinside.com/mgallery/board/lists/?id=hyunjatime&sort_type=N&search_head=190&page={}"
VIEW_BASE = "https://gall.dcinside.com/mgallery/board/view/?id=hyunjatime&no={}"
OUTPUT = Path("public/transcendence-posts.json")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6",
    "Referer": "https://gall.dcinside.com/mgallery/board/lists/?id=hyunjatime",
}


def load_existing():
    if not OUTPUT.exists():
        return []
    try:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def extract_post(row):
    raw_no = (row.get("data-no") or "").strip()
    if raw_no.isdigit():
        post_no = int(raw_no)
    else:
        num_cell = row.select_one("td.gall_num, .gall_num")
        digits = re.sub(r"[^0-9]", "", num_cell.get_text(" ", strip=True) if num_cell else "")
        if not digits:
            return None
        post_no = int(digits)

    link = None
    for candidate in row.select("td.gall_tit a, .gall_tit a, .ub-gall-tit a, .subject a, a.title"):
        href = candidate.get("href") or ""
        if "view" in href and (f"no={post_no}" in href or f"no%3D{post_no}" in href):
            link = candidate
            break
    if link is None:
        for candidate in row.select("td.gall_tit a, .gall_tit a, .ub-gall-tit a, .subject a, a.title"):
            if "view" in (candidate.get("href") or ""):
                link = candidate
                break
    if link is None:
        return None

    title = link.get_text(" ", strip=True)
    if not title:
        return None

    return {
        "dcPostNo": post_no,
        "title": title,
        "url": VIEW_BASE.format(post_no),
    }


def crawl_page(session, page):
    response = session.get(LIST_URL.format(page), headers=HEADERS, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    rows = soup.select("tr.ub-content")

    posts = []
    seen = set()
    for row in rows:
        post = extract_post(row)
        if not post or post["dcPostNo"] in seen:
            continue
        seen.add(post["dcPostNo"])
        posts.append(post)
    return posts


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing()
    merged = {int(item["dcPostNo"]): item for item in existing if item.get("dcPostNo")}

    session = requests.Session()
    full_backfill = len(merged) == 0
    max_pages = 500 if full_backfill else 5
    empty_pages = 0

    for page in range(1, max_pages + 1):
        try:
            posts = crawl_page(session, page)
        except Exception as exc:
            print(f"page={page} failed: {exc}")
            if full_backfill:
                raise
            break

        print(f"page={page}, posts={len(posts)}")
        if not posts:
            empty_pages += 1
            if full_backfill or empty_pages >= 1:
                break
        else:
            empty_pages = 0
            for post in posts:
                merged[post["dcPostNo"]] = post
        time.sleep(0.4)

    result = sorted(merged.values(), key=lambda item: int(item["dcPostNo"]), reverse=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"saved {len(result)} posts -> {OUTPUT}")


if __name__ == "__main__":
    main()
