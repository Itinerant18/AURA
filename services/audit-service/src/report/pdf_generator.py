from io import BytesIO
from typing import Optional


def generate_audit_pdf(tenant_id: str, scores: dict, insights: dict) -> Optional[bytes]:
    """Generate a PDF audit report. Returns PDF bytes."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        elements.append(Paragraph("AURA Social Media Audit Report", styles["Title"]))
        elements.append(Spacer(1, 20))

        # Scores table
        score_data = [["Dimension", "Score", "Status"]]
        for key, value in scores.items():
            if key == "overall":
                continue
            status = "GREEN" if value >= 70 else "AMBER" if value >= 40 else "RED"
            score_data.append([key.replace("_", " ").title(), str(value), status])

        score_data.append(["Overall", str(scores.get("overall", 0)), ""])

        table = Table(score_data, colWidths=[200, 80, 80])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 20))

        # Action items
        elements.append(Paragraph("Action Items", styles["Heading2"]))
        for item in insights.get("actionItems", []):
            elements.append(Paragraph(
                f"[{item['priority'].upper()}] {item['description']} — {item['impact']}",
                styles["Normal"],
            ))
            elements.append(Spacer(1, 5))

        doc.build(elements)
        return buffer.getvalue()
    except ImportError:
        return None
