// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoibm9taW43MDkiLCJhIjoiY203ZWZoYmdkMGRlMTJtcHdneDFxcG5xbyJ9.boF_qGLy3mYOdeOk0UnRGg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => { 
    // Common style for bike lanes
    const bikeLaneStyle = {
        'line-color': 'green',  // A bright green using hex code
        'line-width': 5,        // Thicker lines
        'line-opacity': 0.6     // Slightly less transparent
    };

    // First data source: Existing bike network (Boston)
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: bikeLaneStyle  // Use the common style here
    });

    // Second data source: Existing bike network (Cambridge)
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: bikeLaneStyle  // Use the same style here
    });

    // Load the nested JSON file
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
    const svg = d3.select('#map').select('svg');
    let stations = [];
    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
        stations = jsonData.data.stations;
        console.log('Stations Array:', stations);

        function getCoords(station) {
            const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
            const { x, y } = map.project(point);  // Project to pixel coordinates
            return { cx: x, cy: y };  // Return as object for use in SVG attributes
        }
    
        // Append circles to the SVG for each station
        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', 5)               // Radius of the circle
            .attr('fill', 'steelblue')  // Circle fill color
            .attr('stroke', 'white')    // Circle border color
            .attr('stroke-width', 1)    // Circle border thickness
            .attr('opacity', 0.6);      // Circle opacity
     
        // Function to update circle positions when the map moves/zooms
        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
                .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
        }
    
        // Initial position update when map loads
        updatePositions();
    
        // Reposition markers on map interactions
        map.on('move', updatePositions);     // Update during map movement
        map.on('zoom', updatePositions);     // Update during zooming
        map.on('resize', updatePositions);   // Update on window resize
        map.on('moveend', updatePositions);  // Final adjustment after movement ends
    }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });

    // Load the csv file
    const csvurl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv'
    d3.csv(csvurl).then(trips => {
        departures = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.start_station_id,
        );
        // Calculate arrivals (group by end_station_id)
        const arrivals = d3.rollup(
            trips,
            (v) => v.length,   // Count the number of trips for each end station
            (d) => d.end_station_id  // Group by end_station_id
        );

        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });

        console.log('Stations Array With Traffic Data:', stations);
        
        const radiusScale = d3
          .scaleSqrt()
          .domain([0, d3.max(stations, (d) => d.totalTraffic)])
          .range([0, 25]);
        
        // Update the radius of each circle based on total traffic
        svg.selectAll('circle')
          .data(stations)
          .attr('r', d => radiusScale(d.totalTraffic))  // Set radius based on total traffic
          .each(function(d) {
            // Append title for each circle to show tooltips
            d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });
        }).catch(error => {
        console.error('Error loading CSV:', error);  // Handle errors if csv loading fails
    });
});
