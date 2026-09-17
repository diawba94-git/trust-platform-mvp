import os
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from trustwedge_auth import get_current_user

from ..database import get_db
from ..schemas import (
    WorkflowCreateRequest, VerificationRequest, VerificationSubmit,
    NotaryRequest, NotaryValidation, CancelRequest,
)
from ..workflow_engine import WorkflowEngine
from ..blockchain import BlockchainClient
from ..services.did_service import DIDService

router = APIRouter(prefix="/workflows", tags=["Workflows"])

blockchain_client = BlockchainClient()
did_service = DIDService(os.getenv("ENCRYPTION_KEY"))


def _engine(db: Session) -> WorkflowEngine:
    return WorkflowEngine(db, blockchain_client, did_service)


@router.post("/create")
def create_workflow(
    request: WorkflowCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).create_workflow(
        workflow_type=request.workflow_type,
        initiator_id=current_user["id"],
        target_user_id=request.target_user_id,
        document_token_id=request.document_token_id,
        document_cid=request.document_cid,
        workflow_data=request.workflow_data
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.post("/{workflow_id}/start")
def start_workflow(
    workflow_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).start_workflow(workflow_id, current_user["id"])
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.post("/{workflow_id}/request-verification")
def request_verification(
    workflow_id: int,
    request: VerificationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).request_verification(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        verifier_id=request.verifier_id,
        verification_data=request.verification_data
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.post("/{workflow_id}/submit-verification")
def submit_verification(
    workflow_id: int,
    request: VerificationSubmit,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).submit_verification(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        is_valid=request.is_valid,
        verification_notes=request.notes
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.post("/{workflow_id}/request-notary")
def request_notary_validation(
    workflow_id: int,
    request: NotaryRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).request_notary_validation(
        workflow_id=workflow_id, actor_id=current_user["id"], notary_id=request.notary_id
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.post("/{workflow_id}/validate-by-notary")
def validate_by_notary(
    workflow_id: int,
    request: NotaryValidation,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).validate_by_notary(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        is_valid=request.is_valid,
        validation_notes=request.notes,
        transaction_hash=request.transaction_hash,
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.post("/{workflow_id}/cancel")
def cancel_workflow(
    workflow_id: int,
    request: CancelRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).cancel_workflow(workflow_id, current_user["id"], request.reason)
    return {"workflow_id": workflow.id, "status": workflow.status.value}


@router.get("/{workflow_id}/status")
def get_workflow_status(
    workflow_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflow = _engine(db).get_workflow(workflow_id)
    return {
        "workflow_id": workflow.id,
        "status": workflow.status.value,
        "workflow_type": workflow.workflow_type.value,
        "initiator_id": workflow.initiator_id,
        "target_user_id": workflow.target_user_id,
        "notary_id": workflow.notary_id,
        "document_token_id": workflow.document_token_id,
        "workflow_data": workflow.workflow_data,
        "created_at": workflow.created_at,
        "updated_at": workflow.updated_at,
        "completed_at": workflow.completed_at,
        "steps": [
            {
                "step_name": step.step_name,
                "action": step.action,
                "status": step.status,
                "created_at": step.created_at
            } for step in workflow.steps
        ]
    }


@router.get("/my")
def get_my_workflows(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflows = _engine(db).get_user_workflows(current_user["id"], status)
    return [
        {
            "id": w.id,
            "type": w.workflow_type.value,
            "status": w.status.value,
            "initiator_id": w.initiator_id,
            "target_user_id": w.target_user_id,
            "notary_id": w.notary_id,
            "document_token_id": w.document_token_id,
            "workflow_data": w.workflow_data,
            "created_at": w.created_at,
            "updated_at": w.updated_at
        } for w in workflows
    ]
