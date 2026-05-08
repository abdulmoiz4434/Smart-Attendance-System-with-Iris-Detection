"""
Offline training script for PyTorch CNN on CASIA-Iris-Thousand.
Run locally before deployment:  python -m app.ml.casia_train

Dataset layout expected:
  data/CASIA-Iris-Thousand/
    000/
      S1000S01.jpg
      S1000S02.jpg
      ...
    001/
      ...
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
import numpy as np

# ── Dataset ───────────────────────────────────────────────────────────────────

class IrisDataset(Dataset):
    def __init__(self, root_dir: str, transform=None):
        self.samples = []
        self.transform = transform
        self.class_to_idx = {}

        classes = sorted(os.listdir(root_dir))
        for idx, cls in enumerate(classes):
            self.class_to_idx[cls] = idx
            cls_dir = os.path.join(root_dir, cls)
            if not os.path.isdir(cls_dir):
                continue
            for fname in os.listdir(cls_dir):
                if fname.lower().endswith(('.jpg', '.jpeg', '.bmp', '.png')):
                    self.samples.append((os.path.join(cls_dir, fname), idx))

        self.num_classes = len(classes)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert('L')   # Grayscale
        if self.transform:
            img = self.transform(img)
        return img, label


# ── Model ─────────────────────────────────────────────────────────────────────

class IrisEmbeddingNet(nn.Module):
    """Lightweight CNN that maps a 64×64 iris crop to a 512-d embedding."""
    def __init__(self, num_classes: int):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),   # 32×32
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 16×16
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2), # 8×8
            nn.Conv2d(128, 256, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),# 4×4
        )
        self.embedding = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
        )
        self.classifier = nn.Linear(512, num_classes)

    def forward(self, x, return_embedding: bool = False):
        x = self.features(x)
        emb = self.embedding(x)
        if return_embedding:
            return emb
        return self.classifier(emb)


# ── Training loop ──────────────────────────────────────────────────────────────

def train():
    DATA_DIR   = "data/CASIA-Iris-Thousand"
    MODEL_PATH = "app/ml/iris_model.pt"
    EPOCHS     = 20
    BATCH_SIZE = 64
    LR         = 1e-3
    DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"

    transform = transforms.Compose([
        transforms.Resize((64, 64)),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5], std=[0.5]),
    ])

    dataset  = IrisDataset(DATA_DIR, transform=transform)
    loader   = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
    model    = IrisEmbeddingNet(num_classes=dataset.num_classes).to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=7, gamma=0.5)

    print(f"Training on {DEVICE} | {len(dataset)} samples | {dataset.num_classes} classes")

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss, correct, total = 0.0, 0, 0
        for imgs, labels in loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * imgs.size(0)
            correct    += (outputs.argmax(1) == labels).sum().item()
            total      += imgs.size(0)

        scheduler.step()
        acc = 100 * correct / total
        print(f"Epoch {epoch}/{EPOCHS}  loss={total_loss/total:.4f}  acc={acc:.1f}%")

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    train()