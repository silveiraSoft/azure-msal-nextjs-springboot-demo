package com.example.msaldemo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${azure.tenant-id}")
    private String tenantId;

    @Value("${azure.client-id}")
    private String clientId;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    // -------------------------------------------------------------------------
    // Security filter chain
    // -------------------------------------------------------------------------

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Stateless REST API — no sessions, no CSRF
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            .authorizeHttpRequests(auth -> auth
                // Health check — public, no token required
                .requestMatchers("/actuator/health").permitAll()

                // /api/public — any valid Azure AD JWT (app token OR user token).
                // Next.js fetches this server-side with an application token.
                .requestMatchers("/api/public/**").authenticated()

                // /api/dashboard/admin — only users assigned the Admin app role.
                // The `roles` claim in the user JWT must contain "Admin".
                .requestMatchers("/api/dashboard/admin/**").hasAuthority("ROLE_Admin")

                // /api/dashboard — any user with the data.read scope (Admin or User role).
                // App tokens are rejected because they have no `scp` claim.
                .requestMatchers("/api/dashboard/**").hasAuthority("SCOPE_data.read")

                .anyRequest().denyAll()
            )

            // Tell Spring Security to validate Bearer JWTs
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder())
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            );

        return http.build();
    }

    // -------------------------------------------------------------------------
    // JWT decoder — validates issuer + audience
    // -------------------------------------------------------------------------

    @Bean
    public JwtDecoder jwtDecoder() {
        // Auto-discovers JWKS URI from the issuer's OpenID Connect metadata endpoint:
        //   GET https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration
        NimbusJwtDecoder decoder = (NimbusJwtDecoder) JwtDecoders.fromIssuerLocation(
            "https://login.microsoftonline.com/" + tenantId + "/v2.0"
        );

        // Validate both `iss` (issuer) and `aud` (audience = backend client ID)
        var audienceValidator = new AudienceValidator(clientId);
        var defaultValidator = JwtValidators.createDefault();
        decoder.setJwtValidator(
            new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                defaultValidator, audienceValidator
            )
        );

        return decoder;
    }

    // -------------------------------------------------------------------------
    // Grant authorities from BOTH delegated scopes (scp) and app roles (roles)
    //
    //   User token  → "scp": "data.read openid profile"  → SCOPE_data.read
    //   App token   → "roles": ["DataReader"]             → ROLE_DataReader
    // -------------------------------------------------------------------------

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new AzureJwtGrantedAuthoritiesConverter());
        return converter;
    }

    // -------------------------------------------------------------------------
    // CORS
    // -------------------------------------------------------------------------

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    // -------------------------------------------------------------------------
    // Inner classes
    // -------------------------------------------------------------------------

    /**
     * Validates the `aud` (audience) claim in the JWT.
     * Azure AD sets aud = the backend app's client ID.
     */
    static class AudienceValidator implements org.springframework.security.oauth2.core.OAuth2TokenValidator<Jwt> {
        private final String audience;

        AudienceValidator(String audience) {
            this.audience = audience;
        }

        @Override
        public org.springframework.security.oauth2.core.OAuth2TokenValidatorResult validate(Jwt jwt) {
            List<String> audiences = jwt.getAudience();
            if (audiences != null && (
                audiences.contains(audience) ||
                audiences.contains("api://" + audience)
            )) {
                return org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success();
            }
            return org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure(
                new org.springframework.security.oauth2.core.OAuth2Error(
                    "invalid_token", "Token audience does not include " + audience, null
                )
            );
        }
    }

    /**
     * Converts JWT claims to Spring Security GrantedAuthority objects.
     *
     * - Delegated (user) tokens  → `scp` claim  → SCOPE_<scope>
     * - Application tokens       → `roles` claim → ROLE_<role>
     */
    static class AzureJwtGrantedAuthoritiesConverter
        implements Converter<Jwt, Collection<GrantedAuthority>> {

        @Override
        public Collection<GrantedAuthority> convert(Jwt jwt) {
            List<GrantedAuthority> authorities = new ArrayList<>();

            // Delegated scopes — present in user tokens
            String scp = jwt.getClaimAsString("scp");
            if (scp != null && !scp.isBlank()) {
                Arrays.stream(scp.split(" "))
                    .filter(s -> !s.isBlank())
                    .map(s -> new SimpleGrantedAuthority("SCOPE_" + s))
                    .forEach(authorities::add);
            }

            // Application roles — present in app tokens (client credentials)
            List<String> roles = jwt.getClaimAsStringList("roles");
            if (roles != null) {
                roles.stream()
                    .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                    .forEach(authorities::add);
            }

            return authorities;
        }
    }
}
