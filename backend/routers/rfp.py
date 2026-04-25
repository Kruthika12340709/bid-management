from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.rfp import RFP
from schemas.rfp import RFPOut, RFPCreate
from typing import List
from uuid import UUID

router = APIRouter()


@router.get("/", response_model=List[RFPOut])
async def list_rfps(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RFP).order_by(RFP.submission_deadline))
    return result.scalars().all()


@router.get("/{rfp_id}", response_model=RFPOut)
async def get_rfp(rfp_id: UUID, db: AsyncSession = Depends(get_db)):
    rfp = await db.get(RFP, rfp_id)
    if not rfp:
        raise HTTPException(status_code=404, detail="RFP not found")
    return rfp


@router.post("/", response_model=RFPOut, status_code=201)
async def create_rfp(payload: RFPCreate, db: AsyncSession = Depends(get_db)):
    rfp = RFP(**payload.model_dump())
    db.add(rfp)
    await db.commit()
    await db.refresh(rfp)
    return rfp
