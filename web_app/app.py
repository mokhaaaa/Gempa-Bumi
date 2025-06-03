from flask import Flask, render_template, request, jsonify, make_response
import pandas as pd
import numpy as np
import os
import math
import requests
import json
from pathlib import Path
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Konfigurasi database MySQL - Sesuaikan dengan kredensial
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:@localhost:3307/earthquake_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Model untuk tabel earthquakes
class Earthquake(db.Model):
    __tablename__ = 'earthquakes'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(50))
    date_time = db.Column(db.DateTime)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    magnitude = db.Column(db.Float, nullable=False)
    mag_type = db.Column(db.String(20))
    depth = db.Column(db.Float, nullable=False)
    phase_count = db.Column(db.Integer)
    azimuth_gap = db.Column(db.Float)
    location = db.Column(db.String(255))
    agency = db.Column(db.String(50))
    
    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'date_time': self.date_time.strftime('%Y-%m-%d %H:%M:%S') if self.date_time else None,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'magnitude': self.magnitude,
            'mag_type': self.mag_type,
            'depth': self.depth,
            'phase_count': self.phase_count,
            'azimuth_gap': self.azimuth_gap,
            'location': self.location,
            'agency': self.agency
        }

# Model untuk tabel earthquakes_preprocessed 
class EarthquakePreprocessed(db.Model):
    __tablename__ = 'earthquakes_preprocessed'
    
    id = db.Column(db.Integer, primary_key=True)
    latitude_norm = db.Column(db.Float, nullable=False)
    longitude_norm = db.Column(db.Float, nullable=False)
    depth_norm = db.Column(db.Float, nullable=False)
    magnitude_norm = db.Column(db.Float, nullable=False)
    cluster = db.Column(db.Integer, nullable=False)
    
    earthquake = db.relationship('Earthquake', backref='preprocessed', 
    uselist=False, primaryjoin="Earthquake.id == EarthquakePreprocessed.id", foreign_keys=[id])

# Model untuk tabel earthquakes_cleaned 
class EarthquakeCleaned(db.Model):
    __tablename__ = 'earthquakes_cleaned'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(50))
    date_time = db.Column(db.DateTime)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    magnitude = db.Column(db.Float, nullable=False)
    mag_type = db.Column(db.String(20))
    depth = db.Column(db.Float, nullable=False)
    phase_count = db.Column(db.Integer)
    azimuth_gap = db.Column(db.Float)
    location = db.Column(db.String(255))
    agency = db.Column(db.String(50))
    cluster = db.Column(db.Integer, nullable=False)
    
    earthquake = db.relationship('Earthquake', backref='cleaned', 
    uselist=False, primaryjoin="Earthquake.id == EarthquakeCleaned.id", foreign_keys=[id])

# Load data preprocessed gempa bumi (jika dibutuhkan)
data_path = os.path.join('data', 'preprocessed', 'pre_processed_gempa.csv')
try:
    df = pd.read_csv(data_path)
    print(f"Successfully loaded {len(df)} earthquake records from CSV")
except Exception as e:
    print(f"Error loading data from CSV: {e}")
    df = pd.DataFrame()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/realtime')
def realtime():
    return render_template('realtime.html')

@app.route('/api/realtime-earthquakes')
def api_realtime_earthquakes():
    """API endpoint to get real-time earthquake data from BMKG"""
    try:
        # Mendapatkan data source dari request
        source = request.args.get('source', default='latest', type=str)
        
        # Memilih URL berdasarkan sumber request
        if source == 'latest':
            url = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json'
        elif source == 'mag5plus':
            url = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json'
        elif source == 'felt':
            url = 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json'
        else:
            return jsonify({"error": "Invalid source parameter"})
        
        # Mengambil data dari API JSON BMKG
        response = requests.get(url)
        
        if response.status_code != 200:
            return jsonify({"error": f"Failed to fetch data from BMKG (Status: {response.status_code})"})
        
        # Parse respons JSON 
        try:
            data = response.json()
            return jsonify(data)
        except:
            return jsonify({"error": "Invalid JSON response from BMKG"})
            
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"})

