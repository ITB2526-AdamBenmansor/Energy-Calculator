// CONSTANTS BASE (Dades reals ajustades al JSON)
const BASE_AIGUA_LECTIU = 5000;
const BASE_AIGUA_FESTIU = 100;
const BASE_ELEC_LECTIU = 472;
const BASE_ELEC_FESTIU = 192;
const BASE_MAT_UNITATS = 15;
const BASE_MAT_EUROS = 12;
const BASE_NETEJA_LITRES = 2;
const BASE_NETEJA_EUROS = 5;

// Funció de calendari
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
    return { lectius, festius };
}

// Disparadors des de l'HTML
function calcularResultats() {
    let start = document.getElementById("startDate").value;
    let end = document.getElementById("endDate").value;
    if(!start || !end) return alert("Selecciona les dates.");

    let dies = analitzarDies(start, end);
    executarCalculs(dies, "period");
}

function calcularProximAny() {
    let start = new Date();
    let end = new Date();
    end.setFullYear(start.getFullYear() + 1);

    let dies = analitzarDies(start, end);
    executarCalculs(dies, "year");
}

// Lògica matemàtica unificada
function executarCalculs(dies, tipus) {
    // 1. CÀLCULS BASE (100% de consum inercial)
    let totalAigua = (dies.lectius * BASE_AIGUA_LECTIU) + (dies.festius * BASE_AIGUA_FESTIU);
    let totalElec = (dies.lectius * BASE_ELEC_LECTIU) + (dies.festius * BASE_ELEC_FESTIU);
    let totalMatUnitats = dies.lectius * BASE_MAT_UNITATS;
    let totalMatEuros = dies.lectius * BASE_MAT_EUROS;
    let totalNetejaLitres = (dies.lectius * BASE_NETEJA_LITRES) + (dies.festius * (BASE_NETEJA_LITRES * 0.2));
    let totalNetejaEuros = (dies.lectius * BASE_NETEJA_EUROS) + (dies.festius * (BASE_NETEJA_EUROS * 0.2));

    // 2. CÀLCULS PLA REDUCCIÓ (-30% -> multiplicar per 0.70)
    let redAigua = totalAigua * 0.70;
    let redElec = totalElec * 0.70;
    let redMatUnitats = totalMatUnitats * 0.70;
    let redMatEuros = totalMatEuros * 0.70;

    // --- ACTUALITZAR EL DOM (HTML) ---

    // Targetes inercials
    document.getElementById(`water-${tipus}`).innerText = totalAigua.toLocaleString('ca-ES', {maximumFractionDigits: 0});
    document.getElementById(`elec-${tipus}`).innerText = totalElec.toLocaleString('ca-ES', {maximumFractionDigits: 0});
    document.getElementById(`mat-${tipus}-unit`).innerText = totalMatUnitats.toLocaleString('ca-ES', {maximumFractionDigits: 0});
    document.getElementById(`mat-${tipus}-eur`).innerText = totalMatEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2});
    document.getElementById(`clean-${tipus}-l`).innerText = totalNetejaLitres.toLocaleString('ca-ES', {maximumFractionDigits: 1});
    document.getElementById(`clean-${tipus}-eur`).innerText = totalNetejaEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2});

    // Secció Pla de Reducció (Sempre mostrem el període calculat actualment amb el -30%)
    document.getElementById("water-red-period").innerText = redAigua.toLocaleString('ca-ES', {maximumFractionDigits: 0});
    document.getElementById("elec-red-period").innerText = redElec.toLocaleString('ca-ES', {maximumFractionDigits: 0});
    document.getElementById("mat-red-unit").innerText = redMatUnitats.toLocaleString('ca-ES', {maximumFractionDigits: 0});
    document.getElementById("mat-red-eur").innerText = redMatEuros.toLocaleString('ca-ES', {maximumFractionDigits: 2});
}

// Inicialització
window.onload = calcularResultats;