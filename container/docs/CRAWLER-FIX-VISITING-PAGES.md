# Crawler Fix - Visiting All Pages

## Issue Identified

The crawler was stopping prematurely and not visiting all pages up to the `max_pages` limit.

## Root Causes

### 1. **Premature Termination**
The original code checked `len(self.visited_urls) < self.max_pages`, but was adding URLs to `visited_urls` **before** actually crawling them. This meant the set size grew faster than the actual number of pages crawled.

**Before:**
```python
# In _crawl_page, URLs were added to visited_urls when discovered
self.visited_urls.add(normalized_url)  # Added before crawling!

# In run(), loop checked visited_urls size
while self.to_visit and len(self.visited_urls) < self.max_pages:
```

**Problem:** If a page had 50 links, all 50 would be added to `visited_urls` immediately, causing the loop to stop even though only 1 page was actually crawled.

### 2. **Confusing State Management**
URLs were tracked in only one set (`visited_urls`), which was used for both:
- Preventing duplicate crawling
- Counting pages crawled

This dual purpose caused the counting issue.

## Solution Implemented

### 1. **Separate State Tracking**
```python
self.visited_urls: Set[str] = set()    # URLs actually crawled
self.queued_urls: Set[str] = set()     # URLs queued but not crawled yet
self.pages_crawled = 0                 # Explicit counter
```

### 2. **Fixed Loop Condition**
```python
# Now uses explicit counter instead of set size
while self.to_visit and self.pages_crawled < self.max_pages:
```

### 3. **Proper URL Lifecycle**

**Discovery:**
```python
# When link is found on a page
self.queued_urls.add(normalized_url)  # Mark as queued
self.to_visit.append((normalized_url, depth + 1))  # Add to queue
```

**Crawling:**
```python
# When actually crawling the URL
self.visited_urls.add(url)  # Mark as visited
self.pages_crawled += 1     # Increment counter
```

### 4. **Better Logging**
Added detailed logging to track progress:
```python
logger.info(f"Crawling page {self.pages_crawled}/{self.max_pages}: {url} (depth: {depth})")
logger.info(f"Found {links_found} new links on {url}")
logger.info(f"Progress: {self.pages_crawled}/{self.max_pages} pages, {self.documents_found} documents, {len(self.to_visit)} queued")
```

## Changes Made

### In `__init__`:
```python
# Before
self.visited_urls: Set[str] = set()
self.to_visit: List[tuple] = [(self.start_url, 0)]
self.documents_found = 0

# After
self.visited_urls: Set[str] = set()  # URLs we've already crawled
self.queued_urls: Set[str] = set()   # URLs we've queued but not yet crawled
self.to_visit: List[tuple] = [(self.start_url, 0)]
self.documents_found = 0
self.pages_crawled = 0
```

### In `_crawl_page`:
```python
# Added at start of function
self.visited_urls.add(url)
self.pages_crawled += 1

# Changed URL queuing
self.queued_urls.add(normalized_url)  # Instead of visited_urls
```

### In `run`:
```python
# Before
while self.to_visit and len(self.visited_urls) < self.max_pages:

# After
while self.to_visit and self.pages_crawled < self.max_pages:
```

## Example Scenario

**Configuration:**
- `max_depth = 2`
- `max_pages = 100`

**Before Fix:**
1. Start page has 50 links
2. All 50 added to `visited_urls` immediately
3. Crawl first page (1 actually crawled)
4. First page links to 50 more pages, all added to `visited_urls`
5. Now `len(visited_urls) = 101`
6. Loop exits! Only ~2-3 pages actually crawled

**After Fix:**
1. Start page has 50 links
2. All 50 added to `queued_urls`
3. `pages_crawled = 1`
4. Continue crawling until `pages_crawled = 100`
5. All 100 pages actually get crawled

## Testing

To verify the fix:

1. **Create a test job:**
   ```json
   {
     "start_url": "https://example.com/docs",
     "max_depth": 3,
     "max_pages": 50,
     "file_types": ["html"]
   }
   ```

2. **Monitor logs:**
   ```bash
   docker-compose logs -f powernova-api
   ```

3. **Look for:**
   ```
   Starting crawl job X: https://example.com/docs
   Max depth: 3, Max pages: 50
   Crawling page 1/50: https://example.com/docs (depth: 0)
   Found 23 new links on https://example.com/docs
   Crawling page 2/50: https://example.com/docs/intro (depth: 1)
   Found 15 new links on https://example.com/docs/intro
   ...
   Progress: 10/50 pages, 10 documents, 33 queued
   ...
   Progress: 20/50 pages, 20 documents, 45 queued
   ...
   Crawl job X completed: 50 pages crawled, 50 documents found
   ```

4. **Verify in admin UI:**
   - Pages crawled should reach max_pages
   - Documents found should match pages crawled (for HTML)
   - Status should be COMPLETED

## Benefits

1. ✅ **Accurate counting** - Pages crawled matches actual crawl count
2. ✅ **Correct limits** - Respects max_pages setting
3. ✅ **Better deduplication** - Separates queued vs visited URLs
4. ✅ **Improved logging** - Track progress in real-time
5. ✅ **Predictable behavior** - Crawler works as expected

## Performance Impact

- **Memory**: Slightly higher (two sets instead of one)
- **Speed**: No change (same logic, just better accounting)
- **Accuracy**: 100% improvement! 🎉

## Deployment

Changes have been applied and API restarted:
```bash
docker-compose restart powernova-api
```

Ready to test with a new crawl job!
