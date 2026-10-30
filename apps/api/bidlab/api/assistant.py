"""«Pregúntale al pliego» routes: transcribe a spoken question, answer it via tools."""

import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, Response, UploadFile
from sqlalchemy.orm import Session

from bidlab.api import deps
from bidlab.api.errors import ERROR_RESPONSES, ApiError
from bidlab.schemas import generated as g
from bidlab.services import assistant as assistant_service
from bidlab.services import idempotency

router = APIRouter(responses=ERROR_RESPONSES, tags=["assistant"])


@router.post(
    "/tenders/{tender_id}/assistant/transcriptions",
    response_model=g.AssistantTranscription,
    status_code=201,
    operation_id="transcribe_question",
)
def transcribe_question(
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    tender_id: str,
    audio: Annotated[UploadFile, File()],
    allow_remote_processing: Annotated[bool, Form()] = False,
    idempotency_key: str = Header(max_length=100),
) -> g.AssistantTranscription:
    # Sync on purpose: the provider call blocks a threadpool worker, never
    # the event loop. Real byte cap; the +1 byte detects overflow.
    raw = audio.file.read(assistant_service.MAX_AUDIO_BYTES + 1)
    if len(raw) > assistant_service.MAX_AUDIO_BYTES:
        raise ApiError(
            413,
            "upload_too_large",
            f"audio is over {assistant_service.MAX_AUDIO_BYTES} bytes",
        )
    route = assistant_service.transcriptions_route_for(tender_id)
    # Multipart boundaries vary per retry: the clip hash plus consent is the intent.
    canonical = f"{hashlib.sha256(raw).hexdigest()}\n{allow_remote_processing}".encode()
    stored = idempotency.check(db, route, idempotency_key, canonical)
    if stored is not None:
        response.status_code = 200
        return g.AssistantTranscription.model_validate(stored)
    created = assistant_service.transcribe(
        db, tender_id, raw, allow_remote_processing=allow_remote_processing
    )
    winner = idempotency.store(db, route, idempotency_key, canonical, created)
    if winner is not None:
        response.status_code = 200
        return g.AssistantTranscription.model_validate(winner)
    return g.AssistantTranscription.model_validate(created)


@router.post(
    "/tenders/{tender_id}/assistant/answers",
    response_model=g.AssistantAnswer,
    status_code=201,
    operation_id="answer_question",
)
def answer_question(
    payload: g.AssistantAnswerRequest,
    response: Response,
    db: Annotated[Session, Depends(deps.get_db)],
    _guard: Annotated[None, Depends(deps.require_local_client)],
    tender_id: str,
    idempotency_key: str = Header(max_length=100),
) -> g.AssistantAnswer:
    body = payload.model_dump_json().encode("utf-8")
    route = assistant_service.answers_route_for(tender_id)
    stored = idempotency.check(db, route, idempotency_key, body)
    if stored is not None:
        response.status_code = 200
        return g.AssistantAnswer.model_validate(stored)
    created = assistant_service.answer(db, tender_id, payload)
    winner = idempotency.store(db, route, idempotency_key, body, created)
    if winner is not None:
        response.status_code = 200
        return g.AssistantAnswer.model_validate(winner)
    return g.AssistantAnswer.model_validate(created)
