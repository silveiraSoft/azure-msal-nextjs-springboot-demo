package com.example.msaldemo.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Accessible only with a *user (delegated) token* that contains the `data.read` scope.
 * The browser sends the token in the Authorization header after the user logs in via MSAL.
 *
 * Application tokens (client_credentials) are rejected because they have no `scp` claim
 * and therefore Spring Security never grants the SCOPE_data.read authority.
 *
 * Role-based access:
 *   /api/dashboard/data  — any authenticated user (Admin OR User role)
 *   /api/dashboard/admin — only users with the Admin app role
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    /**
     * Available to all authenticated users (both Admin and User roles).
     * The response includes the user's roles so the frontend can show/hide UI elements.
     */
    @GetMapping("/data")
    public Map<String, Object> getDashboardData(@AuthenticationPrincipal Jwt jwt) {
        String name              = jwt.getClaimAsString("name");
        String preferredUsername = jwt.getClaimAsString("preferred_username");
        String oid               = jwt.getClaimAsString("oid");
        String scopes            = jwt.getClaimAsString("scp");

        // `roles` claim contains the app roles assigned to this user in Azure AD.
        // e.g., ["Admin"] or ["User"]
        List<String> roles = jwt.getClaimAsStringList("roles");

        return Map.of(
            "user", Map.of(
                "name",     name != null ? name : "Unknown",
                "email",    preferredUsername != null ? preferredUsername : "Unknown",
                "objectId", oid != null ? oid : "Unknown",
                "roles",    roles != null ? roles : List.of()
            ),
            "scopes", scopes != null ? scopes : "",
            "dashboard", List.of(
                Map.of("metric", "Active Users",    "value", 1_234),
                Map.of("metric", "Monthly Revenue", "value", "$45,678"),
                Map.of("metric", "Open Tickets",    "value", 42),
                Map.of("metric", "Deployments",     "value", 7)
            ),
            "message", "Welcome " + (name != null ? name : "user") + "! Role: "
                + (roles != null && roles.contains("Admin") ? "Administrator" : "General User")
        );
    }

    /**
     * Admin-only endpoint — Spring Security rejects anyone without ROLE_Admin
     * before this method is even called (configured in SecurityConfig).
     *
     * Returns sensitive management data only admins should see.
     */
    @GetMapping("/admin")
    public Map<String, Object> getAdminData(@AuthenticationPrincipal Jwt jwt) {
        String name = jwt.getClaimAsString("name");

        return Map.of(
            "adminMessage", "You have Admin access, " + (name != null ? name : "user") + ".",
            "sensitiveData", List.of(
                Map.of("user", "alice@demo.com",  "role", "Admin",        "lastLogin", "2026-06-27"),
                Map.of("user", "bob@demo.com",    "role", "User",         "lastLogin", "2026-06-26"),
                Map.of("user", "charlie@demo.com","role", "User",         "lastLogin", "2026-06-25")
            ),
            "systemHealth", Map.of(
                "database", "OK",
                "cache",    "OK",
                "apiGateway", "OK"
            )
        );
    }
}
