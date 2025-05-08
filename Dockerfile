FROM libretranslate/libretranslate:latest

EXPOSE 5000

HEALTHCHECK --interval=5s --timeout=3s --retries=3 http://localhost:5000/health
