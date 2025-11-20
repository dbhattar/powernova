# Crawler User-Agent Update - From Masquerading to Ethical Crawling

## What Changed

### Before (Unethical Approach)
```python
# ❌ Pretending to be a Chrome browser
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
```

**Problems:**
- Deceptive - pretended to be a human browser
- Bypassed robots.txt rules intended for bots
- Violated web etiquette
- Potential legal/ToS violations

### After (Ethical Approach)
```python
# ✅ Honest bot identification
'User-Agent': 'PowerNOVA-Crawler/1.0 (+https://github.com/yourusername/powernova; bot for document indexing)'
```

**Benefits:**
- Transparent identity
- Respects robots.txt
- Allows site owners to manage bot behavior
- Follows industry best practices

## New Features Added

### 1. **robots.txt Support**
```python
def _is_allowed_by_robots(self, url: str) -> bool:
    """Check if URL is allowed by robots.txt"""
    parser = self._get_robots_parser(url)
    return parser.can_fetch(self.user_agent, url)
```

**How it works:**
- Fetches robots.txt once per domain
- Caches parser for efficiency
- Checks every URL before crawling
- Logs blocked URLs

### 2. **Polite Crawl Delay**
```python
self.request_delay = 1.0  # 1 second between requests
```

**Changed from:**
- 0.5 seconds (too aggressive)

**Now:**
- 1 second default
- Can read from robots.txt `Crawl-delay`
- Applied between all requests

### 3. **Proper Headers**
```python
self.session.headers.update({
    'User-Agent': self.user_agent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive'
})
```

**Removed:**
- `DNT: 1` (browsers only)
- `Upgrade-Insecure-Requests` (browsers only)

## Usage Example

### robots.txt Example
```
# https://example.com/robots.txt
User-agent: *
Disallow: /private/
Disallow: /admin/

User-agent: PowerNOVA-Crawler
Allow: /docs/
Disallow: /api/
Crawl-delay: 2
```

### What Happens
1. Crawler requests `https://example.com/robots.txt`
2. Parses rules for `PowerNOVA-Crawler`
3. Allows: `https://example.com/docs/page.html` ✅
4. Blocks: `https://example.com/api/data` ❌
5. Blocks: `https://example.com/private/secret` ❌
6. Uses 2-second delay between requests

## Testing

### Test 1: Check robots.txt
```bash
curl https://www.example.com/robots.txt
```

### Test 2: Crawl with new User-Agent
```bash
curl -X POST http://localhost:8000/api/admin/crawl \
  -H "X-Admin-Key: YOUR_KEY" \
  -d '{
    "start_url": "https://example.com",
    "max_depth": 2,
    "max_pages": 10
  }'
```

### Test 3: Check logs
```bash
docker logs powernova-api | grep "robots.txt"
docker logs powernova-api | grep "Blocked by robots"
```

## When You Get Blocked

### Scenario 1: robots.txt Blocks You
```
# robots.txt
User-agent: PowerNOVA-Crawler
Disallow: /
```

**Response:**
- ✅ Respect the block
- ✅ Contact site owner for permission
- ❌ Don't change User-Agent to bypass

### Scenario 2: No robots.txt
If `robots.txt` doesn't exist:
- Crawler assumes everything is allowed
- Still applies rate limiting
- Still identifies itself

### Scenario 3: Partial Access
```
# robots.txt
User-agent: PowerNOVA-Crawler
Allow: /public/
Disallow: /
```

**Result:**
- Only crawls `/public/` directory
- Logs blocked URLs
- Continues with allowed pages

## Benefits of This Approach

### For Website Owners
- ✅ Can identify your bot in logs
- ✅ Can control what you crawl via robots.txt
- ✅ Can apply different rate limits
- ✅ Can contact you if needed
- ✅ Better analytics (bot vs human traffic)

### For You
- ✅ Ethical and transparent
- ✅ Follows industry standards
- ✅ Reduces legal risk
- ✅ Better relationship with site owners
- ✅ Can request whitelisting if needed

### For the Web Ecosystem
- ✅ Maintains trust in web crawling
- ✅ Supports robots.txt standard
- ✅ Encourages responsible bot behavior
- ✅ Protects site resources

## Migration Notes

### Sites That May Block You Now
Previously working sites might now be blocked if they have:
```
User-agent: *
Disallow: /
```

**Solutions:**
1. Check if they have specific rules for crawlers
2. Contact site owner for permission
3. Use allowed sections only
4. Consider if you really need that content

### Sites That Will Work Better
Many sites have bot-friendly robots.txt:
```
User-agent: *
Allow: /public/
Crawl-delay: 1
```

These will work the same or better.

## Configuration

### Update Your User-Agent
Edit `api/services/crawler.py`:

```python
self.user_agent = 'YourBotName/1.0 (+https://yourwebsite.com/bot; contact@yourwebsite.com)'
```

**Include:**
- Bot name and version
- Link to info page about your bot
- Contact method (URL or email)

### Customize Rate Limit
```python
self.request_delay = 2.0  # 2 seconds per request
```

Or let robots.txt control it:
```python
# Will automatically read Crawl-delay from robots.txt
```

## References

- **Documentation**: `docs/ETHICAL-CRAWLING.md`
- **robots.txt Spec**: https://www.robotstxt.org/
- **Python robotparser**: https://docs.python.org/3/library/urllib.robotparser.html

## Summary

**Key Change:** From deceptive browser masquerading → honest bot identification

**New Features:**
- ✅ robots.txt compliance
- ✅ Proper User-Agent
- ✅ Crawl delay enforcement
- ✅ Block logging

**Impact:**
- **Short term**: Some sites may block you (that's OK!)
- **Long term**: More sustainable, ethical, and legally sound approach

**Recommendation:**
If you need to crawl sites that block bots, **request permission first** rather than trying to circumvent blocks.
