from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base, SessionLocal
from backend.models import UserModel
from backend.routers import folders, memos, users, ratings, tags, auth, roles
from backend.routers.roles import seed_default_roles

# SQLite テーブルの自動生成
Base.metadata.create_all(bind=engine)

# FastAPI インスタンス化
app = FastAPI(
    title="nao-memo API",
    description="SQLAlchemy ORM を採用したフォルダ＆メモ管理API（多軸レーティング機能付き）",
    version="2.0.0"
)

# CORS ミドルウェア設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターのインクルード
app.include_router(auth.router)
app.include_router(folders.router)
app.include_router(memos.router)
app.include_router(users.router)
app.include_router(ratings.router)
app.include_router(tags.router)
app.include_router(roles.router)

# --- Startup: Seed default anonymous user and default roles ---
@app.on_event('startup')
def seed_default_user():
    db = SessionLocal()
    try:
        anon = db.query(UserModel).filter(UserModel.username == 'anonymous').first()
        if not anon:
            db.add(UserModel(username='anonymous', display_name='ゲスト'))
            db.commit()
        # Seed default roles
        seed_default_roles(db)
    finally:
        db.close()
