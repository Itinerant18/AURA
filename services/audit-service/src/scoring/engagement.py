def calculate_engagement_score(posts: list, followers: int) -> int:
    """Calculate engagement rate score (0-100)."""
    if not posts or followers == 0:
        return 20

    total_engagement = sum(
        p.get("likes", 0) + p.get("comments", 0) + p.get("shares", 0)
        for p in posts
    )
    avg_engagement = total_engagement / len(posts)
    er = (avg_engagement / followers) * 100

    if er >= 5:
        return 95
    if er >= 3:
        return 80
    if er >= 1:
        return 60
    if er >= 0.5:
        return 40
    return 25
