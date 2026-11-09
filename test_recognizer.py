import sys

from PIL import Image, ImageDraw

from char_recognizer import CharRecognizer

rec = CharRecognizer('models', device='cpu')

if len(sys.argv) > 1:
    # Usage: python test_recognizer.py path\to\image.png
    img = Image.open(sys.argv[1])
else:
    # Same synthetic "A" as in the Colab test
    img = Image.new('RGB', (280, 280), 'white')
    d = ImageDraw.Draw(img)
    d.line([(60, 240), (140, 40), (220, 240)], fill='black', width=18, joint='curve')
    d.line([(95, 160), (185, 160)], fill='black', width=18, joint='curve')

top3, processed = rec.predict(img, top_k=3, return_processed=True)
print(top3)
Image.fromarray(processed).resize((224, 224), Image.NEAREST).save('processed_preview.png')
print("Saved processed_preview.png (what the model sees)")