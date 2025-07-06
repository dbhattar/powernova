var map = null;
var rto_iso_layer = null;
var projgrid;
const API_URL_BASE = '/api'
var projects_url = API_URL_BASE + '/get_projects';
var project_details_url = API_URL_BASE + '/get_project_details';

var isoStyleMap = {
    "CAISO": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#ff0000'
    },
    "ERCOT": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#ffaa00'
    },
    "PJM": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#ff00aa'
    },
    "MISO": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#ffaaaa'
    },
    "SPP": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#aaaa00'
    },
    "NYISO": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#aa00aa'
    },
    "ISONE": {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.3,
        fillColor: '#ff00ff'
    }
};

function isoStyle(feature) {
    return isoStyleMap[feature.properties.RTO_ISO];
}

async function addRtoIsoLayer(rto_iso) {
    var url = API_URL_BASE + "/get_rto_iso_map";
    if (rto_iso != null) {
        url = url + "/" + rto_iso;
    }
    var mapResponse = await fetch(url)
    var iso_rto_map = await mapResponse.json();
    var new_rto_iso_layer = L.geoJSON(iso_rto_map, {
        filter: function (feature) {
            return (feature.properties.LOC_TYPE == "REG") ||
                (feature.properties.RTO_ISO == "PJM" && feature.properties.LOC_TYPE == "ZON");
        },
        onEachFeature: async function (feature, layer) {
                var content = "\
                    Name:  <h1>" + feature.properties.NAME + "</h1>";
                layer.bindPopup(content);
            }
        },
    );

    new_rto_iso_layer.eachLayer(function (layer) {  
        layer.setStyle(isoStyleMap[layer.feature.properties.RTO_ISO]) 
    });


    if (rto_iso_layer != null) {
        rto_iso_layer.remove(map);
    }
    rto_iso_layer = new_rto_iso_layer;
    rto_iso_layer.addTo(map);

    bounds = rto_iso_layer.getBounds();
    map.setView(bounds.getCenter(), 5);
}

async function showMap() {
    map = L.map('map').setView([35.36124621126173, -120.81143387275726], 6); // Default center, zoomed out
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
}

// Fetch data from the API
async function fetchProjects(iso) {
    try {
        showProjectsTable(iso)
    } catch (error) {
        console.error('Error fetching projects:', error);
        document.getElementById('errorMessage').innerHTML = '<tr><td colspan="9">Error loading data</td></tr>';
    }
}

async function fetchProjectsForIso(iso) {
    try {
        showProjectsTable(iso);
        await addRtoIsoLayer(iso);
    } catch (error) {
        console.error('Error fetching projects:', error);
        document.getElementById('errorMessage').innerHTML = '<tr><td colspan="9">Error loading data</td></tr>';
    }
}

function updateProjTable(projs) {
    const projData = projs.map(p => [p['IsoID'], p['QueueID'], p['ProjectName'],
        p['GenerationType'], p['InterconnectionLocation'],
        p['County'], p['State'], p['Status']]);
    
    projgrid.updateConfig({
        data: projData
    }).forceRender();
}

function showProjectsTable(iso) {
    // const cols = ['IsoID', 'QueueID', 'ProjectName', 
    //     'GenerationType', 'InterconnectionLocation',
    //     'County', 'State', 'Status'];
    
    const cols = ['IsoID', 'QueueID', 'County', 'State', 'Status'];

    var _get_projects_url = projects_url;

    if (iso != null) {
        _get_projects_url = _get_projects_url + "/" + iso;
    }
    
    if (projgrid == null) {
        projgrid = new gridjs.Grid({
            columns: cols,
           search: true,
            // search: {
            //     server: {
            //     url: (prev, keyword) => `${prev}&search=${keyword}`
            //     }
            // },
            sort: true,
            pagination: { 
                enabled: true, 
                limit: 20,
                server: {
                    url: (prev, page, limit) => `${prev}?limit=${limit}&offset=${page * limit}`
                }
            },
            server: {
                url: _get_projects_url,
                then: data => data.results.map(p => [p['IsoID'], p['QueueID'],  p['County'], p['StateName'], p['Status']]),
                total: data => data.count
            }
        })    
        projgrid.render(document.getElementById('proj-table'));
        projgrid.on('cellClick', handleCellClick)
    }
    else {

        projgrid.updateConfig({
            server: {
                url: _get_projects_url,
                then: data => data.results.map(p => [p['IsoID'], p['QueueID'], p['County'], p['StateName'], p['Status']]),
                total: data => data.count
            }
        });
        projgrid.forceRender()
    }
}

