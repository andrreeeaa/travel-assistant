const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
// Permitem front-end-ului să comunice cu acest back-end
app.use(cors());
app.use(express.json());

// incarcam meniul cu tool-uri din fisierul json
const descriereMetode = JSON.parse(fs.readFileSync('tooldescriptions.json', 'utf8'));
const URL_RDF = 'http://localhost:8080/rdf4j-server/repositories/grafexamen';
const URL_JSON_SERVER = 'http://localhost:4000';
const URL_GRAPHQL = 'http://localhost:3000';

// RUTE
// o singura ruta principala pt toate cererile JSON-RPC
// cererile json-rpc se executa la o singura adresa
// in corpul cererii (body) se afla un doc json care spune ce trebuie facut
app.post('/mcp-server', async (req, res) => {
    // extragem datele json din corpul cererii trimis de frontend
    const cerere = req.body;

    // extragem metoda, clientul spune ce vrea
    // metodele standard sunt "tools/list" și "tools/call"
    const metodaRpc = cerere.method;

    // Extragem ID-ul. JSON-RPC obligă fiecare cerere să aibă un ID, sa stie clientul la care intrebare i s-a raspuns
    const idRpc = cerere.id;

    // Cazul 1: trimite lista de tool-uri disponobile catre mcp client
    if (metodaRpc === 'tools/list') {
        return res.json({
            jsonrpc: "2.0", //versiunea protocolului 
            id: idRpc, //ecou la id-ul primit (serverul raspunde inapoi cu id-ul dat)
            result: descriereMetode //trimitem continutul din toolsdescription.json
        });
    }

    // Cazul 2: MCP Client cere executarea unui tool (tools/call)
    if (metodaRpc === 'tools/call') {
        //extragem numele uneltei dorite din parametrii cererii
        const numeTool = cerere.params.name;
        const argumente = cerere.params.arguments || {}

        try{
            let rezultatRdf;

            // verificam daca unealta ceruta este cea de zboruri
            if(numeTool === 'getZboruriDupaDestinatie'){
                // apelam functia sa aduca datele din serverul rdf
                rezultatRdf = await getZboruriDupaDestinatie(argumente.destinatie);
            } 
            // verificam daca unealta ceruta este cea de a adauga zboruri
            else if(numeTool === 'adaugaZbor') {
                // apelam functia
                rezultatRdf = await adaugaZbor(argumente);
            } 
            else if (numeTool === 'getHotelsDupaOras'){
                rezultatRdf = await getHotelsDupaOras(argumente.oras);
            }
            else if (numeTool === 'adaugaHotel') {
                rezultatRdf = await adaugaHotel(argumente);
            }
            else if(numeTool === 'getAtractiiDupaOras'){
                rezultatRdf = await getAtractiiDupaOras(argumente.oras);
            }
            else if(numeTool === 'adaugaAtractie'){
                rezultatRdf = await adaugaAtractie(argumente);
            }
            else {
                // daca nu se cere niciuna dintre metode, ci cu totul altceva, trimite 404 
                return res.status(404).json({ eroare: "Tool necunoscut" });
            }

            // impachetam rezultatul venit in format json-rpc si il trimitem
            return res.json({
                jsonrpc: "2.0",
                id: idRpc,
                result: rezultatRdf
            });

        } catch (err){
            // eroare la server
            return res.status(500).json({
                jsonrpc: "2.0",
                id: idRpc,
                error: { code: -32000, message: "Eroare server: " + err.message }
            });
        }
    }
});

// Obs: Aceasta ruta post e un fel de dispecer care citeste cererea json-rpc si deleaga munca functiilor din spate

