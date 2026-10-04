"""Create 192 and 512 app icons from Logo.png (run if Pillow is installed)."""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow first: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "netlify-deploy" / "Logo.png"
OUT_DIR = ROOT / "netlify-deploy"

def make(size, name):
    im = Image.open(SRC).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    x = (size - im.width) // 2
    y = (size - im.height) // 2
    canvas.paste(im, (x, y), im)
    dest = OUT_DIR / name
    canvas.save(dest, "PNG", optimize=True)
    print("Wrote", dest)

if __name__ == "__main__":
    if not SRC.exists():
        raise SystemExit("Missing " + str(SRC))
    make(192, "icon-192.png")
    make(512, "icon-512.png")
    make(180, "apple-touch-icon.png")
