// ==========================================
// 1. CONSTANTS BASE (Dades reals ajustades ITB, Barcelona i JSON)
// ==========================================

// --- ECONOMIA I INFLACIÓ ---
const ANY_BASE = 2024;
const IPC_MITJA = 0.031;

const PREU_KWH_COMPRA = 0.18;
const PREU_LITRE_AIGUA = 0.0025;

// --- ELECTRICITAT (Consum) ---
const BASE_ELEC_CONS_LECTIU = 472; // kWh/dia lectiu
const BASE_ELEC_CONS_FESTIU = 192; // kWh/dia tancat

// --- ENERGIA SOLAR (Dades Reals Confirmades) ---
const POTENCIA_TOTAL_KWP = 30.94;
const NUM_PANEL_ACTUAL = 136;
const BASE_ELEC_GEN_DIARIA_MITJANA = 45.37; // Dada exacta de generació: kWh/dia mitjana

// --- AIGUA ---
const BASE_AIGUA_LECTIU = 5000;
const BASE_AIGUA_FESTIU = 100;

// --- MATERIAL (Oficina i Neteja) ---
const BASE_MAT_EUROS = 12;
const BASE_MAT_UNITATS = 15;
const BASE_NETEJA_EUROS = 5;
const BASE_NETEJA_LITRES = 2;

// --- FUNCIÓ DE SEGURETAT ---
function safeSetText(id, text) {
    let element = document.getElementById(id);
    if (element) {
        element.innerText = text;
    }
}

// ==========================================
// 2. FUNCIÓ DE CALENDARI
// ==========================================
function analitzarDies(start, end) {
    let lectius = 0;
    let festius = 0;
    let current = new Date(start);
    let endDate = new Date(end);

    while (current <= endDate) {
        let diaSetmana = current.getDay();
        let mes = current.getMonth();

        if (diaSetmana === 0 || diaSetmana === 6 || mes === 6 || mes === 7) {
            festius++;
        } else {
            lectius++;
        }
        current.setDate(current.getDate() + 1);
    }
    return { lectius, festius, total: lectius + festius };
}

// ==========================================
// 3. DISPARADORS DE L'HTML
// ==========================================
function calcularResultats() {
    let start = document.getElementById("startDate").value;
    let end = document.getElementById("endDate").value;

    if(!start || !end) return alert("Si us plau, selecciona les dates d'inici i fi.");

    let targetYear = new Date(end).getFullYear();
    let diesPeriod = analitzarDies(start, end);

    executarCalculsPrincipals(diesPeriod, "period", targetYear);
    calcularProximAnyOcult();
}

function calcularProximAny() {
    calcularProximAnyOcult();
    alert("S'ha actualitzat la projecció per als propers 365 dies basant-nos en el dia d'avui.");
}

function calcularProximAnyOcult() {
    let startYear = new Date();
    let endYear = new Date();
    endYear.setFullYear(startYear.getFullYear() + 1);

    let diesYear = analitzarDies(startYear, endYear);
    executarCalculsPrincipals(diesYear, "year", endYear.getFullYear());
}

// ==========================================
// 4. LÒGICA MATEMÀTICA I ACTUALITZACIÓ DOM
// ==========================================
function obtenirMultiplicadorIPC(anyFi) {
    if (anyFi > ANY_BASE) {
        return Math.pow(1 + IPC_MITJA, (anyFi - ANY_BASE));
    }
    return 1.0;
}

