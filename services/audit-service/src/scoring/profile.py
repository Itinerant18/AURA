def calculate_profile_score(account: dict) -> int:
    """Score profile completeness (0-100)."""
    score = 0
    checks = [
        ("account_name", 15),
        ("bio", 20),
        ("profile_image", 15),
        ("cover_image", 10),
        ("website", 15),
        ("contact_info", 10),
        ("location", 15),
    ]

    for field, points in checks:
        if account.get(field):
            score += points

    return min(score, 100)