//  ==== Tool 1: citire cu filtrare dupa destinatie ===
async function getZboruriDupaDestinatie(destinatie){
    // daca nu s-a dat nicio destinatie, returnam toate zborurile
    let filtru;
    if(destinatie){
        // daca s-a dat o destinatie, construieste filtru sparql, daca nu, lasa filtru gol
        // LCASE - transforma in lowercase valoarea din graf (stanga) si val data de user (dreapta) 
        //${destinatie} = javascript care insereaza val variabilei in string
        //Acum filtrul caută atât în orașul destinație cât și în țară — deci "Spania", "Barcelona" și "Madrid" vor găsi zboruri!
        filtru = `FILTER(LCASE(?destinatie) = LCASE("${destinatie}") || 
                    LCASE(?tara) = LCASE("${destinatie}"))`;
    } else {
        filtru = '';
    }

    const query = `
        PREFIX : <http://andreeaene.ro#>
        PREFIX schema: <http://schema.org/>

        SELECT ?zborLabel ?origine ?destinatie ?tara ?pret ?durata ?modelAvion ?companie
        WHERE {
            GRAPH :zboruri {
                ?zbor a schema:Flight ;
                    schema:name ?zborLabel ;
                    :esteOperatDe ?avion ;
                    schema:arrivalLocation ?destinatie ;
                    schema:departureLocation ?origine ;
                    schema:price ?pret ;
                    schema:duration ?durata .
                OPTIONAL { ?zbor :taraDestinatie ?tara }
                ${filtru}
            }
            GRAPH :flota {
                ?avion schema:brand ?companie ;
                    :model ?modelAvion .
            }
        }`;

        const raspuns = await fetch(URL_RDF, { //du-te la adresa url, trimite o cerere http la o adresa
            method: 'POST', //cum transmitem: prin post -> trimitem informatii (interogarea)
            headers: { //conditiile noastre; antele=regulile de comunicare
                'Content-Type': 'application/sparql-query', //continutul de tip sparql query
                'Accept': 'application/sparql-results+json' //returnarea rezultatului se va face in format json
            },
            //body = corpul cererii
            body: query //ce cerem mai exact, comanda propriu-zisa
        });

        // transforma raspunsul in obiecte js
        // in utilizare cu fetch, metoda .json() returneaza un promise
        // aici json() apartine de fetch api
        const date = await raspuns.json();
        // depanare raspuns de la server
        //console.log("Date brute de la RDF4J:", JSON.stringify(date, null, 2));

        // Curățăm JSON-ul
        // cream un nou array cu datele modificate
        return date.results.bindings.map(item => ({
            // if-else ternar
            // condition ? exprIfTrue : exprIfFalse
            // if elem x exista, accesam campul value din interiorul ei ("[http://exemplu.ro/Avion](http://exemplu.ro/Avion)"), else pune string gol pt a nu bloca programul
            zbor: item.zborLabel?.value || 'Necunoscut',
            origine: item.origine?.value || 'Necunoscuta',
            destinatie: item.destinatie?.value || 'Necunoscuta',
            tara: item.tara?.value || 'Necunoscuta',
            pretBilet: item.pret?.value || '0',
            durata: item.durata?.value || '0',
            avion: item.modelAvion?.value || 'Necunoscut',
            companie: item.companie?.value || 'Necunoscuta'
        }));

}

// === TOOL 2: scriere - adauga zbor nou ====
async function adaugaZbor(zbor){
    // date.now() expr current time in milisecunde
    // folosim pentru a genera un id unic
    //Pentru că în RDF nu există autoincrementare ca în SQL. Nu există un mecanism built-in care stie care a fost ultimul id/cursa
    const idNou = 'Cursa' + Date.now()

    const updateQuery = `
        PREFIX : <http://andreeaene.ro#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        INSERT DATA {
            GRAPH :zboruri {
                :${idNou} a :Zbor;
                        rdfs:label "${zbor.label}";
                        :esteOperatDe :${zbor.avionId};
                        :destinatie "${zbor.destinatie}";
                        :origine "${zbor.origine}";
                        :pretBilet ${zbor.pretBilet};
                        :durata ${zbor.durata}.
            }
        }
    `;

    // '/statements' = adresa specială pentru operații de scriere în RDF4J
    const raspuns = await fetch(URL_RDF + '/statements', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/sparql-update' //ce trimitem
        },
        body: updateQuery //interogarea sparql
    });

    //fetch() returnează un obiect numit Response care conține informații despre ce a răspuns serverul. Unul din câmpurile acestui obiect e .ok
    // true - daca serverul a rasp cu succes, false - daca a aparut o eroare
    if (raspuns.ok) {
        return { succes: true, mesaj: `Zborul ${idNou} a fost adaugat cu succes.` };
    } else {
        throw new Error("Inserarea a esuat cu status: " + raspuns.status); //codul http numeric
    }
}

