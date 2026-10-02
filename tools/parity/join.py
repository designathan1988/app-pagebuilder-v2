# Joins each region's two crops (tools/parity/pair.ts) into one image, the canonical's above the app's, scaled 2x.
import glob, os, sys
from PIL import Image
folder = sys.argv[1]
for canon in glob.glob(os.path.join(folder, '*-canon.png')):
    if 'whole' in canon: continue
    app = canon.replace('-canon.png', '-app.png')
    if not os.path.exists(app): continue
    a, b = Image.open(canon), Image.open(app)
    w = max(a.width, b.width)
    im = Image.new('RGB', (w, a.height + b.height + 8), 'white')
    im.paste(a, (0, 0)); im.paste(b, (0, a.height + 8))
    if im.width < 700: im = im.resize((im.width * 2, im.height * 2))
    im.save(canon.replace('-canon.png', '-pair.png'))
