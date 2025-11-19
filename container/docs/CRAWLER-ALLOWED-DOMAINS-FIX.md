# Crawler Allowed Domains Fix

## Problem
When specifying an allowed domain in the crawl job creation form (e.g., `example.com`), the crawler would download only the first page and then exit, instead of continuing to crawl additional pages on that domain.

## Root Cause
The domain matching logic in `_is_allowed_domain()` was doing a simple string equality check (`domain in self.allowed_domains`). This caused issues when:

1. User specifies `example.com` as allowed domain
2. Start URL is `https://www.example.com/page` (note the `www` subdomain)
3. Links on the page point to `https://www.example.com/...`
4. The crawler extracts the domain as `www.example.com`
5. Simple check: `www.example.com in ['example.com']` → **False**
6. All links are rejected as "not allowed domain"
7. Crawler exits after first page

## Solution
Enhanced the domain matching logic to support subdomain matching:

```python
def _is_allowed_domain(self, url: str) -> bool:
    """Check if URL domain is allowed"""
    parsed = urlparse(url)
    domain = parsed.netloc
    
    # If no allowed domains specified, only allow same domain as start URL
    if not self.allowed_domains:
        start_domain = urlparse(self.start_url).netloc
        return domain == start_domain
    
    # Check if domain matches any allowed domain
    # Support both exact match and subdomain match
    for allowed_domain in self.allowed_domains:
        # Exact match
        if domain == allowed_domain:
            return True
        
        # Subdomain match: domain ends with .allowed_domain
        # e.g., if allowed domain is "example.com", allow "www.example.com"
        if domain.endswith('.' + allowed_domain):
            return True
        
        # Reverse check: if allowed_domain is a subdomain of domain
        # e.g., allowed="www.example.com" should match domain="example.com"
        if allowed_domain.endswith('.' + domain):
            return True
    
    return False
```

## Behavior After Fix

### Supported Patterns
- `example.com` matches:
  - `example.com` ✓
  - `www.example.com` ✓
  - `subdomain.example.com` ✓
  - `api.docs.example.com` ✓

- `www.example.com` matches:
  - `www.example.com` ✓
  - `example.com` ✓ (reverse match)

### Rejected Patterns (Security)
- `example.com` does NOT match:
  - `different.com` ✗
  - `example.com.fake.com` ✗ (prevents domain spoofing)

## Testing
Verified with multiple test cases:
```
✓ example.com              vs example.com          = True
✓ www.example.com          vs example.com          = True
✓ subdomain.example.com    vs example.com          = True
✓ www.example.com          vs www.example.com      = True
✓ example.com              vs www.example.com      = True
✓ different.com            vs example.com          = False
✓ example.com.fake.com     vs example.com          = False
```

## Files Changed
- `api/services/crawler.py` - Enhanced `_is_allowed_domain()` method

## Deployment
1. Rebuild Docker image: `./scripts/azure-deploy-api.sh --update`
2. Test with real crawl job specifying allowed domains

## Impact
Users can now:
- Specify `example.com` and crawl both `example.com` and `www.example.com`
- Use root domains without worrying about subdomain variations
- Crawler will properly follow links across subdomains of allowed domains
