"""Wait until PostgreSQL accepts connections (used in CI before tests).

    python -m scripts.wait_for_db postgresql://user:pass@host:5432/db [timeout_seconds]
"""
import sys
import time

import psycopg


def main() -> None:
    url = sys.argv[1].replace("postgresql+psycopg://", "postgresql://")
    deadline = time.monotonic() + (float(sys.argv[2]) if len(sys.argv) > 2 else 60)
    while True:
        try:
            psycopg.connect(url, connect_timeout=3).close()
            print("database is ready")
            return
        except psycopg.OperationalError as exc:
            if time.monotonic() > deadline:
                sys.exit(f"database is not reachable: {exc}")
            time.sleep(1)


if __name__ == "__main__":
    main()
