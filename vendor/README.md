# Vendored sql.js

Version: **sql.js 1.13.0**, containing **SQLite 3.49.1**.

Source: https://registry.npmjs.org/sql.js/-/sql.js-1.13.0.tgz

Official npm integrity (verified before extraction):

```text
sha512-RJbVP1HRDlUUXahJ7VMTcu9Rm1Nzw+EBpoPr94vnbD4LwR715F3CcxE2G2k45PewcaZ57pjetYa+LoSJLAASgA==
```

| File | Bytes | Package source |
| --- | ---: | --- |
| `sql-wasm.js` | 48,788 | `package/dist/sql-wasm.js` |
| `sql-wasm.wasm` | 659,806 | `package/dist/sql-wasm.wasm` |
| `LICENSE` | 2,199 | `package/LICENSE` |

License: MIT, copyright (c) 2017 sql.js authors. Preserve the full LICENSE
notice when embedding or redistributing the substantial JS/WASM assets.

## Offline single-file HTML

At build time, inline `sql-wasm.js` in an inert text script element and include
`sql-wasm.wasm` as a base64 string. At runtime, decode the base64 and pass the
bytes directly to the initializer inside a Blob Worker:

```javascript
const wasmBinary = Uint8Array.from(atob(WASM_BASE64), character => character.charCodeAt(0));
const SQL = await initSqlJs({ wasmBinary });
const database = new SQL.Database();
```

This path uses no fetch, CDN, external script, or localhost server. It is
suitable for opening the completed HTML from `file://` without a network.
The WASM base64 payload is 879,744 characters before wrapping.

Packaging precautions:

- Replace case-insensitive `</script` occurrences in embedded JavaScript with
  `<\/script`; HTML parsers end script elements even inside JS strings.
- Preserve the full MIT notice in the distributed HTML (an HTML comment or
  visible third-party notices section is sufficient).
- Initialization is asynchronous. Disable query controls until initialization
  and seed data loading finish; show an error if either fails.
- Do not add a restrictive CSP without permitting the inline scripts and WASM
  compilation. Modern CSP typically requires an inline hash/nonce plus
  `wasm-unsafe-eval`; older browser policies may require `unsafe-eval`.
- The course executes SQLite, not a MySQL server. Basic SELECT, WHERE, ORDER
  BY, INSERT, UPDATE and DELETE work, but MySQL-specific syntax may differ.

## Verification

Verified with Node v22.22.2. `global.fetch` was replaced with a function that
throws, and initialization used `wasmBinary: new Uint8Array(fs.readFileSync(...))`.
Initialization succeeded without fetching.

- `SELECT sqlite_version()` returned `3.49.1`.
- A `products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL)`
  table accepted four rows and `SELECT COUNT(*)` returned `4`.
- `SELECT name, price FROM products WHERE price >= 10 ORDER BY price DESC`
  returned `Desk, 120` followed by `Chair, 45`.

No npm installation or `node_modules` directory was used.