@app.route('/historical')
def historical():
    """Route for historical earthquake data page"""
    return render_template('historical.html')

@app.route('/api/historical-data')
def api_historical_data():
    """API endpoint to get historical earthquake data from database"""
    try:
        # Parse parameter pagination
        start = request.args.get('start', default=0, type=int)
        length = request.args.get('length', default=25, type=int)
        draw = request.args.get('draw', default=1, type=int)
        # Parse parameter filter
        mag_min = request.args.get('mag_min', default=None, type=float)
        mag_max = request.args.get('mag_max', default=None, type=float)
        depth_min = request.args.get('depth_min', default=None, type=float)
        depth_max = request.args.get('depth_max', default=None, type=float)
        year_min = request.args.get('year_min', default=None, type=int)
        year_max = request.args.get('year_max', default=None, type=int)
        # Buat query dasar
        query = Earthquake.query
        # Tambahkan filter
        if mag_min is not None:
            query = query.filter(Earthquake.magnitude >= mag_min)
        if mag_max is not None:
            query = query.filter(Earthquake.magnitude <= mag_max)
        if depth_min is not None:
            query = query.filter(Earthquake.depth >= depth_min)
        if depth_max is not None:
            query = query.filter(Earthquake.depth <= depth_max)
        if year_min is not None and Earthquake.date_time is not None:
            query = query.filter(db.extract('year', Earthquake.date_time) >= year_min)
        if year_max is not None and Earthquake.date_time is not None:
            query = query.filter(db.extract('year', Earthquake.date_time) <= year_max)
        # Hitung total dan jumlah yang difilter
        total_records = Earthquake.query.count()
        filtered_records = query.count()
        # Terapkan pagination dan urutan
        query = query.order_by(Earthquake.id.desc())
        earthquakes = query.offset(start).limit(length).all()
        # Format data untuk DataTables
        data = []
        for i, eq in enumerate(earthquakes):
            eq_dict = eq.to_dict()
            eq_dict['No'] = start + i + 1 
            data.append(eq_dict)
        # Respons untuk DataTables
        response = {
            'draw': int(draw),
            'recordsTotal': total_records,
            'recordsFiltered': filtered_records,
            'data': data
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"Error dalam API data historis: {str(e)}")
        return jsonify({
            'draw': int(draw),
            'recordsTotal': 0,
            'recordsFiltered': 0,
            'data': [],
            'error': str(e)
        })

@app.route('/api/download-csv')
def download_csv():
    """Download data gempa sebagai CSV dengan filtering"""
    try:
        # Parse parameter filter
        mag_min = request.args.get('mag_min', default=None, type=float)
        mag_max = request.args.get('mag_max', default=None, type=float)
        depth_min = request.args.get('depth_min', default=None, type=float)
        depth_max = request.args.get('depth_max', default=None, type=float)
        year_min = request.args.get('year_min', default=None, type=int)
        year_max = request.args.get('year_max', default=None, type=int)
        
        # Buat query dasar
        query = Earthquake.query
        
        # Tambahkan filter
        if mag_min is not None:
            query = query.filter(Earthquake.magnitude >= mag_min)
        if mag_max is not None:
            query = query.filter(Earthquake.magnitude <= mag_max)
        if depth_min is not None:
            query = query.filter(Earthquake.depth >= depth_min)
        if depth_max is not None:
            query = query.filter(Earthquake.depth <= depth_max)
        if year_min is not None and Earthquake.date_time is not None:
            query = query.filter(db.extract('year', Earthquake.date_time) >= year_min)
        if year_max is not None and Earthquake.date_time is not None:
            query = query.filter(db.extract('year', Earthquake.date_time) <= year_max)
        
        # Ambil hasil query
        earthquakes = query.all()
        
        if not earthquakes:
            return "Tidak ada data yang tersedia dengan filter yang ditentukan", 404
        
        # Konversi ke DataFrame
        data = []
        for eq in earthquakes:
            data.append(eq.to_dict())
        
        df = pd.DataFrame(data)
        
        # Buat CSV string
        csv_data = df.to_csv(index=False)
        
        # Buat respons dengan data CSV
        response = make_response(csv_data)
        response.headers["Content-Disposition"] = "attachment; filename=earthquake_data.csv"
        response.headers["Content-Type"] = "text/csv"
        
        return response
    
    except Exception as e:
        return f"Error menghasilkan CSV: {str(e)}", 500

