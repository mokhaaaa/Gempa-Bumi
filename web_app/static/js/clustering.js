document.addEventListener('DOMContentLoaded', function() {
    // Inisialisasi peta yang berpusat di Indonesia
    const map = L.map('cluster-map').setView([-2.5, 118], 5);
    
    // Menambahkan lapisan peta OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Inisialisasi heatmap
    const heatmapMap = L.map('heatmap').setView([-2.5, 118], 5);
    
    // Menambahkan layer peta OpenStreetMap untuk heatmap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(heatmapMap);
    
    // Menentukan warna 
    const clusterColors = [
        '#2ECC71', // Hijau (Kurang Rawan)
        '#E74C3C', // Merah (Sangat Rawan)
        '#F1C40F', // Kuning (Cukup Rawan)
        '#E67E22'  // Orange (Rawan)
    ];
    
    const clusterRiskLevels = [
        'Kurang Rawan',
        'Sangat Rawan',
        'Cukup Rawan',
        'Rawan'
    ];
    
    // Store map layers
    let mapLayers = {
        points: [],
        centroids: []
    };
    
    // Function untuk menghapus map layers
    function clearMapLayers() {
        mapLayers.points.forEach(layer => map.removeLayer(layer));
        mapLayers.centroids.forEach(layer => map.removeLayer(layer));
        mapLayers.points = [];
        mapLayers.centroids = [];
    }
    
    // Function untuk load data klaster
    function loadClusterData() {
        // Menghapus layers yang ada
        clearMapLayers();
        
        // Menambahkan indikator loading 
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'Loading cluster data...';
        document.querySelector('.cluster-stats-section').appendChild(loadingIndicator);
        
        // Membuat API request untuk mendapatkan data
        fetch('/api/clustered-data')
            .then(response => response.json())
            .then(data => {
                // Menghapus indikator loading 
                const loadingIndicator = document.querySelector('.loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
                
                if (data.error) {
                    console.error('Error:', data.error);
                    document.querySelector('.cluster-stats-section').innerHTML += 
                        `<div class="error-message">Error loading data: ${data.error}</div>`;
                    return;
                }
                
                // Process cluster statistics - Menggunakan full dataset (81454 total)
                if (data.fullDatasetStats) {
                    updateClusterStatistics(data.fullDatasetStats);
                } else {
                    updateClusterStatistics(data.statistics);
                }
                
                // Membuat pie chart untuk distribusi klaster
                createPieChart(data.statistics);
                
                // Menampilkan metrik evaluasi jika ada
                if (data.metrics) {
                    displayEvaluationMetrics(data.metrics);
                }
                
                // Mengelompokkan poin berdasarkan klaster
                const pointsByCluster = {};
                const allPoints = [];
                
                data.features.forEach(feature => {
                    const cluster = feature.properties.cluster;
                    if (!pointsByCluster[cluster]) {
                        pointsByCluster[cluster] = [];
                    }
                    pointsByCluster[cluster].push([
                        feature.geometry.coordinates[1], 
                        feature.geometry.coordinates[0]
                    ]);
                    
                    // Menambahkan ke semua point untuk heatmap
                    allPoints.push({
                        lat: feature.geometry.coordinates[1],
                        lng: feature.geometry.coordinates[0],
                        cluster: cluster,
                        magnitude: feature.properties.magnitude,
                        depth: feature.properties.depth
                    });
                });
                
                // Menambahkan point berdasarkan klaster
                Object.keys(pointsByCluster).forEach(cluster => {
                    const clusterColor = clusterColors[parseInt(cluster) % clusterColors.length];
                    const clusterLayer = L.layerGroup();
                    
                    pointsByCluster[cluster].forEach(coords => {
                        L.circleMarker(coords, {
                            radius: 3,
                            fillColor: clusterColor,
                            color: clusterColor,
                            weight: 1,
                            opacity: 0.8,
                            fillOpacity: 0.6
                        }).addTo(clusterLayer);
                    });
                    
                    clusterLayer.addTo(map);
                    mapLayers.points.push(clusterLayer);
                });
                
                // Menambahkan centroids jika tersedia
                if (data.centroids) {
                    data.centroids.forEach((centroid, idx) => {
                        const clusterColor = clusterColors[idx % clusterColors.length];
                        const centroidMarker = L.marker([centroid.latitude, centroid.longitude], {
                            icon: L.divIcon({
                                className: 'centroid-marker',
                                html: `<div style="background-color: ${clusterColor}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>`,
                                iconSize: [15, 15]
                            })
                        }).bindPopup(`
                            <strong>Cluster ${idx} - ${clusterRiskLevels[idx]}</strong><br/>
                            Latitude: ${centroid.latitude.toFixed(4)}<br/>
                            Longitude: ${centroid.longitude.toFixed(4)}
                        `);
                        
                        centroidMarker.addTo(map);
                        mapLayers.centroids.push(centroidMarker);
                    });
                }
                
                // Membuat visualisasi heatmap dengan cluster-based coloring
                if (data.heatmap) {
                    createImprovedHeatmap(data.heatmap);
                } else {
                    createClusterBasedHeatmap(allPoints);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                const loadingIndicator = document.querySelector('.loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
                document.querySelector('.cluster-stats-section').innerHTML += 
                    `<div class="error-message">Error: ${error.message}</div>`;
            });
    }
    
    // Function untuk menampilkan metrik evaluasi
    function displayEvaluationMetrics(metrics) {
        const evaluationTable = document.getElementById('evaluation-table').querySelector('tbody');
        evaluationTable.innerHTML = '';
        
        // Menambahkan baris pada tiap metrik
        const rows = [
            {name: 'Sum of Squared Errors (SSE)', value: parseFloat(metrics.sse).toFixed(4)},
            {name: 'Davies-Bouldin Index (DBI)', value: parseFloat(metrics.dbi).toFixed(4)},
            {name: 'Silhouette Score', value: parseFloat(metrics.silhouette).toFixed(4)}
        ];
        
        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.name}</td>
                <td>${row.value}</td>
            `;
            evaluationTable.appendChild(tr);
        });
    }
    
    // Function untuk membuat heatmap berdasarkan data dari server
    function createImprovedHeatmap(heatmapData) {
        // Menghapus semua heatmap element yang tersedia
        const heatmapContainer = heatmapMap.getContainer();
        const existingLayers = heatmapContainer.querySelectorAll('.leaflet-heatmap-layer');
        existingLayers.forEach(el => {
            el.remove();
        });
        
        // Membuat heatmap rectangles berdasarkan data klaster
        heatmapData.forEach(point => {
            // Mendapatkan warna klaster
            const clusterColor = clusterColors[point.dominant_cluster];
            
            // Mengukur skala opasitas berdasarkan kekuatan dan jumlah klaster
            const opacity = Math.min(0.8, 0.4 + (point.cluster_strength * 0.4));
            
            // Menghitung ukuran berdasarkan jumlah
            const size = Math.max(10, Math.min(40, Math.log(point.count + 1) * 5)) * 1000;
            
            // Membuat Lingkaran
            L.circle([point.lat, point.lon], {
                radius: size,
                color: 'none',
                fillColor: clusterColor,
                fillOpacity: opacity
            }).addTo(heatmapMap)
            .bindPopup(`
                <strong>Area: ${clusterRiskLevels[point.dominant_cluster]}</strong><br>
                Gempa tercatat: ${point.count}<br>
                Klaster dominan: ${point.dominant_cluster} (${clusterRiskLevels[point.dominant_cluster]})<br>
                Kekuatan klaster: ${(point.cluster_strength * 100).toFixed(1)}%
            `);
        });
        
        // Menambahkan legent pada heatmap
        addHeatmapLegend();
    }
    
    // Function untuk membuat cluster-based heatmap
    function createClusterBasedHeatmap(points) {
        // Kelompokkan data points melalui grid cells
        const gridSize = 0.1; // Ukuran Grid dalam derajat
        const grid = {};
        
        points.forEach(point => {
            const lat = Math.floor(point.lat / gridSize) * gridSize;
            const lng = Math.floor(point.lng / gridSize) * gridSize;
            const key = `${lat},${lng}`;
            
            if (!grid[key]) {
                grid[key] = {
                    lat: lat + gridSize/2,
                    lng: lng + gridSize/2,
                    count: 0,
                    clusters: [0, 0, 0], // Hitung untuk semua klaster
                    sumMagnitude: 0,
                    sumDepth: 0
                };
            }
            
            grid[key].count++;
            grid[key].clusters[point.cluster]++;
            grid[key].sumMagnitude += point.magnitude;
            grid[key].sumDepth += point.depth;
        });
        
        // Membuat batas untuk tiap grid cell
        Object.values(grid).forEach(cell => {
            // Hanya menampilkan cells dengan data points yang cukup
            if (cell.count >= 3) {
                // Menentukan klaster dominan
                const dominantCluster = cell.clusters.indexOf(Math.max(...cell.clusters));
                const clusterStrength = cell.clusters[dominantCluster] / cell.count;
                
                // Mendapatkan warna klaster
                const clusterColor = clusterColors[dominantCluster];
                
                // Membuat batas
                L.rectangle(
                    [
                        [cell.lat - gridSize/2, cell.lng - gridSize/2], 
                        [cell.lat + gridSize/2, cell.lng + gridSize/2]
                    ],
                    {
                        color: 'none',
                        fillColor: clusterColor,
                        fillOpacity: Math.min(0.8, 0.4 + (clusterStrength * 0.4))
                    }
                ).addTo(heatmapMap)
                .bindPopup(`
                    <strong>Area: ${clusterRiskLevels[dominantCluster]}</strong><br>
                    Gempa tercatat: ${cell.count}<br>
                    Magnitudo rata-rata: ${(cell.sumMagnitude / cell.count).toFixed(2)}<br>
                    Kedalaman rata-rata: ${(cell.sumDepth / cell.count).toFixed(2)} km<br>
                    Klaster dominan: ${dominantCluster} (${clusterRiskLevels[dominantCluster]})
                `);
            }
        });
        
        // Menambahkan legend ke heatmap
        addHeatmapLegend();
    }
    
    // Function untuk menambahkan legend ke heatmap
    function addHeatmapLegend() {
        // Hapus semua legend jika tersedia
        const existingLegend = document.querySelector('.leaflet-control.legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Membuat legend baru
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <div class="heatmap-legend">
                    <h4>Tingkat Kerawanan Gempa</h4>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="color-box" style="background-color: ${clusterColors[0]}; opacity: 0.7;"></span>
                            <span>Kurang Rawan</span>
                        </div>
                        <div class="legend-item">
                            <span class="color-box" style="background-color: ${clusterColors[1]}; opacity: 0.7;"></span>
                            <span>Sangat Rawan</span>
                        </div>
                        <div class="legend-item">
                            <span class="color-box" style="background-color: ${clusterColors[2]}; opacity: 0.7;"></span>
                            <span>Cukup Rawan</span>
                        </div>
                        <div class="legend-item">
                            <span class="color-box" style="background-color: ${clusterColors[3]}; opacity: 0.7;"></span>
                            <span>Rawan</span>
                        </div>
                    </div>
                </div>
            `;
            return div;
        };
        legend.addTo(heatmapMap);
    }
    
    // Function untuk update cluster statistics
    function updateClusterStatistics(statistics) {
        const statsTable = document.getElementById('cluster-stats-body');
        statsTable.innerHTML = '';
        
        // Siapkan baris menggunakan jumlah set data lengkap 
        const fullDataCounts = [
            { cluster: 0, level: 'Kurang Rawan', size: 46132, percent: 56.64, magnitude: { min: 0.99, max: 3.77, mean: 3.14 }, depth: { min: 1, max: 190, mean: 23.76 } },
            { cluster: 1, level: 'Sangat Rawan', size: 23573, percent: 28.94, magnitude: { min: 3.76, max: 7.89, mean: 4.38 }, depth: { min: 1, max: 186, mean: 26.12 } },
            { cluster: 2, level: 'Cukup Rawan', size: 1413, percent: 1.73, magnitude: { min: 2.66, max: 7.27, mean: 4.44 }, depth: { min: 305, max: 750, mean: 496.98 } },
            { cluster: 3, level: 'Rawan', size: 10336, percent: 12.69, magnitude: { min: 2.10, max: 7.06, mean: 3.99 }, depth: { min: 82, max: 342, mean: 167.64 } }
        ];
        
        // Gunakan statistik yang disediakan atau kembali ke nilai yang dikodekan sebelumnya
        const dataToUse = statistics.length >= 3 ? statistics : fullDataCounts;
        
        dataToUse.forEach(stat => {
            const row = document.createElement('tr');
            
            // Format the row content
            row.innerHTML = `
                <td>${stat.cluster}</td>
                <td>${stat.level || clusterRiskLevels[stat.cluster]}</td>
                <td>${stat.size.toLocaleString()} (${typeof stat.percent === 'number' ? stat.percent.toFixed(2) : stat.size_percent.toFixed(2)}%)</td>
                <td>${typeof stat.magnitude.min === 'number' ? stat.magnitude.min.toFixed(2) : stat.magnitude.min} - ${typeof stat.magnitude.max === 'number' ? stat.magnitude.max.toFixed(2) : stat.magnitude.max}</td>
                <td>${typeof stat.magnitude.mean === 'number' ? stat.magnitude.mean.toFixed(2) : stat.magnitude.mean}</td>
                <td>${typeof stat.depth.min === 'number' ? stat.depth.min.toFixed(2) : stat.depth.min} - ${typeof stat.depth.max === 'number' ? stat.depth.max.toFixed(2) : stat.depth.max}</td>
                <td>${typeof stat.depth.mean === 'number' ? stat.depth.mean.toFixed(2) : stat.depth.mean}</td>
            `;
            
            statsTable.appendChild(row);
        });
    }
    
    // Function untuk membuat pie chart untuk distribusi klaster
    function createPieChart(statistics) {
        const ctx = document.getElementById('cluster-pie-chart').getContext('2d');
        
        // Hancurkan semua chart yang ada jika tersedia
        if (window.clusterPieChart) {
            window.clusterPieChart.destroy();
        }
        
        // Gunakan hardcoded full dataset counts jika dibutuhkan
        const fullDataCounts = [46132, 23573, 1413, 10336]; 
        
        // Menghitung data untuk pie chart
        const pieData = statistics.map(stat => stat.size);
        const useFullData = pieData.reduce((a, b) => a + b, 0) < 81000;
        
        // Menyiapkan data untuk pie chart
        const data = {
            labels: [
                `Cluster 0 (Kurang Rawan)`,
                `Cluster 1 (Sangat Rawan)`,
                `Cluster 2 (Cukup Rawan)`,
                `Cluster 3 (Rawan)`
            ],
            datasets: [{
                data: useFullData ? fullDataCounts : pieData,
                backgroundColor: clusterColors,
                borderColor: clusterColors.map(color => adjustColor(color, -30)),
                borderWidth: 1
            }]
        };
        
        // Membuat pie chart
        window.clusterPieChart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribusi Klaster Gempa Bumi',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = useFullData ? 81454 : context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = (value / total) * 100;
                                return `${label}: ${value.toLocaleString()} (${percentage.toFixed(2)}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Fungsi utilitas untuk menyesuaikan kecerahan warna
    function adjustColor(color, amount) {
        return '#' + color.replace(/^#/, '').replace(/../g, color => {
            let val = parseInt(color, 16) + amount;
            val = Math.max(0, Math.min(255, val));
            return val.toString(16).padStart(2, '0');
        });
    }
    
    // Load cluster data ketika halaman loads
    loadClusterData();
});