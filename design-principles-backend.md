# PRIME LABORATORY SYSTEM (PLS)
## MASTER SOFTWARE ARCHITECTURE, CODE QUALITY & REFACTORING STANDARD

### 1. ROLE AND OBJECTIVE

Act as a Principal Software Architect, Senior Software Engineer, and Software Modernization Specialist.

Your responsibility is to conduct a comprehensive architectural assessment and progressively restructure the existing Prime Laboratory System (PLS) codebase into a professionally engineered, modular, maintainable, testable, scalable, and language-independent software architecture.

This is not a request to simply reorganize folders or rename files.

The objective is to correct architectural weaknesses, eliminate improper dependencies, enforce SOLID principles, establish clear separation of concerns, and introduce architectural boundaries that will make future maintenance, expansion, testing, and migration to another programming language significantly easier.

The resulting architecture must preserve all existing business functionality.

**Do not sacrifice working functionality in the name of architectural purity.**

---

### 2. CORE ARCHITECTURAL PHILOSOPHY

Adopt the following architectural standards:

- Clean Architecture.
- Domain-Driven Design (DDD), applied pragmatically.
- Hexagonal Architecture (Ports and Adapters).
- SOLID principles.
- Dependency Inversion Principle.
- Repository Pattern.
- Unit of Work Pattern where appropriate.
- Separation of Concerns.
- Modular Monolith architecture, with well-defined module boundaries.

The architecture must be language-agnostic.

Business rules must not depend on JavaScript, TypeScript, Node.js, Express, Knex, MySQL, or any particular framework.

The architecture should make it possible to reimplement the application in Go, Rust, C#, Java, or another language without having to rediscover and rewrite its business rules from tightly coupled infrastructure code.

---

### 3. ESTABLISH STRICT ARCHITECTURAL LAYERS

Organize the application into clearly defined layers.

#### A. Domain Layer

This is the core of the application.

It contains:

- Domain entities.
- Value objects.
- Domain services.
- Domain events.
- Business rules.
- Domain exceptions.
- Repository contracts/interfaces.
- Domain specifications where necessary.

Rules:

1. Entities must represent business concepts and maintain their own invariants.
2. Do not place database queries inside entities.
3. Do not put HTTP request or response objects inside entities.
4. Do not mix persistence models with domain entities.
5. Do not import infrastructure dependencies into the domain.
6. Do not make domain entities dependent on Express, Knex, MySQL, or external frameworks.
7. Avoid creating interfaces unnecessarily. Introduce abstractions where they establish meaningful boundaries.

An entity must represent a business object, not a database table disguised as a class.

#### B. Application Layer

This layer coordinates application operations and implements use cases.

It contains:

- Application services.
- Use cases.
- Command handlers.
- Query handlers.
- DTOs.
- Input validation.
- Application interfaces/ports.
- Transaction coordination.
- Authorization orchestration.

Examples:

- RegisterPatientUseCase.
- CreateInvoiceUseCase.
- RecordPaymentUseCase.
- ReleaseLaboratoryResultUseCase.
- CreatePurchaseOrderUseCase.
- ReceiveInventoryUseCase.
- FinalizeAccountingPeriodUseCase.

Rules:

1. Each use case should have a clearly defined responsibility.
2. Application services must orchestrate operations rather than implement database access.
3. Application services must depend on repository contracts, not concrete database implementations.
4. Application services must not contain raw SQL queries.
5. Application services must not directly manipulate Knex or MySQL connections.
6. Application services must not depend on Express request or response objects.
7. Application services should return application results or output DTOs.
8. Business transactions must be coordinated through an appropriate transaction abstraction.
9. Avoid oversized services that handle unrelated business operations.

#### C. Infrastructure Layer

This layer implements the technical details required by the application.

It contains:

- Repository implementations.
- Database connections.
- Knex implementations.
- SQL queries.
- Database transactions.
- External API integrations.
- File storage implementations.
- Email and SMS providers.
- Device communication adapters.
- Logging implementations.
- Cache implementations.
- Background job implementations.

Rules:

1. All database queries belong in the persistence/infrastructure boundary.
2. Knex and MySQL-specific logic must remain isolated.
3. Infrastructure implements interfaces defined by the appropriate inner architectural layer.
4. Database-specific entities or records must not leak into the domain.
5. Replacing MySQL must not require rewriting domain business rules.
6. External services must be accessed through adapters.
7. Infrastructure must not become the location for business decisions.

#### D. Presentation Layer

This layer handles communication with users and external clients.

It contains:

- HTTP controllers.
- Routes.
- Request validation schemas.
- Request and response DTO mapping.
- Authentication middleware.
- Authorization middleware.
- Exception-to-HTTP mapping.
- API response formatting.

Rules:

1. Controllers must remain thin.
2. Controllers must not contain business logic.
3. Controllers must not contain SQL queries.
4. Controllers must not directly access database connections.
5. Controllers must delegate operations to application use cases.
6. HTTP-specific concerns must not leak into the application or domain layers.

---

### 4. STRICT REPOSITORY PATTERN

One of the primary objectives is to eliminate database queries from services.

Establish a consistent repository architecture.

Example:

Repository contract:

    interface PatientRepository {
        findById(id): Promise<Patient | null>;
        findByPatientNumber(number): Promise<Patient | null>;
        save(patient): Promise<Patient>;
        delete(patient): Promise<void>;
    }

Infrastructure implementation:

    class MySqlPatientRepository implements PatientRepository {
        constructor(database) {}

        async findById(id) {
            // Knex/MySQL implementation
        }

        async findByPatientNumber(number) {
            // Knex/MySQL implementation
        }

        async save(patient) {
            // Persistence implementation
        }
    }

