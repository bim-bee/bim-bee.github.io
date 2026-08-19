# Bimbee Profile Catalogue — grouped table prototype

Open `index.html` directly in a browser. No local server is required.

The visitor-facing table is ordered as:

- Category (sticky)
- Family (sticky)
- ID (sticky)
- Mass kg/m
- Area cm²
- Dimensions (one subcolumn per dimension field)
- Properties (one subcolumn per property field)

The `Developer columns` checkbox reveals the fields intentionally hidden from the visitor-facing view: designation, aliases, source, record status, data status, and raw source text.

Catalogue data remains bundled in `data/profiles-data.js` so direct `file://` opening works.
