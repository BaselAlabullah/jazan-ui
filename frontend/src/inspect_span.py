from pathlib import Path
path = Path('App.jsx')
text = path.read_text(encoding='utf-8')
start = text.index('<span\n          className')
print(text[start:start+160])