Application use case:

    class RegisterPatientUseCase {
        constructor(patientRepository) {}

        async execute(input) {
            // Application orchestration
            // Business rules and repository interaction
        }
    }

The examples above illustrate architectural boundaries, not mandatory syntax.

Important requirements:

- Repository interfaces must be independent of database technology.
- Repository implementations must contain database-specific queries.
- Avoid generic repositories that sacrifice domain clarity.
- Do not create repository methods that expose Knex query builders.
- Do not return raw database records directly to domain logic.
- Do not duplicate queries across multiple services.
- Use appropriate query repositories or read models for complex reporting and read-heavy operations.
- Keep command-side domain persistence separate from specialized reporting queries where necessary.

---

### 5. STRICT SOLID ENFORCEMENT

Evaluate and correct violations of all five SOLID principles.

**S — Single Responsibility Principle**

Every class and module must have a clearly defined responsibility.

Avoid:
- Services handling multiple unrelated modules.
- Controllers implementing business rules.
- Repositories handling unrelated business operations.
- Utility classes becoming dumping grounds.

**O — Open/Closed Principle**

Modules should support extension without unnecessary modification of stable existing components.

Use appropriate abstractions and strategies where genuine variation exists.

**L — Liskov Substitution Principle**

Implementations must honor the behavioral contracts of their interfaces.

Do not create inheritance hierarchies that break expected behavior.

**I — Interface Segregation Principle**

Avoid oversized interfaces.

A class must not be forced to implement methods it does not need.

Separate interfaces according to actual responsibilities.

**D — Dependency Inversion Principle**

High-level business logic must depend on abstractions.

Infrastructure implementations must depend inward on architectural contracts, not the other way around.

---

### 6. SEPARATE ENTITIES, INTERFACES, DTOs AND DATABASE MODELS

This is a mandatory architectural correction.

Never mix unrelated architectural concepts in the same file or class.

Establish clear distinctions:

**Domain entities:** Represent business concepts and enforce invariants.

**Interfaces:** Define contracts between components and layers.

**DTOs:** Transfer data between application boundaries.

**Persistence models:** Represent database storage structures.

**API models:** Represent external request and response formats.

For example, Patient should not simultaneously represent:

- A database row.
- An API response.
- A request validation schema.
- A domain entity.
- A repository contract.

These concepts must remain distinct where their responsibilities differ.

Avoid unnecessary duplication, however. Introduce mappings and additional models only where a real architectural boundary requires them.

---

### 7. MODULE-BASED ARCHITECTURE

PLS must be organized around its business capabilities.

Examples of major modules include:

- Patient Management.
- Patient Registration.
- Laboratory Management.
- Billing and Payments.
- Results Management.
- Inventory Management.
- Pharmacy.
- Accounting and Finance.
- Payroll.
- Human Resources.
- Device Interfacing.
- Radiology Information System.
- Notifications.
- User Management.
- Facility Management.
- Multi-Tenant Management.
- Reporting and Analytics.

Each module must have a clear boundary and internal architecture.

A module should own its business rules, application use cases, domain models, and persistence implementations.

Modules must communicate through well-defined contracts rather than accessing each other's internal implementation details.

Avoid circular dependencies.

Do not allow one module to directly manipulate another module's database tables or internal repositories without an explicitly defined integration boundary.

Where cross-module operations are necessary, introduce application-level contracts, domain events, or dedicated integration services.

---

### 8. MULTI-TENANT ARCHITECTURAL REQUIREMENTS

PLS is a multi-tenant system.

The architecture must enforce tenant isolation as a fundamental architectural concern.

Requirements:

1. Tenant context must be established at a controlled application boundary.
2. Tenant identification must not be randomly passed throughout the codebase.
3. Repository implementations must enforce tenant-scoped data access where applicable.
4. Never rely exclusively on frontend-supplied tenant identifiers for security.
5. Cross-tenant access must require explicit authorization.
6. Tenant-specific database and connection resolution must be isolated in infrastructure.
7. Domain business rules must not depend on the mechanics of tenant database selection.
8. Background jobs, scheduled tasks, and integrations must preserve tenant context.
9. Ensure transactions cannot accidentally cross tenant boundaries.
10. Tenant isolation must be covered by automated tests.

Preserve the existing multi-tenant and multi-branch functionality.

---

### 9. TRANSACTION AND DATA CONSISTENCY MANAGEMENT

Introduce a consistent transaction management abstraction.

Requirements:

- Use transactions for operations that require atomicity.
- Keep transaction implementation inside infrastructure.
- Allow application use cases to coordinate transaction boundaries.
- Ensure repositories participating in a transaction use the same transaction context.
- Avoid scattered transaction handling across controllers and services.
- Handle rollback and failure scenarios correctly.
- Preserve idempotency where required.
- Use appropriate outbox patterns for reliable event publication where necessary.

Pay particular attention to:

- Patient registration and billing.
- Invoice generation and payments.
- Inventory receiving and stock adjustments.
- Accounting journals.
- Result validation and release.
- Payroll processing.

Do not introduce distributed transactions or microservices unnecessarily.

---

### 10. ERROR HANDLING AND VALIDATION

Establish a consistent error-handling architecture.

Separate:

- Domain exceptions.
- Application exceptions.
- Infrastructure exceptions.
- Authentication and authorization errors.
- Validation errors.
- HTTP presentation errors.

Database-specific exceptions must not leak into the domain.

Implement centralized exception mapping at the application/presentation boundary.

Avoid generic catch blocks that hide errors or silently return success.

Validation must occur at appropriate boundaries:

