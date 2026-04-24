Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
Chart.defaults.color = '#86868b';

const ANY_BASE = 2024;
const IPC_HISTORIC = [3.1, 5.7, 3.1, -0.5, 2.5, 3.1];
const PREU_KWH_COMPRA = 0.18;
const PREU_LITRE_AIGUA = 0.0025;
const BASE_ELEC_CONS_LECTIU = 472;
const BASE_ELEC_CONS_FESTIU = 192;
const BASE_ELEC_GEN_DIARIA_MITJANA = 45.37; // Ho mantenim perquè és el que generen les plaques ACTUALS que ja teniu
const BASE_AIGUA_LECTIU = 5000;
const BASE_AIGUA_FESTIU = 500;
const BASE_MAT_EUROS = 12;
const BASE_NETEJA_EUROS = 5;

// CONSTANT INVERSIÓ (Per al ROI de la Fase 3)
// Pressupost estimat per implementar les mesures d'eficiència (sensors, LED, airejadors, etc.)
const COST_FIX_MILLORES = 2500;

let lineChartInst = null;

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function getCheckedSum(className) {
    let sum = 0;
    const checkboxes = document.querySelectorAll('.' + className + ':checked');
    checkboxes.forEach(cb => {
        sum += parseFloat(cb.value) || 0;
    });
    return sum;
}

function analitzarDies(start, end) {
    let lectius = 0, festius = 0;
    let curr = new Date(start);
    let finish = new Date(end);

    let loops = 0;
    while (curr <= finish && loops < 5000) {
        let d = curr.getDay();
        let m = curr.getMonth();
        // Diumenges (0), Dissabtes (6), Juliol (6), Agost (7) es compten com festius/baix consum global
        if (d === 0 || d === 6 || m === 6 || m === 7) {
            festius++;
        } else {
            lectius++;
        }
        curr.setDate(curr.getDate() + 1);
        loops++;
    }
    return { lectius, festius, total: lectius + festius };
}

function predirIPCAny(any) {
    if (any <= ANY_BASE) return 0;
    let d = [...IPC_HISTORIC];
    for (let i = ANY_BASE; i < any; i++) {
        let n = d.length;
        d.push((d[n-1]*0.5) + (d[n-2]*0.3) + (d[n-3]*0.2));
    }
    return d[d.length - 1] / 100;
}

