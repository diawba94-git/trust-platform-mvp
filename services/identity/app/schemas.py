from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime

# Réutilise l'enum du modèle (et non une redéfinition locale) : ROLE_TO_CONTRACT_ROLE
# (models.py) est indexé par ces mêmes membres — un second UserRole, même de valeurs
# identiques, serait une classe d'enum différente et ferait échouer silencieusement
# `request.role in ROLE_TO_CONTRACT_ROLE` (l'attribution du rôle on-chain ne se
# déclencherait alors jamais).
from .models import UserRole


class ActorCreateRequest(BaseModel):
    email: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
    role: UserRole = UserRole.USER

    @model_validator(mode="after")
    def _require_identity_fields_for_user_role(self):
        if self.role == UserRole.USER and not (self.date_of_birth and self.place_of_birth and self.national_id_number):
            raise ValueError(
                "date_of_birth, place_of_birth et national_id_number sont requis pour créer un compte USER"
            )
        return self


class ActorCreateResponse(BaseModel):
    id: int
    did: str
    address: str
    private_key: Optional[str] = None
    public_key: str
    email: str
    full_name: str
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
    role: str
    created_at: datetime
    already_existed: bool = False

    class Config:
        from_attributes = True


class ManagedUserCreateRequest(BaseModel):
    email: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
    role: str = "USER"

    @model_validator(mode="after")
    def _require_identity_fields_for_user_role(self):
        if self.role == "USER" and not (self.date_of_birth and self.place_of_birth and self.national_id_number):
            raise ValueError(
                "date_of_birth, place_of_birth et national_id_number sont requis pour créer un compte USER"
            )
        return self


class SetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)


class MyCredentialsResponse(BaseModel):
    id: int
    did: str
    address: str
    private_key: Optional[str] = None
    public_key: Optional[str] = None
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True
