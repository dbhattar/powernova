# SQLAlchemy Enum Values Fix

## Date: November 20, 2024

## Issue

**Error Messages:**
```
# First error:
psycopg2.errors.InvalidTextRepresentation: invalid input value for enum documentscope: "CONVERSATION"

# Second error (after partial fix):
psycopg2.errors.InvalidTextRepresentation: invalid input value for enum documenttype: "pdf"
```

**User Impact:**
- Document upload failed with 500 Internal Server Error
- Users could not attach documents to conversations
- Database rejected enum values

## Root Cause Analysis

### The Problem

**Two separate issues:**

1. **SQLAlchemy using enum NAMES instead of VALUES**
2. **Python enum values didn't match database enum values**

### Database Enum Values (All Uppercase)

```sql
-- documenttype enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'documenttype'::regtype;
enumlabel: PDF, HTML, TEXT, MARKDOWN, DOCX, OTHER

-- documentstatus enum  
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'documentstatus'::regtype;
enumlabel: PENDING, PROCESSING, COMPLETED, FAILED

-- documentscope enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'documentscope'::regtype;
enumlabel: platform, user, conversation  ← LOWERCASE!
```

### Python Enum Values (Were Lowercase)

```python
# BEFORE (❌ Wrong):
class DocumentType(str, enum.Enum):
    PDF = "pdf"        # Value lowercase, database has "PDF"
    HTML = "html"      # Value lowercase, database has "HTML"
    # ... etc

class DocumentStatus(str, enum.Enum):
    PENDING = "pending"  # Value lowercase, database has "PENDING"
    # ... etc
```

## Solution

### Part 1: Force SQLAlchemy to Use Enum Values

Added `values_callable` to all enum columns:

```python
document_type = Column(
    SQLEnum(DocumentType, values_callable=lambda x: [e.value for e in x]),
    ...
)
document_scope = Column(
    SQLEnum(DocumentScope, values_callable=lambda x: [e.value for e in x]),
    ...
)
status = Column(
    SQLEnum(DocumentStatus, values_callable=lambda x: [e.value for e in x]),
    ...
)
```

### Part 2: Match Python Enum Values to Database

Changed Python enum values to **UPPERCASE** to match database:

```python
# AFTER (✅ Correct):
class DocumentType(str, enum.Enum):
    PDF = "PDF"          # Matches database "PDF"
    HTML = "HTML"        # Matches database "HTML"
    TEXT = "TEXT"        # Matches database "TEXT"
    MARKDOWN = "MARKDOWN"
    DOCX = "DOCX"
    OTHER = "OTHER"

class DocumentStatus(str, enum.Enum):
    PENDING = "PENDING"      # Matches database "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class DocumentScope(str, enum.Enum):
    PLATFORM = "platform"     # Matches database "platform"
    USER = "user"            # Matches database "user"
    CONVERSATION = "conversation"  # Matches database "conversation"
```

**Note:** `DocumentScope` stays lowercase because the database has lowercase values.

## Files Modified

### `/api/models/document.py`

**Changes Made:**

1. **Enum Value Definitions (Lines 12-27):**
```python
# BEFORE:
class DocumentType(str, enum.Enum):
    PDF = "pdf"
    HTML = "html"
    # ...

class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    # ...

# AFTER:
class DocumentType(str, enum.Enum):
    PDF = "PDF"          # ✅ Uppercase to match database
    HTML = "HTML"
    TEXT = "TEXT"
    MARKDOWN = "MARKDOWN"
    DOCX = "DOCX"
    OTHER = "OTHER"

class DocumentStatus(str, enum.Enum):
    PENDING = "PENDING"      # ✅ Uppercase to match database
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class DocumentScope(str, enum.Enum):
    PLATFORM = "platform"     # ✅ Lowercase (database has lowercase)
    USER = "user"
    CONVERSATION = "conversation"
```

2. **Column Definitions (Lines 77, 80, 93):**
```python
# Added values_callable to force using enum values
document_type = Column(
    SQLEnum(DocumentType, values_callable=lambda x: [e.value for e in x]),
    nullable=False,
    default=DocumentType.HTML
)

document_scope = Column(
    SQLEnum(DocumentScope, values_callable=lambda x: [e.value for e in x]),
    nullable=False,
    default=DocumentScope.PLATFORM,
    index=True
)

status = Column(
    SQLEnum(DocumentStatus, values_callable=lambda x: [e.value for e in x]),
    nullable=False,
    default=DocumentStatus.PENDING
)
```

## Summary of All Changes

| Enum | Database Values | Python Values (Before) | Python Values (After) | values_callable |
|------|----------------|----------------------|---------------------|-----------------|
| DocumentType | PDF, HTML, TEXT... | pdf, html, text... ❌ | PDF, HTML, TEXT... ✅ | Added ✅ |
| DocumentStatus | PENDING, PROCESSING... | pending, processing... ❌ | PENDING, PROCESSING... ✅ | Added ✅ |
| DocumentScope | platform, user, conversation | platform, user, conversation ✅ | platform, user, conversation ✅ | Added ✅ |

## Testing

### Verify Database Enum Values

```bash
# Check documentscope enum
docker exec -it powernova-postgres psql -U powernova -d powernova \
  -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'documentscope'::regtype;"

# Expected output:
  enumlabel   
--------------
 platform
 user
 conversation
```

### Test Document Upload

```bash
# 1. Login and get token
TOKEN="your_jwt_token"

# 2. Upload document
curl -X POST "http://localhost:8000/api/conversations/1/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf"

# 3. Check logs for successful insert
docker logs powernova-api | grep "INSERT INTO documents"

# Should NOT see error about 'CONVERSATION'
```

### Verify in Browser

1. Open http://localhost:8081
2. Login
3. Create/open conversation
4. Click paperclip icon
5. Upload a PDF/DOCX/TXT file
6. Should see success message (not 500 error)
7. Document should appear in documents panel

## Best Practices Learned

### 1. Consistent Enum Value Casing

**Always use lowercase for database enum values:**
```python
# ✅ GOOD - Consistent lowercase
class DocumentScope(str, enum.Enum):
    PLATFORM = "platform"
    USER = "user"
    CONVERSATION = "conversation"

# ❌ BAD - Mixed case
class DocumentScope(str, enum.Enum):
    PLATFORM = "PLATFORM"  # Uppercase
    user = "user"          # Lowercase
```

### 2. Always Specify `values_callable` for SQLAlchemy Enums

```python
# ✅ GOOD - Explicit value usage
Column(SQLEnum(MyEnum, values_callable=lambda x: [e.value for e in x]))

# ❌ BAD - Implicit (uses names)
Column(SQLEnum(MyEnum))
```

### 3. Test Enum Inserts Early

After creating a new enum-based column:
1. Check database enum values
2. Try inserting via SQLAlchemy
3. Verify the correct value is used

## Migration Implications

**No migration needed** because:
- Database enum values are correct (lowercase)
- Python enum values are correct (lowercase)
- Only SQLAlchemy's interpretation was wrong
- Fix is in ORM layer, not database layer

## Related Issues

This fix also prevents future issues with:
- `DocumentType` enum (now uses "pdf", not "PDF")
- `DocumentStatus` enum (now uses "pending", not "PENDING")

All enums now consistently use their **values** instead of **names**.

## References

- SQLAlchemy Enum Documentation: https://docs.sqlalchemy.org/en/20/core/type_basics.html#sqlalchemy.types.Enum
- PostgreSQL Enum Types: https://www.postgresql.org/docs/current/datatype-enum.html
- Python Enum Module: https://docs.python.org/3/library/enum.html
