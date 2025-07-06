function addChart(ctx, _data, chartEventHandler) {
    // const tempChart = new Chart(ctx, {
    //     type: 'line',
    //     data: {
    //         labels: [],
    //         datasets: [{
    //             label: 'Average Temperature (°C)',
    //             data: [],
    //             borderColor: 'rgba(75, 192, 192, 1)',
    //             fill: false
    //         }]
    //     },
    //     options: {
    //         scales: {
    //             x: { title: { display: true, text: 'Time' } },
    //             y: { title: { display: true, text: 'Temperature (°C)' } }
    //         }
    //     }
    // });
    
    const tempChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: _data.map(row => row.label),
            datasets: [
                {
                    data: _data
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            // Enable interaction events
            events: ['click'], // Default events to listen for
            onClick: (event, elements, chart) => {
              if (elements.length > 0) {
                const index = elements[0].index; // Index of clicked data point
                const value = chart.data.datasets[0].data[index];
                const label = chart.data.labels[index];
                chartEventHandler(label);
                //console.log(`Clicked: ${label} - ${value}`);
              }
            },
        }
    });    
}