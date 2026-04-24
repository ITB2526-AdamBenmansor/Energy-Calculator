// Configuració Global de Chart.js
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
Chart.defaults.color = '#86868b';

const CONFIG = {
    ANY_BASE: 2024,
    PREU_KWH: 0.18,
    PREU_AIGUA: 0.0025,
    CONS_ELEC: { LECTIU: 472, FESTIU: 192, GEN_SOLAR: 45.37 },
    CONS_AIGUA: { LECTIU: 5000, FESTIU: 500 },
    COST_FIX_DIARI: { MAT: 12, NETEJA: 5 },
    INVERSIO_INICIAL: 2500 
};

let mainChart = null;

function getVal(id) { return document.getElementById(id); }

function calcularResultats() {
    const startInput = getVal("startDate");
    const endInput = getVal("endDate");

    // 1. BLINDAJE DE FECHAS: Nada antes del 1 de enero de 2024
    if (startInput.value < "2024-01-01") startInput.value = "2024-01-01";
    if (endInput.value < "2024-01-01") endInput.value = "2024-01-01";

    // 2. BLINDAJE LÓGICO: La fecha de inicio no puede ser posterior a la de fin
    if (startInput.value > endInput.value) {
        endInput.value = startInput.value; // Ajusta la fecha final para que tenga sentido
    }

    const dIni = new Date(startInput.value);
    const dFi = new Date(endInput.value);
    
    if (isNaN(dIni) || isNaN(dFi)) return;

    // Càlcul de dies
    let lectius = 0, festius = 0, totalDies = 0;
    let curr = new Date(dIni);
    while (curr <= dFi) {
        const d = curr.getDay();
        const m = curr.getMonth();
        if (d === 0 || d === 6 || m === 6 || m === 7) festius++; else lectius++;
        totalDies++;
        curr.setDate(curr.getDate() + 1);
    }

    // Projecció IPC
    const anyFi = dFi.getFullYear();
    let ipcFactor = 1;
    if (anyFi > CONFIG.ANY_BASE) {
        const ipcPrediccio = 0.028;
        ipcFactor = 1 + ipcPrediccio;
        getVal("ipc-percentage").innerText = (ipcPrediccio * 100).toFixed(1);
        getVal("ipc-year").innerText = anyFi;
        getVal("ipc-alert").style.display = "block";
    } else {
        getVal("ipc-alert").style.display = "none";
    }

    // Consums Base
    const kwhConsum = (lectius * CONFIG.CONS_ELEC.LECTIU) + (festius * CONFIG.CONS_ELEC.FESTIU);
    const kwhGen = totalDies * CONFIG.CONS_ELEC.GEN_SOLAR;
    const kwhNet = Math.max(0, kwhConsum - kwhGen);
    const lAigua = (lectius * CONFIG.CONS_AIGUA.LECTIU) + (festius * CONFIG.CONS_AIGUA.FESTIU);

    const costElec = kwhNet * CONFIG.PREU_KWH * ipcFactor;
    const costAigua = lAigua * CONFIG.PREU_AIGUA * ipcFactor;
    const costMat = lectius * CONFIG.COST_FIX_DIARI.MAT * ipcFactor;
    const costNet = (lectius * CONFIG.COST_FIX_DIARI.NETEJA) * ipcFactor;
    const costTotalBase = costElec + costAigua + costMat + costNet;

    // Actualitzar UI Base
    getVal("base-elec-kwh").innerText = Math.round(kwhNet).toLocaleString('ca-ES');
    getVal("base-elec-eur").innerText = costElec.toFixed(2) + " €";
    getVal("base-aigua-l").innerText = Math.round(lAigua).toLocaleString('ca-ES');
    getVal("base-aigua-eur").innerText = costAigua.toFixed(2) + " €";
    getVal("base-mat-eur").innerText = costMat.toFixed(2) + " €";
    getVal("base-clean-eur").innerText = costNet.toFixed(2) + " €";

    // Càlcul Estalvi (Checkboxes)
    const getSum = (cls) => Array.from(document.querySelectorAll('.'+cls+':checked')).reduce((a,b) => a + parseFloat(b.value), 0);
    
    const pE = getSum('cb-elec') / 100;
    const pA = getSum('cb-aigua') / 100;
    const pM = getSum('cb-mat') / 100;
    const pN = getSum('cb-net') / 100;

    const estalvi = (costElec * pE) + (costAigua * pA) + (costMat * pM) + (costNet * pN);
    const costFinal = costTotalBase - estalvi;

    getVal("savings-needed-eur").innerText = estalvi.toLocaleString('ca-ES', {maximumFractionDigits:2}) + " €";
    getVal("extra-panels-perc").innerText = costTotalBase > 0 ? ((estalvi/costTotalBase)*100).toFixed(1) + "%" : "0%";

    // ROI
    const estalviAnual = totalDies > 0 ? (estalvi / totalDies) * 365 : 0;
    const anysROI = estalviAnual > 0 ? (CONFIG.INVERSIO_INICIAL / estalviAnual) : 0;
    getVal("roi-years").innerText = estalvi > 0 ? anysROI.toFixed(1) : "0";

    // Gràfic
    updateChart(dIni, dFi, costTotalBase, costFinal);
}

