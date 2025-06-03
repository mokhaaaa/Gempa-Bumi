import numpy as np
import json
from pathlib import Path

def euclidean_distance(x, y):
    return np.sqrt(np.sum((x - y) ** 2))

def normalize(value, min_val, max_val):
    """Normalize a value to the range [0, 1]"""
    return (value - min_val) / (max_val - min_val)

def denormalize(norm_value, min_val, max_val):
    """Convert a normalized value back to its original scale"""
    return norm_value * (max_val - min_val) + min_val

def predict_cluster(data_point, centroids):
    """
    Predict which cluster a new data point belongs to based on depth and magnitude
    
    Parameters:
    -----------
    data_point : dict
        Data point with normalized 'depth' and 'magnitude' values
    centroids : list
        List of centroids with depth and magnitude values
        
    Returns:
    --------
    dict
        Prediction result with cluster and distances
    """
    # Menghitung jarak ke tiap centroid (Menggunakan depth dan magnitude)
    distances = []
    for centroid in centroids:
        point_vector = np.array([data_point['depth'], data_point['magnitude']])
        centroid_vector = np.array([centroid['depth'], centroid['magnitude']])
        distance = euclidean_distance(point_vector, centroid_vector)
        distances.append(distance)
    
    # Menemukan centroid terdekat
    predicted_cluster = np.argmin(distances)
    min_distance = distances[predicted_cluster]
    
    return {
        'predicted_cluster': int(predicted_cluster),
        'distance': float(min_distance),
        'distances': [float(d) for d in distances]
    }

def run_clustering(data, n_clusters=4):
    """
    This function is used for the simulation endpoint.
    For the simulation with multiple points.
    
    Parameters:
    -----------
    data : DataFrame
        Data with 'Latitude', 'Longitude', 'Depth', 'Magnitude' columns
    n_clusters : int
        Number of clusters
        
    Returns:
    --------
    dict
        Clustering result with centroids and metrics
    """
    # Load the model data
    model_path = Path(__file__).parent.parent / 'data' / 'results' / 'iwo_gempa_bumi.json'
    with open(model_path, 'r') as f:
        model_data = json.load(f)
    
    # Normalisasi data
    normalized_data = []
    for _, row in data.iterrows():
        normalized_point = {
            'latitude': normalize(row['Latitude'], model_data['normalization']['latitude']['min'], model_data['normalization']['latitude']['max']),
            'longitude': normalize(row['Longitude'], model_data['normalization']['longitude']['min'], model_data['normalization']['longitude']['max']),
            'depth': normalize(row['Depth'], model_data['normalization']['depth']['min'], model_data['normalization']['depth']['max']),
            'magnitude': normalize(row['Magnitude'], model_data['normalization']['magnitude']['min'], model_data['normalization']['magnitude']['max'])
        }
        normalized_data.append(normalized_point)
    
    # Prediksi klaster untuk tiap data point
    predictions = []
    for point in normalized_data:
        result = predict_cluster(point, model_data['centroids'])
        predictions.append(result['predicted_cluster'])
    
    # Membuat hasil dalam format yang diharapkan
    result = {
        'centroids': model_data['centroids'],
        'clusters': predictions,
        'metrics': model_data['metrics'],
        'data_with_clusters': []
    }
    
    # Menambahkan data points dengan lael klaster
    for i, row in data.iterrows():
        result['data_with_clusters'].append({
            'Latitude': float(row['Latitude']),
            'Longitude': float(row['Longitude']),
            'Depth': float(row['Depth']),
            'Magnitude': float(row['Magnitude']),
            'Cluster': int(predictions[i])
        })
    
    return result