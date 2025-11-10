from pathlib import Path
lines = Path('App.jsx').read_text(encoding='utf-8').splitlines()
for i in range(1847, 1855):
    print(i+1, repr(lines[i]))
