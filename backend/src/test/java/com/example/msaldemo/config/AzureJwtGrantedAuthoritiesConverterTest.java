package com.example.msaldemo.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for SecurityConfig.AzureJwtGrantedAuthoritiesConverter.
 *
 * This converter is the core of the role/scope logic:
 *   - User tokens  → `scp` claim  → SCOPE_data.read
 *   - App tokens   → `roles` claim → ROLE_Admin / ROLE_User
 *
 * Tool: JUnit 5 + AssertJ — pure unit test, no Spring context.
 */
class AzureJwtGrantedAuthoritiesConverterTest {

    private final SecurityConfig.AzureJwtGrantedAuthoritiesConverter converter =
            new SecurityConfig.AzureJwtGrantedAuthoritiesConverter();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Jwt buildJwt(String scp, List<String> roles) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600));
        if (scp != null)   builder.claim("scp", scp);
        if (roles != null) builder.claim("roles", roles);
        return builder.build();
    }

    private List<String> authorityNames(Collection<GrantedAuthority> authorities) {
        return authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
    }

    // ── User token tests (scp claim) ──────────────────────────────────────────

    @Test
    @DisplayName("maps single scp value to SCOPE_ authority")
    void convert_singleScope_returnsScopeAuthority() {
        Jwt jwt = buildJwt("data.read", null);

        Collection<GrantedAuthority> authorities = converter.convert(jwt);

        assertThat(authorityNames(authorities)).containsExactly("SCOPE_data.read");
    }

    @Test
    @DisplayName("maps multiple space-separated scp values to separate SCOPE_ authorities")
    void convert_multipleScopes_returnsMultipleScopeAuthorities() {
        Jwt jwt = buildJwt("data.read openid profile", null);

        Collection<GrantedAuthority> authorities = converter.convert(jwt);

        assertThat(authorityNames(authorities))
                .containsExactlyInAnyOrder("SCOPE_data.read", "SCOPE_openid", "SCOPE_profile");
    }

    // ── App token tests (roles claim) ─────────────────────────────────────────

    @Test
    @DisplayName("maps roles claim to ROLE_ authorities (app token)")
    void convert_appRoles_returnsRoleAuthorities() {
        Jwt jwt = buildJwt(null, List.of("Admin", "DataReader"));

        Collection<GrantedAuthority> authorities = converter.convert(jwt);

        assertThat(authorityNames(authorities))
                .containsExactlyInAnyOrder("ROLE_Admin", "ROLE_DataReader");
    }

    @Test
    @DisplayName("maps single Admin role for Admin user token")
    void convert_adminRole_returnsAdminRoleAuthority() {
        // User tokens can also carry roles if the user is assigned an app role
        Jwt jwt = buildJwt("data.read openid", List.of("Admin"));

        Collection<GrantedAuthority> authorities = converter.convert(jwt);

        assertThat(authorityNames(authorities))
                .contains("SCOPE_data.read", "SCOPE_openid", "ROLE_Admin");
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("returns empty collection when both scp and roles are absent")
    void convert_noClaims_returnsEmpty() {
        Jwt jwt = buildJwt(null, null);

        Collection<GrantedAuthority> authorities = converter.convert(jwt);

        assertThat(authorities).isEmpty();
    }

    @Test
    @DisplayName("ignores blank/extra whitespace in scp claim")
    void convert_scpWithExtraSpaces_handlesGracefully() {
        Jwt jwt = buildJwt("data.read  openid", null); // double space

        Collection<GrantedAuthority> authorities = converter.convert(jwt);

        // blank strings from split should be filtered out
        assertThat(authorityNames(authorities))
                .doesNotContain("SCOPE_");
    }
}
