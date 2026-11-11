#!/usr/bin/env python3
"""Generate assets/js/data.js from publications/publications.xlsx and patents/patent.xlsx.

Usage (from the repository root):
    python3 tools/xlsx2data.py

Only the Python standard library is used, so no extra packages are needed.
Expected columns (row 1 is the header):
  publications.xlsx  A project year | B SCI(E) (SCI or SCIE; shown as a label on journal articles) | C type | D title | E faculty | F students | G conference | H journal
                     | I IF | J JCR top 10% ('O' marks it; shown as a label) | K publication year (used on the site; falls back to A when empty)
  patent.xlsx        A country | B title | C filing year | D inventors | E registered (O/X) | F registration year
                     | G triadic filing (O/X) | H triadic registration (O/X)
Column C of publications.xlsx holds the Korean type labels used by the project report
(e.g. 국외학술대회 = international conference); they are mapped in PUB_TYPES below.
"""
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
PUB_XLSX = ROOT / 'publications' / 'publications.xlsx'
PATENT_XLSX = ROOT / 'patents' / 'patent.xlsx'
OUT = ROOT / 'assets' / 'js' / 'data.js'

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
PUB_TYPES = {'국외학술대회': 'conference', '국내학술대회': 'conference', '국외학술지': 'journal', '국내학술지': 'journal'}


def read_rows(path):
    """Return the first sheet as a list of {column_letter: text} dicts, header row excluded."""
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings = [''.join(t.text or '' for t in si.iter(NS + 't')) for si in sst.findall(NS + 'si')]
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))

    rows = []
    for row in sheet.iter(NS + 'row'):
        if row.get('r') == '1':
            continue
        cells = {}
        for c in row.findall(NS + 'c'):
            col = re.match(r'[A-Z]+', c.get('r')).group()
            v = c.find(NS + 'v')
            if c.get('t') == 's' and v is not None:
                value = strings[int(v.text)]
            elif c.get('t') == 'inlineStr':
                value = ''.join(t.text or '' for t in c.iter(NS + 't'))
            else:
                value = v.text if v is not None else ''
            cells[col] = clean(value)
        if any(cells.values()):
            rows.append(cells)
    return rows


def clean(text):
    return re.sub(r'\s+', ' ', text or '').strip()


def clean_title(text):
    text = re.sub(r',?\s*In Proceedings\s*$', '', clean(text), flags=re.I)
    return text.rstrip(' ,.')


def names(text):
    return [n.strip() for n in re.split(r'[,，]', text or '') if n.strip()]


def year(text):
    m = re.search(r'\d{4}', text or '')
    return int(m.group()) if m else None


def flag(text):
    """True for an 'O' (yes) cell."""
    return (text or '').strip().upper() in ('O', '○', 'Y', 'YES')


def index_label(text):
    """Normalise the SCI(E) column to 'SCIE', 'SCI' or ''."""
    t = re.sub(r'[^A-Z]', '', (text or '').upper())
    return 'SCIE' if t == 'SCIE' else ('SCI' if t == 'SCI' else '')


def build_publications():
    pubs = []
    for r in read_rows(PUB_XLSX):
        pubs.append({
            'year': year(r.get('K')) or year(r.get('A')),
            'type': PUB_TYPES.get(r.get('C', ''), 'conference'),
            'sci': index_label(r.get('B')),
            'title': clean_title(r.get('D')),
            'venue': r.get('G') or r.get('H') or '',
            'jcrTop10': flag(r.get('J')),
            'faculty': names(r.get('E')),
            'students': names(r.get('F')),
        })
    # Newest first; rows of the same year keep the spreadsheet order.
    return sorted(pubs, key=lambda p: -(p['year'] or 0))


def build_patents(professors):
    """professors: names listed as faculty in publications.xlsx. patent.xlsx has a single
    inventor column, so inventors in that set are shown as professors and the rest as students."""
    patents = []
    for r in read_rows(PATENT_XLSX):
        inventors = names(r.get('D'))
        registered = flag(r.get('E'))
        patents.append({
            'country': r.get('A', ''),
            'title': clean_title(r.get('B')),
            'professors': [n for n in inventors if n in professors],
            'students': [n for n in inventors if n not in professors],
            'status': 'registered' if registered else 'filed',
            'filed': year(r.get('C')),
            'registered': year(r.get('F')) if registered else None,
            'triadicFiled': flag(r.get('G')),
            'triadicRegistered': flag(r.get('H')),
        })
    # Registered patents first (newest registration first), then applications (newest filing first).
    return sorted(patents, key=lambda p: (p['status'] != 'registered', -(p['registered'] or 0), -(p['filed'] or 0)))


def js_list(items):
    return '[\n' + ',\n'.join('    ' + json.dumps(i, ensure_ascii=False) for i in items) + '\n  ]'


def main():
    pubs = build_publications()
    patents = build_patents({n for p in pubs for n in p['faculty']})
    OUT.write_text(
        '/*\n'
        ' * AUTO-GENERATED by tools/xlsx2data.py — do not edit by hand.\n'
        ' * Edit publications/publications.xlsx or patents/patent.xlsx, then run:\n'
        ' *     python3 tools/xlsx2data.py\n'
        ' */\n'
        'window.HCDRC_DATA = {\n'
        f'  publications: {js_list(pubs)},\n'
        f'  patents: {js_list(patents)}\n'
        '};\n',
        encoding='utf-8')
    print(f'Wrote {OUT.relative_to(ROOT)}: {len(pubs)} publications, {len(patents)} patents')


if __name__ == '__main__':
    main()
