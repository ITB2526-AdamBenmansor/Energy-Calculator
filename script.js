// ==========================================
// 1. CONSTANTS BASE (Dades reals ajustades ITB, Barcelona i JSON)
// ==========================================
const ANY_BASE = 2024;
const IPC_HISTORIC = [3.1, 5.7, 3.1, -0.5, 2.5, 3.1];

const PREU_KWH_COMPRA = 0.18;
const PREU_LITRE_AIGUA = 0.0025;

const BASE_ELEC_CONS_LECTIU = 472;
const BASE_ELEC_CONS_FESTIU = 192;

const POTENCIA_TOTAL_KWP = 30.94;
const NUM_PANEL_ACTUAL = 136;
const BASE_ELEC_GEN_DIARIA_MITJANA = 45.37;

const BASE_AIGUA_LECTIU = 5000;
const BASE_AIGUA_FESTIU = 100;

const BASE_MAT_EUROS = 12;
const BASE_MAT_UNITATS = 15;
const BASE_NETEJA_EUROS = 5;
const BASE_NETEJA_LITRES = 2;

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

        // Caps de setmana (0, 6) i juliol (6), agost (7) es consideren festius
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

    if(!start || !end) return;

    let targetYear = new Date(end).getFullYear();
    let diesPeriod = analitzarDies(start, end);

    executarCalculsPrincipals(diesPeriod, "period", targetYear);
    calcularProximAnyOcult();
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

// Algorisme de predicció d'IPC (WMA)
function predirIPCAny(anyObjectiu) {
    if (anyObjectiu <= ANY_BASE) return 0;
    let dades = [...IPC_HISTORIC];
    let anySimulat = ANY_BASE;

    while (anySimulat < anyObjectiu) {
        let n = dades.length;
        let prediccioSeguentAny = (dades[n-1] * 0.5) + (dades[n-2] * 0.3) + (dades[n-3] * 0.2);
        dades.push(prediccioSeguentAny);
        anySimulat++;
    }
    return dades[dades.length - 1] / 100;
}

function obtenirMultiplicadorIPC(anyFi) {
    if (anyFi <= ANY_BASE) return 1.0;
    return 1 + predirIPCAny(anyFi);
}

