from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
import io
import json
from datetime import datetime

DOC_TYPE_TITLES = {
    "DIPLOMA": "DIPLÔME",
    "EMPLOYMENT": "ATTESTATION D'EMPLOI",
    "LAND_TITLE": "TITRE FONCIER",
    "ID_CARD": "CARTE D'IDENTITÉ",
    "BIRTH_CERTIFICATE": "ACTE DE NAISSANCE",
    "RESIDENCE_CERTIFICATE": "ATTESTATION DE RÉSIDENCE",
}


def _format_thousands(value) -> str:
    """Formate un nombre avec des espaces comme séparateurs de milliers (convention
    française), ex: 20000000 -> "20 000 000". Les valeurs non numériques (dates,
    texte libre, ...) sont renvoyées telles quelles."""
    try:
        num = float(value)
    except (TypeError, ValueError):
        return str(value)
    if num == int(num):
        return f"{int(num):,}".replace(",", " ")
    return f"{num:,.2f}".replace(",", " ")


def generate_document_pdf(
    doc_type: str,
    doc_key: str,
    owner_name: str,
    owner_did: str,
    attributes: list,
    issuer_name: str = "TrustWedge",
    token_id: int = 0,
) -> bytes:
    """Génère le PDF réel d'un document émis (diplôme, attestation d'emploi, carte
    d'identité, ...), à partir de ses attributs. Le titre foncier a son propre générateur
    dédié (generate_land_title_pdf ci-dessous), utilisé lors des transferts entre
    particuliers."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    title = DOC_TYPE_TITLES.get(doc_type, doc_type)

    c.setFont("Helvetica-Bold", 20)
    c.drawString(30 * mm, 270 * mm, title)

    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, 260 * mm, "TRUSTWEDGE")
    if doc_key:
        c.drawString(30 * mm, 253 * mm, f"Référence : {doc_key}")

    # QR code de vérification, même format que celui du titre foncier (JSON attendu par le
    # scanner du wallet mobile, packages/sdk/src/qr.ts) — permet de retrouver le token_id
    # sans le ressaisir, que ce soit en scannant le QR ou en déposant directement ce PDF sur
    # l'outil de vérification (qui retrouve le document à partir de l'empreinte du fichier).
    qr_data = json.dumps({
        "app": "trustwedge-wallet",
        "v": 1,
        "tokenId": token_id,
        "docType": doc_type,
        "docKey": doc_key,
        "ownerDid": owner_did,
    })
    qr_widget = QrCodeWidget(qr_data)
    qr_size = 24 * mm
    bounds = qr_widget.getBounds()
    scale = qr_size / (bounds[2] - bounds[0])
    drawing = Drawing(qr_size, qr_size, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(qr_widget)
    qr_x = 210 * mm - 30 * mm - qr_size
    renderPDF.draw(drawing, c, qr_x, 252 * mm)

    c.line(30 * mm, 248 * mm, 180 * mm, 248 * mm)

    c.setFont("Helvetica-Bold", 12)
    c.drawString(30 * mm, 235 * mm, "TITULAIRE")
    c.setFont("Helvetica", 12)
    c.drawString(30 * mm, 220 * mm, f"Nom : {owner_name}")
    c.drawString(30 * mm, 205 * mm, f"DID : {owner_did}")

    y = 185
    if attributes:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(30 * mm, y * mm, "DÉTAILS")
        y -= 15
        c.setFont("Helvetica", 12)
        for attr in attributes:
            value = _format_thousands(attr.get('value', '')) if attr.get('valueType') == 'uint256' else attr.get('value', '')
            c.drawString(30 * mm, y * mm, f"{attr.get('key', '')} : {value}")
            y -= 15

    c.setFont("Helvetica-Bold", 12)
    c.drawString(30 * mm, y * mm, "ÉMISSION")
    y -= 15
    c.setFont("Helvetica", 12)
    c.drawString(30 * mm, y * mm, f"Émis par : {issuer_name}")
    y -= 15
    c.drawString(30 * mm, y * mm, f"Date : {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    c.setFont("Helvetica-Oblique", 8)
    c.drawString(30 * mm, 20 * mm, "Ce document est vérifiable sur la blockchain")
    c.drawString(30 * mm, 10 * mm, "© TrustWedge - Tous droits réservés")

    c.save()
    buffer.seek(0)
    return buffer.getvalue()


_NAVY = HexColor("#1a2b4a")
_GREY = HexColor("#6b7280")
_GREEN = HexColor("#1a7a3c")
_BEIGE = HexColor("#f5efe0")
_BEIGE_BORDER = HexColor("#d9c9a3")
_RULE = HexColor("#e5e7eb")


def generate_land_title_pdf(
    owner_name: str,
    owner_did: str,
    token_id: int,
    location: str,
    area: str,
    value: str,
    doc_key: str = "",
    ipfs_cid: str = "",
    issuer: str = "État du Sénégal"
) -> bytes:
    """Génère le certificat officiel de titre foncier — mise en page inspirée du certificat
    délivré par le registre foncier (emblème, statut, fiche d'identification, QR code de
    vérification, avertissement de valeur probante, identifiant technique en pied de page)."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 25 * mm
    top = height - 20 * mm

    # --- En-tête : emblème + administration ---
    c.setStrokeColor(_NAVY)
    c.setLineWidth(1.2)
    c.circle(margin + 6 * mm, top - 6 * mm, 6 * mm, stroke=1, fill=0)
    c.circle(margin + 6 * mm, top - 6 * mm, 1.3 * mm, stroke=1, fill=1)

    c.setFillColor(_NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin + 16 * mm, top - 3.5 * mm, "RÉPUBLIQUE DU SÉNÉGAL")
    c.setFont("Helvetica", 9)
    c.setFillColor(_GREY)
    c.drawString(margin + 16 * mm, top - 9 * mm, "Direction générale des Impôts et Domaines — Registre foncier numérique")

    c.setStrokeColor(_RULE)
    c.setLineWidth(0.7)
    c.line(margin, top - 16 * mm, width - margin, top - 16 * mm)

    # --- Titre centré ---
    y = top - 30 * mm
    c.setFillColor(_NAVY)
    c.setFont("Times-Bold", 22)
    c.drawCentredString(width / 2, y, "Certificat de titre foncier")

    y -= 9 * mm
    c.setFont("Times-Roman", 13)
    c.setFillColor(_GREY)
    c.drawCentredString(width / 2, y, doc_key or f"TOKEN-{token_id}")

    y -= 7 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(_GREEN)
    c.drawCentredString(width / 2, y, "Statut : Validé")

    # --- Corps : fiche d'identification (gauche) + QR code (droite) ---
    y -= 16 * mm
    col_left_x = margin
    col_right_x = width - margin - 32 * mm

    fields = [
        ("TYPE DE BIEN", "Titre foncier"),
        ("PROPRIÉTAIRE", owner_name),
        ("LOCALISATION", location),
        ("SUPERFICIE", f"{_format_thousands(area)} m²"),
        ("VALEUR ESTIMÉE", f"{_format_thousands(value)} FCFA"),
        ("DATE DE VALIDATION", datetime.now().strftime("%d.%m.%Y")),
    ]
    fy = y
    for label, val in fields:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(_GREY)
        c.drawString(col_left_x, fy, label)
        fy -= 4.5 * mm
        c.setFont("Helvetica", 11)
        c.setFillColor(_NAVY)
        c.drawString(col_left_x, fy, str(val))
        fy -= 8 * mm

    # Format JSON attendu par le scanner du wallet mobile (packages/sdk/src/qr.ts,
    # WalletQrPayload) — un format texte "maison" ne serait pas reconnu (JSON.parse échoue,
    # QR rejeté comme "illisible"). Le contenu du QR ne fait de toute façon foi de rien : seul
    # tokenId est réellement utilisé, la vérification relit toujours l'état on-chain.
    qr_data = json.dumps({
        "app": "trustwedge-wallet",
        "v": 1,
        "tokenId": token_id,
        "docType": "LAND_TITLE",
        "docKey": doc_key,
        "ownerDid": owner_did,
    })
    qr_widget = QrCodeWidget(qr_data)
    qr_size = 32 * mm
    bounds = qr_widget.getBounds()
    scale = qr_size / (bounds[2] - bounds[0])
    drawing = Drawing(qr_size, qr_size, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(qr_widget)
    renderPDF.draw(drawing, c, col_right_x, y - qr_size + 8 * mm)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(_GREY)
    c.drawCentredString(col_right_x + qr_size / 2, y - qr_size + 3 * mm, "Scannez pour vérifier")
    c.drawCentredString(col_right_x + qr_size / 2, y - qr_size, "ce titre en ligne")

    # --- Avertissement de valeur probante ---
    warn_h = 20 * mm
    warn_y = fy - 4 * mm
    c.setFillColor(_BEIGE)
    c.setStrokeColor(_BEIGE_BORDER)
    c.roundRect(margin, warn_y - warn_h, width - 2 * margin, warn_h, 2 * mm, stroke=1, fill=1)
    c.setFillColor(_NAVY)
    c.setFont("Helvetica", 8.5)
    text = c.beginText(margin + 5 * mm, warn_y - 7 * mm)
    text.setLeading(11)
    text.textLines([
        "Ce certificat est une reproduction des informations inscrites au registre foncier",
        "national à la date de sa génération. Seule l'attestation vérifiable délivrée par",
        "l'administration fait foi devant un tiers.",
    ])
    c.drawText(text)

    # --- Pied de page ---
    c.setStrokeColor(_RULE)
    c.line(margin, 15 * mm, width - margin, 15 * mm)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(_GREY)
    short_cid = f"{ipfs_cid[:10]}…{ipfs_cid[-4:]}" if ipfs_cid else "—"
    c.drawCentredString(
        width / 2, 10 * mm,
        f"Certificat généré le {datetime.now().strftime('%d.%m.%Y')} · Identifiant IPFS : {short_cid}"
    )

    c.save()
    buffer.seek(0)
    return buffer.getvalue()