function calcularResultats() {
    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;
    if(!start || !end) return;

    const dIni = new Date(start);
    const dFi = new Date(end);
    if (isNaN(dIni) || isNaN(dFi)) return;

    const anyFi = dFi.getFullYear();
    const dies = analitzarDies(start, end);
    const ipc = 1 + predirIPCAny(anyFi);

    const alertBox = document.getElementById("ipc-alert");
    if(alertBox) {
        if(anyFi > ANY_BASE) {
            safeSetText("ipc-percentage", ((ipc-1)*100).toFixed(1));
            safeSetText("ipc-year", anyFi);
            alertBox.style.display = "block";
        } else {
            alertBox.style.display = "none";
        }
    }

    const consElec = (dies.lectius * BASE_ELEC_CONS_LECTIU) + (dies.festius * BASE_ELEC_CONS_FESTIU);
    const genElec = dies.total * BASE_ELEC_GEN_DIARIA_MITJANA;
    const kwhNet = Math.max(0, consElec - genElec); // Restem el que generen les plaques ACTUALS
    const lAigua = (dies.lectius * BASE_AIGUA_LECTIU) + (dies.festius * BASE_AIGUA_FESTIU);

    const costElec = (kwhNet * PREU_KWH_COMPRA) * ipc;
    const costAigua = (lAigua * PREU_LITRE_AIGUA) * ipc;
    const costMat = (dies.lectius * BASE_MAT_EUROS) * ipc;
    const costNet = ((dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * 2)) * ipc;
    const costTotal = costElec + costAigua + costMat + costNet;

    safeSetText("base-elec-kwh", kwhNet.toLocaleString('ca-ES', {maximumFractionDigits:0}));
    safeSetText("base-aigua-l", lAigua.toLocaleString('ca-ES', {maximumFractionDigits:0}));
    safeSetText("base-elec-eur", costElec.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("base-aigua-eur", costAigua.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("base-mat-eur", costMat.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("base-clean-eur", costNet.toLocaleString('ca-ES', {maximumFractionDigits:2}));

    let pElec = Math.min(100, getCheckedSum('cb-elec')) / 100;
    let pAigua = Math.min(100, getCheckedSum('cb-aigua')) / 100;
    let pMat = Math.min(100, getCheckedSum('cb-mat')) / 100;
    let pNet = Math.min(100, getCheckedSum('cb-net')) / 100;

    const estalvi = (costElec*pElec) + (costAigua*pAigua) + (costMat*pMat) + (costNet*pNet);

    safeSetText("savings-needed-eur", estalvi.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("extra-panels-perc", costTotal > 0 ? ((estalvi/costTotal)*100).toFixed(1) : "0.0");
    safeSetText("total-cost-reduced-eur", (costTotal - estalvi).toLocaleString('ca-ES', {maximumFractionDigits:2}));

    const factorEstalvi = costTotal > 0 ? (costTotal - estalvi) / costTotal : 1;

    // --- CÀLCUL DEL ROI (Sense comptar plaques absurdes) ---
    const estalviAnualitzat = dies.total > 0 ? (estalvi / dies.total) * 365.25 : 0;
    const roiAnys = estalviAnualitzat > 0 ? (COST_FIX_MILLORES / estalviAnualitzat) : 0;

    // Si no s'ha marcat cap mesura, no mostrem anys de retorn (mostrem 0)
    safeSetText("roi-years", estalvi > 0 ? roiAnys.toFixed(1) : "0.0");
    // ---------------------------------------

    // GENERACIÓ DEL GRÀFIC
    const mesosLabels = [];
    const dadesBase = [];
    const dadesReduides = [];
    const nomsMesos = ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'];

    let mIni = dIni.getMonth();
    let yIni = dIni.getFullYear();
    let mFi = dFi.getMonth();
    let yFi = dFi.getFullYear();

    let startAbs = yIni * 12 + mIni;
    let endAbs = yFi * 12 + mFi;

    if (endAbs < startAbs) {
        let temp = startAbs;
        startAbs = endAbs;
        endAbs = temp;
    }

    let totalMesosIterar = (endAbs - startAbs) + 1;
    if (totalMesosIterar <= 0) totalMesosIterar = 1;
    if (totalMesosIterar > 60) totalMesosIterar = 60;

    const costBaseMensualMax = costTotal / Math.max(1, totalMesosIterar);

    for (let i = 0; i < totalMesosIterar; i++) {
        let currentAbs = startAbs + i;
        let mIndex = currentAbs % 12;
        let currentYear = Math.floor(currentAbs / 12);
        let yearStr = currentYear.toString().slice(-2);

        mesosLabels.push(`${nomsMesos[mIndex]} '${yearStr}`);

        let factorMes = 1.0;

        switch(mIndex) {
            case 8: factorMes = 0.90; break;
            case 9: case 10: case 1: case 4: factorMes = 1.0; break;
            case 11: factorMes = 0.75; break;
            case 0: factorMes = 0.80; break;
            case 2: case 3: factorMes = 0.85; break;
            case 5: factorMes = 0.88; break;
            case 6: factorMes = 0.40; break;
            case 7: factorMes = 0.18; break;
        }

        const variacio = (Math.random() * 0.06) - 0.03;
        factorMes = factorMes + variacio;

        let valorBaseMes = costBaseMensualMax * factorMes;
        dadesBase.push(valorBaseMes);
        dadesReduides.push(valorBaseMes * factorEstalvi);
    }

    actualitzarGraficLinies(mesosLabels, dadesBase, dadesReduides);
}

function actualitzarGraficLinies(labels, baseVals, reduitVals) {
    const canvas = document.getElementById('lineChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (lineChartInst) {
        lineChartInst.destroy();
    }

    lineChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pressupost Base (€)',
                    data: baseVals,
                    borderColor: '#86868b',
                    backgroundColor: 'rgba(134, 134, 139, 0.05)',
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Pressupost Reduït (€)',
                    data: reduitVals,
                    borderColor: '#30d158',
                    backgroundColor: 'rgba(48, 209, 88, 0.1)',
                    borderWidth: 4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (context) => {
                            let val = context.parsed.y || 0;
                            return `${context.dataset.label}: ${val.toLocaleString('ca-ES', {maximumFractionDigits:2})} €`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0', drawBorder: false },
                    ticks: { callback: (value) => value + ' €' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

window.onload = calcularResultats;
// FUNCIONS DEL MODAL (POP-UP)
function openModal() {
    document.getElementById('aboutModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('aboutModal').style.display = 'none';
}

// Tancar el modal fent clic a l'espai fosc de fora
window.onclick = function(event) {
    const modal = document.getElementById('aboutModal');
    if (event.target == modal) {
        closeModal();
    }
}