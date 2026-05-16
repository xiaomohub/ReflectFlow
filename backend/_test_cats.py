"""Check categories endpoint response"""
import json
d = json.load(open('/tmp/cats_check.json', encoding='utf-8'))
print('Keys:', list(d.keys()))
print('Has by_domain:', 'by_domain' in d)
if 'by_domain' in d:
    print('by_domain:', d['by_domain'])
else:
    print('MISSING! by_domain not in response')
    # Check if the response has the right structure
    expected = {'by_source', 'by_action', 'by_status', 'by_domain', 'total', 'unread'}
    actual = set(d.keys())
    print('Missing fields:', expected - actual)
    print('Extra fields:', actual - expected)
