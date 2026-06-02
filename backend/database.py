import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- SQLite Auto-Migration Logic ---
def run_db_migrations(db_path="memos.db"):
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(memos)")
        columns = [col[1] for col in cursor.fetchall()]
        if "folder_id" not in columns:
            print("Auto-migration: Adding folder_id column to memos table...")
            cursor.execute("ALTER TABLE memos ADD COLUMN folder_id INTEGER")
            conn.commit()
    except Exception as e:
        print("Auto-migration warning:", e)
    finally:
        conn.close()

# Run migrations before SQLAlchemy initialization
run_db_migrations()

# --- SQLAlchemy Database configuration ---
DATABASE_URL = "sqlite:///memos.db"
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
