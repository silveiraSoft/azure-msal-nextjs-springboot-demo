# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build
# Downloads dependencies, compiles, packages the JAR.
# This stage is never shipped; only the JAR is copied forward.
# ─────────────────────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Copy the POM first so Docker caches the dependency layer.
# Dependencies are only re-downloaded when pom.xml changes.
COPY pom.xml .
RUN mvn dependency:go-offline -B --no-transfer-progress

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests --no-transfer-progress

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime
# Minimal JRE image (~85 MB). No Maven, no source code.
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

# Non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

# Copy only the built JAR from the builder stage
COPY --from=builder /build/target/msal-demo-0.0.1-SNAPSHOT.jar app.jar

# ─── Environment variables ───────────────────────────────────────────────────
# ALL values are injected at runtime via docker-compose / docker run -e.
# NOTHING is baked into this image — the same image works for dev and prod.
#
#   Required at runtime:
#     AZURE_TENANT_ID          — Azure AD tenant ID
#     AZURE_BACKEND_CLIENT_ID  — Backend app registration client ID
#     FRONTEND_URL             — CORS allowed origin (e.g. http://localhost:3000)
#
#   JVM tuning for constrained environments (Render free tier = 512 MB):
ENV JAVA_TOOL_OPTIONS="-Xmx256m -Xss512k -XX:+UseSerialGC -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
