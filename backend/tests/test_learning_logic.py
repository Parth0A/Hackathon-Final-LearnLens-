from services.debugger import diagnose_root_gap
from services.intervention import select_intervention_type
from services.mastery import calculate_mastery
from services.recovery import recovery_status


def test_concept_mastery_is_calculated_per_concept() -> None:
    result = calculate_mastery([
        {"concept_id": "lifo", "correct": True},
        {"concept_id": "lifo", "correct": False},
        {"concept_id": "stack", "correct": False},
    ])
    assert result["lifo"]["mastery"] == 0.5
    assert result["lifo"]["incorrect_attempts"] == 1


def test_debugger_finds_lifo_from_repeated_fifo_lifo_confusion() -> None:
    attempts = [
        {"concept_id": "stack", "correct": False, "misconception_tag": "FIFO_LIFO_CONFUSION"},
        {"concept_id": "lifo", "correct": False, "misconception_tag": "FIFO_LIFO_CONFUSION"},
        {"concept_id": "stack", "correct": False, "misconception_tag": "FIFO_LIFO_CONFUSION"},
    ]
    result = diagnose_root_gap(attempts, {"lifo": {"mastery": 0.33}, "stack": {"mastery": 0.0}})
    assert result is not None
    assert result["root_gap"] == "lifo"
    assert result["confidence"] == 0.87


def test_intervention_adapts_after_failed_attempt() -> None:
    assert select_intervention_type([]) == "simple_explanation"
    assert select_intervention_type([{ "type": "simple_explanation", "result": "NOT_RECOVERED" }]) == "visual_explanation"


def test_recovery_thresholds_are_prototype_thresholds() -> None:
    assert recovery_status(0.8) == "RECOVERED"
    assert recovery_status(0.6) == "PARTIALLY_RECOVERED"
    assert recovery_status(0.59) == "NOT_RECOVERED"