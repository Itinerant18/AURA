def calculate_hashtag_score(posts: list) -> int:
    """Score hashtag strategy (0-100)."""
    if not posts:
        return 20

    all_hashtags = []
    for post in posts:
        hashtags = post.get("hashtags", [])
        all_hashtags.extend(hashtags)

    if not all_hashtags:
        return 15

    unique_count = len(set(all_hashtags))
    total_count = len(all_hashtags)
    avg_per_post = total_count / len(posts)
    diversity = unique_count / total_count if total_count > 0 else 0

    score = 0
    # Optimal: 5-15 hashtags per post
    if 5 <= avg_per_post <= 15:
        score += 40
    elif 3 <= avg_per_post <= 20:
        score += 25
    else:
        score += 10

    # Diversity: using varied hashtags
    if diversity > 0.6:
        score += 35
    elif diversity > 0.3:
        score += 20
    else:
        score += 10

    # Volume bonus
    if unique_count > 30:
        score += 25
    elif unique_count > 15:
        score += 15
    else:
        score += 5

    return min(score, 100)
