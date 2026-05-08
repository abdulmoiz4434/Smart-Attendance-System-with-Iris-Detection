"""
Optional CNN wrapper. When iris_model.pt exists, the service will use CNN
embeddings instead of Gabor. Both are drop-in replacements.
"""
import torch
import torch.nn as nn
import numpy as np
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "iris_model.pt")
NUM_CLASSES = 1000   # CASIA-Iris-Thousand


class IrisEmbeddingNet(nn.Module):
    def __init__(self, num_classes: int = NUM_CLASSES):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.embedding = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
        )
        self.classifier = nn.Linear(512, num_classes)

    def forward(self, x, return_embedding=False):
        x = self.features(x)
        emb = self.embedding(x)
        if return_embedding:
            return emb
        return self.classifier(emb)


_model = None

def load_model():
    global _model
    if not os.path.exists(MODEL_PATH):
        return None
    if _model is None:
        m = IrisEmbeddingNet()
        m.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        m.eval()
        _model = m
    return _model


def extract_cnn_embedding(gray_roi: np.ndarray) -> np.ndarray | None:
    """Extract 512-d CNN embedding from a grayscale ROI numpy array."""
    model = load_model()
    if model is None:
        return None  # Fall back to Gabor in caller

    import cv2
    from torchvision import transforms

    resized = cv2.resize(gray_roi, (64, 64)).astype(np.float32) / 255.0
    tensor = torch.tensor(resized).unsqueeze(0).unsqueeze(0)  # (1, 1, 64, 64)
    transform = transforms.Normalize(mean=[0.5], std=[0.5])
    tensor = transform(tensor)

    with torch.no_grad():
        embedding = model(tensor, return_embedding=True)
    vec = embedding.squeeze().numpy()
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec