# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-02-01

### Added
- **Pagination support** for all list/query functions:
  - `bridge_list_tasks` - Added `offset` parameter for paginated task listing
  - `bridge_get_history` - Added `offset` parameter for paginated history retrieval
  - `bridge_get_events` - Added `offset` parameter for paginated audit log access
  - `bridge_list_sessions` - Added `offset` parameter for paginated session listing

### Technical Details
- Updated database queries to support SQL `OFFSET` clause
- Updated TypeScript interfaces: `ListTasksParams`, `GetHistoryParams`
- Updated Zod validation schemas for all affected tools
- Pagination allows navigating large datasets by skipping N records

### Example Usage
```typescript
// Get first page (tasks 1-50)
bridge_list_tasks({ limit: 50, offset: 0 })

// Get second page (tasks 51-100)
bridge_list_tasks({ limit: 50, offset: 50 })

// Get third page (tasks 101-150)
bridge_list_tasks({ limit: 50, offset: 100 })
```

## [0.1.0] - Initial Release

### Features
- Task queue with priority-based ordering and dependencies
- Shared state management between architect and executor agents
- Session context for pause/resume functionality
- Clarification system for inter-agent communication
- Project-specific data isolation via SQLite databases
- Audit logging for all state changes
