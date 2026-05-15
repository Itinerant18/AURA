def calculate_content_mix_score(posts: list) -> int:
    """Score content type diversity (0-100)."""
    if not posts:
        return 20

    types = {}
    for post in posts:
        t = post.get("type", "image")
        types[t] = types.get(t, 0) + 1

    total = len(posts)
    type_count = len(types)

    # Ideal mix: image 40%, carousel 25%, reel 20%, story 15%
    score = 0

    # Type diversity (max 50)
    if type_count >= 4:
        score += 50
    elif type_count == 3:
        score += 35
    elif type_count == 2:
        score += 20
    else:
        score += 10

    # Balance (max 50) - penalize if one type dominates > 70%
    max_ratio = max(count / total for count in types.values())
    if max_ratio <= 0.4:
        score += 50
    elif max_ratio <= 0.6:
        score += 35
    elif max_ratio <= 0.7:
        score += 20
    else:
        score += 10

    return min(score, 100)