// Panel Logic
const panel = document.getElementById('panel');
const closeButton = document.getElementById('close-panel');
const project_details = document.getElementById('project_details');

// Close Button
closeButton.addEventListener('click', () => {
    panel.classList.add('translate-x-full');
});        

// {
//     "WithdrawnDate":null,
//     "WithdrawalComment":null,
//     "ActualCompletionDate":null,
//     "AdditionalInfo":"{
//         \"Type-1\": \"Wind Turbine\", 
//         \"Type-2\": \"Storage\", 
//         \"Type-3\": null, 
//         \"Fuel-1\": \"Wind Turbine\", 
//         \"Fuel-2\": \"Battery\", 
//         \"Fuel-3\": null, 
//         \"MW-1\": 38.0, 
//         \"MW-2\": 38.0, 
//         \"MW-3\": null, 
//         \"Interconnection Request Receive Date\": 1069113600000, 
//         \"Interconnection Agreement Status\": \"Executed\", 
//         \"Study Process\": \"AMEND 39\", 
//         \"Proposed On-line Date (as filed with IR)\": 1120114800000, 
//         \"System Impact Study or Phase I Cluster Study\": \"Complete\", 
//         \"Facilities Study (FAS) or Phase II Cluster Study\": \"Complete\", 
//         \"Optional Study (OS)\": null, 
//         \"Full Capacity, Partial or Energy Only (FC/P/EO)\": \"Partial Capacity\", 
//         \"Off-Peak Deliverability and Economic Only\": \"Off-Peak Deliverability\", 
//         \"Feasibility Study or Supplemental Review\": null
//     }"
// }
function format_caiso_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    var additionalInfo = JSON.parse(details['AdditionalInfo'])
    html += "<p>Study Process: " + additionalInfo['Study Process'] + "</p>"
    html += "<p>Interconnection Type: " + additionalInfo['Full Capacity, Partial or Energy Only (FC/P/EO)'] + "</p>"
    return html;
}

// '{"IsoID":"PJM","QueueID":"AE1-092 - moved to TC1","ProjectName":"Blue Jacket-Kirby 138 kV","InterconnectingEntity":null,"County":"Union","StateName":"OH","InterconnectionLocation":null,"TransmissionOwner":"Dayton","GenerationType":"Solar","CapacityMW":206.55,"SummerCapacity":96.4,"WinterCapacityMW":206.6,"QueueDate":"2018-08-31","Status":"Active","ProposedCompletionDate":null,"WithdrawnDate":null,"WithdrawalComment":null,"ActualCompletionDate":null,"AdditionalInfo":"{\\"MW In Service\\": null, \\"Commercial Name\\": null, \\"Initial Study\\": null, \\"Feasibility Study\\": \\"https://www.pjm.com/pjmfiles/pub/planning/project-queues/feas_docs/ae1092_fea.pdf\\", \\"Feasibility Study Status\\": \\"Document Posted\\", \\"System Impact Study\\": \\"https://www.pjm.com/pjmfiles/pub/planning/project-queues/impact_studies/ae1092_imp.htm\\", \\"System Impact Study Status\\": \\"Document Posted\\", \\"Facilities Study\\": null, \\"Facilities Study Status\\": \\"In Progress\\", \\"Interim/Interconnection Service/Generation Interconnection Agreement\\": null, \\"Interim/Interconnection Service/Generation Interconnection Agreement Status\\": null, \\"Wholesale Market Participation Agreement\\": null, \\"Construction Service Agreement\\": null, \\"Construction Service Agreement Status\\": null, \\"Upgrade Construction Service Agreement\\": null, \\"Upgrade Construction Service Agreement Status\\": null, \\"Backfeed Date\\": null, \\"Long-Term Firm Service Start Date\\": null, \\"Long-Term Firm Service End Date\\": null, \\"Test Energy Date\\": null}"}'
function format_pjm_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    var additionalInfo = JSON.parse(details['AdditionalInfo'])
    var fsReport = additionalInfo['Feasibility Study'];
    if (fsReport !== null) {
        html += "<p>Feasibility Study Report: " + "<a class='font-medium text-blue-600 dark:text-blue-500 hover:underline' href='" + fsReport + "'>" + fsReport + "</a>"
    }
    var sisReport = additionalInfo['System Impact Study'];
    if (sisReport !== null) {
        html += "<p>System Impact Study Report: " + "<a class='font-medium text-blue-600 dark:text-blue-500 hover:underline' href='" + sisReport + "'>" + sisReport + "</a>"
    }
    return html;
}

