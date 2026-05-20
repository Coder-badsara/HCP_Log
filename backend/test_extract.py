import json
from app import ai_client

text = "update outcomes seeing improving growth in health"
res = ai_client._extract_interaction_data(text)
print(json.dumps(res, indent=2))
print('\n--- top-level fields from build_local_payload ---')
print(json.dumps(ai_client.build_local_payload(text), indent=2))