@app.route('/clustering')
def clustering():
    """Route for earthquake clustering visualization"""
    return render_template('clustering.html')

@app.route('/api/clustered-data')
def api_clustered_data():
    """API endpoint to get clustered earthquake data for visualization"""
    try:
        # Load metrik model dari file JSON 
        json_path = os.path.join(os.path.dirname(__file__), 'data', 'results', 'klasterisasi_iwo_skripsi.json')
        with open(json_path, 'r') as file:
            model_data = json.load(file)
        
        # Mengekstrak model metrik
        metrics = {
            'sse': model_data['metrics']['sse'],
            'dbi': model_data['metrics']['dbi'],
            'silhouette': model_data['metrics']['silhouette']
        }
        
        # Mencoba untuk mendapatkan data dari database
        features = []
        
        try:
            # Mendapatkan data gempa bumi yang bersih dengan label klaster
            earthquakes = db.session.query(
                EarthquakeCleaned.latitude,
                EarthquakeCleaned.longitude,
                EarthquakeCleaned.depth,
                EarthquakeCleaned.magnitude,
                EarthquakeCleaned.cluster
            ).limit(15000).all()  # batasi ke 15.000 untuk performa
            
            # Format sebagai fitur GeoJSON
            for eq in earthquakes:
                features.append({
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [eq[1], eq[0]]  # longitude, latitude
                    },
                    'properties': {
                        'depth': eq[2],
                        'magnitude': eq[3],
                        'cluster': eq[4]
                    }
                })
                
        except Exception as e:
            print(f"Database query failed: {e}")
            
            # Kembali ke data sampel dari model JSON
            print("Using sample data from JSON file")
            
            # Menghasilkan titik data sampel untuk setiap klaster
            sample_count = 3000  # 1000 per klaster
            
            for cluster_id, stats in enumerate(model_data['cluster_stats']):
                # Mendapatkan rentang normalisasi
                lat_min = model_data['normalization']['latitude']['min']
                lat_max = model_data['normalization']['latitude']['max']
                lon_min = model_data['normalization']['longitude']['min']
                lon_max = model_data['normalization']['longitude']['max']
                depth_min = model_data['normalization']['depth']['min']
                depth_max = model_data['normalization']['depth']['max']
                mag_min = model_data['normalization']['magnitude']['min']
                mag_max = model_data['normalization']['magnitude']['max']
                
                # Menghasilkan titik sampel untuk klaster ini
                cluster_size = int(sample_count * (stats['size'] / model_data['cluster_counts']['total']))
                
                for _ in range(cluster_size):
                    # Membuat koordinat acak di seluruh Indonesia
                    lat_norm = np.random.uniform(0, 1)
                    lon_norm = np.random.uniform(0, 1)
                    
                    # Untuk depth dan magnitude, gunakan rentang klaster spesifik
                    depth_norm = np.random.uniform(
                        stats['depth']['min'],
                        stats['depth']['max']
                    )
                    mag_norm = np.random.uniform(
                        stats['magnitude']['min'],
                        stats['magnitude']['max']
                    )
                    
                    # Denormalisasi values
                    latitude = lat_norm * (lat_max - lat_min) + lat_min
                    longitude = lon_norm * (lon_max - lon_min) + lon_min
                    depth = depth_norm * (depth_max - depth_min) + depth_min
                    magnitude = mag_norm * (mag_max - mag_min) + mag_min
                    
                    # Menambahkan atribut
                    features.append({
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [longitude, latitude]
                        },
                        'properties': {
                            'depth': depth,
                            'magnitude': magnitude,
                            'cluster': cluster_id
                        }
                    })
        
        # Menghitung atau mendapatkan centroid
        centroids = []
        statistics = []
        
        for cluster_id in range(4):  
            # Mendapatkan semua poin untuk klaster ini
            cluster_points = [f for f in features 
                             if f['properties']['cluster'] == cluster_id]
            
            if cluster_points:
                # Menghitung lokasi centroid
                lat_sum = sum(p['geometry']['coordinates'][1] for p in cluster_points)
                lon_sum = sum(p['geometry']['coordinates'][0] for p in cluster_points)
                lat_avg = lat_sum / len(cluster_points)
                lon_avg = lon_sum / len(cluster_points)
                
                # Menambahkan ke centroids
                centroids.append({
                    'latitude': lat_avg,
                    'longitude': lon_avg
                })
                
                # Menghitung statistik
                depths = [p['properties']['depth'] for p in cluster_points]
                magnitudes = [p['properties']['magnitude'] for p in cluster_points]
                
                statistics.append({
                    'cluster': cluster_id,
                    'size': len(cluster_points),
                    'size_percent': (len(cluster_points) / len(features)) * 100,
                    'depth': {
                        'min': min(depths),
                        'max': max(depths),
                        'mean': sum(depths) / len(depths)
                    },
                    'magnitude': {
                        'min': min(magnitudes),
                        'max': max(magnitudes),
                        'mean': sum(magnitudes) / len(magnitudes)
                    }
                })
            else:
                # Gunakan data dari model JSON jika tidak ada poin untuk klaster ini
                stats = model_data['cluster_stats'][cluster_id]
                centroids.append({
                    'latitude': stats['latitude']['mean'],
                    'longitude': stats['longitude']['mean']
                })
                
                # Denormaliasi values
                depth_min = model_data['normalization']['depth']['min']
                depth_max = model_data['normalization']['depth']['max']
                mag_min = model_data['normalization']['magnitude']['min']
                mag_max = model_data['normalization']['magnitude']['max']
                
                statistics.append({
                    'cluster': cluster_id,
                    'size': stats['size'],
                    'size_percent': stats['size_percent'],
                    'depth': {
                        'min': stats['depth']['min'] * (depth_max - depth_min) + depth_min,
                        'max': stats['depth']['max'] * (depth_max - depth_min) + depth_min,
                        'mean': stats['depth']['mean'] * (depth_max - depth_min) + depth_min
                    },
                    'magnitude': {
                        'min': stats['magnitude']['min'] * (mag_max - mag_min) + mag_min,
                        'max': stats['magnitude']['max'] * (mag_max - mag_min) + mag_min,
                        'mean': stats['magnitude']['mean'] * (mag_max - mag_min) + mag_min
                    }
                })
        
        # Menghasilkan data heatmap untuk visualisasi yang lebih baik
        heatmap_data = generate_heatmap_data(features)
        
        # Menambahkan statistik set data lengkap dari JSON
        fullDatasetStats = []
        for i, stats in enumerate(model_data['cluster_stats']):
            # Denormalisi values
            depth_min = model_data['normalization']['depth']['min']
            depth_max = model_data['normalization']['depth']['max']
            mag_min = model_data['normalization']['magnitude']['min']
            mag_max = model_data['normalization']['magnitude']['max']
            
            # Menambahkan statistik yang tepat dengan jumlah yang lengkap
            fullDatasetStats.append({
                'cluster': i,
                'level': clusterRiskLevels[i],
                'size': stats['size'],
                'percent': stats['size_percent'],
                'magnitude': {
                    'min': stats['magnitude']['min'] * (mag_max - mag_min) + mag_min,
                    'max': stats['magnitude']['max'] * (mag_max - mag_min) + mag_min,
                    'mean': stats['magnitude']['mean'] * (mag_max - mag_min) + mag_min
                },
                'depth': {
                    'min': stats['depth']['min'] * (depth_max - depth_min) + depth_min,
                    'max': stats['depth']['max'] * (depth_max - depth_min) + depth_min,
                    'mean': stats['depth']['mean'] * (depth_max - depth_min) + depth_min
                }
            })
        
        # Mengembalikan respons secara penuh
        return jsonify({
            'features': features,
            'centroids': centroids,
            'statistics': statistics,
            'fullDatasetStats': fullDatasetStats,
            'metrics': metrics,
            'heatmap': heatmap_data
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)})

