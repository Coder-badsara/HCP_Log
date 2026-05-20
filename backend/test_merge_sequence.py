import json
from app import ai_client

initial = "Met Dr. Shankar, discussed cardiac attack, shared echo reports, positive sentiment"
follow_up = "update outcomes seeing improving growth in health"

initial_payload = ai_client.extract_entities_from_text(initial)
# extract_entities_from_text is async; call sync via internal functions
# use local extractor for simplicity
initial_local = ai_client._extract_interaction_data(initial)
follow_local = ai_client._extract_interaction_data(follow_up)

print('INITIAL LOCAL:')
print(json.dumps(initial_local, indent=2))
print('\nFOLLOW-UP LOCAL:')
print(json.dumps(follow_local, indent=2))

# simulate frontend draft after initial
draft = {
    'hcp_name': initial_local['extracted_data']['hcp_name'],
    'interaction_type': initial_local['extracted_data']['interaction_type'] or 'meeting',
    'date': initial_local['extracted_data']['date'],
    'time': initial_local['extracted_data']['time'],
    'attendees': initial_local['extracted_data']['attendees'] or '',
    'topics_discussed': initial_local['extracted_data']['topics_discussed'] or '',
    'materials_shared': initial_local['extracted_data']['materials_shared'] or '',
    'samples_distributed': initial_local['extracted_data']['samples_distributed'] or '',
    'sentiment': initial_local['extracted_data']['sentiment'] or 'neutral',
    'outcomes': initial_local['extracted_data']['outcomes'] or '',
    'follow_up_actions': initial_local['extracted_data']['follow_up_actions'] or '',
}

print('\nDRAFT BEFORE FOLLOW-UP:')
print(json.dumps(draft, indent=2))

# frontend mergeDrafts logic in python

def merge_drafts(current, nextd, is_follow_up=False):
    merged = current.copy()
    for k, val in nextd.items():
        if k == 'attendees' and isinstance(val, str) and val.strip():
            incoming = [s.strip() for s in val.split(',') if s.strip()]
            existing = [s.strip() for s in (current.get('attendees') or '').split(',') if s.strip()]
            combined = list(dict.fromkeys(existing + incoming))
            merged['attendees'] = ', '.join(combined)
            continue
        if is_follow_up and k in ('topics_discussed', 'materials_shared', 'samples_distributed'):
            continue
        if val is not None:
            merged[k] = val
    return merged

nextDraft = {
    'outcomes': follow_local['extracted_data'].get('outcomes')
}
print('\nNEXT DRAFT FROM FOLLOW-UP:')
print(json.dumps(nextDraft, indent=2))

merged = merge_drafts(draft, nextDraft, is_follow_up=follow_local.get('is_follow_up_only', False))
print('\nMERGED DRAFT AFTER FOLLOW-UP:')
print(json.dumps(merged, indent=2))
