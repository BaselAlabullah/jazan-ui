from pathlib import Path
path = Path('App.jsx')
lines = path.read_text(encoding='utf-8').splitlines(keepends=True)
target = None
for idx, line in enumerate(lines):
    if line.strip() == '<span' and 'strainer.location.unit' in ''.join(lines[idx-5:idx]):
        target = idx
        break
if target is None:
    raise SystemExit('target span not found')
replacement = [
    '        <span\n',
    '          className={ounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-white }\n',
    '        >\n',
]
del lines[target:target+4]
for line in reversed(replacement):
    lines.insert(target, line)
path.write_text(''.join(lines), encoding='utf-8')
