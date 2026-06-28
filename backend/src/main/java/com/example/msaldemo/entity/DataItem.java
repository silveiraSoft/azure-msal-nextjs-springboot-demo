package com.example.msaldemo.entity;

import jakarta.persistence.*;

/**
 * Simple entity stored in PostgreSQL (prod/Docker) or H2 (local dev).
 * Replaces the hardcoded list in PublicController.
 *
 * Table: data_items
 * Seeded by: src/main/resources/data.sql
 */
@Entity
@Table(name = "data_items")
public class DataItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 255)
    private String description;

    // ── Constructors ──────────────────────────────────────────────────────────

    protected DataItem() {}   // required by JPA

    public DataItem(String title, String description) {
        this.title       = title;
        this.description = description;
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    public Long   getId()          { return id; }
    public String getTitle()       { return title; }
    public String getDescription() { return description; }
}
