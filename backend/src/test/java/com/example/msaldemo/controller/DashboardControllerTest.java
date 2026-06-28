package com.example.msaldemo.controller;

import com.example.msaldemo.config.SecurityConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for DashboardController.
 *
 * Tests three access scenarios:
 *   1. Admin user   → can access /data AND /admin
 *   2. Regular user → can access /data but NOT /admin (403)
 *   3. App token    → cannot access either endpoint (no scp claim → no SCOPE_data.read)
 *   4. No token     → 401 on all endpoints
 *
 * Key Spring Security Test concepts used:
 *   jwt().authorities(...)  — explicitly sets the GrantedAuthority list on the
 *                             mock principal, bypassing the JWT converter.
 *                             Use this when you want to test exact authority matching.
 *   jwt().jwt(j -> ...)     — sets JWT claims for tests that inspect claim values
 *                             (e.g., DashboardController reads name, email, oid, roles).
 */
@WebMvcTest(DashboardController.class)
@Import(SecurityConfig.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtDecoder jwtDecoder;

    // ── /api/dashboard/data — Admin user ─────────────────────────────────────

    @Test
    @DisplayName("Admin user can access /api/dashboard/data")
    void getDashboardData_adminUser_returns200() throws Exception {
        mockMvc.perform(get("/api/dashboard/data")
                .with(jwt()
                        .jwt(j -> j
                                .subject("admin-oid")
                                .claim("name", "Alice Admin")
                                .claim("preferred_username", "alice@demo.com")
                                .claim("oid", "admin-oid")
                                .claim("scp", "data.read openid profile")
                                .claim("roles", List.of("Admin")))
                        .authorities(
                                new SimpleGrantedAuthority("SCOPE_data.read"),
                                new SimpleGrantedAuthority("ROLE_Admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.name").value("Alice Admin"))
                .andExpect(jsonPath("$.user.email").value("alice@demo.com"))
                .andExpect(jsonPath("$.user.roles").isArray())
                .andExpect(jsonPath("$.user.roles", contains("Admin")))
                .andExpect(jsonPath("$.dashboard").isArray())
                .andExpect(jsonPath("$.message").value(containsString("Administrator")));
    }

    // ── /api/dashboard/data — Regular user ───────────────────────────────────

    @Test
    @DisplayName("User role can access /api/dashboard/data")
    void getDashboardData_regularUser_returns200() throws Exception {
        mockMvc.perform(get("/api/dashboard/data")
                .with(jwt()
                        .jwt(j -> j
                                .subject("user-oid")
                                .claim("name", "Bob User")
                                .claim("preferred_username", "bob@demo.com")
                                .claim("oid", "user-oid")
                                .claim("scp", "data.read")
                                .claim("roles", List.of("User")))
                        .authorities(
                                new SimpleGrantedAuthority("SCOPE_data.read"),
                                new SimpleGrantedAuthority("ROLE_User"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.roles", contains("User")))
                .andExpect(jsonPath("$.message").value(containsString("General User")));
    }

    // ── /api/dashboard/admin — Admin user ────────────────────────────────────

    @Test
    @DisplayName("Admin user can access /api/dashboard/admin")
    void getAdminData_adminUser_returns200() throws Exception {
        mockMvc.perform(get("/api/dashboard/admin")
                .with(jwt()
                        .jwt(j -> j
                                .subject("admin-oid")
                                .claim("name", "Alice Admin")
                                .claim("scp", "data.read")
                                .claim("roles", List.of("Admin")))
                        .authorities(
                                new SimpleGrantedAuthority("SCOPE_data.read"),
                                new SimpleGrantedAuthority("ROLE_Admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adminMessage").exists())
                .andExpect(jsonPath("$.sensitiveData").isArray())
                .andExpect(jsonPath("$.systemHealth").exists())
                .andExpect(jsonPath("$.systemHealth.database").value("OK"));
    }

    // ── /api/dashboard/admin — Regular user (should be forbidden) ────────────

    @Test
    @DisplayName("User role gets 403 on /api/dashboard/admin")
    void getAdminData_userRole_returns403() throws Exception {
        mockMvc.perform(get("/api/dashboard/admin")
                .with(jwt()
                        .jwt(j -> j
                                .claim("scp", "data.read")
                                .claim("roles", List.of("User")))
                        // No ROLE_Admin authority — SecurityConfig denies this
                        .authorities(new SimpleGrantedAuthority("SCOPE_data.read"),
                                     new SimpleGrantedAuthority("ROLE_User"))))
                .andExpect(status().isForbidden());
    }

    // ── App token (no scp claim) → should be rejected ────────────────────────

    @Test
    @DisplayName("App token (no SCOPE_data.read) gets 403 on /api/dashboard/data")
    void getDashboardData_appToken_returns403() throws Exception {
        mockMvc.perform(get("/api/dashboard/data")
                .with(jwt()
                        // App token has roles but no scp → no SCOPE_data.read
                        .jwt(j -> j
                                .claim("roles", List.of("DataReader"))
                                .claim("appid", "frontend-client-id"))
                        .authorities(new SimpleGrantedAuthority("ROLE_DataReader"))))
                .andExpect(status().isForbidden());
    }

    // ── Unauthenticated ───────────────────────────────────────────────────────

    @Test
    @DisplayName("No token returns 401 on /api/dashboard/data")
    void getDashboardData_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/dashboard/data"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("No token returns 401 on /api/dashboard/admin")
    void getAdminData_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/dashboard/admin"))
                .andExpect(status().isUnauthorized());
    }
}
