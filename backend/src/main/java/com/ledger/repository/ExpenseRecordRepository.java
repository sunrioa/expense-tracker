package com.ledger.repository;

import com.ledger.entity.ExpenseRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExpenseRecordRepository extends JpaRepository<ExpenseRecord, Long> {

    List<ExpenseRecord> findAllByOrderByIdAsc();

    List<ExpenseRecord> findByParentIdOrderByPeriodAscIdAsc(Long parentId);

    List<ExpenseRecord> findByParentIdIsNullOrderByIdAsc();

    List<ExpenseRecord> findByPeriodOrderByIdAsc(String period);

    boolean existsByParentIdAndNameIgnoreCase(Long parentId, String name);
}
