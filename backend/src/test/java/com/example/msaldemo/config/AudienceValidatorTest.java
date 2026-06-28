package com.example.msaldemo.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for SecurityConfig.AudienceValidator.
 *
 * Tool: JUnit 5 + AssertJ (both bundled with spring-boot-starter-test).
 * No Spring context is loaded — pure unit test, runs in milliseconds.
 */
class AudienceValidatorTest {

    private static final String EXPECTED_AUDIENCE = "api://backend-client-id";

    private final SecurityConfig.AudienceValidator validator =
            new SecurityConfig.AudienceValidator(EXPECTED_AUDIENCE);

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Builds a minimal Jwt with the given audience list. */
    private Jwt jwtWithAudience(List<String> audiences) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("aud", audiences)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("succeeds when token audience matches expected client ID")
    void validate_matchingAudience_succeeds() {
        Jwt jwt = jwtWithAudience(List.of(EXPECTED_AUDIENCE));

        OAuth2TokenValidatorResult result = validator.validate(jwt);

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    @DisplayName("succeeds when token has multiple audiences including the expected one")
    void validate_multipleAudiences_succeeds() {
        Jwt jwt = jwtWithAudience(List.of("other-client", EXPECTED_AUDIENCE));

        OAuth2TokenValidatorResult result = validator.validate(jwt);

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    @DisplayName("fails when audience does not match")
    void validate_wrongAudience_fails() {
        Jwt jwt = jwtWithAudience(List.of("api://some-other-app"));

        OAuth2TokenValidatorResult result = validator.validate(jwt);

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.getErrors())
                .anyMatch(e -> e.getErrorCode().equals("invalid_token"));
    }

    @Test
    @DisplayName("fails when audience list is empty")
    void validate_emptyAudience_fails() {
        Jwt jwt = jwtWithAudience(List.of());

        OAuth2TokenValidatorResult result = validator.validate(jwt);

        assertThat(result.hasErrors()).isTrue();
    }

    @Test
    @DisplayName("fails when audience list is null (missing aud claim)")
    void validate_nullAudience_fails() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        OAuth2TokenValidatorResult result = validator.validate(jwt);

        assertThat(result.hasErrors()).isTrue();
    }
}
