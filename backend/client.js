const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const API_KEY_OPENAI = process.env.API_KEY_OPENAI;
const URL_GPT = "https://api.openai.com/v1/chat/completions";
const URL_MCP_SERVER = "http://localhost:7000/mcp-server";

const app = express();
app.use(cors());
app.use(express.json());

const descriereMetode = JSON.parse(fs.readFileSync('tooldescriptions.json', 'utf8'))

app.post('/api/chat', async (req, res) => {
    
    const userPrompt = req.body.prompt;
    console.log("Utilizatorul a întrebat:", userPrompt);

    try {
        const date = {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: userPrompt }],
            tools: descriereMetode.tools, 
            tool_choice: "auto"
        }

        const raspunsLLM1 = await fetch(URL_GPT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY_OPENAI}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(date)
        })

        const dateAI_1 = await raspunsLLM1.json();

        console.log("Răspunsul brut de la LLM:", dateAI_1);
        
        const recomandareTool = dateAI_1.choices[0].message.tool_calls;

        if (!recomandareTool) {
            return res.json({ raspuns: dateAI_1.choices[0].message.content });
        }
        const rezultateTooluri = [];

        for(const toolCall of recomandareTool){
            const numeTool = toolCall.function.name;

            const argumenteTool = JSON.parse(toolCall.function.arguments || '{}');

            console.log("Tool recomandat:", numeTool, "cu argumentele:", argumenteTool);

            const pachetJsonRpc = {
                jsonrpc: "2.0",
                method: "tools/call",
                params: { 
                    name: numeTool,
                    arguments: argumenteTool
                },
                id: 1
            };

            // raspunsul brut care vine de la server
            const raspunsServer = await fetch(URL_MCP_SERVER, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pachetJsonRpc)
            });

            //transformam datele in obiecte js utilizabile
            const dateServer = await raspunsServer.json();

            //preluam rezultatul cautat (array-ul de date) si il punem intr-o variabila
            const rezultateBrute = dateServer.result;

            console.log("3. Am primit datele de la baza de date.");
            console.log(`Rezultat de la ${numeTool}:`, rezultateBrute);

            //salvam rezultatul impreuna cu tool_call_id-ul
            // ca sa putem trimite inapoi la LLM raspunsul pentru fiecare tool
            rezultateTooluri.push({
                tool_call_id: toolCall.id,
                numeTool: numeTool,
                rezultat: rezultateBrute
            });

        }

        // Al 3-lea drum - a doua vizita catre AI (reformularea rasp)
        // C. cerem ai-ului sa formuleze o propozitie cu datele brute

        // trebuie sa includem un mesaj de tip "tool" pentru FIECARE tool executat
        const mesajeTooluri = rezultateTooluri.map(r => ({
            role: "tool",
            tool_call_id: r.tool_call_id,
            name: r.numeTool,
            content: JSON.stringify(r.rezultat) // Îi dăm datele brute de la server
        }));


        const pachetFinalCatreAI = { //pachetul de trimis
            model: "gpt-4o-mini",
            // reaminim ai-ului toata povestea: prompt, tool-ul pe care l-a ales mai devreme si ce date i-a dat serverul
            messages: [
                // 1. Îi dăm un ordin suprem să folosească datele noastre
                { 
                    role: "system", 
                    content: `Ești un asistent de călătorie complet.
                        Răspunde ÎNTOTDEAUNA în română, într-un limbaj natural și prietenos.
                        NU scrie niciodată cod sau markdown.
                        NU inventa NICIODATĂ informații — folosește STRICT datele primite de la unelte.
                        Dacă nu ai date despre ceva, spune că nu ai informații disponibile.
                        Preturile sunt intotdeauna in EURO, nu in lei.
                        
                        Ai acces la trei unelte obligatorii:
                        1. getZboruriDupaDestinatie — pentru zboruri
                        2. getHotelsDupaOras — pentru hoteluri
                        3. getAtractiiDupaOras — pentru atractii turistice`
                        
                        // Când utilizatorul întreabă despre o destinație, TREBUIE să folosești TOATE trei uneltele simultan.
                        
                        // Când prezinți zboruri:
                        // - Cursa [nume]: din [origine] spre [destinatie], pret [pret] euro, durata [durata] minute, operat de [companie] cu [avion].
                        // Când prezinți hoteluri:
                        // - [nume hotel] ([stele] stele): [oras], [pret] euro/noapte, camere disponibile: [tipuri].
                        // Când prezinți atracții:
                        // - [nume] ([tip]): [pret] euro, rating: [rating]/5.`
                },
                { role: "user", content: userPrompt },//reaminim promptul
                dateAI_1.choices[0].message, //reamintim ce a decis
                ...mesajeTooluri //spread operator, adauga toate mesajele de tool
            ]
        };

        // raspunsul "brut" de la a doua vizita la ai
        const raspunsLLM2 = await fetch(URL_GPT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY_OPENAI}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(pachetFinalCatreAI)
        });

        // transformam datele in obiecte js utilizabile
        const dateAI_2 = await raspunsLLM2.json();

        //salvam obiectul extras mai devreme intr-o variabila
        const raspunsFinalLLM = dateAI_2.choices[0].message.content;
        console.log("Răspunsul final a fost generat!");

        // Trimitem răspunsul final către Front-end
        res.json({ raspuns: raspunsFinalLLM });

    } catch (eroare) {
        console.error("A apărut o problemă:", eroare);
        res.status(500).json({ eroare: "Eroare la procesarea mesajului." });
    }
});

// Pornim MCP Client-ul pe portul 4000
app.listen(5000, () => {
    console.log('MCP Client rulează pe http://localhost:5000');
});