# The distribution is built by Gradle and copied in, rather than built here: the build needs the
# whole repository and a warm Gradle cache, and neither belongs in an image layer.
#
#   ./gradlew :backend:service:cloud-run:installDist
#   docker build -f backend/service/entries/cloud-run/Dockerfile \
#     backend/service/entries/cloud-run
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY build/install/cloud-run/ /app/

# Cloud Run overrides this with the port it routes to; the default matches what it documents.
ENV PORT=8080

ENTRYPOINT ["/app/bin/cloud-run"]
