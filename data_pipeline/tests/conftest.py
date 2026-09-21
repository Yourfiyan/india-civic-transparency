import sys
from pathlib import Path

data_pipeline_dir = Path(__file__).resolve().parent.parent
if str(data_pipeline_dir) not in sys.path:
    sys.path.insert(0, str(data_pipeline_dir))
