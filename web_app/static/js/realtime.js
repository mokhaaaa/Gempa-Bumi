document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi peta yang berpusat di Indonesia
    const map = L.map('earthquakeMap').setView([-2.5, 118], 5);
    
    // Menambahkan lapisan peta OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Menyimpan map markers
    let markers = [];
    
    // Default data source
    let currentSource = 'latest';
    
    // Fungsi untuk membersihkan semua markers
    function clearMarkers() {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    }
    
    // Fungsi untuk mendapatkan marker size berdasarkan magnitude
    function getMarkerSize(magnitude) {
        const mag = parseFloat(magnitude);
        if (mag >= 8) return 22;
        if (mag >= 7) return 20;
        if (mag >= 6) return 18;
        if (mag >= 5) return 16;
        if (mag >= 4) return 14;
        if (mag >= 3) return 12;
        if (mag >= 2) return 10;
        return 8;
    }
    
    // Fungsi untuk mendapatkan marker color berdasarkan magnitude
    function getMagnitudeColor(magnitude) {
        const mag = parseFloat(magnitude);
        if (mag >= 8) return '#990000';
        if (mag >= 7) return '#cc0000';
        if (mag >= 6) return '#ff0000';
        if (mag >= 5) return '#ff3300';
        if (mag >= 4) return '#ff6600';
        if (mag >= 3) return '#ff9900';
        if (mag >= 2) return '#ffcc00';
        return '#ffff00';
    }
    
    // Fungsi untuk mendapatkan marker border color berdasarkan depth
    function getDepthColor(depth) {
        const dep = parseFloat(depth);
        if (dep <= 50) return '#ff0000';
        if (dep <= 100) return '#ff9900';
        if (dep <= 250) return '#ffff00';
        if (dep <= 600) return '#00cc00';
        return '#0000ff';
    }
    
    // Fungsi untuk memformat koordinat
    function formatCoordinates(lat, lon) {
        const latDirection = lat >= 0 ? 'LU' : 'LS';
        const lonDirection = lon >= 0 ? 'BT' : 'BB';
        return `${Math.abs(lat).toFixed(2)} ${latDirection} - ${Math.abs(lon).toFixed(2)} ${lonDirection}`;
    }
    
    // Fungsi untuk parse coordinates dari string
    function parseCoordinates(coordStr) {
        try {
            // Menangani format seperti "1.91 LU - 97.01 BT"
            if (coordStr.includes('LU') || coordStr.includes('LS')) {
                const parts = coordStr.split('-').map(part => part.trim());
                
                let lat = parseFloat(parts[0].replace('LU', '').replace('LS', '').trim());
                if (parts[0].includes('LS')) lat *= -1;
                
                let lon = parseFloat(parts[1].replace('BT', '').replace('BB', '').trim());
                if (parts[1].includes('BB')) lon *= -1;
                
                return {latitude: lat, longitude: lon};
            }
            
            // Kembali ke normal lat/lon parsing
            const match = coordStr.match(/([-+]?\d*\.\d+|\d+)/g);
            if (match && match.length >= 2) {
                return {
                    latitude: parseFloat(match[0]),
                    longitude: parseFloat(match[1])
                };
            }
        } catch (e) {
            console.error('Error parsing coordinates:', e);
        }
        
        return {latitude: 0, longitude: 0};
    }
    
    // Fungsi untuk mengambil dan menampilkan data gempa bumi
    function fetchEarthquakes(source) {
        // Update sumber saat ini
        currentSource = source;
        
        // Update button aktif
        document.querySelectorAll('.source-btn').forEach(btn => {
            if (btn.dataset.source === source) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update judul halaman berdasarkan sumber
        let title = "Earthquake Data from BMKG";
        if (source === 'latest') {
            title = "Gempa Bumi Terkini";
            document.getElementById('singleQuakeInfo').style.display = 'block';
            document.getElementById('earthquakeTable').style.display = 'none';
        } else if (source === 'mag5plus') {
            title = "15 Gempa Bumi Magnitude 5.0+";
            document.getElementById('singleQuakeInfo').style.display = 'none';
            document.getElementById('earthquakeTable').style.display = 'block';
            document.getElementById('tableTitle').textContent = "Informasi 15 Gempa Bumi Magnitude 5.0+";
        } else if (source === 'felt') {
            title = "15 Gempa Bumi Dirasakan";
            document.getElementById('singleQuakeInfo').style.display = 'none';
            document.getElementById('earthquakeTable').style.display = 'block';
            document.getElementById('tableTitle').textContent = "Informasi 15 Gempa Bumi Dirasakan";
        }
        document.getElementById('dataTitle').textContent = title;
        
        // Menghapus markers yang sudah ada
        clearMarkers();
        
        // Membuat API request untuk mendapatkan gempa bumi real-time
        fetch(`/api/realtime-earthquakes?source=${source}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                
                if (source === 'latest') {
                    // Memproses satu data gempa bumi
                    if (data.Infogempa && data.Infogempa.gempa) {
                        const quake = data.Infogempa.gempa;
                        
                        // Parse coordinates
                        const coords = parseCoordinates(quake.Coordinates || `${quake.Lintang} - ${quake.Bujur}`);
                        const latitude = coords.latitude;
                        const longitude = coords.longitude;
                        
                        // Mengekstrak data yang lain
                        const magnitude = quake.Magnitude;
                        const depth = quake.Kedalaman;
                        const depthVal = parseFloat(depth.replace('km', '').trim());
                        const location = quake.Wilayah;
                        const dateTime = `${quake.Tanggal} ${quake.Jam}`;
                        const potential = quake.Potensi || 'Not specified';
                        
                        // Menambahkan ke map
                        const marker = L.circleMarker([latitude, longitude], {
                            radius: getMarkerSize(magnitude),
                            fillColor: getMagnitudeColor(magnitude),
                            color: getDepthColor(depthVal),
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.8
                        }).addTo(map);
                        
                        marker.bindPopup(`
                            <strong>Magnitude ${magnitude}</strong><br>
                            ${dateTime}<br>
                            Depth: ${depth}<br>
                            ${location}
                        `);
                        
                        markers.push(marker);
                        
                        // Peta pusat gempa bumi
                        map.setView([latitude, longitude], 6);
                        
                        // Update info panel
                        document.getElementById('latestDateTime').textContent = dateTime;
                        document.getElementById('latestMagnitude').textContent = magnitude;
                        document.getElementById('latestDepth').textContent = depth;
                        document.getElementById('latestLocation').textContent = location;
                        document.getElementById('latestCoordinates').textContent = formatCoordinates(latitude, longitude);
                        document.getElementById('latestPotential').textContent = potential;
                    }
                } else {
                    // Memproses beberapa data gempa bumi
                    if (data.Infogempa && data.Infogempa.gempa) {
                        const quakes = data.Infogempa.gempa;
                        let tableHtml = '';
                        
                        quakes.forEach((quake, index) => {
                            // Parse coordinates
                            const coords = parseCoordinates(quake.Coordinates || `${quake.Lintang} - ${quake.Bujur}`);
                            const latitude = coords.latitude;
                            const longitude = coords.longitude;
                            
                            // Mengekstrak data yang lain
                            const magnitude = quake.Magnitude;
                            const depth = quake.Kedalaman;
                            const depthVal = parseFloat(depth.replace('km', '').trim());
                            const location = quake.Wilayah;
                            const dateTime = `${quake.Tanggal} ${quake.Jam}`;
                            
                            // Menambahkan ke map
                            const marker = L.circleMarker([latitude, longitude], {
                                radius: getMarkerSize(magnitude),
                                fillColor: getMagnitudeColor(magnitude),
                                color: getDepthColor(depthVal),
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.8
                            }).addTo(map);
                            
                            marker.bindPopup(`
                                <strong>Magnitude ${magnitude}</strong><br>
                                ${dateTime}<br>
                                Depth: ${depth}<br>
                                ${location}
                            `);
                            
                            markers.push(marker);
                            
                            // Menambahkan ke table
                            tableHtml += `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${dateTime}</td>
                                    <td>${magnitude}</td>
                                    <td>${depth}</td>
                                    <td>${formatCoordinates(latitude, longitude)}</td>
                                    <td>${location}</td>
                                    <td>
                                        <button class="detail-btn" data-lat="${latitude}" data-lon="${longitude}">Lihat</button>
                                    </td>
                                </tr>
                            `;
                        });
                        
                        // Update table
                        document.getElementById('quakeTableBody').innerHTML = tableHtml;
                        
                        // Menambahkan event listeners untuk detail buttons
                        document.querySelectorAll('.detail-btn').forEach(btn => {
                            btn.addEventListener('click', function() {
                                const lat = parseFloat(this.dataset.lat);
                                const lon = parseFloat(this.dataset.lon);
                                map.setView([lat, lon], 7);
                                
                                // Temukan dan buka popup penanda yang sesuai
                                markers.forEach(marker => {
                                    const markerLatLng = marker.getLatLng();
                                    if (markerLatLng.lat === lat && markerLatLng.lng === lon) {
                                        marker.openPopup();
                                    }
                                });
                            });
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to load earthquake data. Please try again later.');
            });
    }
    
    // Menambahkan event listeners untuk source buttons
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            fetchEarthquakes(this.dataset.source);
        });
    });
    
    // Mengambil sumber data default pada saat memuat halaman
    fetchEarthquakes(currentSource);
});