- Request validation at presentation.
- Application input validation at use-case boundaries where necessary.
- Domain invariant validation inside domain objects.

Do not duplicate the same validation logic unnecessarily across every layer.

---

### 11. DEPENDENCY INJECTION AND COMPOSITION ROOT

Establish a clear dependency injection strategy.

Requirements:

1. Dependencies must be injected rather than instantiated randomly throughout business logic.
2. Application services must receive their dependencies through constructors or an equivalent explicit mechanism.
3. Concrete infrastructure implementations must be registered at the application's composition root.
4. Domain classes must not instantiate database connections.
5. Avoid global service locators and hidden dependencies.
6. Make dependencies explicit and easy to replace during testing.

---

### 12. LANGUAGE-INDEPENDENT DESIGN AND FUTURE PORTABILITY

This is one of the most important objectives.

Design the architecture so that the business logic can eventually be reimplemented in Go, Rust, C#, Java, or another language.

Do not build an architecture that is unnecessarily tied to TypeScript or Node.js.

Establish the following standards:

- Use technology-neutral domain concepts.
- Keep business rules independent of framework APIs.
- Define clear application input and output contracts.
- Keep persistence contracts independent of SQL implementation.
- Keep external integration contracts independent of their providers.
- Avoid passing framework-specific objects across architectural boundaries.
- Avoid exposing database query builders outside infrastructure.
- Avoid using JavaScript-specific behavior as an implicit business rule.
- Define explicit data types and business invariants.
- Document important business workflows independently of implementation details.
- Use stable, explicit API and event contracts.

The objective is not to make all languages look identical.

The objective is to make the architecture and business behavior understandable and reproducible in another language without carrying over unnecessary implementation dependencies.

---

### 13. TESTING ARCHITECTURE

Establish a testing strategy across all architectural layers.

**Domain tests**
- Entity behavior.
- Business invariants.
- Value objects.
- Domain services.

**Application tests**
- Use-case execution.
- Repository contract interactions.
- Authorization decisions.
- Transaction coordination.
- Failure scenarios.

**Infrastructure tests**
- Repository implementations.
- Database queries.
- Transaction behavior.
- Tenant isolation.
- External integrations.

**Integration tests**
- Cross-module workflows.
- Database consistency.
- API-to-application interactions.

**End-to-end tests**
- Critical user workflows.

Use mocks or fakes appropriately, but do not rely exclusively on mocked tests.

Critical database and multi-tenant behavior must also be tested against a real test database.

---

### 14. CODE QUALITY AND NAMING CONVENTIONS

Establish consistent naming conventions.

Examples:

- RegisterPatientUseCase.
- PatientRepository.
- MySqlPatientRepository.
- Patient.
- PatientId.
- RegisterPatientInput.
- RegisterPatientResult.
- PatientController.
- PatientRoutes.

Avoid ambiguous names such as:

- CommonService.
- GeneralHelper.
- MainRepository.
- DataManager.
- GlobalUtility.
- MiscellaneousFunctions.

Use meaningful names that describe responsibilities.

Keep classes and functions focused.

Avoid:
- God classes.
- God services.
- Circular imports.
- Deeply coupled modules.
- Excessive inheritance.
- Unnecessary abstractions.
- Duplicate business logic.
- Magic values.
- Hidden side effects.
- Large files containing unrelated responsibilities.

Do not introduce abstraction merely to increase the number of files.

Every abstraction must have a clear architectural purpose.

---

### 15. TARGET DIRECTORY STRUCTURE

Evaluate the existing project and establish a consistent modular structure.

A conceptual example:

    src/
      modules/
        patients/
          domain/
            entities/
            value-objects/
            services/
            events/
            repositories/
            exceptions/

          application/
            use-cases/
            services/
            dto/
            ports/

          infrastructure/
            persistence/
              repositories/
              models/
              mappers/
            integrations/

          presentation/
            controllers/
            routes/
            validators/
            mappers/

          patients.module.ts

        billing/
          domain/
          application/
          infrastructure/
          presentation/

        inventory/
          domain/
          application/
          infrastructure/
          presentation/

      shared/
        domain/
        application/
        infrastructure/

      bootstrap/
        dependency-injection/
        configuration/

      tests/

This is a conceptual structure, not an instruction to copy it blindly.

Adapt it to the existing application, module complexity, and current framework.

Avoid turning shared into a dumping ground for unrelated code.

---

### 16. STRICT REFACTORING RULES

Follow these rules throughout the modernization process:

1. Do not rewrite the entire application in one operation.
2. Do not delete working functionality.
3. Do not modify business rules unless an existing defect is identified and documented.
4. Do not change API contracts unnecessarily.
5. Do not change database schemas without a documented migration plan.
6. Do not introduce breaking changes without approval.
7. Do not replace existing dependencies simply because another library is available.
8. Do not introduce microservices merely to achieve separation of concerns.
9. Do not create unnecessary interfaces or abstraction layers.
10. Do not leave partially migrated modules in an inconsistent state.
11. Do not create placeholder architecture that is never implemented.
12. Preserve existing authentication, authorization, tenant isolation, and transaction behavior.
13. Ensure existing tests pass before and after each migration.
14. Document architectural decisions and trade-offs.

Maintain backward compatibility wherever reasonably possible.

---

### 17. REQUIRED EXECUTION PHASES

Execute the project in clearly defined phases.

**PHASE 1 — Architectural Audit**

Inspect the entire existing codebase.

Identify:

