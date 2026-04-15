import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingDeadlines, btwAangiftes, belastingTips } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// POST /api/belasting/seed — Seeds deadlines + BTW aangiftes for 2026 and 2027
export async function POST() {
  try {
    await requireAuth();

    const jaren = [2026, 2027];
    const resultaat: { deadlines: number; aangiftes: number } = { deadlines: 0, aangiftes: 0 };

    for (const jaar of jaren) {
      // ---- DEADLINES ----
      const bestaandeDeadlines = await db
        .select()
        .from(belastingDeadlines)
        .where(eq(belastingDeadlines.jaar, jaar))
        ;

      if (bestaandeDeadlines.length === 0) {
        const deadlinesToCreate: {
          type: "btw" | "inkomstenbelasting" | "icp" | "kvk_publicatie";
          omschrijving: string;
          datum: string;
          kwartaal: number | null;
          jaar: number;
        }[] = [
          {
            type: "btw",
            omschrijving: `BTW aangifte Q1 ${jaar}`,
            datum: `${jaar}-04-30`,
            kwartaal: 1,
            jaar,
          },
          {
            type: "btw",
            omschrijving: `BTW aangifte Q2 ${jaar}`,
            datum: `${jaar}-07-31`,
            kwartaal: 2,
            jaar,
          },
          {
            type: "btw",
            omschrijving: `BTW aangifte Q3 ${jaar}`,
            datum: `${jaar}-10-31`,
            kwartaal: 3,
            jaar,
          },
          {
            type: "btw",
            omschrijving: `BTW aangifte Q4 ${jaar}`,
            datum: `${jaar + 1}-01-31`,
            kwartaal: 4,
            jaar,
          },
          {
            type: "inkomstenbelasting",
            omschrijving: `Inkomstenbelasting ${jaar}`,
            datum: `${jaar + 1}-05-01`,
            kwartaal: null,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q1 ${jaar}`,
            datum: `${jaar}-04-30`,
            kwartaal: 1,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q2 ${jaar}`,
            datum: `${jaar}-07-31`,
            kwartaal: 2,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q3 ${jaar}`,
            datum: `${jaar}-10-31`,
            kwartaal: 3,
            jaar,
          },
          {
            type: "icp",
            omschrijving: `ICP opgave Q4 ${jaar}`,
            datum: `${jaar + 1}-01-31`,
            kwartaal: 4,
            jaar,
          },
          // KvK publicatieplicht geldt alleen voor BV's en NV's, NIET voor
          // eenmanszaak/VOF. Autronis is een VOF dus deze deadline is niet
          // van toepassing en wordt bewust niet geseed.
        ];

        for (const deadline of deadlinesToCreate) {
          await db.insert(belastingDeadlines).values(deadline).run();
          resultaat.deadlines++;
        }
      }

      // ---- BTW AANGIFTES ----
      const bestaandeAangiftes = await db
        .select()
        .from(btwAangiftes)
        .where(eq(btwAangiftes.jaar, jaar))
        ;

      if (bestaandeAangiftes.length === 0) {
        for (let kwartaal = 1; kwartaal <= 4; kwartaal++) {
          await db.insert(btwAangiftes).values({
            kwartaal,
            jaar,
            btwOntvangen: 0,
            btwBetaald: 0,
            btwAfdragen: 0,
            status: "open",
          }).run();
          resultaat.aangiftes++;
        }
      }
    }

    // ---- BELASTING TIPS ----
    const bestaandeTips = await db.select({ id: belastingTips.id }).from(belastingTips);

    let tipsAangemaakt = 0;
    if (bestaandeTips.length === 0) {
      const initialTips: {
        categorie: "aftrekpost" | "regeling" | "subsidie" | "optimalisatie" | "weetje";
        titel: string;
        beschrijving: string;
        voordeel: string | null;
        bron: string | null;
        bronNaam: string | null;
      }[] = [
        // --- Aftrekposten ---
        {
          categorie: "aftrekpost",
          titel: "Zelfstandigenaftrek",
          beschrijving: "Als je minimaal 1.225 uur per jaar aan je onderneming besteedt, heb je recht op de zelfstandigenaftrek. Dit bedrag wordt afgetrokken van je winst voordat belasting wordt berekend.",
          voordeel: "€3.750 aftrek op je winst (2026)",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/zelfstandigenaftrek",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "aftrekpost",
          titel: "Startersaftrek",
          beschrijving: "In de eerste 5 jaar als ondernemer mag je in maximaal 3 jaar de startersaftrek toepassen, bovenop de zelfstandigenaftrek. Voorwaarde: je voldoet aan het urencriterium.",
          voordeel: "€2.123 extra aftrek bovenop zelfstandigenaftrek",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/startersaftrek",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "aftrekpost",
          titel: "MKB-winstvrijstelling",
          beschrijving: "14% van je winst (na aftrek van ondernemersaftrek) is vrijgesteld van inkomstenbelasting. Dit geldt automatisch voor alle IB-ondernemers, ongeacht het urencriterium.",
          voordeel: "14% van je winst is belastingvrij",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/mkb-winstvrijstelling",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "aftrekpost",
          titel: "Kleinschaligheidsinvesteringsaftrek (KIA)",
          beschrijving: "Bij investeringen tussen €2.801 en €69.764 per jaar in bedrijfsmiddelen krijg je een extra aftrekpost. Het percentage hangt af van het totale investeringsbedrag.",
          voordeel: "Tot 28% extra aftrek op investeringen",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/kleinschaligheidsinvesteringsaftrek",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "aftrekpost",
          titel: "Kilometervergoeding zakelijk verkeer",
          beschrijving: "Voor zakelijke ritten met je privéauto mag je €0,23 per km aftrekken. Houd een rittenregistratie bij met datum, begin/eindadres, kilometers en zakelijk doel.",
          voordeel: "€0,23 per zakelijke kilometer",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/auto/content/wat-zijn-de-autokosten-die-ik-mag-aftrekken",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "aftrekpost",
          titel: "Werkruimte in eigen woning",
          beschrijving: "Als je een werkruimte hebt die een zelfstandig deel van je woning vormt (eigen ingang, eigen sanitair) én je er minimaal 70% van je inkomen verdient, kun je kosten aftrekken.",
          voordeel: "Deel van huur/hypotheek + energiekosten aftrekbaar",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/werkruimte-in-de-eigen-woning",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "aftrekpost",
          titel: "Fiscale oudedagsreserve (FOR)",
          beschrijving: "Je mag jaarlijks 9,44% van je winst toevoegen aan je FOR (max €10.320 in 2026). Dit verlaagt je belastbare winst nu, maar je betaalt later belasting bij opname.",
          voordeel: "Max €10.320 uitgestelde belasting per jaar",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/fiscale-oudedagsreserve",
          bronNaam: "Belastingdienst",
        },
        // --- Regelingen ---
        {
          categorie: "regeling",
          titel: "Willekeurige afschrijving starters",
          beschrijving: "Als starter mag je in het eerste jaar tot 75% van de investering in één keer afschrijven. Dit kan flink schelen in je belastbaar inkomen als je grote aankopen doet.",
          voordeel: "Tot 75% versneld afschrijven in jaar 1",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/willekeurige-afschrijving-starters",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "regeling",
          titel: "Voorlopige aanslag aanvragen",
          beschrijving: "Vraag een voorlopige aanslag aan om belasting in maandelijkse termijnen te betalen. Zo voorkom je een grote naheffing en kun je bij te veel betalen geld terugkrijgen.",
          voordeel: "Belasting in termijnen betalen, geen naheffing",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/voorlopige-aanslag/content/voorlopige-aanslag-aanvragen-of-wijzigen",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "regeling",
          titel: "Kleineondernemersregeling (KOR)",
          beschrijving: "Bij een omzet onder €20.000 per jaar kun je vrijstelling van BTW aanvragen. Je brengt dan geen BTW in rekening maar kunt ook geen BTW aftrekken.",
          voordeel: "Geen BTW-administratie bij omzet < €20.000",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/btw/content/kleine-ondernemersregeling-kor",
          bronNaam: "Belastingdienst",
        },
        // --- Subsidies ---
        {
          categorie: "subsidie",
          titel: "WBSO (R&D aftrek)",
          beschrijving: "De WBSO geeft loonkostenaftrek voor technisch onderzoek en softwareontwikkeling. Als ZZP'er krijg je een vaste aftrek per S&O-uur. Aanvragen vóór het kwartaal begint.",
          voordeel: "Tot 32% loonkostenaftrek + vaste aftrek",
          bron: "https://www.rvo.nl/subsidies-financiering/wbso",
          bronNaam: "RVO",
        },
        {
          categorie: "subsidie",
          titel: "Innovatiebox",
          beschrijving: "Winst uit innovatieve activiteiten (waarvoor je WBSO hebt) wordt belast tegen een effectief tarief van 9% in plaats van het normale tarief. Aanvragen via je aangifte.",
          voordeel: "9% belasting in plaats van 37,07%/49,50%",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/innovatiebox",
          bronNaam: "Belastingdienst",
        },
        // --- Optimalisatie ---
        {
          categorie: "optimalisatie",
          titel: "Investeer strategisch rond jaareinde",
          beschrijving: "Plan grotere aankopen (laptop, software) zo dat je totaal boven €2.801 uitkomt voor KIA-aftrek. Maar spreid over jaren als je anders boven €69.764 komt.",
          voordeel: "Maximaal profiteren van KIA-aftrek",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/kleinschaligheidsinvesteringsaftrek",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "optimalisatie",
          titel: "Reserveer maandelijks voor belasting",
          beschrijving: "Zet elke maand 30-35% van je winst apart op een aparte spaarrekening. Zo heb je nooit een vervelende verrassing bij de definitieve aanslag.",
          voordeel: "Geen financiële stress bij aanslag",
          bron: null,
          bronNaam: null,
        },
        {
          categorie: "optimalisatie",
          titel: "Houd je uren nauwkeurig bij",
          beschrijving: "Het urencriterium (1.225 uur/jaar) is essentieel voor de zelfstandigenaftrek en startersaftrek. Tel ook acquisitie, administratie en scholing mee — niet alleen facturabele uren.",
          voordeel: "Toegang tot €3.750+ aan aftrekposten",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/urencriterium",
          bronNaam: "Belastingdienst",
        },
        // --- Weetjes ---
        {
          categorie: "weetje",
          titel: "Zakelijke verzekeringen zijn aftrekbaar",
          beschrijving: "Je AOV (arbeidsongeschiktheidsverzekering), bedrijfsaansprakelijkheidsverzekering en rechtsbijstandverzekering zijn volledig aftrekbaar als bedrijfskosten.",
          voordeel: "100% aftrekbaar als bedrijfskosten",
          bron: null,
          bronNaam: null,
        },
        {
          categorie: "weetje",
          titel: "Bewaarplicht administratie: 7 jaar",
          beschrijving: "Je bent wettelijk verplicht je administratie 7 jaar te bewaren. Dit geldt voor facturen, bankafschriften, contracten en BTW-aangiftes. Digitaal bewaren mag.",
          voordeel: "Voorkom boetes bij controle",
          bron: "https://www.belastingdienst.nl/wps/wcm/connect/nl/ondernemers/content/hoe-lang-moet-ik-mijn-administratie-bewaren",
          bronNaam: "Belastingdienst",
        },
        {
          categorie: "weetje",
          titel: "Scholingskosten zijn aftrekbaar",
          beschrijving: "Kosten voor cursussen, trainingen, vakliteratuur en congressen die zakelijk relevant zijn, mag je volledig aftrekken als bedrijfskosten.",
          voordeel: "100% aftrekbaar als bedrijfskosten",
          bron: null,
          bronNaam: null,
        },
      ];

      for (const tip of initialTips) {
        await db.insert(belastingTips).values({
          ...tip,
          isAiGegenereerd: 0,
        }).run();
        tipsAangemaakt++;
      }
    }

    return NextResponse.json({
      succes: true,
      bericht: `${resultaat.deadlines} deadlines, ${resultaat.aangiftes} BTW aangiftes en ${tipsAangemaakt} belastingtips aangemaakt.`,
      resultaat: { ...resultaat, tips: tipsAangemaakt },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
