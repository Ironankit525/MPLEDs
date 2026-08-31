from datetime import datetime, timezone
from pymongo import MongoClient
import os
import sys

# Add the app directory to the path so we can import auth module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.auth import get_password_hash
from app.config import settings

def seed_users():
    # Connect to DB
    client = MongoClient(settings.DATABASE_URL)
    db = client['MPLADS']
    
    users_to_add = [
        {
            "username": "admin",
            "password": "demo1234",
            "role": "admin",
            "agency_name": "System Admin",
            "district": "All"
        },
        {
            "username": "mp",
            "password": "demo1234",
            "role": "mp",
            "agency_name": "MP Office",
            "district": "Pune"
        },
        {
            "username": "contractor",
            "password": "demo1234",
            "role": "contractor",
            "agency_name": "Demo Builders",
            "district": "Pune"
        }
    ]

    for u in users_to_add:
        # Check if exists
        existing = db.users.find_one({"username": u["username"]})
        if existing:
            # Update password and role just in case
            db.users.update_one(
                {"username": u["username"]},
                {"$set": {
                    "password_hash": get_password_hash(u["password"]),
                    "role": u["role"]
                }}
            )
            print(f"Updated existing user: {u['username']}")
        else:
            db.users.insert_one({
                "username": u["username"],
                "password_hash": get_password_hash(u["password"]),
                "role": u["role"],
                "agency_name": u["agency_name"],
                "district": u["district"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            })
            print(f"Created new user: {u['username']}")

    print("Test users seeded successfully!")

if __name__ == "__main__":
    seed_users()
