from app import ai_client

samples = [
    "This was a detailed visit with Dr. Smith to review the new formulation.",
    "We had a meeting today with the HCP to discuss results.",
    "Quick follow up: add John and send brochures.",
    "Had a phone call with the clinic to confirm dates.",
    "Detail visit scheduled next week to go over samples.",
    "Visited the HCP and discussed product details.",
]

for s in samples:
    t = ai_client._extract_interaction_type(s)
    print(f"INPUT: {s}\n-> interaction_type: {t}\n")
