# Asistent de Călătorie — Proiect Web Semantic
 
Un asistent de călătorie inteligent care combină 3 surse de date semantice cu un LLM (OpenAI GPT-4o-mini) prin arhitectura MCP (Model Context Protocol). Utilizatorul poate întreba în limbaj natural despre zboruri, hoteluri și atracții turistice.
 
---
 
## Arhitectura
 
```
Utilizator (limbaj natural)
        │
        ▼
index.html (Front-end)
        │ fetch POST
        ▼
client.js — MCP Client (port 5000)
        │
        ├── OpenAI GPT-4o-mini (ce tool să folosesc?)
        │
        ├── server.js — MCP Server (port 7000) prin JSON-RPC
        │       │
        │       ├── RDF4J (port 8080) — interogări SPARQL
        │       ├── JSON-Server (port 4000) — REST API
        │       └── JSON-GraphQL-Server (port 3000) — GraphQL
        │
        └── OpenAI GPT-4o-mini (formulează răspuns natural)
```
 
---
 
## Surse de date
 
### 1. RDF4J — Aeronave și Zboruri
- **Tehnologie:** Bază de grafuri RDF, interogări SPARQL
- **Fișier date:** `date_zboruri.trig` (format TriG cu grafuri numite)
- **Grafuri:** `:flota` (aeronave) și `:zboruri` (curse)
- **Terminologie:** Schema.org (`schema:Flight`, `schema:Vehicle`, `schema:price` etc.)
- **Relație:** one-to-many — un avion operează mai multe curse
### 2. JSON-Server — Hoteluri și Camere
- **Tehnologie:** REST API simulat cu JSON-Server
- **Fișier date:** `data-rest.json`
- **Entități:** `hotels` și `rooms`
- **Relație:** one-to-many — un hotel are mai multe tipuri de camere
- **Port:** 4000 (obligatoriu conform cerințelor)
### 3. JSON-GraphQL-Server — Destinații și Atracții Turistice
- **Tehnologie:** GraphQL
- **Fișier date:** `date_graphql.json`
- **Entități:** `destinations` și `attractions`
- **Relație:** one-to-many — o destinație are mai multe atracții turistice
- **Port:** 3000 (obligatoriu conform cerințelor)
---
 
## Tool-uri MCP disponibile
 
| Tool | Server | Tip | Descriere |
|---|---|---|---|
| `getZboruriDupaDestinatie` | RDF4J | Citire | Caută zboruri după oraș sau țară |
| `adaugaZbor` | RDF4J | Scriere | Adaugă un zbor nou |
| `getHotelsDupaOras` | JSON-Server | Citire | Caută hoteluri după oraș sau țară |
| `adaugaHotel` | JSON-Server | Scriere | Adaugă un hotel nou |
| `getAtractiiDupaOras` | GraphQL | Citire | Caută atracții turistice după oraș |
| `adaugaAtractie` | GraphQL | Scriere | Adaugă o atracție turistică nouă |
 
---
 
## Instalare și pornire
 
### Cerințe
- Node.js (versiunea LTS)
- RDF4J Server instalat local
- Cont OpenAI cu API key
### 1. Clonează repository-ul
```bash
git clone https://github.com/username/asistent-calatorie.git
cd asistent-calatorie
```
 
### 2. Instalează dependențele
```bash
cd backend
npm install
```
 
### 3. Instalează serverele globale
```bash
npm install -g json-server@0.17.4
npm install -g json-graphql-server
```
 
### 4. Configurează variabilele de mediu
Creează fișierul `backend/.env`:
```
API_KEY_OPENAI=sk-proj-cheia-ta-openai
```
 
### 5. Pornește toate serverele (câte un terminal separat)
 
**Terminal 1 — RDF4J**
```bash
# din folderul de instalare RDF4J
bin\server.bat        # Windows
./bin/server.sh       # Mac/Linux
```
Apoi importă `date_zboruri.trig` în repository-ul `grafexamen` din RDF4J Workbench (`http://localhost:8080`).
 
**Terminal 2 — JSON-Server**
```bash
cd backend
json-server --watch data-rest.json --port 4000
```
 
**Terminal 3 — JSON-GraphQL-Server**
```bash
cd backend
json-graphql-server date_graphql.json
```
 
**Terminal 4 — MCP Server**
```bash
cd backend
node server.js
```
 
**Terminal 5 — MCP Client**
```bash
cd backend
node client.js
```
 
### 6. Deschide front-end-ul
Deschide `frontend/index.html` în Chrome.
 
---
 
## 💬 Exemple de prompturi
 
```
"Ce zboruri sunt spre Paris?"
"Care este cea mai ieftină cazare din Roma?"
"Ce atracții turistice sunt în Londra?"
"Există curse spre Spania?"
"Vreau să merg la Paris — ce zboruri, hoteluri și atracții îmi recomanzi?"
"Adaugă un zbor nou: Cursa 501 București-Viena, preț 130 euro, durată 90 minute, operat de Avion2"
```
 
---
 
## Structura proiect
 
```
proiect/
├── backend/
│   ├── server.js             # MCP Server (port 7000)
│   ├── client.js             # MCP Client (port 5000)
│   ├── tooldescriptions.json # Descrierea tool-urilor pentru LLM
│   ├── data-rest.json        # Date hoteluri și camere (JSON-Server)
│   └── date_graphql.json     # Date destinații și atracții (GraphQL)
├── frontend/
│   └── index.html            # Interfața utilizator
└── date_zboruri.trig         # Date aeronave și zboruri (RDF4J)
```
 
---
 
## Tehnologii folosite
 
| Tehnologie | Rol |
|---|---|
| Node.js + Express | MCP Server și MCP Client |
| OpenAI GPT-4o-mini | Selecție tool-uri și formulare răspuns natural |
| RDF4J | Bază de grafuri semantice |
| SPARQL | Limbaj de interogare pentru RDF4J |
| JSON-Server | Server REST pentru hoteluri |
| JSON-GraphQL-Server | Server GraphQL pentru atracții turistice |
| JSON-RPC | Protocol de comunicare MCP Client ↔ MCP Server |
| Schema.org | Terminologie standardizată pentru datele RDF |
| CORS | Cross-Origin Resource Sharing pentru front-end |
 
---
 
## Funcționalități
 
- **Limbaj natural** — utilizatorul scrie în română fără comenzi speciale
- **3 surse de date** — RDF4J, REST și GraphQL interogate simultan
- **Tool calling** — OpenAI decide automat ce funcție să apeleze
- **Răspuns natural** — datele brute sunt reformulate în propoziții clare
- **Adăugare date** — utilizatorul poate adăuga zboruri, hoteluri și atracții
- **Filtrare flexibilă** — după oraș SAU țară (ex: "Paris" sau "Franta")
