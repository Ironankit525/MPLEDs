"""
Database connection, session management, and initialisation for the MPLADS module.

Uses MongoDB Atlas via PyMongo for cloud-hosted document storage.
"""

import logging
from typing import Generator

from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings

logger = logging.getLogger(__name__)

# Read from Settings (app/config.py), which in turn requires DATABASE_URL
# to be set via the environment or .env — there is deliberately no
# hardcoded fallback here any more. A hardcoded Atlas URI (including a
# live username/password) used to live in this file; that credential
# should be treated as compromised and rotated in the Atlas dashboard,
# then replaced in .env. See app/config.py's DATABASE_URL comment.
MONGO_URL = settings.DATABASE_URL

# Connect to Atlas. We use the 'MPLADS' database.
# Note: For testing, this might be a mongomock client.
try:
    # If the URL contains mongomock, we need to handle it specially
    if "mongomock" in MONGO_URL.lower():
        import mongomock
        client = mongomock.MongoClient(MONGO_URL)
    else:
        # Atlas requires TLS; python.org macOS builds (and some Linux
        # minimal images) ship without a system CA path Python can find,
        # which fails the handshake with CERTIFICATE_VERIFY_FAILED.
        # certifi's bundle is the portable fix; certifi is already an
        # indirect dependency (httpx), so this adds no new install.
        import certifi
        client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())
    
    # Get database instance
    # Parse DB name from URI or default to MPLADS
    db_name = "MPLADS"
    if "@" in MONGO_URL and "/" in MONGO_URL.split("@")[-1]:
        parsed_db = MONGO_URL.split("@")[-1].split("/")[1].split("?")[0]
        if parsed_db:
            db_name = parsed_db
            
    db = client[db_name]
except Exception as e:
    logger.exception("Failed to initialize MongoDB client")
    raise


def get_db() -> Generator[Database, None, None]:
    """FastAPI dependency that yields the MongoDB database instance.

    Usage in a route::

        @app.post("/example")
        def example(db: Database = Depends(get_db)):
            ...
    """
    yield db


# ── Seed data for the districts collection ─────────────────────────────
# Real Indian districts spanning multiple states and regions.
SEED_DISTRICTS = [
    # Name, State, Latitude, Longitude
    ("Pune", "Maharashtra", 18.5204, 73.8567),
    ("Nagpur", "Maharashtra", 21.1458, 79.0882),
    ("Mumbai Suburban", "Maharashtra", 19.0760, 72.8777),
    ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
    ("Varanasi", "Uttar Pradesh", 25.3176, 82.9739),
    ("Jaipur", "Rajasthan", 26.9124, 75.7873),
    ("Jodhpur", "Rajasthan", 26.2389, 73.0243),
    ("Patna", "Bihar", 25.6093, 85.1376),
    ("Bhopal", "Madhya Pradesh", 23.2599, 77.4126),
    ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
    ("Coimbatore", "Tamil Nadu", 11.0168, 76.9558),
    ("Kolkata", "West Bengal", 22.5726, 88.3639),
    ("Bengaluru Urban", "Karnataka", 12.9716, 77.5946),
    ("Thiruvananthapuram", "Kerala", 8.5241, 76.9366),
    ("Guwahati", "Assam", 26.1445, 91.7362),
]


def init_db() -> None:
    """Ensure indexes and seed the districts lookup.

    Safe to call multiple times.
    """
    from app.config import DATA_DIR, IMAGES_DIR
    # Ensure directories exist for image storage
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Create basic indexes
    db.users.create_index("username", unique=True)
    db.sessions.create_index("token", unique=True)
    db.image_records.create_index("work_id")

    # Projects: work_id is the join key from ImageRecord.work_id and must
    # identify exactly one work, hence unique. assigned_to_user_id is the
    # filter behind every submitter-dashboard query.
    db.projects.create_index("work_id", unique=True)
    db.projects.create_index("assigned_to_user_id")

    logger.info("MongoDB indexes verified.")

    # Seed districts
    _seed_districts()


def _seed_districts() -> None:
    """Insert seed districts if the collection is empty."""
    try:
        existing_count = db.districts.count_documents({})
        if existing_count > 0:
            logger.info("Districts collection already populated (%d docs), skipping seed.", existing_count)
            return

        docs = []
        for name, state, lat, lon in SEED_DISTRICTS:
            docs.append({
                "name": name,
                "state": state,
                "centre_latitude": lat,
                "centre_longitude": lon,
            })
        
        if docs:
            db.districts.insert_many(docs)
        logger.info("Seeded %d districts.", len(SEED_DISTRICTS))
    except Exception:
        logger.exception("Failed to seed districts collection.")
        raise
