Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
Chart.defaults.color = '#86868b';

const ANY_BASE = 2024;
const IPC_HISTORIC = [3.1, 5.7, 3.1, -0.5, 2.5, 3.1];
const PREU_KWH_COMPRA = 0.18;
const PREU_LITRE_AIGUA = 0.0025;
const BASE_ELEC_CONS_LECTIU = 472;
const BASE_ELEC_CONS_FESTIU = 192;
const NUM_PANEL_ACTUAL = 136;
const BASE_ELEC_GEN_DIARIA_MITJANA = 45.37;
const BASE_AIGUA_LECTIU = 5000;
const BASE_AIGUA_FESTIU = 100;
const BASE_MAT_EUROS = 12;
const BASE_NETEJA_EUROS = 5;

let lineChartInst = null;

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function analitzarDies(start, end) {
    let lectius = 0, festius = 0;
    let curr = new Date(start), finish = new Date(end);
    while (curr <= finish) {
        let d = curr.getDay();
        let m = curr.getMonth();
        (d === 0 || d === 6 || m === 6 || m === 7) ? festius++ : lectius++;
        curr.setDate(curr.getDate() + 1);
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

    const anyFi = new Date(end).getFullYear();
    const dies = analitzarDies(start, end);
    const ipc = 1 + predirIPCAny(anyFi);

    const alertBox = document.getElementById("ipc-alert");
    if(anyFi > ANY_BASE) {
        safeSetText("ipc-percentage", ((ipc-1)*100).toFixed(1));
        safeSetText("ipc-year", anyFi);
        alertBox.style.display = "block";
    } else { alertBox.style.display = "none"; }

    const consElec = (dies.lectius * BASE_ELEC_CONS_LECTIU) + (dies.festius * BASE_ELEC_CONS_FESTIU);
    const genElec = dies.total * BASE_ELEC_GEN_DIARIA_MITJANA;
    const kwhNet = Math.max(0, consElec - genElec);
    const lAigua = (dies.lectius * BASE_AIGUA_LECTIU) + (dies.festius * BASE_AIGUA_FESTIU);

    const costElec = (kwhNet * PREU_KWH_COMPRA) * ipc;
    const costAigua = (lAigua * PREU_LITRE_AIGUA) * ipc;
    const costMat = (dies.lectius * BASE_MAT_EUROS) * ipc;
    const costNet = ((dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * 1)) * ipc;
    const costTotal = costElec + costAigua + costMat + costNet;

    safeSetText("base-elec-kwh", kwhNet.toLocaleString('ca-ES', {maximumFractionDigits:0}));
    safeSetText("base-aigua-l", lAigua.toLocaleString('ca-ES', {maximumFractionDigits:0}));
    safeSetText("base-elec-eur", costElec.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("base-aigua-eur", costAigua.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("base-mat-eur", costMat.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("base-clean-eur", costNet.toLocaleString('ca-ES', {maximumFractionDigits:2}));

    let pElec = Math.min(100, (parseFloat(document.getElementById('m-elec-llums').value)||0) + (parseFloat(document.getElementById('m-elec-temp').value)||0) + (parseFloat(document.getElementById('m-elec-stb').value)||0)) / 100;
    let pAigua = Math.min(100, (parseFloat(document.getElementById('m-aigua-air').value)||0) + (parseFloat(document.getElementById('m-aigua-fuit').value)||0)) / 100;
    let pMat = Math.min(100, (parseFloat(document.getElementById('m-mat-dig').value)||0) + (parseFloat(document.getElementById('m-mat-rec').value)||0)) / 100;
    let pNet = Math.min(100, (parseFloat(document.getElementById('m-net-dos').value)||0) + (parseFloat(document.getElementById('m-net-granel').value)||0)) / 100;

    const estalvi = (costElec*pElec) + (costAigua*pAigua) + (costMat*pMat) + (costNet*pNet);

    safeSetText("savings-needed-eur", estalvi.toLocaleString('ca-ES', {maximumFractionDigits:2}));
    safeSetText("extra-panels-perc", ((estalvi/costTotal)*100).toFixed(1));
    safeSetText("total-cost-reduced-eur", (costTotal - estalvi).toLocaleString('ca-ES', {maximumFractionDigits:2}));

    const kwhPendent = (costElec * (1-pElec)) / (PREU_KWH_COMPRA * ipc);
    const genPlaque = (BASE_ELEC_GEN_DIARIA_MITJANA / NUM_PANEL_ACTUAL) * dies.total;
    safeSetText("extra-panels-needed-count", Math.max(0, Math.ceil(kwhPendent / genPlaque)));

    // Generació de punts irregulars per al gràfic de línies
    const mesos = ['Set', 'Oct', 'Nov', 'Des', 'Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun'];
    const factorEstalvi = (costTotal - estalvi) / costTotal;

    const dadesBase = mesos.map(() => (costTotal / mesos.length) * (0.85 + Math.random() * 0.3));
    const dadesReduides = dadesBase.map(v => v * factorEstalvi);

    actualitzarGraficLinies(mesos, dadesBase, dadesReduides);
}

function actualitzarGraficLinies(labels, baseVals, reduitVals) {
    const ctx = document.getElementById('lineChart').getContext('2d');

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
                    tension: 0.4, // Suavitza la línia per fer-la irregular i orgànica
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
                    tension: 0.4, // Suavitza la línia
                    fill: true // Omple l'àrea inferior per donar més pes visual
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
                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString('ca-ES', {maximumFractionDigits:2})} €`
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