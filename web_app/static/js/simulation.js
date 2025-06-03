document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi peta yang berpusat di Indonesia
    const map = L.map('simulationMap').setView([-2.5, 118], 5);
    
    // Menambahkan lapisan peta OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Variabel untuk pengelolaan negara
    let isMapClickEnabled = false;
    let userMarker = null;
    let modelData = null;
    
    // Mendefinisikan warna klaster
    const clusterColors = {
        0: '#2ECC71', // Hijau (Kurang Rawan)
        1: '#E74C3C', // Merah (Sangat Rawan)
        2: '#F1C40F', // Kuning (Cukup Rawan)
        3: '#E67E22'  // Orange (Rawan)
    };   
    
    // Mendefinisikan level resiko klaster
    const clusterRiskLevels = {
        0: 'Kurang Rawan',
        1: 'Sangat Rawan',
        2: 'Cukup Rawan',
        3: 'Rawan'
    };
    
    // Load model data
    fetch('/api/simulation-model')
        .then(response => response.json())
        .then(data => {
            modelData = data;
        })
        .catch(error => {
            console.error('Error loading model data:', error);
            alert('Failed to load model data. Please refresh the page.');
        });
    
    // Inisialisasi event listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Beralih mode klik peta
        document.getElementById('useMapToggle').addEventListener('click', function() {
            isMapClickEnabled = !isMapClickEnabled;
            this.classList.toggle('active');
            
            const mapInstructions = document.getElementById('mapInstructions');
            if (isMapClickEnabled) {
                this.textContent = 'Nonaktifkan Klik Map';
                mapInstructions.style.display = 'block';
            } else {
                this.textContent = 'Gunakan Klik Map';
                mapInstructions.style.display = 'none';
            }
        });
        
        // Penangan klik peta
        map.on('click', function(e) {
            if (!isMapClickEnabled) return;
            
            // Update form dengan koordinat yang diklik
            document.getElementById('inputLatitude').value = e.latlng.lat.toFixed(4);
            document.getElementById('inputLongitude').value = e.latlng.lng.toFixed(4);
            
            // Menambahkan nilai default untuk kedalaman dan magnitudo jika tidak diatur
            if (!document.getElementById('inputDepth').value) {
                document.getElementById('inputDepth').value = '10';
            }
            if (!document.getElementById('inputMagnitude').value) {
                document.getElementById('inputMagnitude').value = '5.0';
            }
            
            // Update marker
            updateUserMarker(e.latlng.lat, e.latlng.lng);
        });
        
        // Mengklasifikasikan tombol klaster
        document.getElementById('classifyCluster').addEventListener('click', function() {
            const latitude = parseFloat(document.getElementById('inputLatitude').value);
            const longitude = parseFloat(document.getElementById('inputLongitude').value);
            const depth = parseFloat(document.getElementById('inputDepth').value);
            const magnitude = parseFloat(document.getElementById('inputMagnitude').value);
            
            // validasi input
            if (isNaN(latitude) || isNaN(longitude) || isNaN(depth) || isNaN(magnitude)) {
                alert('Silakan isi semua field dengan nilai yang valid');
                return;
            }
            
            // Update marker pada map
            updateUserMarker(latitude, longitude);
            
            // Memberikan klasifikasi request
            classifyCluster(latitude, longitude, depth, magnitude);
        });
        
        // Reset form button
        document.getElementById('resetForm').addEventListener('click', function() {
            // Menghapus isi form
            document.getElementById('inputLatitude').value = '';
            document.getElementById('inputLongitude').value = '';
            document.getElementById('inputDepth').value = '';
            document.getElementById('inputMagnitude').value = '';
            
            // memindahkan marker
            if (userMarker) {
                map.removeLayer(userMarker);
                userMarker = null;
            }
            
            // Menyembunyikan hasill
            document.getElementById('resultCard').style.display = 'none';
        });
    }
    
    function updateUserMarker(lat, lng) {
        // Menghilanfkan marker yang sudah ada
        if (userMarker) {
            map.removeLayer(userMarker);
        }
        
        // Membuat marker baru
        userMarker = L.marker([lat, lng]).addTo(map);
        
        const depth = document.getElementById('inputDepth').value || '?';
        const magnitude = document.getElementById('inputMagnitude').value || '?';
        
        userMarker.bindPopup(`
            <strong>Gempa Bumi</strong><br>
            Latitude: ${lat.toFixed(4)}<br>
            Longitude: ${lng.toFixed(4)}<br>
            Kedalaman: ${depth} km<br>
            Magnitudo: ${magnitude}
        `).openPopup();
    }
    
    function classifyCluster(lat, lng, depth, magnitude) {
        // Mempersiapkan data untuk klasifikasi
        const data = {
            latitude: lat,
            longitude: lng,
            depth: depth,
            magnitude: magnitude
        };
        
        // Mengirimkan request
        fetch('/api/predict-cluster', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            // Menampilkan hasil klasifikasi
            displayResult(result, data);
            
            // Update marker dengan warna klaster
            if (userMarker) {
                map.removeLayer(userMarker);
                
                const clusterColor = clusterColors[result.predicted_cluster];
                
                userMarker = L.circleMarker([lat, lng], {
                    radius: getMarkerSize(magnitude),
                    fillColor: clusterColor,
                    color: getDepthColor(depth),
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(map);
                
                userMarker.bindPopup(`
                    <strong>Gempa Bumi</strong><br>
                    Latitude: ${lat.toFixed(4)}<br>
                    Longitude: ${lng.toFixed(4)}<br>
                    Kedalaman: ${depth} km<br>
                    Magnitudo: ${magnitude}<br>
                    <strong>Cluster: ${result.predicted_cluster} (${clusterRiskLevels[result.predicted_cluster]})</strong>
                `).openPopup();
            }
        })
        .catch(error => {
            console.error('Error classifying cluster:', error);
            alert('Gagal melakukan klasifikasi klaster. Silakan coba lagi.');
        });
    }
    
    function displayResult(result, data) {
        const resultCard = document.getElementById('resultCard');
        resultCard.style.display = 'block';
        
        // Update cluster badge
        const clusterBadge = document.getElementById('clusterBadge');
        const clusterIndex = result.predicted_cluster;
        clusterBadge.textContent = `Cluster ${clusterIndex}: ${clusterRiskLevels[clusterIndex]}`;
        clusterBadge.style.backgroundColor = clusterColors[clusterIndex];
        
        // Update ringkasan input
        const inputSummary = document.getElementById('inputSummary');
        inputSummary.innerHTML = `
            <li>Latitude: ${data.latitude.toFixed(4)}</li>
            <li>Longitude: ${data.longitude.toFixed(4)}</li>
            <li>Kedalaman: ${data.depth} km</li>
            <li>Magnitudo: ${data.magnitude}</li>
        `;
        
        // Update hasil text klaster
        const clusterResult = document.getElementById('clusterResult');
        clusterResult.innerHTML = `
            Data gempa termasuk dalam <strong>Cluster ${clusterIndex} (${clusterRiskLevels[clusterIndex]})</strong>.
        `;
    }
    
    // Utility functions
    function normalize(value, min, max) {
        return (value - min) / (max - min);
    }
    
    function denormalize(normalizedValue, min, max) {
        return normalizedValue * (max - min) + min;
    }
    
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
    
    function getDepthColor(depth) {
        const dep = parseFloat(depth);
        if (dep <= 50) return '#ff0000';
        if (dep <= 100) return '#ff9900';
        if (dep <= 250) return '#ffff00';
        if (dep <= 600) return '#00cc00';
        return '#0000ff';
    }
});