function updateChart(dIni, dFi, totalBase, totalReduit) {
    const ctx = getVal('lineChart').getContext('2d');
    if (mainChart) mainChart.destroy();

    const months = []; const d1 = []; const d2 = [];
    let curr = new Date(dIni);
    
    // Assegurem que l'eix de les X no es trenqui si les dates són idèntiques
    if (dIni.getTime() === dFi.getTime()) {
        months.push(dIni.toLocaleString('ca-ES', { month: 'short' }) + " " + dIni.getFullYear().toString().slice(-2));
        d1.push(totalBase);
        d2.push(totalReduit);
    } else {
        while (curr <= dFi) {
            const label = curr.toLocaleString('ca-ES', { month: 'short' }) + " " + curr.getFullYear().toString().slice(-2);
            if (!months.includes(label)) months.push(label);
            curr.setMonth(curr.getMonth() + 1);
        }

        const basePerMonth = totalBase / Math.max(1, months.length);
        const reduitPerMonth = totalReduit / Math.max(1, months.length);

        months.forEach((label, i) => {
            // AQUÍ ESTÁ EL ARREGLO: Lógica estacional basada en el nombre del mes
            const isSummer = label.toLowerCase().includes('jul') || label.toLowerCase().includes('ag');
            const isWinter = label.toLowerCase().includes('gen') || label.toLowerCase().includes('des') || label.toLowerCase().includes('febr') || label.toLowerCase().includes('nov');

            let mod = 1.0;
            if (isSummer) {
                mod = 0.35; // Caída drástica en vacaciones (Julio/Agosto)
            } else if (isWinter) {
                mod = 1.25; // Pico de consumo en invierno (calefacción/luces)
            } else {
                mod = 1.05; // Curso normal
            }

            d1.push(basePerMonth * mod);
            d2.push(reduitPerMonth * mod);
        });
    }

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                { label: 'Base', data: d1, borderColor: '#86868b', tension: 0.4 },
                { label: 'Amb Mesures', data: d2, borderColor: '#30d158', backgroundColor: 'rgba(48, 209, 88, 0.1)', fill: true, tension: 0.4, borderWidth: 3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
        }
    });
}

// Funcions del Modal "Sobre el projecte"
function openModal() { document.getElementById('aboutModal').style.display = 'flex'; }
function closeModal() { document.getElementById('aboutModal').style.display = 'none'; }
window.onclick = function(event) {
    const modal = document.getElementById('aboutModal');
    if (event.target == modal) closeModal();
}

window.onload = calcularResultats;