// {"IsoID":"Ercot","QueueID":"28INR0073","ProjectName":"Daystar Solar ","InterconnectingEntity":"Choate Solar, LLC","County":"Karnes","StateName":"Texas","InterconnectionLocation":"5728 Choate 138kV","TransmissionOwner":null,"GenerationType":"Solar - Photovoltaic Solar","CapacityMW":150,"SummerCapacity":null,"WinterCapacityMW":null,"QueueDate":"2024-04-15","Status":"Active","ProposedCompletionDate":"2028-03-15","WithdrawnDate":null,"WithdrawalComment":null,"ActualCompletionDate":null,"AdditionalInfo":"{\\"Fuel\\": \\"Solar\\", \\"Technology\\": \\"Photovoltaic Solar\\", \\"GIM Study Phase\\": \\"SS Completed, FIS Started, No IA\\", \\"Screening Study Started\\": 1713139200000, \\"Screening Study Complete\\": 1720137600000, \\"FIS Requested\\": 1712620800000, \\"FIS Approved\\": null, \\"Economic Study Required\\": null, \\"IA Signed\\": null, \\"Air Permit\\": null, \\"GHG Permit\\": null, \\"Water Availability\\": \\"Not Required\\", \\"Meets Planning\\": null, \\"Meets All Planning\\": null, \\"CDR Reporting Zone\\": \\"SOUTH\\", \\"Approved for Energization\\": null, \\"Approved for Synchronization\\": null, \\"Comment\\": null}"}

function format_ercot_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    var additionalInfo = JSON.parse(details['AdditionalInfo'])

    html += "<p>GIM Study Phase: " + additionalInfo["GIM Study Phase"]

    return html;
}

// {"IsoID":"MISO","QueueID":"J3464","ProjectName":null,"InterconnectingEntity":null,"County":"Story","StateName":"IA","InterconnectionLocation":"Fernald","TransmissionOwner":"ITC MIDWEST","GenerationType":"Solar","CapacityMW":200,"SummerCapacity":200,"WinterCapacityMW":200,"QueueDate":"2024-04-16","Status":"Active","ProposedCompletionDate":null,"WithdrawnDate":null,"WithdrawalComment":null,"ActualCompletionDate":null,"AdditionalInfo":"{\\"facilityType\\": \\"Photovoltaic\\", \\"Post Generator Interconnection Agreement Status\\": \\"\\", \\"Interconnection Approval Date\\": null, \\"inService\\": \\"2028-06-30T04:00:00+00:00\\", \\"giaToExec\\": null, \\"studyCycle\\": \\"DPP-2023\\", \\"studyGroup\\": \\"West\\", \\"studyPhase\\": \\"Study Not Started\\", \\"svcType\\": \\"\\", \\"dp1ErisMw\\": 0.0, \\"dp1NrisMw\\": 0.0, \\"dp2ErisMw\\": 0.0, \\"dp2NrisMw\\": 0.0, \\"sisPhase1\\": \\"\\"}"}'
function format_miso_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    var additionalInfo = JSON.parse(details['AdditionalInfo'])

    html += "<p>Study Phase: " + additionalInfo["studyPhase"]
    html += "<p>Study Cycle: " + additionalInfo["studyCycle"]
    html += "<p>Study Group: " + additionalInfo["studyGroup"]

    return html;
}

// {"IsoID":"ISONE","QueueID":"1594","ProjectName":"Woonsocket Substation – Tifft ST BESS","InterconnectingEntity":null,"County":"Providence","StateName":"RI","InterconnectionLocation":"RIE feeder 26W7, Woonsocket Substation","TransmissionOwner":null,"GenerationType":"BAT","CapacityMW":4.5,"SummerCapacity":4.5,"WinterCapacityMW":4.5,"QueueDate":"2024-11-15","Status":"Active","ProposedCompletionDate":"2026-12-31","WithdrawnDate":null,"WithdrawalComment":null,"ActualCompletionDate":null,"AdditionalInfo":"{\\"Updated\\": \\"11/15/2024\\", \\"Unit\\": \\"OT\\", \\"Op Date\\": \\"12/31/2026\\", \\"Sync Date\\": \\"12/31/2026\\", \\"Serv\\": null, \\"I39\\": \\"N\\", \\"Dev\\": null, \\"Zone\\": \\"RI\\", \\"System Impact Study Completed\\": \\"N\\", \\"Feasiblity Study Status\\": null, \\"System Impact Study Status\\": null, \\"Optional Interconnection Study Status\\": null, \\"Facilities Study Status\\": null, \\"Interconnection Agreement Status\\": null, \\"Project Status\\": null}"}'
function format_isone_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Summer Capacity: " + details["SummerCapacity"] + " MW</p>"
    html += "<p>Winter Capacity: " + details["WinterCapacityMW"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    return html;
}