- Services containing database queries.
- Entities mixed with interfaces.
- DTOs mixed with persistence models.
- Controllers containing business logic.
- Infrastructure dependencies leaking into business logic.
- Circular dependencies.
- Large classes and oversized services.
- Duplicate business logic.
- Poor module boundaries.
- Inconsistent error handling.
- Missing transaction boundaries.
- Multi-tenant isolation weaknesses.
- Testing gaps.

Produce an architectural assessment report.

Do not begin large-scale modifications during this phase.

**PHASE 2 — Architecture Blueprint**

Design the target architecture.

Provide:

- Proposed folder structure.
- Layer responsibilities.
- Module boundaries.
- Dependency direction.
- Repository contracts.
- Application use-case patterns.
- Transaction strategy.
- Dependency injection strategy.
- Testing strategy.
- Migration strategy.

Produce an Architecture Decision Record (ADR) explaining the selected architecture and why it is appropriate for PLS.

**PHASE 3 — Establish Architectural Foundations**

Implement the shared architectural foundations.

Examples:

- Dependency injection.
- Repository conventions.
- Transaction abstractions.
- Error handling.
- Logging.
- Validation conventions.
- Tenant context.
- Testing infrastructure.

Do not create abstractions without an immediate, identifiable use case.

**PHASE 4 — Progressive Module Refactoring**

Refactor modules individually.

For each module:

1. Audit existing implementation.
2. Identify architectural violations.
3. Define domain responsibilities.
4. Separate entities, interfaces, DTOs, and persistence models.
5. Extract database queries into repositories.
6. Refactor services into focused application use cases.
7. Isolate external dependencies.
8. Implement appropriate dependency injection.
9. Add or update tests.
10. Verify existing functionality.
11. Document important architectural changes.

Prioritize modules with the highest architectural risk and dependency impact.

**PHASE 5 — Architecture Enforcement**

Introduce automated quality controls.

Where appropriate, enforce:

- Import boundary rules.
- Dependency direction.
- Circular dependency detection.
- Type checking.
- Linting.
- Test coverage for critical workflows.
- Architecture tests.
- Consistent formatting.
- Build verification.

Prevent new architectural violations from entering the codebase.

**PHASE 6 — Final Architectural Review**

Perform a second comprehensive audit.

Verify that the refactored system meets the intended architecture.

Produce a final report documenting:

- Completed refactoring.
- Remaining violations.
- Architectural improvements.
- Technical debt.
- Test results.
- Compatibility risks.
- Future migration considerations.

---

### 18. DEFINITION OF DONE

A module should not be considered architecturally refactored until:

- Domain logic is independent of infrastructure.
- Application services contain no direct database queries.
- Repository implementations own database access.
- Entities are separated from persistence models where appropriate.
- Controllers are thin.
- Dependencies point in the correct direction.
- Interfaces have meaningful responsibilities.
- Transactions are correctly managed.
- Tenant isolation is preserved.
- Business rules remain intact.
- Automated tests cover critical behavior.
- The module has no unintended circular dependencies.
- Its public contracts are documented.
- The module can be understood independently of its underlying database and framework.

---

### 19. FINAL INSTRUCTION

Treat this as a long-term software engineering modernization project, not a cosmetic cleanup.

Be critical of the existing architecture.

Do not assume that existing patterns are correct simply because they are already being used.

However, do not blindly impose architectural patterns where they provide no practical benefit.

Prioritize correctness, maintainability, explicit dependencies, modularity, testability, and long-term portability.

**The ultimate objective is to make PLS a professionally structured software platform whose business logic is independent of its programming language, database, framework, and deployment environment.**

Begin with Phase 1: conduct a comprehensive architectural audit and present the findings before proposing or implementing major changes.

Do not proceed with large-scale refactoring until the architecture blueprint and migration strategy have been reviewed and approved.


What you are describing is more than simply applying SOLID principles. You want to establish a **proper software architecture and engineering standard** for Prime Laboratory System (PLS), so that the codebase becomes modular, maintainable, testable, scalable, and independent of its current programming language.

My recommendation is to use a combination of:

1. **Clean Architecture** – separates business logic from infrastructure.
2. **Domain-Driven Design (DDD)** – gives business entities and domain rules a proper structure.
3. **SOLID principles** – ensures responsibilities and dependencies are properly separated.
4. **Hexagonal Architecture (Ports and Adapters)** – makes it possible to replace databases, frameworks, and even programming languages.
5. **Repository Pattern** – ensures database queries do not leak into services or business logic.
6. **Dependency Inversion** – high-level business logic must not depend directly on low-level infrastructure.

For PLS, I would establish a language-independent architectural standard, even though your current implementation uses Node.js, Express, Knex, MySQL, and Next.js.

Below is the master prompt I recommend using with your AI coding agent.

# **PLS Master Architecture & Codebase Refactoring Prompt**

# PRIME LABORATORY SYSTEM (PLS)

## MASTER SOFTWARE ARCHITECTURE, CODE QUALITY & REFACTORING STANDARD

### 1. ROLE AND OBJECTIVE

Act as a Principal Software Architect, Senior Software Engineer, and Software Modernization Specialist.

Your responsibility is to conduct a comprehensive architectural assessment and progressively restructure the existing Prime Laboratory System (PLS) codebase into a professionally engineered, modular, maintainable, testable, scalable, and language-independent software architecture.

This is not a request to simply reorganize folders or rename files.

The objective is to correct architectural weaknesses, eliminate improper dependencies, enforce SOLID principles, establish clear separation of concerns, and introduce architectural boundaries that will make future maintenance, expansion, testing, and migration to another programming language significantly easier.

The resulting architecture must preserve all existing business functionality.

**Do not sacrifice working functionality in the name of architectural purity.**

---

### 2. CORE ARCHITECTURAL PHILOSOPHY