// A) Calcula Balanç Energètic Actual (EL TEU CODI INTACTE)
function executarCalculsPrincipals(dies, tipus, anyFi) {
    let ipc = obtenirMultiplicadorIPC(anyFi);

    if (tipus === "period") {
        let alertBox = document.getElementById("ipc-alert");
        if (alertBox) {
            if (anyFi > ANY_BASE) {
                let percentatge = ((ipc - 1) * 100).toFixed(2);
                safeSetText("ipc-percentage", percentatge);
                safeSetText("ipc-year", anyFi);
                alertBox.style.display = "block";
            } else {
                alertBox.style.display = "none";
            }
        }
    }

    let consElecLectiu = dies.lectius * BASE_ELEC_CONS_LECTIU;
    let consElecFestiu = dies.festius * BASE_ELEC_CONS_FESTIU;
    let totalConsumElec = consElecLectiu + consElecFestiu;

    let totalGeneracioElec = dies.total * BASE_ELEC_GEN_DIARIA_MITJANA;
    let genElecLectiu = dies.lectius * BASE_ELEC_GEN_DIARIA_MITJANA;

    let totalNetElecCompraKwh = totalConsumElec - totalGeneracioElec;
    if (totalNetElecCompraKwh < 0) totalNetElecCompraKwh = 0;

    let percCompensatLectiu = consElecLectiu > 0 ? (genElecLectiu / consElecLectiu) * 100 : 0;
    if (percCompensatLectiu > 100) percCompensatLectiu = 100;

    let totalAiguaLitres = (dies.lectius * BASE_AIGUA_LECTIU) + (dies.festius * BASE_AIGUA_FESTIU);
    let totalMatUnitats = dies.lectius * BASE_MAT_UNITATS;
    let totalNetejaLitres = (dies.lectius * BASE_NETEJA_LITRES) + (dies.festius * (BASE_NETEJA_LITRES * 0.2));

    let totalNetElecEuros = (totalNetElecCompraKwh * PREU_KWH_COMPRA) * ipc;
    let totalAiguaEuros = (totalAiguaLitres * PREU_LITRE_AIGUA) * ipc;
    let totalMatEuros = (dies.lectius * BASE_MAT_EUROS) * ipc;
    let totalNetejaEuros = ((dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * (BASE_NETEJA_EUROS * 0.2))) * ipc;

    let costTicTotalActualEuros = totalNetElecEuros + totalAiguaEuros + totalMatEuros + totalNetejaEuros;

    safeSetText(`elec-cons-${tipus}`, totalConsumElec.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`elec-gen-${tipus}`, totalGeneracioElec.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`elec-net-${tipus}`, totalNetElecCompraKwh.toLocaleString('ca-ES', {maximumFractionDigits: 0}));

    if (tipus === "period") {
        safeSetText(`elec-comp-perc`, percCompensatLectiu.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
        // Cridem el pla de reducció
        calcularPlaReduccio30Realistic(costTicTotalActualEuros, totalNetElecEuros, dies, ipc);
    }

    safeSetText(`water-${tipus}`, totalAiguaLitres.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`mat-${tipus}-unit`, totalMatUnitats.toLocaleString('ca-ES', {maximumFractionDigits: 0}));
    safeSetText(`mat-${tipus}-eur`, totalMatEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
    safeSetText(`clean-${tipus}-l`, totalNetejaLitres.toLocaleString('ca-ES', {maximumFractionDigits: 1}));
    safeSetText(`clean-${tipus}-eur`, totalNetejaEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
}

// ==========================================
// 5. PLA DE REDUCCIÓ INTERACTIU
// ==========================================
const LLISTA_MESURES = {
    "elec": [
        { id: "chk-elec-1", impacte: 0.12 },
        { id: "chk-elec-2", impacte: 0.10 },
        { id: "chk-elec-3", impacte: 0.08 }
    ],
    "aigua": [
        { id: "chk-wat-1", impacte: 0.20 },
        { id: "chk-wat-2", impacte: 0.10 }
    ],
    "material": [
        { id: "chk-mat-1", impacte: 0.20 },
        { id: "chk-mat-2", impacte: 0.10 }
    ],
    "neteja": [
        { id: "chk-cle-1", impacte: 0.15 },
        { id: "chk-cle-2", impacte: 0.15 }
    ]
};

function calcularPlaReduccio30Realistic(costTicTotalActualEuros, totalNetElecEuros, dies, ipc) {
    let baseAiguaEuros = (dies.lectius * BASE_AIGUA_LECTIU + dies.festius * BASE_AIGUA_FESTIU) * PREU_LITRE_AIGUA * ipc;
    let baseMatEuros = (dies.lectius * BASE_MAT_EUROS) * ipc;
    let baseNetejaEuros = ((dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * (BASE_NETEJA_EUROS * 0.2))) * ipc;

    const calcularImpacteCategoria = (categoria) => {
        return LLISTA_MESURES[categoria].reduce((acc, m) => {
            let el = document.getElementById(m.id);
            return (el && el.checked) ? acc + m.impacte : acc;
        }, 0);
    };

    let estalviElecEuros = totalNetElecEuros * calcularImpacteCategoria("elec");
    let estalviAiguaEuros = baseAiguaEuros * calcularImpacteCategoria("aigua");
    let estalviMatEuros = baseMatEuros * calcularImpacteCategoria("material");
    let estalviNetejaEuros = baseNetejaEuros * calcularImpacteCategoria("neteja");

    let totalEstalviAconseguitEuros = estalviElecEuros + estalviAiguaEuros + estalviMatEuros + estalviNetejaEuros;
    let nouCostTotal = costTicTotalActualEuros - totalEstalviAconseguitEuros;
    let percentatgeEstalviTotal = costTicTotalActualEuros > 0 ? (totalEstalviAconseguitEuros / costTicTotalActualEuros) * 100 : 0;

    let kwhPendent = (totalNetElecEuros - estalviElecEuros) / (PREU_KWH_COMPRA * ipc);
    let genPerPanellPeriodo = (BASE_ELEC_GEN_DIARIA_MITJANA / NUM_PANEL_ACTUAL) * dies.total;
    let numPanelsExtraNeeded = genPerPanellPeriodo > 0 ? kwhPendent / genPerPanellPeriodo : 0;

    safeSetText("savings-needed-eur", totalEstalviAconseguitEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
    safeSetText("extra-panels-perc", percentatgeEstalviTotal.toLocaleString('ca-ES', {maximumFractionDigits: 1}));
    safeSetText("total-cost-reduced-eur", nouCostTotal.toLocaleString('ca-ES', {maximumFractionDigits: 2}));
    safeSetText("extra-panels-needed-count", Math.max(0, Math.ceil(numPanelsExtraNeeded)));
}

// Iniciar tot al carregar la pàgina
window.onload = function() {
    calcularResultats();
};
