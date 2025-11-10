from pathlib import Path
path = Path('App.jsx')
text = path.read_text(encoding='utf-8')
start = text.index('{`${strainer.location.unit}')
print(text[start:start+80].encode('unicode_escape'))
