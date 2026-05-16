"""验证笔记系统 API"""
import requests, json, sys

BASE = 'http://localhost:8000/api/notes'
failed = []

def ok(label, resp, check_keys=None):
    if resp.status_code in (200, 201):
        data = resp.json() if resp.status_code in (200, 201) else resp.text
        if check_keys:
            missing = [k for k in check_keys if k not in (data if isinstance(data, dict) else {})]
            if missing:
                print(f'  FAIL {label}: missing keys {missing}')
                failed.append(label)
                return
        print(f'  OK {label}')
    else:
        print(f'  FAIL {label}: HTTP {resp.status_code} - {resp.text[:200]}')
        failed.append(label)

# 1. Create categories
print('\n=== Note Category CRUD ===')
r = requests.post(f'{BASE}/categories', json={'name': 'Investment Notes', 'sort_order': 1})
ok('create category', r, ['id', 'name'])

r = requests.post(f'{BASE}/categories', json={'name': 'Tech Learning', 'sort_order': 2})
ok('create category 2', r, ['id', 'name'])

# 2. List categories
r = requests.get(f'{BASE}/categories')
ok('list categories', r)
cats = r.json()
print(f'  total categories: {len(cats)}')

# 3. Update category
if cats:
    cid = cats[0]['id']
    r = requests.put(f'{BASE}/categories/{cid}', json={'description': 'Stock market related'})
    ok('update category', r, ['id', 'description'])
    assert r.json()['description'] == 'Stock market related', f"Expected 'Stock market related', got '{r.json()['description']}'"

# 4. Note CRUD
print('\n=== Note CRUD ===')
cat_id = cats[0]['id'] if cats else None

r = requests.post(f'{BASE}/', json={
    'title': 'Core Principles of Value Investing',
    'content': '# Value Investing\n\n## Margin of Safety\n\nMargin of safety is a core concept.',
    'category_id': cat_id,
    'tags': ['investing', 'value-investing']
})
ok('create note', r, ['id', 'title', 'word_count'])
note_id = r.json()['id']
wc = r.json()['word_count']
print(f'  word_count = {wc}')  # should be > 0
assert wc > 0, f'word_count should be > 0, got {wc}'

r = requests.post(f'{BASE}/', json={
    'title': 'Python Async Programming',
    'content': 'async/await was introduced in Python 3.5.',
    'tags': ['Python', 'programming']
})
ok('create note 2', r, ['id'])
note_id2 = r.json()['id']

# 5. List all notes
r = requests.get(f'{BASE}/')
ok('list all notes', r)
all_notes = r.json()
assert len(all_notes) >= 2, f'Expected >=2 notes, got {len(all_notes)}'
print(f'  total notes: {len(all_notes)}')

# 6. Filter by category
r = requests.get(f'{BASE}/', params={'category_id': cat_id})
ok('filter by category', r)
print(f'  notes in category: {len(r.json())}')
assert len(r.json()) >= 1

# 7. Get single note
r = requests.get(f'{BASE}/{note_id}')
ok('get single note', r, ['id', 'title', 'content'])

# 8. Update note
r = requests.put(f'{BASE}/{note_id}', json={'title': 'Core Principles of Value Investing (Revised)'})
ok('update note', r, ['id', 'title'])
assert 'Revised' in r.json()['title']

# 9. Search notes
r = requests.post(f'{BASE}/search', params={'query': 'Value Investing'})
ok('search notes', r)
print(f'  search results: {len(r.json())}')
assert len(r.json()) > 0

# 10. Download as Markdown
r = requests.get(f'{BASE}/{note_id}/download')
if r.status_code == 200:
    ct = r.headers.get('content-type', '')
    if 'text/markdown' in ct and '# Core Principles' in r.text:
        print('  OK download markdown')
    else:
        print(f'  FAIL download: content-type={ct}, body={r.text[:100]}')
        failed.append('download markdown')
else:
    print(f'  FAIL download markdown: HTTP {r.status_code}')
    failed.append('download markdown')

# 11. Delete a note
r = requests.delete(f'{BASE}/{note_id2}')
ok('delete note', r)

# 12. Verify deletion (should 404)
r = requests.get(f'{BASE}/{note_id2}')
if r.status_code == 404:
    print('  OK deletion verified (404)')
else:
    print(f'  FAIL deletion: expected 404, got {r.status_code}')
    failed.append('verify deletion')

# 13. Delete category
r = requests.delete(f'{BASE}/categories/{cat_id}')
ok('delete category', r)

# Summary
print(f'\n====== RESULTS ======')
if failed:
    print(f'FAILED: {len(failed)} items: {failed}')
    sys.exit(1)
else:
    print('ALL PASSED!')
