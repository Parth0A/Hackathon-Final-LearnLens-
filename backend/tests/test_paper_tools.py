from io import BytesIO
from pypdf import PdfWriter

"""Regression coverage for optional teacher paper generation and X-Ray analysis."""

def test_teacher_can_generate_and_xray_a_paper(teacher_client):
    created = teacher_client.post("/classrooms", json={
        "name": "Paper Tools Test",
        "subject": "Data Structures",
        "class_division": "A",
        "academic_year": "2026",
    })
    assert created.status_code == 200, created.text
    classroom_id = created.json()["id"]

    generated = teacher_client.post(
        f"/classrooms/{classroom_id}/papers/generate",
        json={
            "title": "DS Diagnostic Paper",
            "topic_ids": [],
            "question_count": 5,
            "difficulty": "any",
            "published": False,
        },
    )
    assert generated.status_code == 200, generated.text
    body = generated.json()
    assert len(body["questions"]) == 5
    assert len(body["question_ids"]) == 5
    assert body["xray"]["question_count"] == 5
    assert body["xray"]["concepts"]
    assert "difficulty_distribution" in body["xray"]
    assert body["xray"]["questions"]

    xray = teacher_client.post(
        f"/classrooms/{classroom_id}/papers/xray",
        json=body["question_ids"],
    )
    assert xray.status_code == 200, xray.text
    assert xray.json()["question_count"] == 5
    assert xray.json()["questions"][0]["concept"]

def test_paper_generation_requires_teacher_owned_classroom(client):
    response = client.post(
        "/classrooms/not-owned/papers/generate",
        json={"title": "Blocked", "question_count": 2, "difficulty": "any", "published": False},
    )
    assert response.status_code in (403, 404)


def test_teacher_can_upload_pdf_for_xray(teacher_client):
    created = teacher_client.post("/classrooms", json={
        "name": "PDF X-Ray Test",
        "subject": "Data Structures",
        "class_division": "A",
        "academic_year": "2026",
    })
    assert created.status_code == 200, created.text
    classroom_id = created.json()["id"]

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    pdf = BytesIO()
    writer.write(pdf)

    response = teacher_client.post(
        f"/classrooms/{classroom_id}/papers/xray/upload",
        files={"file": ("question-paper.pdf", pdf.getvalue(), "application/pdf")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["page_count"] == 1
    assert body["question_count"] >= 1
    assert "quality_checks" in body


def test_pdf_xray_rejects_non_pdf(teacher_client):
    created = teacher_client.post("/classrooms", json={
        "name": "PDF Type Test",
        "subject": "Data Structures",
        "class_division": "A",
        "academic_year": "2026",
    })
    assert created.status_code == 200, created.text
    classroom_id = created.json()["id"]
    response = teacher_client.post(
        f"/classrooms/{classroom_id}/papers/xray/upload",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )
    assert response.status_code == 415
