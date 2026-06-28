package com.example.msaldemo.controller;

import com.example.msaldemo.config.SecurityConfig;
import com.example.msaldemo.entity.DataItem;
import com.example.msaldemo.repository.DataItemRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for PublicController — tests the full HTTP + Security layer.
 *
 * Tools used:
 *   @WebMvcTest    — loads only the web layer (no full Spring context, no JPA) → fast
 *   MockMvc        — makes fake HTTP requests without a running server
 *   jwt()          — Spring Security Test helper that injects a mock JWT into
 *                    the request, bypassing signature/issuer validation
 *   @MockBean      — replaces real beans that the web layer depends on:
 *                    • JwtDecoder — prevents startup calls to Azure AD JWKS endpoint
 *                    • DataItemRepository — prevents JPA context being required
 *
 * This covers:
 *   ✅ 200 OK with a valid app token (roles claim, no scp)
 *   ✅ 200 OK with a valid user token (scp claim)
 *   ✅ 401 Unauthorized when no token is provided
 *   ✅ Response body structure validation
 */
@WebMvcTest(PublicController.class)
@Import(SecurityConfig.class)
class PublicControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // Prevents Spring from calling Azure AD on startup to fetch JWKS.
    @MockBean
    private JwtDecoder jwtDecoder;

    // @WebMvcTest does NOT load the JPA layer.
    // PublicController injects DataItemRepository — we must mock it here.
    @MockBean
    private DataItemRepository dataItemRepository;

    // Shared seed items — returned by the mocked repository in every test.
    private static final List<DataItem> SEED_ITEMS = List.of(
        new DataItem("Spring Boot", "Java backend framework with embedded Tomcat"),
        new DataItem("Next.js",     "React framework for production"),
        new DataItem("Azure MSAL",  "Microsoft Authentication Library")
    );

    // ── Happy path: app token ─────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/public/data returns 200 with a valid application token")
    void getPublicData_withAppToken_returns200() throws Exception {
        when(dataItemRepository.findAll()).thenReturn(SEED_ITEMS);

        mockMvc.perform(get("/api/public/data")
                .with(jwt()
                        // App token: has roles, no scp
                        .jwt(j -> j
                                .subject("service-principal-oid")
                                .claim("roles", List.of("DataReader"))
                                .claim("appid", "frontend-client-id"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.tokenType").value("application (client credentials)"))
                .andExpect(jsonPath("$.tokenSubject").value("service-principal-oid"));
    }

    @Test
    @DisplayName("GET /api/public/data returns 200 with a valid user token")
    void getPublicData_withUserToken_returns200() throws Exception {
        when(dataItemRepository.findAll()).thenReturn(SEED_ITEMS);

        mockMvc.perform(get("/api/public/data")
                .with(jwt()
                        // User token: has scp, no roles claim necessarily
                        .jwt(j -> j
                                .subject("user-object-id")
                                .claim("scp", "data.read openid profile")
                                .claim("preferred_username", "user@demo.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("delegated (user)"));
    }

    // ── Response body structure ───────────────────────────────────────────────

    @Test
    @DisplayName("response contains expected item fields (id, title, description)")
    void getPublicData_responseStructure_isCorrect() throws Exception {
        when(dataItemRepository.findAll()).thenReturn(SEED_ITEMS);

        mockMvc.perform(get("/api/public/data")
                .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").exists())
                .andExpect(jsonPath("$.items[0].title").isString())
                .andExpect(jsonPath("$.items[0].description").isString());
    }

    @Test
    @DisplayName("items list reflects what the repository returns")
    void getPublicData_itemsMatchRepository() throws Exception {
        when(dataItemRepository.findAll()).thenReturn(SEED_ITEMS);

        mockMvc.perform(get("/api/public/data")
                .with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Spring Boot"))
                .andExpect(jsonPath("$.items[1].title").value("Next.js"))
                .andExpect(jsonPath("$.items[2].title").value("Azure MSAL"));
    }

    // ── Security: unauthenticated requests ────────────────────────────────────

    @Test
    @DisplayName("GET /api/public/data returns 401 when no Authorization header is sent")
    void getPublicData_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/public/data"))
                .andExpect(status().isUnauthorized());
    }
}
