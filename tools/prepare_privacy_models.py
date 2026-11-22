"""Explicit online preparation; run before starting the offline privacy gateway."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hybrid_gateway import NYM, GLINER, BASE
from huggingface_hub import snapshot_download

if __name__ == '__main__':
    for name, revision in [NYM, GLINER, BASE]:
        snapshot_download(name, revision=revision, allow_patterns=['*.json', '*.safetensors', '*.bin', '*.model'], ignore_patterns=['*/**'])
        print('Prepared', name, revision)