// A) Calcula Balanç Energètic Actual
function executarCalculsPrincipals(dies, tipus, anyFi) {
    let ipc = obtenirMultiplicadorIPC(anyFi);

    if (tipus === "period") {
        let alertBox = document.getElementById("ipc-alert");
        if (alertBox) {
            if (anyFi > ANY_BASE) {
                let percentatge = ((ipc - 1) * 100).toFixed(1);
                safeSetText("ipc-percentage", percentatge);
                safeSetText("ipc-year", anyFi);
                alertBox.style.display = "block";
            } else {
                alertBox.style.display = "none";
            }
        }
    }

    // Consum Total
    let consElecLectiu = dies.lectius * BASE_ELEC_CONS_LECTIU;
    let consElecFestiu = dies.festius * BASE_ELEC_CONS_FESTIU;
    let totalConsumElec = consElecLectiu + consElecFestiu;

    // Generació Total Real
    let totalGeneracioElec = dies.total * BASE_ELEC_GEN_DIARIA_MITJANA;
    let genElecLectiu = dies.lectius * BASE_ELEC_GEN_DIARIA_MITJANA;

    // Balanç Net
    let totalNetElecCompraKwh = totalConsumElec - totalGeneracioElec;
    if (totalNetElecCompraKwh < 0) totalNetElecCompraKwh = 0;

    let percCompensatLectiu = consElecLectiu > 0 ? (genElecLectiu / consElecLectiu) * 100 : 0;
    if (percCompensatLectiu > 100) percCompensatLectiu = 100;

    // Altres Impactes
    let totalAiguaLitres = (dies.lectius * BASE_AIGUA_LECTIU) + (dies.festius * BASE_AIGUA_FESTIU);
    let totalMatUnitats = dies.lectius * BASE_MAT_UNITATS;
    let totalNetejaLitres = (dies.lectius * BASE_NETEJA_LITRES) + (dies.festius * (BASE_NETEJA_LITRES * 0.2));

    let totalNetElecEuros = (totalNetElecCompraKwh * PREU_KWH_COMPRA) * ipc;
    let totalAiguaEuros = (totalAiguaLitres * PREU_LITRE_AIGUA) * ipc;
    let totalMatEuros = (dies.lectius * BASE_MAT_EUROS) * ipc;
    let totalNetejaEuros = ((dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * (BASE_NETEJA_EUROS * 0.2))) * ipc;

    let costTicTotalActualEuros = totalNetElecEuros + totalAiguaEuros + totalMatEuros + totalNetejaEuros;

    // Actualitzar DOM principal
    safeSetText(`elec-cons-${tipus}`, totalConsumElec.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`elec-gen-${tipus}`, totalGeneracioElec.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`elec-net-${tipus}`, totalNetElecCompraKwh.toLocaleString('ca-ES', {maximumFractionDigits: 0}));

    if (tipus === "period") {
        safeSetText(`elec-comp-perc`, percCompensatLectiu.toLocaleString('ca-ES', {maximumFractionDigits: 0}));

        // Cridem el pla de reducció passant l'import total I TAMBÉ l'import específic d'electricitat
        calcularPlaReduccio30Realistic(costTicTotalActualEuros, totalNetElecEuros, dies, ipc);
    }

    safeSetText(`water-${tipus}`, totalAiguaLitres.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`mat-${tipus}-unit`, totalMatUnitats.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`mat-${tipus}-eur`, totalMatEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
    safeSetText(`clean-${tipus}-l`, totalNetejaLitres.toLocaleString('ca-ES', {maximumFractionDigits: 1}));
    safeSetText(`clean-${tipus}-eur`, totalNetejaEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
}

// B) Pla de Reducció Sectoritzat (La solució definitiva)
function calcularPlaReduccio30Realistic(costTicTotalActualEuros, totalNetElecEuros, dies, ipc) {

    // --- L'OBJECTIU ---
    // Ara l'objectiu que han de suplir les plaques és reduir un 30% DE LA FACTURA DE LA LLUM exclusivament.
    let estalviObjectiuElectricitatEuros = totalNetElecEuros * 0.30;

    // Mostrem a l'HTML que aquest euro d'estalvi és específicament de llum
    safeSetText("savings-needed-eur", estalviObjectiuElectricitatEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2}) + " (Només de llum)");

    // --- LES ESTRATÈGIES ---
    let factorEficienciaLlum = 0.95; // 5% d'estalvi apagant ordinadors i llums innecessàries
    let factorPolitiquesAiguaMaterial = 0.70; // 30% d'estalvi en aigua i paper per polítiques internes

    // 1. Càlcul de la nova electricitat amb els hàbits d'estalvi
    let consElecLectiuReduitKwh = (dies.lectius * BASE_ELEC_CONS_LECTIU) * factorEficienciaLlum;
    let consElecFestiuKwh = dies.festius * BASE_ELEC_CONS_FESTIU;
    let totalConsumElecReduitKwh = consElecLectiuReduitKwh + consElecFestiuKwh;

    // 2. Càlcul de la nova aigua/materials amb les polítiques del 30%
    let totalAiguaReduitLitres = ((dies.lectius * BASE_AIGUA_LECTIU) + (dies.festius * BASE_AIGUA_FESTIU)) * factorPolitiquesAiguaMaterial;
    let totalAiguaReduitEuros = (totalAiguaReduitLitres * PREU_LITRE_AIGUA) * ipc;

    let totalMatReduitEuros = (dies.lectius * BASE_MAT_EUROS) * factorPolitiquesAiguaMaterial * ipc;
    let totalNetejaReduitEuros = ((dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * (BASE_NETEJA_EUROS * 0.2))) * factorPolitiquesAiguaMaterial * ipc;

    // 3. Revisió del balanç elèctric
    let totalGeneracioElecKwh = dies.total * BASE_ELEC_GEN_DIARIA_MITJANA;

    let totalNetElecCompraReduitKwh = totalConsumElecReduitKwh - totalGeneracioElecKwh;
    if (totalNetElecCompraReduitKwh < 0) totalNetElecCompraReduitKwh = 0;

    let totalNetElecReduitEuros = (totalNetElecCompraReduitKwh * PREU_KWH_COMPRA) * ipc;

    // Cost total de l'institut completament reduït per totes les bandes
    let costTicTotalReduitEurosEficiencia = totalNetElecReduitEuros + totalAiguaReduitEuros + totalMatReduitEuros + totalNetejaReduitEuros;

    // --- CÀLCUL DE LES PLAQUES (Només pel dèficit elèctric) ---
    // Estalvi ELÈCTRIC aconseguit només aplicant el 5% d'hàbits eficients
    let estalviElectricAconseguitEuros = totalNetElecEuros - totalNetElecReduitEuros;

    // El que ens falta per arribar al 30% d'estalvi de la llum
    let estalviPendentEuros = estalviObjectiuElectricitatEuros - estalviElectricAconseguitEuros;
    if (estalviPendentEuros < 0) estalviPendentEuros = 0;

    // Convertim els euros pendents de llum en kWh extra necessaris de les plaques
    let kwhExtraNecessaris = estalviPendentEuros / (PREU_KWH_COMPRA * ipc);

    // Càlcul de plaques extra necessàries de manera realista
    let genPerPanellDiaria = BASE_ELEC_GEN_DIARIA_MITJANA / NUM_PANEL_ACTUAL; // ~0.33 kWh/dia per placa
    let genPerPanellPeriodo = genPerPanellDiaria * dies.total;

    let numPanelsExtraNeeded = genPerPanellPeriodo > 0 ? kwhExtraNecessaris / genPerPanellPeriodo : 0;
    let percAugmentTeulada = NUM_PANEL_ACTUAL > 0 ? (numPanelsExtraNeeded / NUM_PANEL_ACTUAL) * 100 : 0;
    let groupsNeeded = numPanelsExtraNeeded / 4;

    // Actualització final de resultats verds
    safeSetText("total-cost-reduced-eur", costTicTotalReduitEurosEficiencia.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
    safeSetText("extra-generation-needed-kwh", kwhExtraNecessaris.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText("extra-panels-needed-count", numPanelsExtraNeeded.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText("extra-panels-perc", percAugmentTeulada.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText("groups-needed-count", groupsNeeded.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
}

window.onload = calcularResultats;