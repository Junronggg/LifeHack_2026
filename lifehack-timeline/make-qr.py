#!/usr/bin/env python3
"""Regenerate the LifeHack timeline QR codes.

    pip install qrcode pillow
    python3 make-qr.py https://your-final-url

Outputs into ./qr/ :
  qr-white-on-navy.png   drop onto the dark posters
  qr-navy-on-white.png   safest for print / light backgrounds
  qr-gold-on-navy.png    brand accent version
  qr.svg                 vector, for Canva / large-format print
"""
import sys, os, qrcode
from qrcode.image.svg import SvgPathImage

URL = sys.argv[1] if len(sys.argv) > 1 else "https://lifehack2026.nuscomputing.com/timeline"
NAVY, GOLD, WHITE = "#121735", "#E0A93F", "#FFFFFF"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qr")
os.makedirs(OUT, exist_ok=True)

def qr():
    # ERROR_CORRECT_H: survives print, partial occlusion and a centre logo
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=24, border=4)
    q.add_data(URL); q.make(fit=True)
    return q

for name, fg, bg in [("qr-white-on-navy", WHITE, NAVY),
                     ("qr-navy-on-white", NAVY, WHITE),
                     ("qr-gold-on-navy",  GOLD,  NAVY)]:
    qr().make_image(fill_color=fg, back_color=bg).save(f"{OUT}/{name}.png")

qr().make_image(image_factory=SvgPathImage).save(f"{OUT}/qr.svg")
print(f"{URL} -> {OUT}")
