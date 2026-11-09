import numpy as np
import torch
import torch.nn as nn
from pathlib import Path
from PIL import Image, ImageFilter


class CharCNN(nn.Module):
    """Small VGG-style CNN for 28x28 grayscale characters (same layers as in training)."""

    def __init__(self, num_classes):
        super().__init__()

        def block(c_in, c_out, drop):
            return nn.Sequential(
                nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True),
                nn.Conv2d(c_out, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True),
                nn.MaxPool2d(2), nn.Dropout(drop))

        self.features = nn.Sequential(
            block(1, 32, 0.25),
            block(32, 64, 0.25),
            block(64, 128, 0.30),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 3 * 3, 256), nn.BatchNorm1d(256), nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes))

    def forward(self, x):
        return self.classifier(self.features(x))


def _to_ink(image):
    """Return a 2D float32 array where strokes are bright and the background is dark."""
    if isinstance(image, np.ndarray):
        image = Image.fromarray(image.astype(np.uint8))
    if not isinstance(image, Image.Image):
        raise TypeError('image must be a PIL image or a numpy array')

    if image.mode in ('RGBA', 'LA'):
        alpha = np.asarray(image.getchannel('A'), dtype=np.float32)
        if alpha.min() < 250:
            # Transparent canvas: the drawn (opaque) pixels are the ink
            return alpha
        image = image.convert('RGB')

    gray = np.asarray(image.convert('L'), dtype=np.float32)
    border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
    if np.median(border) > 127:  # dark ink on a light background -> invert
        gray = 255.0 - gray
    return gray


def preprocess_drawing(image, mean, std):
    """Turn any drawing into a normalized (1, 1, 28, 28) tensor, MNIST style.

    Steps: ink extraction, crop to the strokes, resize (longest side = 20 px),
    center of mass centering in a 28x28 canvas, normalization.
    Returns (tensor, processed 28x28 uint8 image).
    """
    ink = _to_ink(image)
    ink = ink - ink.min()
    if ink.max() < 1:
        raise ValueError('No character drawn')
    ink = ink / ink.max() * 255.0

    ys, xs = np.where(ink > 40)
    if len(ys) == 0:
        raise ValueError('No character drawn')
    crop = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    h, w = crop.shape
    scale = 22.0 / max(h, w)
    new_w, new_h = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    pil = Image.fromarray(crop.astype(np.uint8)).resize((new_w, new_h), Image.LANCZOS)
    small = np.asarray(pil, dtype=np.float32)

    total = small.sum()
    if total <= 0:
        raise ValueError('No character drawn')
    yy, xx = np.indices(small.shape)
    cy, cx = (small * yy).sum() / total, (small * xx).sum() / total

    top = min(max(int(round(14 - cy)), 0), 28 - new_h)
    left = min(max(int(round(14 - cx)), 0), 28 - new_w)
    canvas = np.zeros((28, 28), dtype=np.float32)
    canvas[top:top + new_h, left:left + new_w] = small

    x = torch.from_numpy(canvas / 255.0)
    x = ((x - mean) / std).unsqueeze(0).unsqueeze(0).float()
    return x, np.clip(canvas, 0, 255).astype(np.uint8)


class CharRecognizer:
    """Loads the trained CNN and recognizes a handwritten character from an image."""

    def __init__(self, models_dir='models', device='cpu', checkpoint='cnn_emnist.pt'):
        self.device = torch.device(device)
        ckpt = torch.load(Path(models_dir) / checkpoint, map_location=self.device)
        self.classes = ckpt['classes']
        self.mean = float(ckpt['mean'])
        self.std = float(ckpt['std'])
        self.model = CharCNN(int(ckpt['num_classes']))
        self.model.load_state_dict(ckpt['state_dict'])
        self.model.to(self.device).eval()

    @torch.no_grad()
    def predict(self, image, top_k=3, return_processed=False):
        """Returns [{'char': 'A', 'probability': 0.93}, ...] (and the processed 28x28 image)."""
        x, processed = preprocess_drawing(image, self.mean, self.std)
        probs = torch.softmax(self.model(x.to(self.device)), dim=1)[0]
        values, indices = probs.topk(min(top_k, len(self.classes)))
        result = [{'char': self.classes[int(i)], 'probability': float(v)}
                  for v, i in zip(values, indices)]
        return (result, processed) if return_processed else result