// ==== TOOL 3: returneaza hotelurile in funct de destinatie ====
async function getHotelsDupaOras(oras){
    //construim URL-ul pentru JSON server
    // daca s-a dat un oras, filtram, altfel aducem toate hotelurile
    let url;
    if(oras){
        url = `${URL_JSON_SERVER}/hotels?city=${encodeURIComponent(oras)}`;
    } else {
        url = `${URL_JSON_SERVER}/hotels`;
    }
    // aducem lista de hoteluri
    const raspuns = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    // transforma raspunsul in array de obiecte js; returneaza un promise
    const hoteluri = await raspuns.json();

    // cream array-ul gol in care vom pune rezultatele
    const rezultat = [];

    // pt fiecare hotel, aducem si camerele libere
    for (const hotel of hoteluri) {
        const listaCamere = await fetch(`${URL_JSON_SERVER}/rooms?hotelId=${hotel.id}&available=true`);
        // transforma in obiecte js
        const camere = await listaCamere.json();

        // construim obiectul hotelului cu datele combinate - un soi de join
        //  si il adaugam in array-ul rezultat
        rezultat.push({
            nume: hotel.name,
            oras: hotel.city,
            tara: hotel.country,
            stele: hotel.stars,
            //pretPeNoapte: hotel.pricePerNight,
            camereDisponibile: camere.length,
            tipuriCamere: camere.map(cam => `${cam.type} (${cam.pricePerNight} euro/noapte)`).join(', ')
            //map() extrage tipurile
            //join() unește toate elementele din array într-un string, cu separatorul specificat între ele: "single, double, suite"
        })
    }

    return rezultat;
}

async function adaugaHotel(hotel) {
    const raspuns = await fetch(`${URL_JSON_SERVER}/hotels`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: hotel.nume,
            city: hotel.oras,
            country: hotel.tara,
            stars: hotel.stele,
            pricePerNight: hotel.pretPeNoapte
        })
    });

    if (raspuns.ok) {
        const hotelNou = await raspuns.json();
        return {
            succes: true,
            mesaj: `Hotelul ${hotelNou.name} din ${hotelNou.city} a fost adaugat cu succes.`,
            id: hotelNou.id
        };
    } else {
        throw new Error("Adaugarea hotelului a esuat cu status: " + raspuns.status);
    }
}

async function getAtractiiDupaOras(oras){
    let interogare;

    if (oras) {
        // cautam mai intai id-ul destinatiei dupa numele orasului
        interogare = {
            query: `{
                allDestinations(filter: { city: "${oras}" }) {
                    id
                    city
                    country
                    language
                    currency
                }
            }`
        };
    } else {
        // daca nu s-a dat oras, aducem toate destinatiile
        interogare = {
            query: `{
                allDestinations {
                    id
                    city
                    country
                    language
                    currency
                }
            }`
        };
    }

    // trimitem interogarea GraphQL
    const raspunsDestinatie = await fetch(URL_GRAPHQL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(interogare)
    });

    const dateDestinatie = await raspunsDestinatie.json();
    const destinatii = dateDestinatie.data.allDestinations;

    // daca nu s-a gasit nicio destinatie
    if (destinatii.length === 0) {
        return { mesaj: `Nu am gasit destinatia ${oras}.` };
    }

    // cream array-ul gol in care vom pune rezultatele
    const rezultat = [];

    // pentru fiecare destinatie aducem atractiile
    for (const destinatie of destinatii) {
        const interogareAtractii = {
            query: `{
                allAttractions(filter: { destination_id: ${destinatie.id} }) {
                    name
                    type
                    priceEuro
                    rating
                }
            }`
        };

        const raspunsAtractii = await fetch(URL_GRAPHQL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(interogareAtractii)
        });

        const dateAtractii = await raspunsAtractii.json();
        const atractii = dateAtractii.data.allAttractions;

        // adaugam destinatia cu atractiile ei in rezultat
        rezultat.push({
            oras: destinatie.city,
            tara: destinatie.country,
            limba: destinatie.language,
            moneda: destinatie.currency,
            atractii: atractii.map(a => ({
                nume: a.name,
                tip: a.type,
                pretEuro: a.priceEuro,
                rating: a.rating
            }))
        });
    }

    return rezultat;
}

async function adaugaAtractie(args){
    const interogare = {
        query: `mutation {
            createAttraction(
                destination_id: ${args.destinationId},
                name: "${args.nume}",
                type: "${args.tip}",
                priceEuro: ${args.pretEuro},
                rating: ${args.rating}
            ) {
                id
                name
                type
                priceEuro
                rating
            }
        }`
    };

    const raspuns = await fetch(URL_GRAPHQL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(interogare)
    });

    //Transformăm răspunsul în obiect JavaScript utilizabil.
    const date = await raspuns.json();

    //daca există câmpul data în răspuns si daca există atracția nou creată în răspuns
    if (date.data && date.data.createAttraction) {
        const atractieNoua = date.data.createAttraction;
        return {
            succes: true,
            mesaj: `Atractia ${atractieNoua.name} a fost adaugata cu succes.`,
            id: atractieNoua.id
        };
    } else {
        throw new Error("Adaugarea atractiei a esuat: " + JSON.stringify(date.errors));
    }
}

// Pornim serverul pe portul 3000
app.listen(7000, () => {
    console.log('MCP Server rulează cu succes pe http://localhost:7000/mcp-server');
});