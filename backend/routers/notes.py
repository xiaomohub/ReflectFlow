"""笔记管理 API - Markdown 笔记 CRUD + 分类 + AI Skills"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from fastapi.responses import PlainTextResponse

from auth import get_current_user
from models.database import get_db
from models.models import AppUser, Note, NoteCategory
from schemas import (
    NoteCreate, NoteUpdate, NoteResponse, NoteSearchItem,
    NoteCategoryCreate, NoteCategoryUpdate, NoteCategoryResponse,
)
from services.note_service import NoteService

router = APIRouter(prefix="/api/notes", tags=["笔记"])


# ===== 笔记分类 CRUD =====

@router.get("/categories", response_model=list[NoteCategoryResponse])
def list_note_categories(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    return db.query(NoteCategory).filter(
        NoteCategory.owner_user_id == current_user.id
    ).order_by(NoteCategory.sort_order).all()


@router.post("/categories", response_model=NoteCategoryResponse)
def create_note_category(
    data: NoteCategoryCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    existing = db.query(NoteCategory).filter(
        NoteCategory.name == data.name,
        NoteCategory.parent_id == data.parent_id,
        NoteCategory.owner_user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(409, f"分类「{data.name}」已存在")
    cat = NoteCategory(**data.model_dump(), owner_user_id=current_user.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=NoteCategoryResponse)
def update_note_category(
    category_id: int,
    data: NoteCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    cat = db.query(NoteCategory).filter(
        NoteCategory.id == category_id,
        NoteCategory.owner_user_id == current_user.id,
    ).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    for key, value in update_data.items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
def delete_note_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    cat = db.query(NoteCategory).filter(
        NoteCategory.id == category_id,
        NoteCategory.owner_user_id == current_user.id,
    ).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    db.query(Note).filter(
        Note.category_id == category_id,
        Note.owner_user_id == current_user.id,
    ).update({Note.category_id: None})
    db.delete(cat)
    db.commit()
    return {"message": "已删除"}


# ===== 笔记 CRUD =====

@router.get("/", response_model=list[NoteResponse])
def list_notes(
    category_id: int = Query(None, description="按分类筛选"),
    tag: str = Query(None, description="按标签筛选"),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    query = db.query(Note).filter(Note.owner_user_id == current_user.id)
    if category_id is not None:
        query = query.filter(Note.category_id == category_id)
    if tag:
        from sqlalchemy import text
        query = query.filter(Note.tags.contains(tag))
    return query.order_by(Note.updated_at.desc()).all()


@router.post("/", response_model=NoteResponse)
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    note_data = data.model_dump()
    note_data["word_count"] = len(note_data.get("content", ""))
    note_data["owner_user_id"] = current_user.id
    note = Note(**note_data)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.owner_user_id == current_user.id,
    ).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.owner_user_id == current_user.id,
    ).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "content" in update_data:
        update_data["word_count"] = len(update_data.get("content", ""))
    for key, value in update_data.items():
        if value is not None:
            setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.owner_user_id == current_user.id,
    ).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    db.delete(note)
    db.commit()
    return {"message": "已删除"}


# ===== 下载 & AI 功能 =====

@router.get("/{note_id}/download")
def download_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """下载笔记为 .md 文件"""
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.owner_user_id == current_user.id,
    ).first()
    if not note:
        raise HTTPException(404, "笔记不存在")
    content = f"# {note.title}\n\n{note.content}"
    return PlainTextResponse(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{note.title}.md"'},
    )


@router.post("/{note_id}/extract-skills")
def extract_skills(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """AI 提取笔记中的技能/方法论"""
    service = NoteService(db, current_user)
    skills = service.extract_skills(note_id)
    return {"skills": skills}


@router.get("/by-decision/{decision_id}", response_model=list[NoteResponse])
def list_notes_by_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """获取关联到某决策的所有笔记"""
    return db.query(Note).filter(
        Note.decision_id == decision_id,
        Note.owner_user_id == current_user.id,
    ).order_by(Note.updated_at.desc()).all()


@router.post("/search", response_model=list[NoteSearchItem])
def search_notes(
    query: str = Query("", description="搜索关键词"),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = NoteService(db, current_user)
    notes = service.search_notes(query)
    # Map to response with snippet from transient attribute
    result = []
    for note in notes:
        item = NoteSearchItem.model_validate(note)
        item.snippet = getattr(note, "_snippet", "")
        result.append(item)
    return result