// '{"IsoID":"NYISO","QueueID":"0429","ProjectName":"North Rockland Station","InterconnectingEntity":null,"County":"Steuben","StateName":"NY","InterconnectionLocation":"Line Y88 345kV","TransmissionOwner":"ConEd","GenerationType":"AC Transmission","CapacityMW":0,"SummerCapacity":null,"WinterCapacityMW":null,"QueueDate":"2014-02-12","Status":"Active","ProposedCompletionDate":null,"WithdrawnDate":null,"WithdrawalComment":null,"ActualCompletionDate":null,"AdditionalInfo":"{\\"Proposed In-Service Date\\": null, \\"Proposed Initial-Sync Date\\": null, \\"Last Updated Date\\": 1648684800000, \\"Z\\": \\"G\\", \\"S\\": 12.0, \\"Availability of Studies\\": \\"SIS\\", \\"SGIA Tender Date\\": null}"}'
function format_nyiso_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    var additionalInfo = JSON.parse(details['AdditionalInfo'])

    html += "<p>Availability of Studies: " + additionalInfo["Availability of Studies"]

    return html;
}

// {"IsoID":"SPP","QueueID":"GEN-2024-SR7","ProjectName":null,"InterconnectingEntity":null,"County":"Beaver County","StateName":"OK","InterconnectionLocation":"Beaver County Substation 345 kV","TransmissionOwner":"OG&E","GenerationType":"Solar","CapacityMW":200,"SummerCapacity":200,"WinterCapacityMW":200,"QueueDate":"2024-01-26","Status":"Active","ProposedCompletionDate":"2027-06-01","WithdrawnDate":null,"WithdrawalComment":null,"ActualCompletionDate":null,"AdditionalInfo":"{\\"In-Service Date\\": null, \\"Commercial Operation Date\\": \\"6/1/2027\\", \\"Cessation Date\\": null, \\"Current Cluster\\": \\"Surplus\\", \\"Cluster Group\\": \\"05 SOUTHWEST\\", \\"Service Type\\": \\"ER\\", \\"Status (Original)\\": \\"IA PENDING\\"}"}'
function format_spp_project(details) {
    var html = ""
    html += "<p>QueueId: " + details["QueueID"] + "</p>"
    html += "<p>Queue Date: " + details["QueueDate"] + "</p>"
    html += "<p>Proposed Completion Date: " + details["ProposedCompletionDate"] + "</p>"
    html += "<p>Name: " + details["ProjectName"] + "</p>"
    html += "<p>County: " + details["County"] + ", " + details["StateName"] + "</p>"
    html += "<p>Interconnection Location: " + details["InterconnectionLocation"] + "</p>"
    html += "<p>Transmission Owner: " + details["TransmissionOwner"] + "</p>"
    html += "<p>Generation Type: " + details["GenerationType"] + "</p>"
    html += "<p>Capacity: " + details["CapacityMW"] + " MW</p>"
    html += "<p>Summer Capacity: " + details["SummerCapacity"] + " MW</p>"
    html += "<p>Winter Capacity: " + details["WinterCapacity"] + " MW</p>"
    html += "<p>Status: " + details["Status"] + "</p>"

    var additionalInfo = JSON.parse(details['AdditionalInfo'])

    html += "<p>Current Cluster: " + additionalInfo["Current Cluster"]
    html += "<p>Cluster Group: " + additionalInfo["Cluster Group"]
    html += "<p>Service Type: " + additionalInfo["Service Type"]    
    html += "<p>Original Status: " + additionalInfo["Status (Original)"]    

    return html;
}

function format_project_details(isoid, details) {
    switch(isoid.toUpperCase()) {
        case 'CAISO':
            return format_caiso_project(details);
        case 'PJM':
            return format_pjm_project(details);
        case 'ERCOT':
            return format_ercot_project(details);
        case 'MISO':
            return format_miso_project(details);
        case 'ISONE':
            return format_isone_project(details);
        case 'NYISO':
            return format_nyiso_project(details);
        case 'SPP':
            return format_spp_project(details);
        default:
            return "Unknown ISO";
    }
}


async function handleCellClick(e, cell, col, row) {
    const _rowIso = row['cells'][0].data;
    const _rowQueueId = row['cells'][1].data;
    const selected_project_url = project_details_url + "?isoId=" + _rowIso + "&queueId=" + _rowQueueId;
    var response = await fetch(selected_project_url)
    var details = await response.json();
    project_details.innerHTML = format_project_details(_rowIso, details);
    panel.classList.remove('translate-x-full');
}