# Reviews Agent — стоп по насыщению
MAX_REVIEWS = 200           # жёсткий потолок по числу отзывов
BATCH_SIZE = 50             # отзывов в одном батче перед проверкой насыщения
COSINE_THRESHOLD = 0.85     # similarity >= этого = тема не новая
NEW_TOPIC_MIN_RATIO = 0.05  # останавливаемся если <5% батча — новые темы

# ConditionalTask (Manager → Reviews Agent retry)
MAX_RETRIES = 2
MIN_REVIEW_COUNT = 10       # меньше → Manager возвращает агента
MIN_CONFIDENCE = 0.7        # меньше → Manager возвращает агента

# Job management
STALE_JOB_TIMEOUT_MINUTES = 45  # должно совпадать с watchdog в БД

# News Agent
NEWS_MAX_ARTICLES = 50

# Competitor matrix
COMPETITOR_MIN_COUNT = 2