Adopt the following architectural standards:

- Clean Architecture.
- Domain-Driven Design (DDD), applied pragmatically.
- Hexagonal Architecture (Ports and Adapters).
- SOLID principles.
- Dependency Inversion Principle.
- Repository Pattern.
- Unit of Work Pattern where appropriate.
- Separation of Concerns.
- Modular Monolith architecture, with well-defined module boundaries.

The architecture must be language-agnostic.

Business rules must not depend on JavaScript, TypeScript, Node.js, Express, Knex, MySQL, or any particular framework.

The architecture should make it possible to reimplement the application in Go, Rust, C#, Java, or another language without having to rediscover and rewrite its business rules from tightly coupled infrastructure code.

---

### 3. ESTABLISH STRICT ARCHITECTURAL LAYERS

Organize the application into clearly defined layers.

#### A. Domain Layer

This is the core of the application.

It contains:

- Domain entities.
- Value objects.
- Domain services.
- Domain events.
- Business rules.
- Domain exceptions.
- Repository contracts/interfaces.
- Domain specifications where necessary.

Rules:

1. Entities must represent business concepts and maintain their own invariants.
2. Do not place database queries inside entities.
3. Do not put HTTP request or response objects inside entities.
4. Do not mix persistence models with domain entities.
5. Do not import infrastructure dependencies into the domain.
6. Do not make domain entities dependent on Express, Knex, MySQL, or external frameworks.
7. Avoid creating interfaces unnecessarily. Introduce abstractions where they establish meaningful boundaries.

An entity must represent a business object, not a database table disguised as a class.

#### B. Application Layer

This layer coordinates application operations and implements use cases.

It contains:

- Application services.
- Use cases.
- Command handlers.
- Query handlers.
- DTOs.
- Input validation.
- Application interfaces/ports.
- Transaction coordination.
- Authorization orchestration.

Examples:

- RegisterPatientUseCase.
- CreateInvoiceUseCase.
- RecordPaymentUseCase.
- ReleaseLaboratoryResultUseCase.
- CreatePurchaseOrderUseCase.
- ReceiveInventoryUseCase.
- FinalizeAccountingPeriodUseCase.

Rules:

1. Each use case should have a clearly defined responsibility.
2. Application services must orchestrate operations rather than implement database access.
3. Application services must depend on repository contracts, not concrete database implementations.
4. Application services must not contain raw SQL queries.
5. Application services must not directly manipulate Knex or MySQL connections.
6. Application services must not depend on Express request or response objects.
7. Application services should return application results or output DTOs.
8. Business transactions must be coordinated through an appropriate transaction abstraction.
9. Avoid oversized services that handle unrelated business operations.

#### C. Infrastructure Layer

This layer implements the technical details required by the application.

It contains:

- Repository implementations.
- Database connections.
- Knex implementations.
- SQL queries.
- Database transactions.
- External API integrations.
- File storage implementations.
- Email and SMS providers.
- Device communication adapters.
- Logging implementations.
- Cache implementations.
- Background job implementations.

Rules:

1. All database queries belong in the persistence/infrastructure boundary.
2. Knex and MySQL-specific logic must remain isolated.
3. Infrastructure implements interfaces defined by the appropriate inner architectural layer.
4. Database-specific entities or records must not leak into the domain.
5. Replacing MySQL must not require rewriting domain business rules.
6. External services must be accessed through adapters.
7. Infrastructure must not become the location for business decisions.

#### D. Presentation Layer

This layer handles communication with users and external clients.

It contains:

- HTTP controllers.
- Routes.
- Request validation schemas.
- Request and response DTO mapping.
- Authentication middleware.
- Authorization middleware.
- Exception-to-HTTP mapping.
- API response formatting.

Rules:

1. Controllers must remain thin.
2. Controllers must not contain business logic.
3. Controllers must not contain SQL queries.
4. Controllers must not directly access database connections.
5. Controllers must delegate operations to application use cases.
6. HTTP-specific concerns must not leak into the application or domain layers.

---

### 4. STRICT REPOSITORY PATTERN

One of the primary objectives is to eliminate database queries from services.

Establish a consistent repository architecture.

Example:

Repository contract:

```
interface PatientRepository {
    findById(id): Promise<Patient | null>;
    findByPatientNumber(number): Promise<Patient | null>;
    save(patient): Promise<Patient>;
    delete(patient): Promise<void>;
}
```

Infrastructure implementation:

```
class MySqlPatientRepository implements PatientRepository {
    constructor(database) {}

    async findById(id) {
        // Knex/MySQL implementation
    }

    async findByPatientNumber(number) {
        // Knex/MySQL implementation
    }

    async save(patient) {
        // Persistence implementation
    }
}
```

Application use case:

```
class RegisterPatientUseCase {
    constructor(patientRepository) {}

    async execute(input) {
        // Application orchestration
        // Business rules and repository interaction
    }
}
```

The examples above illustrate architectural boundaries, not mandatory syntax.

Important requirements:

- Repository interfaces must be independent of database technology.
- Repository implementations must contain database-specific queries.
- Avoid generic repositories that sacrifice domain clarity.
- Do not create repository methods that expose Knex query builders.
- Do not return raw database records directly to domain logic.
- Do not duplicate queries across multiple services.
- Use appropriate query repositories or read models for complex reporting and read-heavy operations.
- Keep command-side domain persistence separate from specialized reporting queries where necessary.

---

### 5. STRICT SOLID ENFORCEMENT

Evaluate and correct violations of all five SOLID principles.

**S — Single Responsibility Principle**

Every class and module must have a clearly defined responsibility.

Avoid:

