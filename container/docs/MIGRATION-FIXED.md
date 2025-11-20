# Migration Fixed - Next Steps

## Issue Fixed ✅
The migration file had a duplicate docstring that was causing Alembic to show:
```
"Mako script for generating migration files"
```

This has been corrected. The migration should now show:
```
"add_pgvector_support"
```

## Test the Migration

### Option 1: Test Inside Running Container (Recommended)

If your containers are already running:

```bash
# 1. Rebuild the API container to get new dependencies
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/docker
docker-compose up --build -d powernova-api

# 2. Enter the container
docker exec -it powernova-api bash

# 3. Run the migration
alembic upgrade head

# Expected output:
# INFO  [alembic.runtime.migration] Running upgrade 002_add_documents_crawl -> e64fd1918790, add_pgvector_support

# 4. Verify the migration worked
python -c "
from database import get_db
from sqlalchemy import text

db = next(get_db())
result = db.execute(text('SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL'))
print(f'Documents with embeddings: {result.scalar()}')

result = db.execute(text(\"SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector'\"))
print(f'pgvector extension installed: {result.scalar() > 0}')
"

# 5. Exit container
exit
```

### Option 2: Full Rebuild (If you encounter issues)

```bash
cd /Users/dipeshbhattarai/Projects/powernovaapp/powernova/container/docker

# 1. Stop and remove containers
docker-compose down

# 2. Remove volumes (CAUTION: This deletes all data!)
docker volume rm powernova_postgres_data

# 3. Rebuild and start fresh
docker-compose up --build -d

# 4. Wait for containers to be healthy
sleep 10

# 5. Run migration
docker exec -it powernova-api alembic upgrade head

# 6. Verify
docker exec -it powernova-postgres psql -U powernova -d powernova -c "\dx"
# Should show 'vector' extension

docker exec -it powernova-postgres psql -U powernova -d powernova -c "\d documents"
# Should show 'embedding' column with type 'vector(1536)'
```

## Verification Commands

### Check if pgvector extension is enabled:
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova -c "\dx"
```

Expected output should include:
```
 vector  | 0.7.0   | public     | vector data type and ivfflat...
```

### Check if embedding column exists:
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova -c "\d documents"
```

Should show:
```
 embedding | vector(1536) | 
```

### Check if HNSW index exists:
```bash
docker exec -it powernova-postgres psql -U powernova -d powernova -c "\di documents_embedding_idx"
```

Should show the index details.

## If You Get Errors

### "pgvector module not found"
The container needs to be rebuilt to install pgvector Python package:
```bash
docker-compose up --build -d powernova-api
```

### "relation documents_embedding_idx already exists"
The index was created by a previous run. You can:
1. Drop it manually and re-run migration
2. Or mark the migration as complete:
```bash
docker exec -it powernova-api alembic stamp head
```

### "column embedding already exists"
Same as above - the migration was partially applied. Either:
1. Roll back: `docker exec -it powernova-api alembic downgrade -1`
2. Or stamp as complete: `docker exec -it powernova-api alembic stamp head`

## Ready to Test RAG?

Once migration is successful, follow the test steps in:
- `docs/PGVECTOR-QUICKSTART.md` (Quick 5-minute test)
- `docs/PGVECTOR-RAG-IMPLEMENTATION.md` (Full documentation)

---

**Status:** Migration file fixed! Ready to apply. 🎯
