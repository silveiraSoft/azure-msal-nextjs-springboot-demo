package com.example.msaldemo.repository;

import com.example.msaldemo.entity.DataItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for DataItem.
 * No implementation needed — Spring generates it at runtime.
 *
 * Inherited methods: findAll(), findById(), save(), delete(), count(), etc.
 */
@Repository
public interface DataItemRepository extends JpaRepository<DataItem, Long> {
}
