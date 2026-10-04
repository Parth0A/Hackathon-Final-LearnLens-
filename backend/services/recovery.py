def recovery_status(mastery_after: float) -> str:
    """Prototype thresholds: 80% recovered, 60-79% partial, below 60% not recovered."""
    if mastery_after >= 0.8:
        return "RECOVERED"
    if mastery_after >= 0.6:
        return "PARTIALLY_RECOVERED"
    return "NOT_RECOVERED"