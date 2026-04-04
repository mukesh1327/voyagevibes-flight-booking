from typing import Optional


def _clean(value: Optional[str]) -> str:
    if value is None:
        return ""
    return value.strip()


def actor_type_from_context(actor_type_header: Optional[str], realm_header: Optional[str]) -> str:
    actor = _clean(actor_type_header).lower()
    if actor == "corp":
        return "corp"
    if actor == "customer":
        return "customer"

    realm = _clean(realm_header).lower()
    if realm in ("corp", "voyagevibes-corp"):
        return "corp"

    return "customer"
