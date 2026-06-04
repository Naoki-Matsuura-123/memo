import os
import sqlite3
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- SQLite Auto-Migration Logic ---
def run_db_migrations(db_path="memos.db"):
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # 1. ユーザーテーブルの確認（anonymousシード確認）
        anon_id = 1
        try:
            cursor.execute("SELECT id FROM users WHERE username = 'anonymous'")
            row = cursor.fetchone()
            if not row:
                cursor.execute("INSERT INTO users (username, display_name) VALUES ('anonymous', 'ゲスト')")
                conn.commit()
                cursor.execute("SELECT id FROM users WHERE username = 'anonymous'")
                row = cursor.fetchone()
            anon_id = row[0] if row else 1
        except Exception:
            pass

        # 2. memos テーブルの確認
        cursor.execute("PRAGMA table_info(memos)")
        columns = [col[1] for col in cursor.fetchall()]
        if len(columns) > 0:
            if "folder_id" not in columns:
                print("Auto-migration: Adding folder_id column to memos table...")
                cursor.execute("ALTER TABLE memos ADD COLUMN folder_id INTEGER")
                conn.commit()
            if "user_id" not in columns:
                print("Auto-migration: Adding user_id column to memos table...")
                cursor.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER")
                conn.commit()
                cursor.execute(f"UPDATE memos SET user_id = {anon_id} WHERE user_id IS NULL")
                conn.commit()

        # 3. folders テーブルの確認
        cursor.execute("PRAGMA table_info(folders)")
        f_columns = [col[1] for col in cursor.fetchall()]
        if len(f_columns) > 0:
            if "user_id" not in f_columns:
                print("Auto-migration: Adding user_id column to folders table...")
                cursor.execute("ALTER TABLE folders ADD COLUMN user_id INTEGER")
                conn.commit()
                cursor.execute(f"UPDATE folders SET user_id = {anon_id} WHERE user_id IS NULL")
                conn.commit()

        # 4. users テーブルの確認
        cursor.execute("PRAGMA table_info(users)")
        u_columns = [col[1] for col in cursor.fetchall()]
        if len(u_columns) > 0:
            if "password_hash" not in u_columns:
                print("Auto-migration: Adding password_hash column to users table...")
                cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
                conn.commit()

        # 5. memo_shares テーブルの確認
        cursor.execute("PRAGMA table_info(memo_shares)")
        memo_shares_info = cursor.fetchall()
        ms_columns = [col[1] for col in memo_shares_info]
        if len(ms_columns) > 0:
            if "role_id" not in ms_columns:
                print("Auto-migration: Adding role_id column to memo_shares table...")
                cursor.execute("ALTER TABLE memo_shares ADD COLUMN role_id INTEGER")
                conn.commit()
                cursor.execute("PRAGMA table_info(memo_shares)")
                memo_shares_info = cursor.fetchall()
                ms_columns = [col[1] for col in memo_shares_info]
            
            # Check if user_id column has a NOT NULL constraint (notnull == 1)
            user_id_col = next((col for col in memo_shares_info if col[1] == "user_id"), None)
            if user_id_col and user_id_col[3] == 1:
                print("Auto-migration: Recreating memo_shares table to make user_id nullable...")
                cursor.execute("PRAGMA foreign_keys=OFF")
                cursor.execute("BEGIN TRANSACTION")
                cursor.execute("ALTER TABLE memo_shares RENAME TO _memo_shares_old")
                
                # Create table matching SQLAlchemy metadata
                cursor.execute("""
                    CREATE TABLE memo_shares (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        memo_id INTEGER NOT NULL,
                        user_id INTEGER,
                        role_id INTEGER,
                        permission TEXT NOT NULL,
                        FOREIGN KEY(memo_id) REFERENCES memos(id) ON DELETE CASCADE,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_memo_shares_id ON memo_shares (id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_memo_shares_memo_id ON memo_shares (memo_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_memo_shares_user_id ON memo_shares (user_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_memo_shares_role_id ON memo_shares (role_id)")
                
                cursor.execute("""
                    INSERT INTO memo_shares (id, memo_id, user_id, role_id, permission)
                    SELECT id, memo_id, user_id, role_id, permission FROM _memo_shares_old
                """)
                cursor.execute("DROP TABLE _memo_shares_old")
                conn.commit()
                cursor.execute("PRAGMA foreign_keys=ON")
                print("Auto-migration: Recreated memo_shares successfully.")

    except Exception as e:
        print("Auto-migration warning:", e)
    finally:
        conn.close()

# --- SQLAlchemy Database configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///memos.db")

# Run migrations if using SQLite
if DATABASE_URL.startswith("sqlite"):
    db_file = DATABASE_URL.replace("sqlite:///", "")
    if db_file:
        run_db_migrations(db_file)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# SQLite接続時のみ外部キー制約 (Foreign Key Constraints) を有効化する
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
