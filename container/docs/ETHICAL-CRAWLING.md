# Ethical Web Crawling Guidelines

## Overview

PowerNOVA's web crawler is designed to be respectful and ethical when accessing websites. This document outlines our approach to responsible web crawling.

## Key Principles

### 1. **Transparent Identity**

Our crawler identifies itself honestly with a proper User-Agent:
```
PowerNOVA-Crawler/1.0 bot for document indexing)
```

**Why this matters:**
- Website owners can identify and manage our bot
- Allows sites to apply appropriate rate limiting
- Enables contact if crawling causes issues
- Respects website analytics and logging

### 2. **robots.txt Compliance**

The crawler automatically:
- Fetches and parses `robots.txt` for each domain
- Respects `Disallow` directives
- Follows `Crawl-delay` recommendations
- Caches robots.txt to avoid repeated requests

**Example:**
```
# robots.txt
User-agent: PowerNOVA-Crawler
Disallow: /private/
Disallow: /admin/
Crawl-delay: 5
```

### 3. **Rate Limiting**

Default behavior:
- **1 second delay** between requests to the same domain
- Respects `Crawl-delay` from robots.txt if specified
- Can be configured per job

### 4. **Resource Considerations**

- Maximum page limit (default: 100 pages)
- Maximum depth limit (default: 2 levels)
- Timeout: 30 seconds per request
- Connection pooling for efficiency

## Configuration

### User-Agent Customization

Update in `api/services/crawler.py`:

```python
self.user_agent = 'YourBotName/1.0 (+https://yoursite.com/bot-info)'
```

**Best practices:**
- Include bot name and version
- Add a URL with more information
- Provide contact method for site owners

### Adjusting Rate Limits

```python
# In crawler initialization
self.request_delay = 2.0  # 2 seconds between requests
```

Or respect robots.txt:
```python
# Automatically reads Crawl-delay from robots.txt
```

## When Sites Block You

If a website blocks your crawler:

### 1. **Check robots.txt**
```bash
curl https://example.com/robots.txt
```

Look for:
- `User-agent: *` or `User-agent: PowerNOVA-Crawler`
- `Disallow:` directives
- `Crawl-delay:` specifications

### 2. **Respect the Block**
If a site blocks your bot:
- ✅ **DO**: Respect the robots.txt rules
- ✅ **DO**: Contact the site owner for permission
- ✅ **DO**: Offer to whitelist specific pages
- ❌ **DON'T**: Circumvent blocks by changing User-Agent
- ❌ **DON'T**: Ignore robots.txt
- ❌ **DON'T**: Overwhelm the site with requests

### 3. **Request Permission**
```
Subject: Permission to Index Your Site

Hello,

I'm developing PowerNOVA, a document indexing system at [URL].
I'd like to include content from your site in our index.

Our crawler:
- Identifies as "PowerNOVA-Crawler/1.0"
- Respects robots.txt
- Crawls at a rate of 1 request/second
- Only indexes public content

Would you grant permission? I'm happy to:
- Limit crawling to specific sections
- Adjust crawl rate
- Provide attribution

Thank you,
[Your Name]
```

## Legal Considerations

### Fair Use
- Only index publicly accessible content
- Don't circumvent authentication or paywalls
- Respect copyright and terms of service
- Provide proper attribution

### GDPR/Privacy
- Don't collect personal information
- Respect privacy directives
- Honor removal requests promptly

### Terms of Service
- Read and comply with website ToS
- Don't crawl sites that explicitly prohibit it
- Respect intellectual property rights

## Alternative: Browser User-Agent (NOT RECOMMENDED)

**Why we DON'T use browser User-Agent:**

```python
# ❌ BAD PRACTICE - Pretending to be a browser
'User-Agent': 'Mozilla/5.0 (Windows...) Chrome/119.0.0.0'
```

**Problems:**
1. **Deceptive**: Misrepresents your bot's identity
2. **Violates robots.txt**: Can't be managed by site owners
3. **Terms of Service**: May violate website ToS
4. **Legal risk**: Could be considered unauthorized access
5. **Bad for ecosystem**: Undermines trust in web crawling

## Monitoring and Logging

The crawler logs:
- robots.txt fetch results
- Blocked URLs (with reason)
- Crawl rate and delays
- Response codes and errors

Check logs:
```bash
docker logs powernova-api | grep "services.crawler"
```

## Contact Information

If your website is being crawled by PowerNOVA and you have concerns:

1. **Update robots.txt**: Add rules for `PowerNOVA-Crawler`
2. **Contact us**: [Add your contact method]
3. **Request removal**: We honor removal requests promptly

## References

- [robots.txt Specification](https://www.robotstxt.org/)
- [Google Webmaster Guidelines](https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)
- [The Web Robots Pages](https://www.robotstxt.org/guidelines.html)
- [Robots Exclusion Protocol](https://en.wikipedia.org/wiki/Robots_exclusion_standard)

## Summary

**DO:**
- ✅ Identify your bot honestly
- ✅ Respect robots.txt
- ✅ Use reasonable rate limits
- ✅ Provide contact information
- ✅ Honor removal requests

**DON'T:**
- ❌ Pretend to be a browser
- ❌ Ignore robots.txt
- ❌ Overwhelm servers
- ❌ Circumvent access controls
- ❌ Ignore legal restrictions

Remember: **Respect makes the web better for everyone.**
