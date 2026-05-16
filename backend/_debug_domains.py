import json, os

os.chdir(os.path.dirname(__file__))
d = json.load(open('_debug_cats.json', encoding='utf-8'))
print('Keys:', list(d.keys()))
print('by_domain:', d.get('by_domain'))

arts = json.load(open('_debug_articles.json', encoding='utf-8'))
for a in arts['items'][:5]:
    print('---')
    print('title:', a['title'][:40])
    print('reason:', a.get('relevance_reason','')[:100])
    aa = a.get('ai_analysis', {})
    if aa:
        print('tags:', aa.get('tags', [])[:3])
        print('matched_domains:', aa.get('matched_domains', []))
