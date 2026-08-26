from pathlib import Path
content = Path('/mnt/data/enriquecedor.py').read_text(encoding='utf-8')
print(content)