- Services handling multiple unrelated modules.
- Controllers implementing business rules.
- Repositories handling unrelated business operations.
- Utility classes becoming dumping grounds.

**O — Open/Closed Principle**

Modules should support extension without unnecessary modification of stable existing components.

Use appropriate abstractions and strategies where genuine variation exists.

**L — Liskov Substitution Principle**

Implementations must honor the behavioral contracts of their interfaces.

Do not create inheritance hierarchies that break expected behavior.

**I — Interface Segregation Principle**

Avoid oversized interfaces.

A class must not be forced to implement methods it does not need.

Separate interfaces according to actual responsibilities.

**D — Dependency Inversion Principle**

High-level business logic must depend on abstractions.

Infrastructure implementations must depend inward on architectural contracts, not the other way around.

---

### 6. SEPARATE ENTITIES, INTERFACES, DTOs AND DATABASE MODELS

This is a mandatory architectural correction.

Never mix unrelated architectural concepts in the same file or class.

Establish clear distinctions:

**Domain entities:** Represent business concepts and enforce invariants.

**Interfaces:** Define contracts between components and layers.

**DTOs:** Transfer data between application boundaries.

**Persistence models:** Represent database storage structures.

**API models:** Represent external request and response formats.

For example, Patient should not simultaneously represent:

- A database row.
- An API response.
- A request validation schema.
- A domain entity.
- A repository contract.

These concepts must remain distinct where their responsibilities differ.

Avoid unnecessary duplication, however. Introduce mappings and additional models only where a real architectural boundary requires them.

---

### 7. MODULE-BASED ARCHITECTURE

PLS must be organized around its business capabilities.

Examples of major modules include:

- Patient Management.
- Patient Registration.
- Laboratory Management.
- Billing and Payments.
- Results Management.
- Inventory Management.
- Pharmacy.
- Accounting and Finance.
- Payroll.
- Human Resources.
- Device Interfacing.
- Radiology Information System.
- Notifications.
- User Management.
- Facility Management.
- Multi-Tenant Management.
- Reporting and Analytics.

Each module must have a clear boundary and internal architecture.

A module should own its business rules, application use cases, domain models, and persistence implementations.

Modules must communicate through well-defined contracts rather than accessing each other's internal implementation details.

Avoid circular dependencies.

Do not allow one module to directly manipulate another module's database tables or internal repositories without an explicitly defined integration boundary.

Where cross-module operations are necessary, introduce application-level contracts, domain events, or dedicated integration services.

---

### 8. MULTI-TENANT ARCHITECTURAL REQUIREMENTS

PLS is a multi-tenant system.

The architecture must enforce tenant isolation as a fundamental architectural concern.

Requirements:

1. Tenant context must be established at a controlled application boundary.
2. Tenant identification must not be randomly passed throughout the codebase.
3. Repository implementations must enforce tenant-scoped data access where applicable.
4. Never rely exclusively on frontend-supplied tenant identifiers for security.
5. Cross-tenant access must require explicit authorization.
6. Tenant-specific database and connection resolution must be isolated in infrastructure.
7. Domain business rules must not depend on the mechanics of tenant database selection.
8. Background jobs, scheduled tasks, and integrations must preserve tenant context.
9. Ensure transactions cannot accidentally cross tenant boundaries.
10. Tenant isolation must be covered by automated tests.

Preserve the existing multi-tenant and multi-branch functionality.

---

### 9. TRANSACTION AND DATA CONSISTENCY MANAGEMENT

Introduce a consistent transaction management abstraction.

Requirements:

- Use transactions for operations that require atomicity.
- Keep transaction implementation inside infrastructure.
- Allow application use cases to coordinate transaction boundaries.
- Ensure repositories participating in a transaction use the same transaction context.
- Avoid scattered transaction handling across controllers and services.
- Handle rollback and failure scenarios correctly.
- Preserve idempotency where required.
- Use appropriate outbox patterns for reliable event publication where necessary.

Pay particular attention to:

- Patient registration and billing.
- Invoice generation and payments.
- Inventory receiving and stock adjustments.
- Accounting journals.
- Result validation and release.
- Payroll processing.

Do not introduce distributed transactions or microservices unnecessarily.

---

### 10. ERROR HANDLING AND VALIDATION

Establish a consistent error-handling architecture.

Separate:

- Domain exceptions.
- Application exceptions.
- Infrastructure exceptions.
- Authentication and authorization errors.
- Validation errors.
- HTTP presentation errors.

Database-specific exceptions must not leak into the domain.

Implement centralized exception mapping at the application/presentation boundary.

Avoid generic catch blocks that hide errors or silently return success.

Validation must occur at appropriate boundaries:

- Request validation at presentation.
- Application input validation at use-case boundaries where necessary.
- Domain invariant validation inside domain objects.

Do not duplicate the same validation logic unnecessarily across every layer.

---

### 11. DEPENDENCY INJECTION AND COMPOSITION ROOT

Establish a clear dependency injection strategy.

Requirements:

1. Dependencies must be injected rather than instantiated randomly throughout business logic.
2. Application services must receive their dependencies through constructors or an equivalent explicit mechanism.
3. Concrete infrastructure implementations must be registered at the application's composition root.
4. Domain classes must not instantiate database connections.
5. Avoid global service locators and hidden dependencies.
6. Make dependencies explicit and easy to replace during testing.

---

### 12. LANGUAGE-INDEPENDENT DESIGN AND FUTURE PORTABILITY

This is one of the most important objectives.

Design the architecture so that the business logic can eventually be reimplemented in Go, Rust, C#, Java, or another language.

Do not build an architecture that is unnecessarily tied to TypeScript or Node.js.

