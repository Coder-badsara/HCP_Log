import json
from app import ai_client

# Inputs
initial = "Met Dr. Shankar, discussed cardiac attack, shared echo reports, positive sentiment"
attendee_update = "add Shiv to attendees"
outcome_update = "update outcomes seeing improving growth in health"

# Helper to run local extractor
def extract_local(text):
    return ai_client._extract_interaction_data(text)

# Frontend-like merge logic
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
    if is_follow_up:
        merged['topics_discussed'] = current['topics_discussed']
        merged['materials_shared'] = current['materials_shared']
        merged['samples_distributed'] = current['samples_distributed']
    return merged

# Initialize empty draft similar to frontend
draft = {
    'hcp_name': '',
    'interaction_type': 'meeting',
    'date': '',
    'time': '',
    'attendees': '',
    'topics_discussed': '',
    'materials_shared': '',
    'samples_distributed': '',
    'sentiment': 'neutral',
    'outcomes': '',
    'follow_up_actions': '',
}

print('=== INITIAL INPUT ===')
init_payload = extract_local(initial)
print(json.dumps(init_payload, indent=2))
nextDraft = init_payload['extracted_data']
# apply as non-followup
draft = merge_drafts(draft, nextDraft, is_follow_up=False)
print('\nDRAFT AFTER INITIAL:')
print(json.dumps(draft, indent=2))

print('\n=== ATTENDEE UPDATE ===')
att_payload = extract_local(attendee_update)
print(json.dumps(att_payload, indent=2))
nextDraft = att_payload['extracted_data']
is_follow = att_payload.get('is_follow_up_only', False)
draft = merge_drafts(draft, nextDraft, is_follow_up=is_follow)
print('\nDRAFT AFTER ATTENDEE UPDATE:')
print(json.dumps(draft, indent=2))

print('\n=== OUTCOME UPDATE ===')
out_payload = extract_local(outcome_update)
print(json.dumps(out_payload, indent=2))
nextDraft = out_payload['extracted_data']
is_follow = out_payload.get('is_follow_up_only', False)
draft = merge_drafts(draft, nextDraft, is_follow_up=is_follow)
print('\nDRAFT AFTER OUTCOME UPDATE:')
print(json.dumps(draft, indent=2))
