package com.example.msaldemo.controller;

import com.example.msaldemo.entity.DataItem;
import com.example.msaldemo.repository.DataItemRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Accessible with an *application token* (client credentials flow).
 * Next.js fetches this server-side — the browser user is NOT required to log in.
 *
 * Required: valid Azure AD JWT whose audience includes the backend client ID.
 * (Any token from the correct tenant passes; delegated user tokens also work.)
 *
 * Data is loaded from the database (H2 in local dev, PostgreSQL in Docker/prod).
 * Seed rows are inserted by src/main/resources/data.sql on startup.
 */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final DataItemRepository dataItemRepository;

    public PublicController(DataItemRepository dataItemRepository) {
        this.dataItemRepository = dataItemRepository;
    }

    @GetMapping("/data")
    public Map<String, Object> getPublicData(@AuthenticationPrincipal Jwt jwt) {
        // Determine whether this is an app token or a user token for demo purposes.
        // App tokens (client credentials) have no "scp" (scope) claim.
        boolean isAppToken = jwt.getClaimAsString("scp") == null;

        List<DataItem> items = dataItemRepository.findAll();

        return Map.of(
            "message", "This is public data fetched by the Next.js server using an application token.",
            "items", items.stream().map(i -> Map.of(
                "id",          i.getId(),
                "title",       i.getTitle(),
                "description", i.getDescription()
            )).toList(),
            "tokenType",    isAppToken ? "application (client credentials)" : "delegated (user)",
            "tokenSubject", jwt.getSubject()
        );
    }
}