def generate_heatmap_data(features):
    """Generate heatmap data from earthquake features"""
    # Kelompokkan melalui grid cells
    grid_size = 0.5  
    grid = {}
    
    for feature in features:
        lat = feature['geometry']['coordinates'][1]
        lon = feature['geometry']['coordinates'][0]
        cluster = feature['properties']['cluster']
        
        # Penghitungan grid cell
        lat_grid = math.floor(lat / grid_size) * grid_size
        lon_grid = math.floor(lon / grid_size) * grid_size
        
        cell_key = f"{lat_grid},{lon_grid}"
        
        if cell_key not in grid:
            grid[cell_key] = {
                'lat': lat_grid + grid_size/2,
                'lon': lon_grid + grid_size/2,
                'count': 0,
                'clusters': [0, 0, 0, 0]  # Count for each cluster
            }
        
        grid[cell_key]['count'] += 1
        grid[cell_key]['clusters'][cluster] += 1
    
    # konversi grid ke data heatmap
    heatmap_data = []
    
    for _, cell in grid.items():
        # Hanya menyertakan sel dengan titik data yang cukup
        if cell['count'] >= 3:
            # Menentukan klaster yang dominan
            dominant_cluster = np.argmax(cell['clusters'])
            cluster_strength = cell['clusters'][dominant_cluster] / cell['count']
            
            heatmap_data.append({
                'lat': cell['lat'],
                'lon': cell['lon'],
                'count': cell['count'],
                'dominant_cluster': int(dominant_cluster),
                'cluster_strength': float(cluster_strength)
            })
    
    return heatmap_data

