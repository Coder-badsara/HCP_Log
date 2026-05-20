import os
import json
import re
from datetime import date, datetime
from typing import AsyncGenerator

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openai/gpt-oss-120b:free')
OPENROUTER_BASE_URL = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
OPENROUTER_SITE_URL = os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173')
OPENROUTER_APP_NAME = os.getenv('OPENROUTER_APP_NAME', 'AI-First CRM')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')


def build_client() -> AsyncOpenAI | None:
    if OPENROUTER_API_KEY:
        return AsyncOpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                'HTTP-Referer': OPENROUTER_SITE_URL,
                'X-Title': OPENROUTER_APP_NAME,
            },
        )

    if OPENAI_API_KEY:
        return AsyncOpenAI(api_key=OPENAI_API_KEY)

    return None


client = build_client()


def _format_today() -> str:
    return date.today().isoformat()


def _format_now() -> str:
    return datetime.now().strftime('%H:%M')


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r'\s+', ' ', name).strip().strip('.,;:')
    if not cleaned:
        return cleaned

    return ' '.join(part[:1].upper() + part[1:].lower() if part else part for part in cleaned.split(' '))


def _extract_after_keyword(text: str, keywords: list[str], stop_tokens: list[str]) -> str:
    for keyword in keywords:
        match = re.search(rf'\b{re.escape(keyword)}\b\s+(.+)', text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        tail = match.group(1).strip()
        stop_index = len(tail)
        stop_patterns = [
            r'\.(?=\s*(?:the\s+)?sentiment\b)',
            r'\.(?=\s*and\s+i\s+shared\b)',
            r'\.(?=\s*and\s+shared\b)',
            r'\.(?=\s*shared\b)',
            r'\b(?:' + '|'.join(re.escape(token) for token in stop_tokens) + r')\b',
        ]

        for pattern in stop_patterns:
            token_match = re.search(pattern, tail, re.IGNORECASE)
            if token_match:
                stop_index = min(stop_index, token_match.start())

        extracted = tail[:stop_index].strip(' ,.;')
        if extracted:
            return extracted

    return ''


def _extract_name(text: str) -> str:
    name_patterns = [
        (r'\bdr\.?\s*([a-z][a-z\-\']*)', True),
        (r'\bdoctor\s+([a-z][a-z\-\']*)', True),
        (r'\bmet\s+([a-z][a-z\-\']*)', True),
    ]

    for pattern, use_title_prefix in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            normalized = _normalize_name(match.group(1))
            return f'Dr.{normalized}' if use_title_prefix else normalized

    return ''


def _extract_sentiment(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ['positive', 'good', 'great', 'favorable', 'favourable', 'productive']):
        return 'positive'
    if any(token in lowered for token in ['negative', 'bad', 'poor', 'concern', 'unhappy', 'challenging']):
        return 'negative'
    return 'neutral'


def _extract_interaction_type(text: str) -> str | None:
    lowered = text.lower()
    # Prefer explicit labels first
    detail_visit_patterns = [r"\bdetail(?:ed)?\s*visit\b", r"\bdetail\s+visit\b"]
    follow_up_patterns = [r"\bfollow[-\s]?up\b", r"\bfollow up\b"]
    call_patterns = [r'\bvideo\s+call\b', r'\bphone\s+call\b', r'\bcall\b', r'\bcalled\b', r'\btele-call\b']
    meeting_patterns = [r'\bmeeting\b', r'\bmet\b', r'\bdiscussed\b', r'\bf2f\b', r'\bin-person\b']

    if any(re.search(pattern, lowered) for pattern in detail_visit_patterns):
        return 'detail visit'
    if any(re.search(pattern, lowered) for pattern in follow_up_patterns):
        return 'follow up'
    if any(re.search(pattern, lowered) for pattern in call_patterns):
        return 'call'
    if any(re.search(pattern, lowered) for pattern in meeting_patterns):
        return 'meeting'
    return None


def _extract_follow_up(text: str) -> str:
    lowered = text.lower().strip()

    follow_up_patterns = [
        r'\b(?:add|schedule|set|create|plan)?\s*follow[-\s]?up\s+(?:after|in)\s+([^.,;\n]+)',
        r'\b(?:add|schedule|set|create|plan)?\s*follow[-\s]?up\s+on\s+([^.,;\n]+)',
        r'\bfollow[-\s]?up\s+([^.,;\n]+)',
    ]

    for pattern in follow_up_patterns:
        match = re.search(pattern, lowered, re.IGNORECASE)
        if match:
            phrase = re.sub(r'\s+', ' ', match.group(0)).strip(' ,.;:')
            if phrase:
                return phrase

    if 'follow up' in lowered or 'follow-up' in lowered:
        return re.sub(r'\s+', ' ', lowered).strip(' ,.;:')

    return ''


def _extract_attendees(text: str) -> str:
    lowered = text.lower()
    # Look for obvious attendee tokens
    # examples: "attendees: John, Mary", "add John and Mary to attendees", "include Shiv in attendees"
    patterns = [
        r'attendees?[:\-]\s*([^\n.,;]+)',
        r'add\s+([^\n.,;]+)\s+(?:to\s+)?attendees?',
        r'include\s+([^\n.,;]+)\s+(?:in\s+)?attendees?',
        r'with\s+([^\n.,;]+)\s+attend',
    ]

    for patt in patterns:
        match = re.search(patt, text, re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            # remove common connector words that may be captured ('attendees', 'add', 'in', 'to', etc.)
            raw = re.sub(r'\b(attendees?|add|include|in|to)\b', ' ', raw, flags=re.IGNORECASE)
            # split on commas, semicolons, slashes or the word 'and'
            parts = re.split(r'\s*(?:and|,|;|/)\s*', raw, flags=re.IGNORECASE)
            parts = [p.strip() for p in parts if p.strip()]
            normalized = ', '.join(_normalize_name(p) for p in parts)
            if normalized:
                return normalized

    # fallback: look for short "add <Name>" commands that likely refer to attendees
    match = re.search(r'add\s+([A-Za-z][A-Za-z.\'\- ]{1,40})$', text.strip(), re.IGNORECASE)
    if match:
        candidate = match.group(1).strip()
        candidate = re.sub(r'\b(attendees?|in|to)\b', ' ', candidate, flags=re.IGNORECASE).strip()
        return _normalize_name(candidate)

    return ''


def _extract_outcomes(text: str) -> str:
    lowered = text.lower()
    # Look for explicit outcome keywords
    patterns = [
        r'outcomes?[:\-]\s*([^\n]+)',
        r'outcome[:\-]\s*([^\n]+)',
        r'update outcomes?\s*(?:as|to)?\s*[:\-]?\s*([^\n]+)',
        r'key outcomes?\s*[:\-]\s*([^\n]+)',
        r'seen\s+([^\n]+)\s+in\s+outcomes?',
    ]

    for patt in patterns:
        match = re.search(patt, text, re.IGNORECASE)
        if match:
            raw = match.group(1).strip()
            raw = re.sub(r'\b(outcomes?|outcome|update|as|to)\b', ' ', raw, flags=re.IGNORECASE)
            raw = re.sub(r'\s+', ' ', raw).strip(' ,.;:')
            if raw:
                return raw

    # fallback: if the note begins with "update outcomes" or contains "add outcome"
    match = re.search(r'\b(update|add|set)\s+(?:the\s+)?outcomes?\b[:\-]?\s*(.+)$', text.strip(), re.IGNORECASE)
    if match:
        candidate = match.group(2).strip()
        candidate = re.sub(r'\s+', ' ', candidate).strip(' ,.;:')
        return candidate

    return ''


def _build_next_steps(extracted_data: dict, source_text: str) -> list[str]:
    steps: list[str] = []
    lowered = source_text.lower()

    hcp_name = extracted_data.get('hcp_name')
    attendees = extracted_data.get('attendees')
    topics = extracted_data.get('topics_discussed')
    materials = extracted_data.get('materials_shared')
    samples = extracted_data.get('samples_distributed')
    follow_up = extracted_data.get('follow_up_actions')

    if not hcp_name:
        steps.append('Add the HCP name so the interaction can be saved cleanly.')

    if attendees and 'attendees' in lowered:
        steps.append('Review the attendee list and keep only the names you want on the visit record.')

    if topics:
        steps.append('Confirm the discussion notes and add any missing outcome or agreement details.')

    if materials or samples:
        steps.append('Verify the materials or samples shared before saving the interaction.')

    if follow_up:
        steps.append('Check the follow-up timing and make sure it matches the next action you want logged.')

    if not steps:
        steps.append('Review the auto-filled fields, then save the interaction if everything looks correct.')

    return steps[:3]


def _compose_assistant_response(summary: str, next_steps: list[str]) -> str:
    steps_block = '\n'.join(f'• {step}' for step in next_steps)
    return f'📝 Summary\n{summary}\n\n✨ Next steps\n{steps_block}'


def build_local_payload(text: str, assistant_response: str | None = None) -> dict:
    payload = _extract_interaction_data(text)
    next_steps = _build_next_steps(payload['extracted_data'], text)
    payload['next_steps'] = next_steps

    if assistant_response:
        payload['assistant_response'] = assistant_response
    else:
        payload['assistant_response'] = _compose_assistant_response(payload['assistant_response'], next_steps)
    return payload


def _extract_interaction_data(text: str) -> dict:
    lowered = text.lower()
    extracted_date = _format_today() if any(token in lowered for token in ['today', 'this morning', 'this afternoon', 'this evening']) else None
    extracted_time = _format_now()
    hcp_name = _extract_name(text)

    attendees = _extract_attendees(text)
    outcomes = _extract_outcomes(text)

    topics = _extract_after_keyword(
        text,
        keywords=['discussed', 'about', 'regarding', 'talked about'],
        stop_tokens=['and', 'also', 'shared', 'sentiment', 'follow-up', 'follow up', 'brochure', 'brochures', 'sample', 'samples', 'outcome', 'outcomes'],
    )

    materials = _extract_after_keyword(
        text,
        keywords=['shared', 'gave', 'provided', 'distributed'],
        stop_tokens=['and', 'sentiment', 'topics', 'follow-up', 'follow up', 'outcome', 'outcomes'],
    )

    samples = _extract_after_keyword(
        text,
        keywords=['sampled', 'distributed', 'gave'],
        stop_tokens=['and', 'sentiment', 'topics', 'shared', 'follow-up', 'follow up', 'outcome', 'outcomes'],
    )

    follow_up_actions = _extract_follow_up(text)
    interaction_keywords_present = any(token in lowered for token in ['met', 'meeting', 'discussed', 'shared', 'gave', 'provided', 'distributed'])
    # If the user is issuing a short follow-up that only modifies attendees, outcomes, or sets a follow-up, treat as follow-up-only
    is_follow_up_only = (bool(follow_up_actions) or bool(attendees) or bool(outcomes)) and not interaction_keywords_present and not topics and not materials and not samples

    if is_follow_up_only:
        extracted_date = None
        extracted_time = None

    topics_discussed = topics or (None if is_follow_up_only else text.strip())
    materials_shared = materials or ('brochures' if 'brochure' in lowered and not is_follow_up_only else '')
    samples_distributed = samples or ('samples' if 'sample' in lowered and not is_follow_up_only else '')

    if 'brochure' in lowered and not materials_shared and not is_follow_up_only:
        materials_shared = 'brochures'

    if 'sample' in lowered and not samples_distributed and not is_follow_up_only:
        samples_distributed = 'samples'

    if topics_discussed and 'prod-x' in lowered and 'prod-X' not in topics_discussed:
        topics_discussed = re.sub(r'prod-x', 'prod-X', topics_discussed, flags=re.IGNORECASE)

    if topics_discussed:
        topics_discussed = re.sub(r'^the\s+', '', topics_discussed, flags=re.IGNORECASE)
    if materials_shared:
        materials_shared = re.sub(r'^the\s+', '', materials_shared, flags=re.IGNORECASE)
    if samples_distributed:
        samples_distributed = re.sub(r'^the\s+', '', samples_distributed, flags=re.IGNORECASE)

    # avoid setting sentiment on short follow-up-only notes so we don't overwrite prior sentiment
    sentiment_value = None if is_follow_up_only else _extract_sentiment(text)

    next_steps = _build_next_steps(
        {
            'hcp_name': hcp_name or None,
            'attendees': attendees or None,
            'topics_discussed': topics_discussed,
            'materials_shared': materials_shared or None,
            'samples_distributed': samples_distributed or None,
            'follow_up_actions': follow_up_actions or None,
        },
        text,
    )

    return {
        'assistant_response': _compose_assistant_response(
            f'I extracted the interaction details for {hcp_name or "the HCP"} and filled the draft.',
            next_steps,
        ),
        'extracted_data': {
            'hcp_name': hcp_name or None,
            'interaction_type': _extract_interaction_type(text),
            'date': extracted_date,
            'time': extracted_time,
            'attendees': attendees or None,
            'topics_discussed': topics_discussed,
            'materials_shared': materials_shared or None,
            'samples_distributed': samples_distributed or None,
            'sentiment': sentiment_value,
            'outcomes': outcomes or None,
            'follow_up_actions': follow_up_actions or None,
        },
        'confidence': {
            'hcp_name': 0.82 if hcp_name else 0.35,
            'date': 0.9 if extracted_date else 0.4,
            'time': 0.7,
            'topics_discussed': 0.88 if topics else 0.6,
            'materials_shared': 0.78 if materials_shared else 0.35,
            'follow_up_actions': 0.85 if follow_up_actions else 0.35,
            'sentiment': 0.85,
        },
        'requires_confirmation': True,
        'next_steps': next_steps,
        'is_follow_up_only': is_follow_up_only,
    }

def fallback_response(text: str) -> dict:
    extracted = build_local_payload(text)
    extracted['assistant_response'] = 'I could not reach the model, so I filled the draft using local parsing.'
    extracted['assistant_response'] = _compose_assistant_response(extracted['assistant_response'], extracted.get('next_steps', []))
    return extracted


async def stream_assistant_summary(text: str) -> AsyncGenerator[str, None]:
    if client is None:
        yield fallback_response(text)['assistant_response']
        return

    prompt = f"""
You are an assistant for logging HCP interactions in a CRM.

Write a short, friendly summary in 1-2 sentences based on the user note.
Mention the HCP and the main discussion points if available.
Then add a new section called "Next steps" with 1-3 practical follow-up actions.
Format the response with simple lines, bullets, and light emoji labels.
Do not output JSON.

User note:
{text}
"""

    try:
        stream = await client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.2,
            max_tokens=160,
            stream=True,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content if chunk.choices else None
            if content:
                yield content
    except Exception:
        yield fallback_response(text)['assistant_response']


async def extract_entities_from_text(text: str) -> dict:
    """Call the configured LLM provider to extract and summarize an HCP interaction."""
    if client is None:
        return fallback_response(text)

    prompt = f"""
You are an assistant for logging HCP interactions in a CRM.

Return JSON only with these keys:
- assistant_response: a short, friendly acknowledgement and summary for the user
- extracted_data: object with hcp_name, interaction_type, date, time, attendees, topics_discussed, materials_shared, samples_distributed, sentiment, outcomes, follow_up_actions
- confidence: object with confidence values between 0 and 1 for the important fields
- requires_confirmation: boolean

Rules:
- If a field is not present in the note, use null.
- Use YYYY-MM-DD for date when possible.
- Keep assistant_response concise.

User note:
{text}
"""

    try:
        resp = await client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0,
            max_tokens=512,
        )
    except Exception:
        return fallback_response(text)

    content = resp.choices[0].message.content or '{}'
    try:
        parsed = json.loads(content)
        local_data = _extract_interaction_data(text)
        extracted_data = parsed.get('extracted_data') if isinstance(parsed.get('extracted_data'), dict) else {}

        merged_data = extracted_data | local_data['extracted_data']
        merged_data = {
            key: value if value not in (None, '') else local_data['extracted_data'].get(key)
            for key, value in merged_data.items()
        }

        return {
            'assistant_response': parsed.get('assistant_response') or local_data['assistant_response'],
            'extracted_data': merged_data,
            'confidence': local_data['confidence'] | (parsed.get('confidence') if isinstance(parsed.get('confidence'), dict) else {}),
            'requires_confirmation': parsed.get('requires_confirmation', True),
            'next_steps': local_data.get('next_steps', []),
            'is_follow_up_only': local_data.get('is_follow_up_only', False),
        }
    except Exception:
        return fallback_response(text)