Establish the following standards:

- Use technology-neutral domain concepts.
- Keep business rules independent of framework APIs.
- Define clear application input and output contracts.
- Keep persistence contracts independent of SQL implementation.
- Keep external integration contracts independent of their providers.
- Avoid passing framework-specific objects across architectural boundaries.
- Avoid exposing database query builders outside infrastructure.
- Avoid using JavaScript-specific behavior as an implicit business rule.
- Define explicit data types and business invariants.
- Document important business workflows independently of implementation details.
- Use stable, explicit API and event contracts.

The objective is not to make all languages look identical.

The objective is to make the architecture and business behavior understandable and reproducible in another language without carrying over unnecessary implementation dependencies.

---

### 13. TESTING ARCHITECTURE

Establish a testing strategy across all architectural layers.

**Domain tests**

- Entity behavior.
- Business invariants.
- Value objects.
- Domain services.

**Application tests**

- Use-case execution.
- Repository contract interactions.
- Authorization decisions.
- Transaction coordination.
- Failure scenarios.

**Infrastructure tests**

- Repository implementations.
- Database queries.
- Transaction behavior.
- Tenant isolation.
- External integrations.

**Integration tests**

- Cross-module workflows.
- Database consistency.
- API-to-application interactions.

**End-to-end tests**

- Critical user workflows.

Use mocks or fakes appropriately, but do not rely exclusively on mocked tests.

Critical database and multi-tenant behavior must also be tested against a real test database.

---

### 14. CODE QUALITY AND NAMING CONVENTIONS

Establish consistent naming conventions.

Examples:

- RegisterPatientUseCase.
- PatientRepository.
- MySqlPatientRepository.
- Patient.
- PatientId.
- RegisterPatientInput.
- RegisterPatientResult.
- PatientController.
- PatientRoutes.

Avoid ambiguous names such as:

- CommonService.
- GeneralHelper.
- MainRepository.
- DataManager.
- GlobalUtility.
- MiscellaneousFunctions.

Use meaningful names that describe responsibilities.

Keep classes and functions focused.

Avoid:

- God classes.
- God services.
- Circular imports.
- Deeply coupled modules.
- Excessive inheritance.
- Unnecessary abstractions.
- Duplicate business logic.
- Magic values.
- Hidden side effects.
- Large files containing unrelated responsibilities.

Do not introduce abstraction merely to increase the number of files.

Every abstraction must have a clear architectural purpose.

---

### 15. TARGET DIRECTORY STRUCTURE

Evaluate the existing project and establish a consistent modular structure.

A conceptual example:

```
src/
  modules/
    patients/
      domain/
        entities/
        value-objects/
        services/
        events/
        repositories/
        exceptions/

      application/
        use-cases/
        services/
        dto/
        ports/

      infrastructure/
        persistence/
          repositories/
          models/
          mappers/
        integrations/

      presentation/
        controllers/
        routes/
        validators/
        mappers/

      patients.module.ts

    billing/
      domain/
      application/
      infrastructure/
      presentation/

    inventory/
      domain/
      application/
      infrastructure/
      presentation/

  shared/
    domain/
    application/
    infrastructure/

  bootstrap/
    dependency-injection/
    configuration/

  tests/
```

This is a conceptual structure, not an instruction to copy it blindly.

Adapt it to the existing application, module complexity, and current framework.

Avoid turning shared into a dumping ground for unrelated code.

---

### 16. STRICT REFACTORING RULES

Follow these rules throughout the modernization process:

1. Do not rewrite the entire application in one operation.
2. Do not delete working functionality.
3. Do not modify business rules unless an existing defect is identified and documented.
4. Do not change API contracts unnecessarily.
5. Do not change database schemas without a documented migration plan.
6. Do not introduce breaking changes without approval.
7. Do not replace existing dependencies simply because another library is available.
8. Do not introduce microservices merely to achieve separation of concerns.
9. Do not create unnecessary interfaces or abstraction layers.
10. Do not leave partially migrated modules in an inconsistent state.
11. Do not create placeholder architecture that is never implemented.
12. Preserve existing authentication, authorization, tenant isolation, and transaction behavior.
13. Ensure existing tests pass before and after each migration.
14. Document architectural decisions and trade-offs.

Maintain backward compatibility wherever reasonably possible.

---

### 17. REQUIRED EXECUTION PHASES

Execute the project in clearly defined phases.

**PHASE 1 — Architectural Audit**

Inspect the entire existing codebase.

Identify:

- Services containing database queries.
- Entities mixed with interfaces.
- DTOs mixed with persistence models.
- Controllers containing business logic.
- Infrastructure dependencies leaking into business logic.
- Circular dependencies.
- Large classes and oversized services.
- Duplicate business logic.
- Poor module boundaries.
- Inconsistent error handling.
- Missing transaction boundaries.
- Multi-tenant isolation weaknesses.
- Testing gaps.

Produce an architectural assessment report.

Do not begin large-scale modifications during this phase.

**PHASE 2 — Architecture Blueprint**

Design the target architecture.

Provide:

- Proposed folder structure.
- Layer responsibilities.
- Module boundaries.
- Dependency direction.
- Repository contracts.
- Application use-case patterns.
- Transaction strategy.
- Dependency injection strategy.
- Testing strategy.
- Migration strategy.

Produce an Architecture Decision Record (ADR) explaining the selected architecture and why it is appropriate for PLS.

**PHASE 3 — Establish Architectural Foundations**

Implement the shared architectural foundations.

Examples:

- Dependency injection.
- Repository conventions.
- Transaction abstractions.
- Error handling.
- Logging.
- Validation conventions.
- Tenant context.
- Testing infrastructure.

