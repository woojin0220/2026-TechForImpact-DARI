from pathlib import Path
import sys


DEMO_DIR = Path(__file__).resolve().parent
EXPERIMENT_DIR = DEMO_DIR.parents[1]
sys.path.insert(0, str(EXPERIMENT_DIR / "src"))

from dari_verification.graph_demo import main  # noqa: E402


if __name__ == "__main__":
    main(DEMO_DIR / "demo_cases.json")
