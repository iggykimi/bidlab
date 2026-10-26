"""Shared transport primitives. Mirrors the API_CONTRACT Money/Decimal/EntityId shapes."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

IDText = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
MoneyText = Annotated[str, Field(pattern=r"^\d{1,12}\.\d{2}$")]
DecimalText = Annotated[str, Field(pattern=r"^-?\d{1,12}(\.\d{1,12})?$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
