# Database Migrations

Place idempotent migration files here using the format:
- `YYYYMMDDHHMM-description.js`

Each file should export:
```js
module.exports = {
  id: "202604031200-add-example-index",
  description: "Add example index",
  up: async ({ mongoose }) => {
    // migration logic
  }
};
```

Run with:
- `node backend/scripts/runMigrations.js`
