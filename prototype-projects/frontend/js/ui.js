const caiso = document.getElementById('CAISO');
const pjm = document.getElementById('PJM');
const ercot = document.getElementById('ERCOT');
const miso = document.getElementById('MISO');
const isone = document.getElementById('ISONE');
const nyiso = document.getElementById('NYISO');
const spp = document.getElementById('SPP');

let iso = null

function removeSelectedClasses(isoDiv) {
    isoDiv.classList.remove("border-double");
    isoDiv.classList.remove("border-4");
    isoDiv.classList.remove("border-red-600");
}

function addSelectedClasses(iso) {
    const isoDiv = document.getElementById(iso);

    isoDiv.classList.add("border-double");
    isoDiv.classList.add("border-4");
    isoDiv.classList.add("border-red-600");
}

function updateButtonState(iso) {
    removeSelectedClasses(caiso);
    removeSelectedClasses(pjm);
    removeSelectedClasses(ercot);
    removeSelectedClasses(miso);
    removeSelectedClasses(isone);
    removeSelectedClasses(nyiso);
    removeSelectedClasses(spp);
    
    if (iso != null) {
        addSelectedClasses(iso);
    }
}

function handleButtonSelection(e) {
    const selectedIso = e.target.innerText;
    if (iso != selectedIso) {
        iso = selectedIso;
    } else {
        iso = null
    }

    updateButtonState(iso);
    fetchProjectsForIso(iso);
}

function initializeListeners() {
    caiso.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
    
    pjm.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
    
    ercot.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
    
    miso.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
    
    isone.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
    
    nyiso.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
    
    spp.addEventListener('click', (e) => {
        handleButtonSelection(e);
    });
}

// Load data on page load
window.onload = function() {
    initializeListeners();
    showMap();
    fetchProjectsForIso(iso);
}