# Label tingkat risiko
clusterRiskLevels = ['Kurang Rawan', 'Sangat Rawan', 'Cukup Rawan', 'Rawan']

@app.route('/simulation')
def simulation():
    """Route for earthquake simulation page"""
    return render_template('simulation.html')

@app.route('/api/simulation-model')
def api_simulation_model():
    """API endpoint to get model data for simulation"""
    try:
        
        model_path = Path(__file__).parent / 'data' / 'results' / 'klasterisasi_iwo_skripsi.json'
        with open(model_path, 'r') as f:
            model_data = json.load(f)
        
        return jsonify(model_data)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/predict-cluster', methods=['POST'])
def api_predict_cluster():
    """API endpoint to predict cluster for a single earthquake data point"""
    if request.method != 'POST':
        return jsonify({"error": "Method not allowed"}), 405
    
    try:
        # Mendapatkan data dari request
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"})
        
        # Validasi kolom yang wajib diisi
        required_fields = ['latitude', 'longitude', 'depth', 'magnitude']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"})
        
        # Load model data
        model_path = Path(__file__).parent / 'data' / 'results' / 'klasterisasi_iwo_skripsi.json'
        with open(model_path, 'r') as f:
            model_data = json.load(f)
        
        # Normalisasi input data
        normalized_data = {
            'latitude': normalize(data['latitude'], model_data['normalization']['latitude']['min'], model_data['normalization']['latitude']['max']),
            'longitude': normalize(data['longitude'], model_data['normalization']['longitude']['min'], model_data['normalization']['longitude']['max']),
            'depth': normalize(data['depth'], model_data['normalization']['depth']['min'], model_data['normalization']['depth']['max']),
            'magnitude': normalize(data['magnitude'], model_data['normalization']['magnitude']['min'], model_data['normalization']['magnitude']['max'])
        }
        
        # Memprediksi klaster menggunakan model.iwo_clustering
        from models.iwo_clustering import predict_cluster
        result = predict_cluster(normalized_data, model_data['centroids'])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)})

# Utility function untuk normalisasi
def normalize(value, min_val, max_val):
    """Normalize a value to the range [0, 1]"""
    return (value - min_val) / (max_val - min_val)

if __name__ == '__main__':
    app.run(debug=True)