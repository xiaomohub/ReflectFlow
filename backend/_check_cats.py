import json
d = json.load(open('/tmp/cats_test.json', encoding='utf-8'))
print('Keys:', list(d.keys()))
print('by_domain:', d.get('by_domain'))
