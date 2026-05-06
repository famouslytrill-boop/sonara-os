from statistics import mean


def activity_score(event_counts: list[int]) -> float:
    if not event_counts:
        return 0.0
    return round(mean(max(0, value) for value in event_counts), 2)


def job_success_rate(completed: int, failed: int) -> float:
    total = completed + failed
    if total <= 0:
        return 0.0
    return round(completed / total, 4)
