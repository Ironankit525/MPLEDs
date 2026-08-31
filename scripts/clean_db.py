import sys
from pathlib import Path
import shutil

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import IMAGES_DIR
from app.database import db, init_db

def clean_database():
    print("Initializing DB connection...")
    init_db()
    
    # 1. Clear MongoDB collections
    print("Clearing image_records collection...")
    res = db.image_records.delete_many({})
    print(f"Deleted {res.deleted_count} image records.")
    
    # 2. Clear local images on disk
    if IMAGES_DIR.exists():
        print(f"Cleaning local images directory: {IMAGES_DIR}")
        for path in IMAGES_DIR.iterdir():
            if path.is_file() and path.name != ".gitkeep":
                try:
                    path.unlink()
                    print(f"Deleted file: {path.name}")
                except Exception as e:
                    print(f"Could not delete {path.name}: {e}")
    else:
        print("Local images directory does not exist.")
        
    print("Database and local storage cleaned successfully!")

if __name__ == "__main__":
    clean_database()