Do not create abstractions without an immediate, identifiable use case.

**PHASE 4 — Progressive Module Refactoring**

Refactor modules individually.

For each module:

1. Audit existing implementation.
2. Identify architectural violations.
3. Define domain responsibilities.
4. Separate entities, interfaces, DTOs, and persistence models.
5. Extract database queries into repositories.
6. Refactor services into focused application use cases.
7. Isolate external dependencies.
8. Implement appropriate dependency injection.
9. Add or update tests.
10. Verify existing functionality.
11. Document important architectural changes.

Prioritize modules with the highest architectural risk and dependency impact.

**PHASE 5 — Architecture Enforcement**

Introduce automated quality controls.

Where appropriate, enforce:

- Import boundary rules.
- Dependency direction.
- Circular dependency detection.
- Type checking.
- Linting.
- Test coverage for critical workflows.
- Architecture tests.
- Consistent formatting.
- Build verification.

Prevent new architectural violations from entering the codebase.

**PHASE 6 — Final Architectural Review**

Perform a second comprehensive audit.

Verify that the refactored system meets the intended architecture.

Produce a final report documenting:

- Completed refactoring.
- Remaining violations.
- Architectural improvements.
- Technical debt.
- Test results.
- Compatibility risks.
- Future migration considerations.

---

### 18. DEFINITION OF DONE

A module should not be considered architecturally refactored until:

- Domain logic is independent of infrastructure.
- Application services contain no direct database queries.
- Repository implementations own database access.
- Entities are separated from persistence models where appropriate.
- Controllers are thin.
- Dependencies point in the correct direction.
- Interfaces have meaningful responsibilities.
- Transactions are correctly managed.
- Tenant isolation is preserved.
- Business rules remain intact.
- Automated tests cover critical behavior.
- The module has no unintended circular dependencies.
- Its public contracts are documented.
- The module can be understood independently of its underlying database and framework.

---

### 19. FINAL INSTRUCTION

Treat this as a long-term software engineering modernization project, not a cosmetic cleanup.

Be critical of the existing architecture.

Do not assume that existing patterns are correct simply because they are already being used.

However, do not blindly impose architectural patterns where they provide no practical benefit.

Prioritize correctness, maintainability, explicit dependencies, modularity, testability, and long-term portability.

**The ultimate objective is to make PLS a professionally structured software platform whose business logic is independent of its programming language, database, framework, and deployment environment.**

Begin with Phase 1: conduct a comprehensive architectural audit and present the findings before proposing or implementing major changes.

Do not proceed with large-scale refactoring until the architecture blueprint and migration strategy have been reviewed and approved.

## **My additional architectural recommendations for PLS**

There are five things I would pay particular attention to beyond the prompt.

### **1. Separate business logic from database technology**

Avoid

**Application service → Knex → MySQL**

Business logic is directly coupled to database implementation.

Recommended

**Application service → Repository interface → Repository implementation → Database**

You can replace Knex/MySQL without rewriting application business rules.

### **2. Use a modular monolith, not microservices**

I would not recommend breaking PLS into microservices just to improve architecture.

Keep one deployable backend initially, but enforce strong module boundaries.

This gives you:

- Easier development and deployment.
- Simpler transactions.
- Less network overhead.
- Better separation of business responsibilities.
- A future option to extract individual modules if necessary.

### **3. Make business workflows language-independent**

For example, consider patient billing.

The business workflow should be documented independently of TypeScript:

1. Receive patient billing request.
2. Identify patient and facility.
3. Determine applicable billing rules.
4. Calculate charges.
5. Create invoice.
6. Record applicable financial entries.
7. Return the invoice result.

Whether implemented in TypeScript, Go, Rust, or C#, the business behavior should remain consistent.

### **4. Introduce architecture tests**

Don't depend on developers remembering architectural rules.

Automate them.

For example:

| Rule                                              | Enforcement                   |
| ------------------------------------------------- | ----------------------------- |
| Domain cannot import Knex                         | Dependency rule               |
| Domain cannot import Express                      | Dependency rule               |
| Controllers cannot access repositories directly   | Architecture test             |
| Services cannot execute SQL                       | Code review + static analysis |
| No circular module dependencies                   | Automated dependency checker  |
| Repository implementations must satisfy contracts | Type checking and tests       |

### **5. Establish a permanent architecture contract**

This is particularly important.

After the refactoring, create a document such as:

`docs/architecture/ARCHITECTURE_CONTRACT.md`

Every future developer and AI coding agent must follow it.

Any new module, feature, endpoint, or database integration must comply with that contract.

## **My recommended implementation strategy**

I would use this sequence:

1. **Audit the entire backend**

   Identify architectural violations without changing existing functionality.
2. **Design and approve the target architecture**

   Establish the folder structure, dependency rules, module boundaries, and conventions.
3. **Refactor one representative module**

   Patient Management would be a good starting point because it can establish the patterns for other modules.
4. **Validate the architecture**

   Ensure the implementation is genuinely following Clean Architecture and SOLID.
5. **Apply the approved pattern across the remaining modules**

   Refactor incrementally, with tests and regression checks.
6. **Enforce the architecture permanently**

   Add automated checks and require architectural compliance for future development.

**One important point:** Don't instruct your AI agent to refactor everything immediately. Let it inspect the entire codebase, understand existing dependencies, produce the architectural blueprint, and obtain your approval first.

That will reduce the risk of damaging working PLS functionality while improving the underlying engineering quality.

The real target is not simply a better-organized TypeScript project. It is a well-defined software system whose business logic can survive a transition from TypeScript to Go or Rust without having to redesign the entire application.