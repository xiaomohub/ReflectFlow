"""Debug by_domain categories issue"""
import sys
sys.path.insert(0, 'D:\\DeepSeek-Work\\backend')

from schemas import ArticleCategoriesResponse, CategoryCount

r = ArticleCategoriesResponse(
    by_source=[CategoryCount(name="test", count=1)],
    by_action=[CategoryCount(name="test", count=1)],
    by_status=[CategoryCount(name="test", count=1)],
    by_domain=[CategoryCount(name="AI", count=5)],
    total=10,
    unread=5,
)
d = r.model_dump()
print('Has by_domain:', 'by_domain' in d)
print('by_domain:', d.get('by_domain'))
print('Full keys:', sorted(d.keys()))
