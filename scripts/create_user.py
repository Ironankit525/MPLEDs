"""Create a user account directly in MongoDB with a specific role.

Public self-registration (`POST /api/auth/register`) only ever creates
Submitter accounts — see app/main.py's register(). There is no
self-service signup for Reviewer/Stakeholder/Admin accounts yet (that's
the not-yet-built Admin role's job); until it exists, this script is
how you bootstrap one for local development or a demo.

Usage:
    python -m scripts.create_user --username district_reviewer --password changeme \
        --role reviewer --agency-name "Pune District Verification Cell" --district Pune
"""

import argparse
import sys

from app.auth import get_password_hash
from app.database import db, init_db
from app.models import USER_ROLES


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", required=True, choices=USER_ROLES)
    parser.add_argument("--agency-name", default=None, help="e.g. 'Pune District Verification Cell'")
    parser.add_argument("--district", default=None)
    args = parser.parse_args()

    init_db()

    if db.users.find_one({"username": args.username}):
        print(f"Username '{args.username}' already exists.", file=sys.stderr)
        raise SystemExit(1)

    db.users.insert_one(
        {
            "username": args.username,
            "password_hash": get_password_hash(args.password),
            "agency_name": args.agency_name,
            "district": args.district,
            "role": args.role,
        }
    )
    print(f"Created {args.role} account '{args.username}'.")


if __name__ == "__main__":
    main()
